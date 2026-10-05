import { createHash, createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, open, unlink, stat, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CompanySchema, PartySchema, GstItemSchema, GstDocument, newDocument, financialYear } from "./realFilms";

const ClaimsSchema = z.object({
    version: z.literal(2), sessionId: z.string().uuid(), workspaceId: z.string().uuid(),
    principalId: z.string().min(1), sourceRecordId: z.string().uuid(), sourceObject: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
    callbackUrl: z.string().url(), returnUrl: z.string().url(), expiresAt: z.number().int(),
    prefill: z.object({ customer: PartySchema, items: z.array(GstItemSchema).max(500), reference: z.string(), notes: z.string(), sourceCompanyId: z.string().uuid().nullable().optional(), sourcePersonId: z.string().uuid().nullable().optional() }),
});
export type Claims = z.infer<typeof ClaimsSchema>;
export type StoredSession = {
    claims: Claims; signedToken: string; document: GstDocument; owner?: string;
    finalized?: { fingerprint: string; quoteId: string; returnUrl: string; pdfBase64: string };
};
export function secret() {
    const value = process.env.INVOIFY_HANDOFF_SECRET;
    if (!value || value.length < 32) throw new Error("Configure INVOIFY_HANDOFF_SECRET (32+ characters)");
    return value;
}
function root() {
    if (!process.env.INVOIFY_SESSION_STORAGE_DIR) throw new Error("Configure a durable INVOIFY_SESSION_STORAGE_DIR");
    return path.resolve(process.env.INVOIFY_SESSION_STORAGE_DIR);
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const signCallback = (body: string) => createHmac("sha256", secret()).update(body).digest("hex");
export function verifyHandoff(token: string) {
    const [body, signature, extra] = token.split(".");
    const expected = createHmac("sha256", secret()).update(body || "").digest("base64url");
    if (!body || extra || signature?.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Invalid handoff signature");
    const claims = ClaimsSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString()));
    if (claims.expiresAt <= Date.now() || claims.expiresAt > Date.now() + 65 * 60 * 1000) throw new Error("Quote session expired or invalid");
    if (claims.callbackUrl !== process.env.TWENTY_CALLBACK_URL) throw new Error("Callback URL does not match this deployment");
    if (new URL(claims.returnUrl).origin !== new URL(process.env.TWENTY_PUBLIC_URL || "").origin) throw new Error("CRM origin does not match this deployment");
    return claims;
}
export async function withSessionLock<T>(key: string, action: () => Promise<T>): Promise<T> {
    await mkdir(root(), { recursive: true, mode: 0o700 });
    const lockPath = path.join(root(), `${hash(key)}.lock`);
    let handle;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { handle = await open(lockPath, "wx", 0o600); break; }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
            const info = await stat(lockPath).catch(() => null);
            if (info && Date.now() - info.mtimeMs > 5 * 60 * 1000) await unlink(lockPath).catch(() => undefined);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    if (!handle) throw new Error("Quote is being processed. Please retry shortly.");
    try { return await action(); }
    finally { await handle.close(); await unlink(lockPath).catch(() => undefined); }
}
function sessionPath(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Invalid session reference");
    return path.join(root(), `${hash(token)}.json`);
}
export async function readSession(token: string): Promise<StoredSession> {
    const stored = JSON.parse(await readFile(sessionPath(token), "utf8")) as StoredSession;
    if (stored.claims.expiresAt <= Date.now()) throw new Error("Quote session has expired. Create a new quote from Twenty.");
    return stored;
}
export async function saveSession(token: string, session: StoredSession) {
    await atomicWrite(sessionPath(token), JSON.stringify(session));
}
async function atomicWrite(destination: string, value: string) {
    const temporary = `${destination}.${randomBytes(8).toString("hex")}.tmp`;
    try {
        await writeFile(temporary, value, { mode: 0o600, flag: "wx" });
        await rename(temporary, destination);
    } finally { await unlink(temporary).catch(() => undefined); }
}
export const cookieName = (token: string) => `invoify-${hash(token).slice(0, 16)}`;
export async function issueSession(signedToken: string) {
    const claims = verifyHandoff(signedToken);
    const token = createHmac("sha256", secret()).update(`editor:${claims.sessionId}`).digest("base64url");
    await withSessionLock(token, async () => {
        const existing = await readSession(token).catch(() => null);
        if (existing) {
            if (existing.owner || existing.finalized) throw new Error("This handoff has already been redeemed");
            return;
        }
        const profilePath = process.env.INVOIFY_COMPANY_PROFILE_PATH;
        if (!profilePath) throw new Error("Configure INVOIFY_COMPANY_PROFILE_PATH");
        const company = CompanySchema.parse(JSON.parse(await readFile(path.resolve(profilePath), "utf8")));
        const document = newDocument(company, [], "quotation");
        const prefix = process.env.INVOIFY_NUMBER_PREFIX;
        if (!prefix || !/^[A-Za-z0-9/-]{1,5}$/.test(prefix)) throw new Error("Configure INVOIFY_NUMBER_PREFIX (1-5 characters)");
        const counterKey = `number:${claims.workspaceId}:${financialYear(document.date)}`;
        document.number = await withSessionLock(counterKey, async () => {
            const counterPath = path.join(root(), `${hash(counterKey)}.counter`);
            const previous = Number(await readFile(counterPath, "utf8").catch(() => process.env.INVOIFY_NUMBER_START || "0"));
            const next = previous + 1;
            if (!Number.isSafeInteger(next) || next < 1) throw new Error("Invalid quote numbering counter");
            await atomicWrite(counterPath, String(next));
            return `${prefix}/${financialYear(document.date)}/${String(next).padStart(4, "0")}`;
        });
        Object.assign(document, claims.prefill, { placeOfSupply: claims.prefill.customer.state });
        await saveSession(token, { claims, signedToken, document });
    });
    return token;
}
export async function claimSession(token: string, owner?: string) {
    return withSessionLock(token, async () => {
        const session = await readSession(token);
        if (session.owner && session.owner !== owner) throw new Error("This session was already opened in another browser");
        if (session.finalized) throw new Error("Quote already finalized. Return to Twenty to create another quote.");
        if (!session.owner) { session.owner = randomBytes(32).toString("hex"); await saveSession(token, session); }
        return session;
    });
}
