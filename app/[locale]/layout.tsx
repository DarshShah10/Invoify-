import BaseNavbar from "@/app/components/layout/BaseNavbar";
import BaseFooter from "@/app/components/layout/BaseFooter";
import Providers from "@/contexts/Providers";
import { Toaster } from "@/components/ui/toaster";
import { outfit } from "@/lib/fonts";
import { dirForLocale, LOCALES } from "@/lib/variables";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Quote editor", robots: { index: false, follow: false } };
export const viewport = { width: "device-width", initialScale: 1 };
export function generateStaticParams() { return LOCALES.map(({ code }) => ({ locale: code })); }
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!LOCALES.some(({ code }) => code === locale)) notFound();
    return <html lang={locale} dir={dirForLocale(locale)} suppressHydrationWarning>
        <body className={outfit.className} suppressHydrationWarning>
            <Providers dir={dirForLocale(locale)}><BaseNavbar />{children}<BaseFooter /><Toaster /></Providers>
        </body>
    </html>;
}
