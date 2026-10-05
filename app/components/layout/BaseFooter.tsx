export default function BaseFooter() {
    return (
        <footer className="border-t border-border">
            <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
                <span>Quote editor</span>
                <span>
                    Built on{" "}
                    <a
                        className="underline underline-offset-4"
                        href="https://github.com/al1abb/invoify"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Invoify
                    </a>
                </span>
            </div>
        </footer>
    );
}
