"use client";
import React, { useEffect, useRef, useState } from "react";
import {
    Company,
    CompanySchema,
    Party,
    GstDocument,
    GstItem,
    GST_TEMPLATES,
    STATES,
    calculateGst,
    defaultCompany,
    documentErrors,
    money,
    newDocument,
    newItem,
} from "@/lib/realFilms";
import RealFilmsDocument from "@/app/components/templates/invoice-pdf/RealFilmsDocument";

function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const inputClass =
    "min-w-0 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
function Field({
    label,
    value,
    onChange,
    type = "text",
    multiline = false,
}: {
    label: string;
    value: string | number;
    onChange: (v: string) => void;
    type?: string;
    multiline?: boolean;
}) {
    const focused = useRef(false);
    const [numberText, setNumberText] = useState(String(value));
    useEffect(() => {
        if (!focused.current) setNumberText(String(value));
    }, [value]);
    return (
        <label className="block text-xs font-medium">
            <span className="mb-1 block text-muted-foreground">{label}</span>
            {multiline ? (
                <textarea
                    aria-label={label}
                    className={inputClass}
                    rows={3}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
            ) : (
                <input
                    aria-label={label}
                    className={inputClass}
                    type={type === "number" ? "text" : type}
                    inputMode={type === "number" ? "decimal" : undefined}
                    step={type === "number" ? "any" : undefined}
                    min={type === "number" ? 0 : undefined}
                    value={type === "number" ? numberText : value}
                    onFocus={() => {
                        focused.current = true;
                    }}
                    onBlur={() => {
                        focused.current = false;
                        if (type === "number") setNumberText(String(value));
                    }}
                    onChange={(e) => {
                        const v = e.target.value;
                        if (type === "number") {
                            if (!/^\d*(\.\d*)?$/.test(v)) return;
                            setNumberText(v);
                        }
                        onChange(v);
                    }}
                />
            )}
        </label>
    );
}
function Select({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: readonly (readonly [string, string])[];
}) {
    return (
        <label className="block text-xs font-medium">
            <span className="mb-1 block text-muted-foreground">{label}</span>
            <select
                aria-label={label}
                className={inputClass}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map(([v, t]) => (
                    <option key={v} value={v}>
                        {t}
                    </option>
                ))}
            </select>
        </label>
    );
}
function Button({
    children,
    onClick,
    disabled = false,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
            {children}
        </button>
    );
}
const stateOptions = [["", "Select state"], ...STATES] as const;
function PartyFields({
    title,
    party,
    onChange,
}: {
    title: string;
    party: Party;
    onChange: (p: Party) => void;
}) {
    return (
        <section className="space-y-3">
            <h3 className="font-semibold">{title}</h3>
            <Field
                label={`${title} name`}
                value={party.name}
                onChange={(v) => onChange({ ...party, name: v })}
            />
            <Field
                label={`${title} address`}
                value={party.address}
                multiline
                onChange={(v) => onChange({ ...party, address: v })}
            />
            <div className="grid grid-cols-2 gap-3">
                <Field
                    label="PIN code"
                    value={party.pin}
                    onChange={(v) => onChange({ ...party, pin: v })}
                />
                <Select
                    label="State / territory"
                    value={party.state}
                    options={stateOptions}
                    onChange={(v) => onChange({ ...party, state: v })}
                />
                <Field
                    label="GSTIN (optional)"
                    value={party.gstin}
                    onChange={(v) =>
                        onChange({
                            ...party,
                            gstin: v.toUpperCase(),
                            state: STATES.some((s) => s[0] === v.slice(0, 2))
                                ? v.slice(0, 2)
                                : party.state,
                        })
                    }
                />
                <Field
                    label="Phone (optional)"
                    value={party.phone}
                    onChange={(v) => onChange({ ...party, phone: v })}
                />
            </div>
            <Field
                label="Email (optional)"
                value={party.email}
                onChange={(v) => onChange({ ...party, email: v })}
            />
        </section>
    );
}

function ScaledPreview({ document }: { document: GstDocument }) {
    const container = useRef<HTMLDivElement>(null),
        paper = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ scale: 1, height: 1000 });
    useEffect(() => {
        const measure = () => {
            if (container.current && paper.current) {
                const scale = Math.min(container.current.clientWidth / 794, 1);
                setSize({ scale, height: paper.current.scrollHeight * scale });
            }
        };
        const observer = new ResizeObserver(measure);
        if (container.current) observer.observe(container.current);
        if (paper.current) observer.observe(paper.current);
        measure();
        return () => observer.disconnect();
    }, []);
    return (
        <div
            ref={container}
            className="relative w-full overflow-hidden"
            style={{ height: size.height }}
            data-testid="document-preview"
        >
            <div
                ref={paper}
                style={{
                    width: 794,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    transform: `scale(${size.scale})`,
                    transformOrigin: "top left",
                }}
            >
                <RealFilmsDocument document={document} />
            </div>
        </div>
    );
}
const STEPS = ["Customer & document", "Items", "Review & download"];
export default function RealFilmsEditor({
    initialDocument = null,
    sessionToken = null,
}: {
    initialDocument?: GstDocument | null;
    sessionToken?: string | null;
}) {
    const [company, setCompany] = useState<Company>(defaultCompany),
        [profile, setProfile] = useState<Company>(defaultCompany);
    const [doc, setDoc] = useState<GstDocument | null>(null),
        [step, setStep] = useState(0),
        [settings, setSettings] = useState(false),
        [message, setMessage] = useState(""),
        [busy, setBusy] = useState(false);
    const [activeItem, setActiveItem] = useState(0);
    const [returnUrl, setReturnUrl] = useState("");
    const [finalized, setFinalized] = useState(false);
    const inFlight = useRef(false);
    const revision = useRef(0),
        top = useRef<HTMLFieldSetElement>(null);

    useEffect(() => {
        if (!initialDocument) return;
        revision.current++;
        setCompany(initialDocument.company);
        setProfile(initialDocument.company);
        setDoc(structuredClone(initialDocument));
    }, [initialDocument]);
    function update(p: Partial<GstDocument>) {
        revision.current++;
        setDoc((d) => (d ? { ...d, ...p } : d));
        setMessage("");
    }
    function updateItem(index: number, p: Partial<GstItem>) {
        if (doc)
            update({
                items: doc.items.map((i, n) =>
                    n === index ? { ...i, ...p } : i
                ),
            });
    }
    function go(index: number) {
        setStep(index);
        setMessage("");
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    async function saveCompany() {
        try {
            const p = CompanySchema.parse(profile);
            const errors = documentErrors(newDocument(p, [], "invoice")).filter(
                (e) =>
                    e.startsWith("Company") ||
                    e.startsWith("Complete the company")
            );
            if (errors.length) throw new Error(errors.join("\n"));
            setCompany(p);
            update({ company: structuredClone(p), terms: p.terms });
            setSettings(false);
            setMessage(
                "Company settings applied to this quote."
            );
        } catch (e) {
            setMessage((e as Error).message);
        }
    }
    function upload(file: File | undefined, key: "logo" | "signature") {
        if (!file) return;
        if (
            file.size > 2_000_000 ||
            !["image/png", "image/jpeg", "image/webp"].includes(file.type)
        ) {
            setMessage("Choose a PNG, JPEG or WebP under 2 MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () =>
            setProfile((p) => ({ ...p, [key]: String(reader.result) }));
        reader.readAsDataURL(file);
    }
    async function generate() {
        if (!doc || inFlight.current || finalized) return;
        const errors = documentErrors(doc);
        if (errors.length) {
            setMessage(errors.join("\n"));
            return;
        }
        inFlight.current = true;
        setBusy(true);
        setMessage("");
        const version = revision.current;
        try {
            const response = await fetch(
                sessionToken ? "/api/quote/finalize" : "/api/invoice/generate",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(
                        sessionToken ? { token: sessionToken, document: doc } : doc
                    ),
                }
            );
            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    error.error ||
                        "PDF could not be generated. Please try again."
                );
            }
            const pdf = await response.blob();
            if (version !== revision.current) {
                setMessage(
                    "The document changed. Download again to use your latest edits."
                );
                return;
            }
            download(pdf, `${doc.number.replace(/\//g, "-")}.pdf`);
            setReturnUrl(response.headers.get("X-Twenty-Return-Url") || "");
            setFinalized(true);
            setMessage("Quote saved in Twenty. Your PDF has been downloaded.");
        } catch (e) {
            setMessage((e as Error).message);
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }
    if (!doc)
        return (
            <div className="p-8 text-sm text-muted-foreground">
                Loading document...
            </div>
        );
    let totals: ReturnType<typeof calculateGst> | null = null;
    try {
        totals = calculateGst(doc);
    } catch {}
    const allErrors = documentErrors(doc);
    return (
        <fieldset
            disabled={busy || finalized}
            ref={top}
            className="mx-auto max-w-[1440px] scroll-mt-20 px-4 py-6 sm:px-6"
        >
            <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Create a quote
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Fill in the details, review your GST, and download a
                        PDF.
                    </p>
                </div>
                <button
                    type="button"
                    className="shrink-0 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                        setProfile(company);
                        setSettings(!settings);
                    }}
                >
                    Company settings
                </button>
            </div>
            {settings && (
                <section className="mb-6 rounded-xl border bg-card p-4 sm:p-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold">
                            Company settings
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Company details for this quote. Finalized details are saved as a snapshot in Twenty.
                        </p>
                    </div>
                    <div className="grid gap-6 lg:grid-cols-3">
                        <PartyFields
                            title="Company"
                            party={profile}
                            onChange={(p) => setProfile({ ...profile, ...p })}
                        />
                        <div className="space-y-3">
                            {(
                                [
                                    ["pan", "PAN"],
                                    ["udyam", "Udyam number"],
                                    [
                                        "officeAddress",
                                        "Alternative office address",
                                    ],
                                    ["officeEmail", "Office email"],
                                    ["officePhone", "Office phone"],
                                    ["jurisdiction", "Jurisdiction"],
                                ] as const
                            ).map(([key, label]) => (
                                <Field
                                    key={key}
                                    label={label}
                                    value={profile[key]}
                                    multiline={key === "officeAddress"}
                                    onChange={(v) =>
                                        setProfile({
                                            ...profile,
                                            [key]: ["pan"].includes(key)
                                                ? v.toUpperCase()
                                                : v,
                                        })
                                    }
                                />
                            ))}
                            {(["logo", "signature"] as const).map((key) => (
                                <label className="block text-sm" key={key}>
                                    {key === "logo" ? "Logo" : "Signature"}
                                    <input
                                        className="mt-1 w-full text-xs"
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        onChange={(e) =>
                                            upload(e.target.files?.[0], key)
                                        }
                                    />
                                    {profile[key] && (
                                        <img
                                            src={profile[key]}
                                            alt={key}
                                            className="my-2 max-h-16"
                                        />
                                    )}
                                </label>
                            ))}
                        </div>
                        <div className="space-y-3">
                            {(
                                [
                                    ["bankName", "Bank name"],
                                    ["accountName", "Account name"],
                                    ["accountNumber", "Account number"],
                                    ["branch", "Branch"],
                                    ["ifsc", "IFSC"],
                                    ["terms", "Default payment terms"],
                                    ["declaration", "Declaration"],
                                ] as const
                            ).map(([key, label]) => (
                                <Field
                                    key={key}
                                    label={label}
                                    value={profile[key]}
                                    multiline={
                                        key === "terms" || key === "declaration"
                                    }
                                    onChange={(v) =>
                                        setProfile({
                                            ...profile,
                                            [key]:
                                                key === "ifsc"
                                                    ? v.toUpperCase()
                                                    : v,
                                        })
                                    }
                                />
                            ))}
                        </div>
                    </div>
                    <div className="mt-5 flex gap-3">
                        <Button onClick={() => void saveCompany()}>
                            Apply company settings
                        </Button>
                        <button
                            type="button"
                            className="text-sm text-muted-foreground"
                            onClick={() => setSettings(false)}
                        >
                            Cancel
                        </button>
                    </div>
                </section>
            )}
            <nav
                aria-label="Document steps"
                className="mb-6 grid grid-cols-3 gap-2"
            >
                {STEPS.map((label, index) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() => go(index)}
                        aria-current={step === index ? "step" : undefined}
                        className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs sm:flex-row sm:text-left sm:text-sm ${step === index ? "border-primary bg-primary/5 text-primary" : "bg-card text-muted-foreground"}`}
                    >
                        <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-semibold ${step === index ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                        >
                            {index + 1}
                        </span>
                        <span className="hidden min-w-0 sm:inline">
                            {label}
                        </span>
                        <span className="sm:hidden">
                            {["Customer", "Items", "Review"][index]}
                        </span>
                    </button>
                ))}
            </nav>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
                <div className="min-w-0 rounded-2xl border bg-card p-4 sm:p-6">
                    {step === 0 && (
                        <div className="space-y-6">
                            <section>
                                <h2 className="mb-4 text-lg font-semibold">
                                    Document details
                                </h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Document date"
                                        type="date"
                                        value={doc.date}
                                        onChange={(v) => {
                                            if (v) update({ date: v });
                                        }}
                                    />
                                    <Field
                                        label="Document number"
                                        value={doc.number}
                                        onChange={(v) => update({ number: v })}
                                    />
                                    <Field
                                        label={
                                            doc.documentType === "quotation"
                                                ? "Valid until (optional)"
                                                : "Due date (optional)"
                                        }
                                        type="date"
                                        value={
                                            doc.documentType === "quotation"
                                                ? doc.validUntil
                                                : doc.dueDate
                                        }
                                        onChange={(v) =>
                                            update(
                                                doc.documentType === "quotation"
                                                    ? { validUntil: v }
                                                    : { dueDate: v }
                                            )
                                        }
                                    />
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    A number is reserved for this quote. You can edit it before finalizing; Twenty prevents duplicate numbers.
                                </p>
                            </section>
                            <div className="border-t pt-5">
                                <PartyFields
                                    title="Customer"
                                    party={doc.customer}
                                    onChange={(customer) =>
                                        update({
                                            customer,
                                            placeOfSupply:
                                                doc.placeOfSupply ||
                                                customer.state,
                                        })
                                    }
                                />
                            </div>
                            <Select
                                label="Place of supply"
                                value={doc.placeOfSupply}
                                options={stateOptions}
                                onChange={(v) => update({ placeOfSupply: v })}
                            />
                            <p className="-mt-3 text-xs text-muted-foreground">
                                Confirm where this supply takes place. This
                                determines IGST or CGST + SGST/UTGST.
                            </p>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={doc.sameShipping}
                                    onChange={(e) =>
                                        update({
                                            sameShipping: e.target.checked,
                                            shipTo: doc.sameShipping
                                                ? structuredClone(doc.customer)
                                                : doc.shipTo,
                                        })
                                    }
                                />
                                Ship to the same address
                            </label>
                            {!doc.sameShipping && (
                                <PartyFields
                                    title="Ship to"
                                    party={doc.shipTo}
                                    onChange={(shipTo) => update({ shipTo })}
                                />
                            )}
                        </div>
                    )}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Products and services
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Add each product, freight or installation
                                    with its own GST rate.
                                </p>
                            </div>
                            {doc.items.map((item, index) => (
                                <section
                                    key={item.id}
                                    className="rounded-xl border"
                                >
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-3 p-4 text-left"
                                        aria-expanded={activeItem === index}
                                        onClick={() =>
                                            setActiveItem(
                                                activeItem === index
                                                    ? -1
                                                    : index
                                            )
                                        }
                                    >
                                        <span className="min-w-0 truncate text-sm font-semibold">
                                            {index + 1}.{" "}
                                            {item.name || "New item"}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {activeItem === index
                                                ? "Collapse"
                                                : "Edit"}
                                        </span>
                                    </button>
                                    {activeItem === index && (
                                        <div className="space-y-4 border-t p-4">
                                            <Field
                                                label="Product / service"
                                                value={item.name}
                                                onChange={(v) =>
                                                    updateItem(index, {
                                                        name: v,
                                                    })
                                                }
                                            />
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <Field
                                                    label="Quantity"
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            quantity: Number(v),
                                                        })
                                                    }
                                                />
                                                <label className="text-xs font-medium">
                                                    <span className="mb-1 block text-muted-foreground">
                                                        Unit
                                                    </span>
                                                    <input
                                                        className={inputClass}
                                                        list="rf-units"
                                                        value={item.unit}
                                                        onChange={(e) =>
                                                            updateItem(index, {
                                                                unit: e.target
                                                                    .value,
                                                            })
                                                        }
                                                    />
                                                </label>
                                                <Field
                                                    label="Unit price (INR)"
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            price: Number(v),
                                                        })
                                                    }
                                                />
                                                <Select
                                                    label="Price mode"
                                                    value={item.priceMode}
                                                    options={[
                                                        [
                                                            "exclusive",
                                                            "Excluding GST",
                                                        ],
                                                        [
                                                            "inclusive",
                                                            "Including GST",
                                                        ],
                                                    ]}
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            priceMode:
                                                                v as GstItem["priceMode"],
                                                        })
                                                    }
                                                />
                                                <Select
                                                    label="Tax treatment"
                                                    value={item.treatment}
                                                    options={[
                                                        ["taxable", "Taxable"],
                                                        ["nil", "Nil rated"],
                                                        ["exempt", "Exempt"],
                                                    ]}
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            treatment:
                                                                v as GstItem["treatment"],
                                                        })
                                                    }
                                                />
                                                {item.treatment ===
                                                    "taxable" && (
                                                    <Field
                                                        label="GST %"
                                                        type="number"
                                                        value={
                                                            item.gstRate ?? ""
                                                        }
                                                        onChange={(v) =>
                                                            updateItem(index, {
                                                                gstRate:
                                                                    v === ""
                                                                        ? null
                                                                        : Number(
                                                                              v
                                                                          ),
                                                            })
                                                        }
                                                    />
                                                )}
                                                <Field
                                                    label="HSN / SAC"
                                                    value={item.hsn}
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            hsn: v,
                                                        })
                                                    }
                                                />
                                                <Select
                                                    label="Item type"
                                                    value={item.kind}
                                                    options={[
                                                        ["goods", "Goods"],
                                                        [
                                                            "service",
                                                            "Service / freight",
                                                        ],
                                                    ]}
                                                    onChange={(v) =>
                                                        updateItem(index, {
                                                            kind: v as GstItem["kind"],
                                                            unit:
                                                                v === "service"
                                                                    ? "job"
                                                                    : "Nos",
                                                        })
                                                    }
                                                />
                                            </div>
                                            <details className="rounded-lg bg-muted/40 p-3">
                                                <summary className="cursor-pointer text-sm text-muted-foreground">
                                                    Description, warranty &
                                                    discount
                                                </summary>
                                                <div className="mt-3 space-y-3">
                                                    <Field
                                                        label="Specifications / description"
                                                        multiline
                                                        value={item.description}
                                                        onChange={(v) =>
                                                            updateItem(index, {
                                                                description: v,
                                                            })
                                                        }
                                                    />
                                                    <Field
                                                        label="Section heading"
                                                        value={item.section}
                                                        onChange={(v) =>
                                                            updateItem(index, {
                                                                section: v,
                                                            })
                                                        }
                                                    />
                                                    <Field
                                                        label="Warranty"
                                                        multiline
                                                        value={item.warranty}
                                                        onChange={(v) =>
                                                            updateItem(index, {
                                                                warranty: v,
                                                            })
                                                        }
                                                    />
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Field
                                                            label="Line discount"
                                                            type="number"
                                                            value={
                                                                item.discount
                                                            }
                                                            onChange={(v) =>
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        discount:
                                                                            Number(
                                                                                v
                                                                            ),
                                                                    }
                                                                )
                                                            }
                                                        />
                                                        <Select
                                                            label="Discount mode"
                                                            value={
                                                                item.discountType
                                                            }
                                                            options={[
                                                                [
                                                                    "percentage",
                                                                    "Percentage",
                                                                ],
                                                                [
                                                                    "amount",
                                                                    "INR amount",
                                                                ],
                                                            ]}
                                                            onChange={(v) =>
                                                                updateItem(
                                                                    index,
                                                                    {
                                                                        discountType:
                                                                            v as GstItem["discountType"],
                                                                    }
                                                                )
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </details>
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">
                                                    Line total{" "}
                                                    {totals
                                                        ? money(
                                                              totals.lines[
                                                                  index
                                                              ].total
                                                          )
                                                        : "--"}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="text-xs text-destructive"
                                                    onClick={() => {
                                                        update({
                                                            items: doc.items.filter(
                                                                (_, i) =>
                                                                    i !== index
                                                            ),
                                                        });
                                                        setActiveItem(
                                                            Math.max(
                                                                0,
                                                                index - 1
                                                            )
                                                        );
                                                    }}
                                                >
                                                    Remove item
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            ))}
                            <datalist id="rf-units">
                                {[
                                    "Nos",
                                    "pcs",
                                    "set",
                                    "job",
                                    "m",
                                    "kg",
                                    "hour",
                                ].map((u) => (
                                    <option key={u} value={u} />
                                ))}
                            </datalist>
                            <button
                                type="button"
                                className="w-full rounded-xl border border-dashed p-3 text-sm font-medium text-primary hover:bg-primary/5"
                                onClick={() => {
                                    update({
                                        items: [...doc.items, newItem()],
                                    });
                                    setActiveItem(doc.items.length);
                                }}
                            >
                                + Add item
                            </button>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    Review & download
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Choose a layout and check the final details.
                                </p>
                            </div>
                            <Select
                                label="Template"
                                value={doc.template}
                                options={Object.entries(GST_TEMPLATES)}
                                onChange={(v) =>
                                    update({
                                        template: v as GstDocument["template"],
                                    })
                                }
                            />
                            <Field
                                label="Payment terms"
                                multiline
                                value={doc.terms}
                                onChange={(v) => update({ terms: v })}
                            />
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={doc.roundOff}
                                    onChange={(e) =>
                                        update({ roundOff: e.target.checked })
                                    }
                                />
                                Round total to the nearest rupee
                            </label>
                            <details className="rounded-lg border p-3">
                                <summary className="cursor-pointer text-sm">
                                    Additional details & discounts
                                </summary>
                                <div className="mt-4 space-y-3">
                                    {(
                                        [
                                            ["reference", "PO / Reference"],
                                            ["salesperson", "Salesperson"],
                                            ["delivery", "Delivery schedule"],
                                            [
                                                "exclusions",
                                                "Project exclusions",
                                            ],
                                            ["notes", "Additional notes"],
                                        ] as const
                                    ).map(([key, label]) => (
                                        <Field
                                            key={key}
                                            label={label}
                                            value={doc[key]}
                                            multiline={
                                                key === "exclusions" ||
                                                key === "notes"
                                            }
                                            onChange={(v) =>
                                                update({ [key]: v })
                                            }
                                        />
                                    ))}
                                    <div className="grid grid-cols-2 gap-3">
                                        <Field
                                            label="Document discount"
                                            type="number"
                                            value={doc.discount}
                                            onChange={(v) =>
                                                update({ discount: Number(v) })
                                            }
                                        />
                                        <Select
                                            label="Discount mode"
                                            value={doc.discountType}
                                            options={[
                                                ["percentage", "Percentage"],
                                                ["amount", "INR amount"],
                                            ]}
                                            onChange={(v) =>
                                                update({
                                                    discountType:
                                                        v as GstDocument["discountType"],
                                                })
                                            }
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={doc.useOfficeContact}
                                            onChange={(e) =>
                                                update({
                                                    useOfficeContact:
                                                        e.target.checked,
                                                })
                                            }
                                        />
                                        Show alternative office contacts
                                    </label>
                                </div>
                            </details>
                            {totals && (
                                <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
                                    <div className="flex justify-between">
                                        <span>Taxable value</span>
                                        <span>{money(totals.taxable)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>
                                            {totals.interstate
                                                ? "IGST"
                                                : `CGST + ${totals.localTax}`}
                                        </span>
                                        <span>{money(totals.tax)}</span>
                                    </div>
                                    {doc.roundOff && (
                                        <div className="flex justify-between">
                                            <span>Round-off</span>
                                            <span>
                                                {money(totals.roundOff)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between border-t pt-3 text-lg font-semibold">
                                        <span>Total</span>
                                        <span>{money(totals.total)}</span>
                                    </div>
                                </div>
                            )}
                            {allErrors.length > 0 && (
                                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                                    <p className="font-medium">
                                        Complete these details before
                                        downloading:
                                    </p>
                                    <ul className="mt-2 list-disc space-y-1 pl-4">
                                        {allErrors.map((e, i) => (
                                            <li key={i}>{e}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    {message && (
                        <div
                            role="status"
                            className="mt-4 whitespace-pre-wrap rounded-lg border bg-muted p-3 text-sm"
                        >
                            {message}
                        </div>
                    )}
                    {returnUrl && <a className="mt-4 inline-block text-sm font-medium underline" href={returnUrl}>Return to Twenty</a>}
                    <div className="mt-6 flex items-center justify-between gap-3 border-t pt-5">
                        <button
                            type="button"
                            disabled={step === 0 || busy}
                            className="rounded-lg px-3 py-2 text-sm text-muted-foreground disabled:invisible"
                            onClick={() => go(step - 1)}
                        >
                            Back
                        </button>
                        {step < 2 ? (
                            <button
                                type="button"
                                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
                                onClick={() => go(step + 1)}
                            >
                                Continue
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={busy}
                                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                                onClick={() => void generate()}
                            >
                                {busy
                                    ? "Finalizing quote..."
                                    : sessionToken
                                      ? "Finalize Quote & Download"
                                      : "Download PDF"}
                            </button>
                        )}
                    </div>
                </div>
                <aside className="min-w-0">
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-medium text-muted-foreground">
                            Live preview
                        </h2>
                        <span className="text-xs text-muted-foreground">
                            A4 · INR
                        </span>
                    </div>
                    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                        <ScaledPreview document={doc} />
                    </div>
                </aside>
            </div>
            <div className="mt-6 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                    {sessionToken
                        ? "Finalizing saves this quote to Twenty and downloads the PDF."
                        : "Your document stays in this session. Download the PDF before leaving."}
                </span>
            </div>
        </fieldset>
    );
}
