import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { GstDocumentSchema, documentErrors } from "@/lib/realFilms";
import RealFilmsDocument from "@/app/components/templates/invoice-pdf/RealFilmsDocument";
import { parseJsonBody } from "@/lib/server/validateRequest";
import { withPdfPage } from "./pdfPage";
export async function generatePdfService(req: NextRequest) {
    const parsed = await parseJsonBody(req, GstDocumentSchema, 8 * 1024 * 1024);
    if (!parsed.ok) return parsed.response;
        const document = parsed.data;
        const errors = documentErrors(document);
        if (errors.length)
            return NextResponse.json(
                { error: errors.join("\n") },
                { status: 400 }
            );
        try {
            const ReactDOMServer = (await import("react-dom/server")).default;
            const html = ReactDOMServer.renderToStaticMarkup(
                React.createElement(RealFilmsDocument, { document })
            );
            const pdf = await withPdfPage(async (page) => {
                await page.setContent(
                    `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`,
                    { waitUntil: "domcontentloaded" }
                );
                await page.evaluate(async () => {
                    await window.document.fonts.ready;
                    await Promise.all(
                        Array.from(window.document.images).map((img) =>
                            img.decode().catch(() => undefined)
                        )
                    );
                });
                return page.pdf({
                    format: "a4",
                    printBackground: true,
                    margin: {
                        top: "12mm",
                        right: "10mm",
                        bottom: "16mm",
                        left: "10mm",
                    },
                    displayHeaderFooter: true,
                    headerTemplate: "<span></span>",
                    footerTemplate:
                        '<div style="font-size:9px;width:100%;text-align:center;color:#607582">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
                });
            });
            return pdfResponse(pdf, false);
        } catch (error) {
            console.error("GST PDF generation error", error);
            return NextResponse.json(
                { error: "Failed to generate PDF" },
                { status: 500 }
            );
        }
}
function pdfResponse(pdf: Uint8Array, _cacheHit: boolean) {
    return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
}
