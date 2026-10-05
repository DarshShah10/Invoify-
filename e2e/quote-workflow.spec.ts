import { test, expect } from '@playwright/test';
import path from 'node:path';
const { authenticate } = require('../scripts/twenty-auth.cjs');

test('native Lead command opens a prefilled editor and returns to Twenty', async ({ page, context }) => {
    const crm = process.env.TWENTY_PUBLIC_URL;
    const api = process.env.TWENTY_API_URL;
    if (!crm || !api || !process.env.TWENTY_EMAIL || !process.env.TWENTY_PASSWORD) throw new Error('Set CRM URLs and test login credentials');
    const token = await authenticate();
    const leads = await fetch(`${api}/rest/opportunities?limit=1`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    const lead = leads.data.opportunities[0];
    const loginToken = await authenticate({ loginOnly: true });
    await page.goto(`${crm}/verify?loginToken=${encodeURIComponent(loginToken)}`);
    await page.waitForURL(url => url.pathname.startsWith('/objects/'), { timeout: 30000 });
    await page.goto(`${crm}/object/opportunity/${lead.id}`);
    await page.getByRole('button', { name: 'Create Quote', exact: true }).click();
    await expect(page.getByText('Client and linked products are loaded from this lead. Edit and finalize them in the quote editor.')).toBeVisible();
    await page.getByRole('button', { name: 'Create Quote', exact: true }).last().click();
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('link', { name: 'Open prefilled quote editor' }).click();
    const editor = await popupPromise;
    await editor.waitForLoadState();
    await expect(editor.getByLabel('Document number')).toHaveValue(/.+/);
    await expect(editor.getByRole('heading', { name: 'Customer', exact: true })).toBeVisible();
    await editor.getByLabel('Document number').fill(`TEST/${Date.now().toString(36)}`);
    await editor.getByLabel('GSTIN (optional)').fill('');
    await editor.getByRole('button', { name: /Items/ }).click();
    await expect(editor.getByLabel('Quantity')).toHaveValue('1');
    await expect(editor.getByLabel('Unit price (INR)')).not.toHaveValue('0');
    await editor.getByLabel('Quantity').fill('2');
    await editor.getByLabel('GST %').fill('18');
    await editor.getByRole('button', { name: /Review/ }).click();
    const responsePromise = editor.waitForResponse(r => r.url().includes('/api/quote/finalize') && r.request().method() === 'POST');
    const downloadPromise = editor.waitForEvent('download');
    await editor.getByRole('button', { name: 'Finalize Quote & Download' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(200);
    const quoteId = response.headers()['x-twenty-quote-id'];
    try {
        const download = await downloadPromise;
        await download.saveAs(path.resolve('.cache/quote-workflow.pdf'));
        await expect(editor.getByRole('link', { name: 'Return to Twenty' })).toHaveAttribute('href', `${crm}/object/opportunity/${lead.id}`);
        await editor.getByRole('link', { name: 'Return to Twenty' }).click();
        await editor.waitForURL(`${crm}/object/opportunity/${lead.id}`, { timeout: 30000 });
        await expect(editor.getByRole('button', { name: 'Create Quote', exact: true })).toBeVisible({ timeout: 30000 });
        const stored = await fetch(`${api}/rest/invoifyQuotes/${quoteId}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
        expect(stored.data.invoifyQuote.leadId).toBe(lead.id);
        expect(stored.data.invoifyQuote.status).toBe('FINALIZED');
        expect(stored.data.invoifyQuote.documentSnapshot.document.items[0].quantity).toBe(2);
    } finally {
        if (quoteId) {
            const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
            const lines = await fetch(`${api}/rest/invoifyQuoteLines?filter=quoteId[eq]:${quoteId}`, { headers }).then(r => r.json());
            for (const line of lines.data.invoifyQuoteLines) await fetch(`${api}/graphql`, { method: 'POST', headers, body: JSON.stringify({ query: `mutation { destroyInvoifyQuoteLine(id: "${line.id}") { id } }` }) });
            await fetch(`${api}/graphql`, { method: 'POST', headers, body: JSON.stringify({ query: `mutation { destroyInvoifyQuote(id: "${quoteId}") { id } }` }) });
        }
    }
});
