"use client";
import ThemeSwitcher from "@/app/components/reusables/ThemeSwitcher";
export default function BaseNavbar() {
    return <header className="border-b border-border bg-background">
        <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
            <span className="text-lg font-semibold">Quote editor</span><ThemeSwitcher />
        </nav>
    </header>;
}
