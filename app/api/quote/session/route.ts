import { NextRequest, NextResponse } from "next/server";
import { issueSession, claimSession, cookieName } from "@/lib/quoteSession";
export const runtime = "nodejs";

function cors(request: NextRequest) {
    const origin = request.headers.get("origin");
    const allowed = origin === "null" || origin === process.env.TWENTY_PUBLIC_URL;
    return { ...(allowed ? { "Access-Control-Allow-Origin": origin! } : {}), "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin", "Cache-Control": "no-store" };
}
export function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: cors(request) }); }
export async function POST(request: NextRequest) {
    try {
        const text = await request.text();
        if (text.length > 8 * 1024 * 1024) throw new Error("Handoff is too large");
        const { token } = JSON.parse(text);
        if (typeof token !== "string") throw new Error("Handoff token is required");
        const reference = await issueSession(token);
        const url = new URL(process.env.INVOIFY_PUBLIC_URL || "");
        url.pathname = "/en"; url.searchParams.set("session", reference);
        return NextResponse.json({ launchUrl: url.toString() }, { headers: cors(request) });
    } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 401, headers: cors(request) }); }
}
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token") || "";
    try {
        const session = await claimSession(token, request.cookies.get(cookieName(token))?.value);
        const response = NextResponse.json({ document: session.document, returnUrl: session.claims.returnUrl }, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
        response.cookies.set(cookieName(token), session.owner!, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "strict", path: "/api/quote", maxAge: Math.max(1, Math.floor((session.claims.expiresAt - Date.now()) / 1000)) });
        return response;
    } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 401, headers: { "Cache-Control": "no-store" } }); }
}
