import { z } from "zod";
import { toWords } from "number-to-words";

export const STATES = [
    ["01", "Jammu and Kashmir"],
    ["02", "Himachal Pradesh"],
    ["03", "Punjab"],
    ["04", "Chandigarh"],
    ["05", "Uttarakhand"],
    ["06", "Haryana"],
    ["07", "Delhi"],
    ["08", "Rajasthan"],
    ["09", "Uttar Pradesh"],
    ["10", "Bihar"],
    ["11", "Sikkim"],
    ["12", "Arunachal Pradesh"],
    ["13", "Nagaland"],
    ["14", "Manipur"],
    ["15", "Mizoram"],
    ["16", "Tripura"],
    ["17", "Meghalaya"],
    ["18", "Assam"],
    ["19", "West Bengal"],
    ["20", "Jharkhand"],
    ["21", "Odisha"],
    ["22", "Chhattisgarh"],
    ["23", "Madhya Pradesh"],
    ["24", "Gujarat"],
    ["26", "Dadra and Nagar Haveli and Daman and Diu"],
    ["27", "Maharashtra"],
    ["29", "Karnataka"],
    ["30", "Goa"],
    ["31", "Lakshadweep"],
    ["32", "Kerala"],
    ["33", "Tamil Nadu"],
    ["34", "Puducherry"],
    ["35", "Andaman and Nicobar Islands"],
    ["36", "Telangana"],
    ["37", "Andhra Pradesh"],
    ["38", "Ladakh"],
] as const;
// Union territories without a legislature use UTGST for intra-territory supply.
export const UTGST_CODES = new Set(["04", "26", "31", "35", "38"]);
export const stateName = (code: string) =>
    STATES.find((s) => s[0] === code)?.[1] || code;
const text = z.string().max(10000);
const image = z
    .string()
    .max(3_000_000)
    .refine(
        (v) => !v || /^data:image\/(png|jpeg|webp);base64,/i.test(v),
        "Upload a PNG, JPEG or WebP image"
    );
const amount = z
    .number()
    .finite()
    .min(0)
    .max(100_000_000)
    .refine(
        (v) => Math.abs(v * 1e6 - Math.round(v * 1e6)) < 0.02,
        "Use at most six decimal places"
    );
const state = z
    .string()
    .refine(
        (v) => !v || STATES.some((s) => s[0] === v),
        "Select an Indian state"
    );
const dateValue = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
        const date = new Date(`${v}T00:00:00Z`);
        return (
            !Number.isNaN(date.getTime()) &&
            date.toISOString().slice(0, 10) === v
        );
    }, "Enter a valid date");
const optionalDate = z.union([z.literal(""), dateValue]);
export const PartySchema = z.object({
    name: text,
    address: text,
    pin: text,
    state,
    gstin: text,
    email: text,
    phone: text,
});
export const CompanySchema = PartySchema.extend({
    pan: text,
    udyam: text,
    officeAddress: text,
    officeEmail: text,
    officePhone: text,
    logo: image,
    signature: image,
    bankName: text,
    accountName: text,
    accountNumber: text,
    branch: text,
    ifsc: text,
    terms: text,
    declaration: text,
    jurisdiction: text,
});
export const GstItemSchema = z.object({
    id: z.string().max(100),
    sourceProductId: z.string().uuid().optional(),
    sourceServiceId: z.string().uuid().optional(),
    name: text,
    description: text,
    section: text,
    warranty: text,
    hsn: text,
    kind: z.enum(["goods", "service"]),
    quantity: amount,
    unit: text,
    price: amount,
    priceMode: z.enum(["exclusive", "inclusive"]),
    discount: amount,
    discountType: z.enum(["amount", "percentage"]),
    treatment: z.enum(["taxable", "nil", "exempt"]),
    gstRate: amount
        .refine((v) => v <= 100, "GST rate must be between 0 and 100")
        .nullable(),
});
export const GstDocumentSchema = z.object({
    schemaVersion: z.literal(2),
    id: z.string().max(100),
    documentType: z.enum(["quotation", "proforma", "invoice"]),
    number: text,
    date: dateValue,
    validUntil: optionalDate,
    dueDate: optionalDate,
    company: CompanySchema,
    useOfficeContact: z.boolean(),
    customer: PartySchema,
    shipTo: PartySchema,
    sameShipping: z.boolean(),
    placeOfSupply: state,
    items: z.array(GstItemSchema).max(500),
    discount: amount,
    discountType: z.enum(["amount", "percentage"]),
    roundOff: z.boolean(),
    template: z.enum([
        "modern",
        "bordered",
        "letterhead",
        "compact",
        "project",
    ]),
    reference: text,
    salesperson: text,
    delivery: text,
    terms: text,
    exclusions: text,
    notes: text,
});
export type Company = z.infer<typeof CompanySchema>;
export type Party = z.infer<typeof PartySchema>;
export type GstItem = z.infer<typeof GstItemSchema>;
export type GstDocument = z.infer<typeof GstDocumentSchema>;
export const TITLES = {
    quotation: "Quotation",
    proforma: "Proforma Invoice",
    invoice: "Tax Invoice",
};
export const GST_TEMPLATES = {
    modern: "Modern",
    bordered: "Classic Bordered",
    letterhead: "Letterhead",
    compact: "Compact",
    project: "Project Quotation",
};
export const emptyParty = (): Party => ({
    name: "",
    address: "",
    pin: "",
    state: "",
    gstin: "",
    email: "",
    phone: "",
});
export const defaultCompany: Company = {
    ...emptyParty(), pan: "", udyam: "", officeAddress: "", officeEmail: "", officePhone: "",
    logo: "", signature: "", bankName: "", accountName: "", accountNumber: "", branch: "",
    ifsc: "", terms: "", declaration: "", jurisdiction: "",
};
export const today = () => {
    const p = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    return ["year", "month", "day"]
        .map((k) => p.find((v) => v.type === k)!.value)
        .join("-");
};
export function financialYear(date: string) {
    const [year, month] = date.split("-").map(Number);
    const start = month >= 4 ? year : year - 1;
    return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
}
export function nextNumber(
    type: GstDocument["documentType"],
    date: string,
    saved: GstDocument[],
    reserved: string[] = []
) {
    const prefix = `DOC/${{ quotation: "Q", proforma: "P", invoice: "I" }[type]}/${financialYear(date)}/`;
    const highest = [...saved.map((d) => d.number), ...reserved]
        .filter((n) => n.startsWith(prefix))
        .reduce(
            (n, value) => Math.max(n, Number(value.slice(prefix.length)) || 0),
            0
        );
    return prefix + String(highest + 1).padStart(4, "0");
}
export function newItem(kind: "goods" | "service" = "goods"): GstItem {
    return {
        id: crypto.randomUUID(),
        name: "",
        description: "",
        section: "",
        warranty: "",
        hsn: "",
        kind,
        quantity: 1,
        unit: kind === "service" ? "job" : "Nos",
        price: 0,
        priceMode: "exclusive",
        discount: 0,
        discountType: "percentage",
        treatment: "taxable",
        gstRate: null,
    };
}
export function newDocument(
    company: Company,
    saved: GstDocument[] = [],
    type: GstDocument["documentType"] = "quotation",
    reserved: string[] = []
): GstDocument {
    const date = today();
    return {
        schemaVersion: 2,
        id: crypto.randomUUID(),
        documentType: type,
        number: nextNumber(type, date, saved, reserved),
        date,
        validUntil: "",
        dueDate: "",
        company: structuredClone(company),
        useOfficeContact: false,
        customer: emptyParty(),
        shipTo: emptyParty(),
        sameShipping: true,
        placeOfSupply: "",
        items: [newItem()],
        discount: 0,
        discountType: "percentage",
        roundOff: true,
        template: "modern",
        reference: "",
        salesperson: "",
        delivery: "",
        terms: company.terms,
        exclusions: "",
        notes: "",
    };
}

// Decimal inputs are converted to integers before multiplication/division.
const SCALE = 1_000_000n;
const dec = (v: number) => {
    if (!Number.isFinite(v) || v < 0 || v > 100_000_000)
        throw new Error("Enter a supported non-negative value");
    return BigInt(v.toFixed(6).replace(".", ""));
};
const rounded = (n: bigint, d: bigint) => (n + d / 2n) / d;
const cents = (v: number) => Number(rounded(dec(v) * 100n, SCALE));
const percentage = (c: number, rate: number, divisor = 100n) =>
    Number(rounded(BigInt(c) * dec(rate), divisor * SCALE));
export type CalculatedLine = GstItem & {
    taxable: number;
    discountCents: number;
    cgst: number;
    sgst: number;
    igst: number;
    tax: number;
    total: number;
};
export function calculateGst(doc: GstDocument) {
    const interstate = doc.company.state !== doc.placeOfSupply;
    const localTax = UTGST_CODES.has(doc.company.state) ? "UTGST" : "SGST";
    const bases = doc.items.map((i) => {
        let base = Number(
            rounded(dec(i.quantity) * dec(i.price) * 100n, SCALE * SCALE)
        );
        if (!Number.isSafeInteger(base) || base > 100_000_000_000_000)
            throw new Error("Item value exceeds the supported limit");
        if (i.priceMode === "inclusive" && i.treatment === "taxable")
            base = Number(
                rounded(
                    BigInt(base) * 100n * SCALE,
                    100n * SCALE + dec(i.gstRate || 0)
                )
            );
        const discount =
            i.discountType === "percentage"
                ? percentage(base, i.discount)
                : cents(i.discount);
        if (discount > base)
            throw new Error(`Discount exceeds value for ${i.name || "item"}`);
        return { base: base - discount, discount };
    });
    const subtotal = bases.reduce((s, b) => s + b.base, 0);
    const discount =
        doc.discountType === "percentage"
            ? percentage(subtotal, doc.discount)
            : cents(doc.discount);
    if (discount > subtotal)
        throw new Error("Document discount exceeds subtotal");
    // Largest remainder allocation keeps the discount exact to the paise.
    if (!Number.isSafeInteger(subtotal) || subtotal > 100_000_000_000_000)
        throw new Error("Document value exceeds the supported limit");
    const allocations = bases.map((b) =>
        subtotal
            ? Number((BigInt(discount) * BigInt(b.base)) / BigInt(subtotal))
            : 0
    );
    let remainder = discount - allocations.reduce((a, b) => a + b, 0);
    const order = bases
        .map((b, index) => ({
            index,
            remainder: subtotal
                ? (BigInt(discount) * BigInt(b.base)) % BigInt(subtotal)
                : 0n,
        }))
        .sort((a, b) =>
            a.remainder === b.remainder
                ? a.index - b.index
                : a.remainder > b.remainder
                  ? -1
                  : 1
        );
    for (const entry of order) {
        if (!remainder) break;
        allocations[entry.index]++;
        remainder--;
    }
    const lines: CalculatedLine[] = doc.items.map((i, index) => {
        const taxable = bases[index].base - allocations[index];
        const rate = i.treatment === "taxable" ? i.gstRate || 0 : 0;
        const cgst = interstate ? 0 : percentage(taxable, rate, 200n);
        const sgst = cgst,
            igst = interstate ? percentage(taxable, rate) : 0;
        return {
            ...i,
            taxable,
            discountCents: bases[index].discount + allocations[index],
            cgst,
            sgst,
            igst,
            tax: cgst + sgst + igst,
            total: taxable + cgst + sgst + igst,
        };
    });
    const groups = new Map<
        string,
        {
            hsn: string;
            treatment: string;
            rate: number;
            taxable: number;
            cgst: number;
            sgst: number;
            igst: number;
            tax: number;
        }
    >();
    for (const l of lines) {
        const rate = l.treatment === "taxable" ? l.gstRate || 0 : 0;
        const key = `${l.hsn}|${l.treatment}|${rate}`;
        const g = groups.get(key) || {
            hsn: l.hsn,
            treatment: l.treatment,
            rate,
            taxable: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            tax: 0,
        };
        for (const k of ["taxable", "cgst", "sgst", "igst", "tax"] as const)
            g[k] += l[k];
        groups.set(key, g);
    }
    const taxable = lines.reduce((s, l) => s + l.taxable, 0),
        tax = lines.reduce((s, l) => s + l.tax, 0);
    const beforeRound = taxable + tax,
        total = doc.roundOff
            ? Math.round(beforeRound / 100) * 100
            : beforeRound;
    return {
        lines,
        groups: [...groups.values()],
        subtotal,
        discount,
        taxable,
        tax,
        total,
        roundOff: total - beforeRound,
        interstate,
        localTax,
        words: rupeeWords(total),
    };
}
export const money = (c: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(c / 100);
function indianWords(n: number): string {
    if (n >= 10_000_000)
        return `${indianWords(Math.floor(n / 10_000_000))} crore${n % 10_000_000 ? " " + indianWords(n % 10_000_000) : ""}`;
    if (n >= 100_000)
        return `${toWords(Math.floor(n / 100_000))} lakh${n % 100_000 ? " " + indianWords(n % 100_000) : ""}`;
    return toWords(n);
}
export function rupeeWords(c: number) {
    return `Indian Rupees ${indianWords(Math.floor(c / 100))}${c % 100 ? " and " + toWords(c % 100) + " paise" : ""} only`;
}
export const displayDate = (v: string) =>
    v ? v.split("-").reverse().join("/") : "";
export function documentErrors(doc: GstDocument): string[] {
    const errors: string[] = [];
    const shape = GstDocumentSchema.safeParse(doc);
    if (!shape.success)
        errors.push(
            ...shape.error.issues.map(
                (i) => `${i.path.join(".")}: ${i.message}`
            )
        );
    if (
        !doc.company.name ||
        !doc.company.address ||
        !doc.company.state ||
        !doc.company.pin
    )
        errors.push(
            "Complete the company name, registered address, PIN and state"
        );
    if (!doc.customer.name || !doc.customer.address || !doc.customer.state)
        errors.push("Complete the customer name, address and state");
    if (
        !doc.sameShipping &&
        (!doc.shipTo.name || !doc.shipTo.address || !doc.shipTo.state)
    )
        errors.push("Complete the shipping name, address and state");
    if (!doc.placeOfSupply) errors.push("Select the place of supply");
    if (!/^[A-Za-z0-9/-]{1,16}$/.test(doc.number))
        errors.push("Number must use 1-16 letters, digits, / or -");
    for (const [label, p] of [
        ["Company", doc.company],
        ["Customer", doc.customer],
        ...(!doc.sameShipping ? [["Shipping", doc.shipTo] as const] : []),
    ] as const) {
        if (
            p.gstin &&
            !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(p.gstin)
        )
            errors.push(`${label} GSTIN has an invalid structure`);
        if (p.gstin && p.gstin.slice(0, 2) !== p.state)
            errors.push(`${label} GSTIN does not match its state`);
        if (p.pin && !/^[1-9]\d{5}$/.test(p.pin))
            errors.push(`${label} PIN must contain six digits`);
        if (p.email && !z.string().email().safeParse(p.email).success)
            errors.push(`${label} email is invalid`);
    }
    if (doc.documentType === "invoice" && !doc.company.gstin)
        errors.push("Company GSTIN is required for a tax invoice");
    if (doc.company.pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(doc.company.pan))
        errors.push("Company PAN has an invalid structure");
    if (
        doc.company.pan &&
        doc.company.gstin &&
        doc.company.pan !== doc.company.gstin.slice(2, 12)
    )
        errors.push("Company PAN does not match GSTIN");
    if (doc.company.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(doc.company.ifsc))
        errors.push("Company IFSC has an invalid structure");
    if (
        doc.documentType === "quotation" &&
        doc.validUntil &&
        doc.validUntil < doc.date
    )
        errors.push("Validity date cannot precede document date");
    if (
        doc.documentType !== "quotation" &&
        doc.dueDate &&
        doc.dueDate < doc.date
    )
        errors.push("Due date cannot precede document date");
    if (!doc.items.length) errors.push("Add at least one item");
    for (const [index, i] of doc.items.entries()) {
        if (!i.name || i.quantity <= 0 || !i.unit)
            errors.push(
                `Item ${index + 1}: name, positive quantity and unit are required`
            );
        if (i.treatment === "taxable" && (i.gstRate === null || i.gstRate <= 0))
            errors.push(
                `Item ${index + 1}: choose GST rate or nil/exempt treatment`
            );
        if (i.discountType === "percentage" && i.discount > 100)
            errors.push(`Item ${index + 1}: discount cannot exceed 100%`);
        if (i.hsn && !/^\d{4,8}$/.test(i.hsn))
            errors.push(`Item ${index + 1}: HSN/SAC must contain 4-8 digits`);
        if (doc.documentType === "invoice" && !i.hsn)
            errors.push(`Item ${index + 1}: enter HSN/SAC`);
    }
    if (doc.discountType === "percentage" && doc.discount > 100)
        errors.push("Document discount cannot exceed 100%");
    try {
        calculateGst(doc);
    } catch (e) {
        errors.push((e as Error).message);
    }
    return errors;
}
