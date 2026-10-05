import { test, expect } from "@playwright/test";
import {
    calculateGst,
    defaultCompany,
    newDocument,
    newItem,
    documentErrors,
    nextNumber,
    financialYear,
    GstDocumentSchema,
} from "../lib/realFilms";

function sample() {
    const d = newDocument({ ...defaultCompany, name: "Example Supplier", address: "Test Street, Mumbai", pin: "400001", state: "27", gstin: "27AOQPS5933L1Z1", pan: "AOQPS5933L" }, [], "invoice");
    d.customer = {
        name: "Jeypore Overseas",
        address: "Hotel Hello, NH26, Jeypore",
        pin: "764001",
        state: "21",
        gstin: "21AAACJ9407H1ZU",
        email: "",
        phone: "",
    };
    d.placeOfSupply = "21";
    d.items = [
        {
            ...newItem(),
            name: "3D Passive Glasses Adult",
            hsn: "900490",
            quantity: 500,
            price: 27,
            gstRate: 18,
        },
        {
            ...newItem("service"),
            name: "Freight",
            hsn: "996719",
            price: 875,
            gstRate: 18,
        },
    ];
    return d;
}
test("Sales_474 and GST branches calculate in paise", () => {
    const d = sample();
    expect(documentErrors(d)).toEqual([]);
    expect(calculateGst(d)).toMatchObject({
        taxable: 1437500,
        tax: 258750,
        roundOff: 50,
        total: 1696300,
        interstate: true,
    });
    d.placeOfSupply = "27";
    expect(calculateGst(d).groups[0]).toMatchObject({
        cgst: 121500,
        sgst: 121500,
        igst: 0,
    });
    d.company.state = "04";
    d.placeOfSupply = "04";
    expect(calculateGst(d).localTax).toBe("UTGST");
    d.company.state = "07";
    d.placeOfSupply = "07";
    expect(calculateGst(d).localTax).toBe("SGST");
});
test("mixed inclusive rates, discount allocation, fractional quantities and exempt items", () => {
    const d = sample();
    d.roundOff = false;
    d.items = [
        {
            ...newItem(),
            name: "A",
            quantity: 1.5,
            price: 118,
            priceMode: "inclusive",
            gstRate: 18,
        },
        { ...newItem(), name: "B", price: 100, gstRate: 5 },
        { ...newItem(), name: "C", price: 100, treatment: "exempt" },
    ];
    d.discountType = "amount";
    d.discount = 10;
    const c = calculateGst(d);
    expect(c.subtotal).toBe(35000);
    expect(c.discount).toBe(1000);
    expect(c.lines.reduce((s, l) => s + l.taxable, 0)).toBe(34000);
    expect(c.lines[2].tax).toBe(0);
    expect(c.total).toBe(c.lines.reduce((s, l) => s + l.total, 0));
    d.items[0].discountType = "amount";
    d.items[0].discount = 1000;
    expect(() => calculateGst(d)).toThrow("Discount exceeds");
});
test("rounding and six decimal inputs stay consistent", () => {
    const d = sample();
    d.roundOff = false;
    d.items = [
        {
            ...newItem(),
            name: "Glasses",
            price: 40,
            quantity: 500,
            gstRate: 18,
        },
    ];
    expect(calculateGst(d).lines[0]).toMatchObject({
        tax: 360000,
        total: 2360000,
    });
    d.items = [
        {
            ...newItem(),
            name: "Fraction",
            price: 0.1,
            quantity: 0.3,
            gstRate: 18,
        },
    ];
    expect(calculateGst(d).taxable).toBe(3);
    d.items[0].treatment = "nil";
    expect(calculateGst(d).tax).toBe(0);
    d.items[0].price = 100;
    d.items[0].quantity = 1;
    d.items[0].discount = 10;
    d.discount = 10;
    expect(calculateGst(d).taxable).toBe(8100);
});
test("validation and financial-year numbering", () => {
    const d = sample();
    d.items[0].gstRate = null;
    d.customer.gstin = "27AAACJ9407H1ZU";
    expect(documentErrors(d).join(" ")).toContain("choose GST rate");
    expect(documentErrors(d).join(" ")).toContain("does not match");
    expect(financialYear("2026-03-31")).toBe("25-26");
    expect(nextNumber("invoice", "2026-04-01", [], ["DOC/I/26-27/0042"])).toBe(
        "DOC/I/26-27/0043"
    );
    expect(nextNumber("quotation", "2026-04-01", [], ["DOC/I/26-27/0042"])).toBe(
        "DOC/Q/26-27/0001"
    );
    expect(
        GstDocumentSchema.safeParse({
            ...sample(),
            company: {
                ...defaultCompany,
                logo: "https://example.com/logo.png",
            },
        }).success
    ).toBe(false);
});
