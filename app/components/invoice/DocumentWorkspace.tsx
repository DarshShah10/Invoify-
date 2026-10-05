"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import RealFilmsEditor from "./RealFilmsEditor";
import { GstDocument } from "@/lib/realFilms";

export default function DocumentWorkspace() {
    const searchParams = useSearchParams();
    const [token] = useState(() => searchParams.get("session"));
    const [document, setDocument] = useState<GstDocument | null>(null);
    const [loading, setLoading] = useState(Boolean(token));
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }
        let active = true;
        fetch(`/api/quote/session?token=${encodeURIComponent(token)}`, {
            cache: "no-store",
        })
            .then(async (response) => {
                const body = await response.json();
                if (!response.ok) throw new Error(body.error || "Quote session could not be opened");
                return body.document as GstDocument;
            })
            .then((value) => {
                if (active) setDocument(value);
            })
            .catch((reason) => {
                if (active) setError((reason as Error).message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [token]);

    if (loading)
        return <div className="p-8 text-sm text-muted-foreground">Opening quote session...</div>;
    if (error)
        return <div className="mx-auto max-w-xl p-8 text-sm text-destructive">{error}</div>;

    if (!token) return <div className="mx-auto max-w-xl p-8 text-sm">Open a Lead in Twenty and choose Create Quote to start a prefilled quotation.</div>;

    return <RealFilmsEditor initialDocument={document} sessionToken={token} />;
}
