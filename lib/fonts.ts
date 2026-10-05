import localFont from "next/font/local";

// Bundled files keep self-hosted builds independent of Google Fonts.
export const outfit = localFont({
    src: [
        {
            path: "../node_modules/@fontsource/outfit/files/outfit-latin-400-normal.woff2",
            weight: "400",
        },
        {
            path: "../node_modules/@fontsource/outfit/files/outfit-latin-500-normal.woff2",
            weight: "500",
        },
        {
            path: "../node_modules/@fontsource/outfit/files/outfit-latin-600-normal.woff2",
            weight: "600",
        },
        {
            path: "../node_modules/@fontsource/outfit/files/outfit-latin-700-normal.woff2",
            weight: "700",
        },
    ],
    display: "swap",
    adjustFontFallback: false,
});
