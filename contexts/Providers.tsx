"use client";
import React from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { ThemeProvider } from "@/contexts/ThemeProvider";
export default function Providers({ children, dir }: { children: React.ReactNode; dir: "rtl" | "ltr" }) {
    return <DirectionProvider dir={dir}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
        </ThemeProvider>
    </DirectionProvider>;
}
