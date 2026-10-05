
/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "standalone",
    async headers() {
        return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Content-Type-Options", value: "nosniff" }] }];
    },
    distDir: process.env.RF_NEXT_DIST_DIR || ".next-realfilms",
    serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
    webpack: (config) => {
        config.module.rules.push({
            test: /\.map$/,
            use: "ignore-loader",
        });
        return config;
    },
};

// Bundle analyzer
const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: process.env.ANALYZE === "true",
});

module.exports = withBundleAnalyzer(nextConfig);
