// Components
import { Suspense } from "react";
import DocumentWorkspace from "@/app/components/invoice/DocumentWorkspace";


export default function Home() {
    return (
        <>
            <main className="w-full">
                    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading workspace...</div>}>
                        <DocumentWorkspace />
                    </Suspense>
            </main>
        </>
    );
}
