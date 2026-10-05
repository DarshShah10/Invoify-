import React from "react";
import {
    GstDocument,
    Party,
    calculateGst,
    money,
    stateName,
    displayDate,
    TITLES,
} from "@/lib/realFilms";

export const REAL_FILMS_CSS = `
.rf-paper{background:white;color:#172b3a;font:11px Arial,sans-serif;padding:26px;max-width:794px;margin:auto;min-height:900px;line-height:1.45;overflow-wrap:anywhere}
.rf-paper,.rf-paper *{box-sizing:border-box}.rf-bottom>*{min-width:0}.rf-total>div>span:first-child{max-width:60%}.rf-total>div>span:last-child{white-space:nowrap}.rf-paper h1{font-size:24px;margin:0;color:#155e75}.rf-paper h2{font-size:18px;margin:0}.rf-paper h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px;color:#155e75}
.rf-head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #155e75;padding-bottom:16px;margin-bottom:16px}.rf-logo{max-height:60px;max-width:150px;margin-bottom:8px}.rf-meta{text-align:right;min-width:165px}.rf-parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px}.rf-text{white-space:pre-wrap}.rf-paper table{width:100%;border-collapse:collapse;margin:14px 0;font-size:10px;table-layout:fixed}.rf-paper th{background:#e8f2f5;color:#155e75;text-align:left;padding:7px 5px}.rf-paper td{padding:8px 5px;border-bottom:1px solid #d7e0e5;vertical-align:top}.rf-paper .num{text-align:right}.rf-paper thead{display:table-header-group}.rf-paper tr{break-inside:avoid}.rf-paper .desc{white-space:pre-wrap;font-size:10px;color:#425665;margin-top:4px}.rf-section td{background:#f2f5f7;font-weight:bold}.rf-bottom{display:grid;grid-template-columns:1fr 260px;gap:24px;break-inside:avoid}.rf-total>div{display:flex;justify-content:space-between;padding:5px 0;gap:12px}.rf-grand{font-size:16px;font-weight:bold;border-top:2px solid #155e75;margin-top:6px}.rf-notes{margin-top:18px;white-space:pre-wrap}.rf-sign{max-height:65px;max-width:150px}.rf-signbox{text-align:right;margin-top:22px;break-inside:avoid}.rf-footer{margin-top:20px;font-size:9px;color:#607582;text-align:center;border-top:1px solid #d7e0e5;padding-top:9px}.rf-bordered{border:1px solid #526776}.rf-bordered td,.rf-bordered th{border:1px solid #b9c8d0}.rf-letterhead .rf-head{display:block;text-align:center}.rf-letterhead .rf-meta{text-align:center;margin-top:16px}.rf-compact{font-size:10px;padding:18px}.rf-compact td{padding:5px}.rf-project .rf-head{border-color:#9b6d32}.rf-project h1,.rf-project h3{color:#805523}.rf-project th{background:#f5efe5;color:#805523}
@media print{.rf-paper{padding:0;max-width:none;min-height:0}.rf-paper table{font-size:9px}.rf-bottom,.rf-signbox{break-inside:avoid}}`;

function PartyBlock({ title, party }: { title: string; party: Party }) {
    return (
        <div>
            <h3>{title}</h3>
            <strong>{party.name || "Customer name"}</strong>
            <div className="rf-text">{party.address}</div>
            <div>
                {party.pin} {stateName(party.state)}{" "}
                {party.state && `(${party.state})`}
            </div>
            {party.gstin && <div>GSTIN: {party.gstin}</div>}
            {party.email && <div>{party.email}</div>}
            {party.phone && <div>{party.phone}</div>}
        </div>
    );
}

export default function RealFilmsDocument({
    document: d,
}: {
    document: GstDocument;
}) {
    let c: ReturnType<typeof calculateGst>;
    try {
        c = calculateGst(d);
    } catch {
        return (
            <div className="rf-paper">
                Correct discounts to see the document preview.
            </div>
        );
    }
    const company = d.company,
        project = d.template === "project";
    const contact = d.useOfficeContact
        ? {
              ...company,
              address: company.officeAddress,
              email: company.officeEmail,
              phone: company.officePhone,
          }
        : company;
    return (
        <>
            <style>{REAL_FILMS_CSS}</style>
            <article className={`rf-paper rf-${d.template}`}>
                <header className="rf-head">
                    <div>
                        {company.logo && (
                            <img
                                className="rf-logo"
                                src={company.logo}
                                alt="Company logo"
                            />
                        )}
                        <h2>{company.name}</h2>
                        <div className="rf-text">{company.address}</div>
                        <div>
                            {company.pin}, {stateName(company.state)} (
                            {company.state})
                        </div>
                        <div>GSTIN: {company.gstin}</div>
                        {company.pan && <div>PAN: {company.pan}</div>}
                        {company.udyam && <div>Udyam: {company.udyam}</div>}
                        {d.useOfficeContact && contact.address && (
                            <div className="desc">
                                Office: {contact.address}
                            </div>
                        )}
                        <div>
                            {contact.email}{" "}
                            {contact.phone && ` | ${contact.phone}`}
                        </div>
                    </div>
                    <div className="rf-meta">
                        <h1>{TITLES[d.documentType]}</h1>
                        <strong>{d.number}</strong>
                        <div>Date: {displayDate(d.date)}</div>
                        {d.documentType === "quotation" && d.validUntil && (
                            <div>Valid until: {displayDate(d.validUntil)}</div>
                        )}
                        {d.documentType !== "quotation" && d.dueDate && (
                            <div>Due: {displayDate(d.dueDate)}</div>
                        )}
                    </div>
                </header>
                <div className="rf-parties">
                    <PartyBlock title="Bill to" party={d.customer} />
                    <PartyBlock
                        title="Ship to"
                        party={d.sameShipping ? d.customer : d.shipTo}
                    />
                </div>
                <div>
                    Place of supply: {stateName(d.placeOfSupply)}{" "}
                    {d.placeOfSupply && `(${d.placeOfSupply})`} | Tax:{" "}
                    {c.interstate ? "IGST" : `CGST + ${c.localTax}`}
                </div>
                {d.reference && <div>PO / Reference: {d.reference}</div>}
                {d.salesperson && <div>Salesperson: {d.salesperson}</div>}
                {d.delivery && <div>Delivery: {d.delivery}</div>}
                <table>
                    <colgroup>
                        <col style={{ width: "4%" }} />
                        <col style={{ width: project ? "25%" : "28%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: project ? "18%" : "15%" }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Description</th>
                            <th>HSN/SAC</th>
                            <th className="num">Qty / Unit</th>
                            <th className="num">Rate</th>
                            <th className="num">Discount</th>
                            <th className="num">Taxable / GST</th>
                            <th className="num">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {c.lines.map((l, index) => (
                            <React.Fragment key={l.id}>
                                {l.section && (
                                    <tr className="rf-section">
                                        <td colSpan={8}>{l.section}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td>{index + 1}</td>
                                    <td>
                                        <strong>
                                            {l.name || "Item description"}
                                        </strong>
                                        {l.description && (
                                            <div className="desc">
                                                {l.description}
                                            </div>
                                        )}
                                        {l.warranty && (
                                            <div className="desc">
                                                Warranty: {l.warranty}
                                            </div>
                                        )}
                                    </td>
                                    <td>{l.hsn}</td>
                                    <td className="num">
                                        {l.quantity}
                                        <br />
                                        {l.unit}
                                    </td>
                                    <td className="num">
                                        {money(l.price * 100)}
                                        <div className="desc">
                                            {l.priceMode === "inclusive"
                                                ? "incl. GST"
                                                : "excl. GST"}
                                        </div>
                                    </td>
                                    <td className="num">
                                        {money(l.discountCents)}
                                    </td>
                                    <td className="num">
                                        {money(l.taxable)}
                                        <div>
                                            {l.treatment === "taxable"
                                                ? `${l.gstRate ?? "--"}%`
                                                : l.treatment}
                                        </div>
                                    </td>
                                    <td className="num">
                                        <strong>{money(l.total)}</strong>
                                        {project && (
                                            <div className="desc">
                                                GST/unit:{" "}
                                                {money(
                                                    l.tax / (l.quantity || 1)
                                                )}
                                                <br />
                                                Incl./unit:{" "}
                                                {money(
                                                    l.total / (l.quantity || 1)
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                <table>
                    <thead>
                        <tr>
                            <th>HSN/SAC</th>
                            <th>Treatment</th>
                            <th className="num">Taxable value</th>
                            <th className="num">GST rate</th>
                            {c.interstate ? (
                                <th className="num">IGST</th>
                            ) : (
                                <>
                                    <th className="num">CGST</th>
                                    <th className="num">{c.localTax}</th>
                                </>
                            )}
                            <th className="num">Total tax</th>
                        </tr>
                    </thead>
                    <tbody>
                        {c.groups.map((g, i) => (
                            <tr key={i}>
                                <td>{g.hsn || "--"}</td>
                                <td>{g.treatment}</td>
                                <td className="num">{money(g.taxable)}</td>
                                <td className="num">{g.rate}%</td>
                                {c.interstate ? (
                                    <td className="num">{money(g.igst)}</td>
                                ) : (
                                    <>
                                        <td className="num">
                                            {money(g.cgst)}
                                            <br />
                                            {g.rate / 2}%
                                        </td>
                                        <td className="num">
                                            {money(g.sgst)}
                                            <br />
                                            {g.rate / 2}%
                                        </td>
                                    </>
                                )}
                                <td className="num">{money(g.tax)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="rf-bottom">
                    <div>
                        <h3>Amount in words</h3>
                        <div>{c.words}</div>
                        {company.bankName && (
                            <div style={{ marginTop: 16 }}>
                                <h3>Bank details</h3>
                                <div>{company.bankName}</div>
                                <div>Account name: {company.accountName}</div>
                                <div>Account no.: {company.accountNumber}</div>
                                <div>Branch: {company.branch}</div>
                                <div>IFSC: {company.ifsc}</div>
                            </div>
                        )}
                    </div>
                    <div className="rf-total">
                        <div>
                            <span>Subtotal after line discounts</span>
                            <span>{money(c.subtotal)}</span>
                        </div>
                        {c.discount > 0 && (
                            <div>
                                <span>Document discount</span>
                                <span>-{money(c.discount)}</span>
                            </div>
                        )}
                        <div>
                            <span>Taxable value</span>
                            <span>{money(c.taxable)}</span>
                        </div>
                        <div>
                            <span>GST</span>
                            <span>{money(c.tax)}</span>
                        </div>
                        {d.roundOff && (
                            <div>
                                <span>Round-off</span>
                                <span>{money(c.roundOff)}</span>
                            </div>
                        )}
                        <div className="rf-grand">
                            <span>Total</span>
                            <span>{money(c.total)}</span>
                        </div>
                    </div>
                </div>
                {[
                    ["Payment terms", d.terms],
                    ["Project exclusions", d.exclusions],
                    ["Notes", d.notes],
                    ["Declaration", company.declaration],
                ].map(
                    ([label, value]) =>
                        value && (
                            <section className="rf-notes" key={label}>
                                <h3>{label}</h3>
                                {value}
                            </section>
                        )
                )}
                <div className="rf-signbox">
                    For {company.name}
                    <br />
                    {company.signature && (
                        <img
                            className="rf-sign"
                            src={company.signature}
                            alt="Signature"
                        />
                    )}
                    <div style={{ marginTop: company.signature ? 4 : 32 }}>
                        Authorized signatory
                    </div>
                </div>
                <footer className="rf-footer">
                    {company.jurisdiction &&
                        `Subject to ${company.jurisdiction} jurisdiction | `}
                    Computer generated document
                    {d.documentType !== "invoice" &&
                        " | This document is not a tax invoice"}
                </footer>
            </article>
        </>
    );
}
