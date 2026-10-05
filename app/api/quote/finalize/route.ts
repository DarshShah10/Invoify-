import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GstDocumentSchema, calculateGst, documentErrors } from "@/lib/realFilms";
import { readSession, saveSession, cookieName, withSessionLock, hash, signCallback } from "@/lib/quoteSession";
import { generatePdfService } from "@/services/invoice/server/generatePdfService";
import { parseJsonBody } from "@/lib/server/validateRequest";
export const runtime = "nodejs";
export const maxDuration = 120;
const FinalizeSchema = z.object({ token: z.string().length(43), document: GstDocumentSchema });

export async function POST(request: NextRequest) {
    const parsed = await parseJsonBody(request, FinalizeSchema, 8 * 1024 * 1024);
    if (!parsed.ok) return parsed.response;
    const input = parsed.data;
    try {
        return await withSessionLock(input.token, async () => {
            const session = await readSession(input.token);
            if (!session.owner || request.cookies.get(cookieName(input.token))?.value !== session.owner) return NextResponse.json({ error: "Session authentication required" }, { status: 401 });
            if (input.document.documentType !== "quotation") return NextResponse.json({ error: "CRM sessions can finalize quotations only" }, { status: 400 });
            const errors = documentErrors(input.document);
            if (errors.length) return NextResponse.json({ error: errors.join("\n") }, { status: 400 });
            const fingerprint = hash(JSON.stringify(input.document));
            if (session.finalized && session.finalized.fingerprint !== fingerprint) return NextResponse.json({ error: "Quote already finalized. Create a new quote to revise it." }, { status: 409 });
            if (!session.finalized) {
                const pdfResponse = await generatePdfService(new Request(request.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.document) }) as NextRequest);
                if (!pdfResponse.ok) return pdfResponse;
                const pdfBase64 = Buffer.from(await pdfResponse.arrayBuffer()).toString("base64");
                const body = JSON.stringify({ sessionToken: session.signedToken, sourceRecordId: session.claims.sourceRecordId, document: input.document, totals: calculateGst(input.document), pdfBase64 });
                const callback = await fetch(session.claims.callbackUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-Invoify-Signature": signCallback(body) }, body, signal: AbortSignal.timeout(65_000) });
                const result = await callback.json().catch(() => null);
                if (!callback.ok || result?.ok !== true || typeof result?.quoteId !== "string") return NextResponse.json({ error: result?.message || "Twenty could not save the quote. Please retry." }, { status: 502 });
                session.finalized = { fingerprint, quoteId: result.quoteId, returnUrl: session.claims.returnUrl, pdfBase64 };
                await saveSession(input.token, session);
            }
            return new NextResponse(Buffer.from(session.finalized.pdfBase64, "base64"), { headers: {
                "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${input.document.number.replace(/\//g, "-")}.pdf"`,
                "X-Twenty-Quote-Id": session.finalized.quoteId, "X-Twenty-Return-Url": session.finalized.returnUrl,
                "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
            } });
        });
    } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }); }
}
