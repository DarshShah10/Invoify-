const assert = require('node:assert/strict');
const { authenticate } = require('./twenty-auth.cjs');
const { request } = require('@playwright/test');

(async () => {
  const token = await authenticate();
  const crm = process.env.TWENTY_API_URL;
  const editor = process.env.INVOIFY_PUBLIC_URL;
  if (!editor) throw new Error('Set INVOIFY_PUBLIC_URL');
  const created = [];
  const api = async (path, method = 'GET', body) => {
    const response = await fetch(`${crm}/rest/${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(`${method} ${path}: ${JSON.stringify(result)}`);
    return result.data;
  };
  const create = async (plural, singular, body) => {
    const data = await api(plural, 'POST', body);
    const record = data[singular];
    assert.ok(record?.id, JSON.stringify(data));
    created.push([plural, record.id]);
    return record;
  };
  const browser = await request.newContext({ baseURL: editor });
  try {
    const suffix = Date.now().toString(36);
    const company = await create('companies', 'createCompany', { name: `Quote integration ${suffix}`, address: { addressStreet1: 'Test Street', addressCity: 'Mumbai', addressPostcode: '400001', addressState: 'Maharashtra', addressCountry: 'India' }, state: '27' });
    const product = await create('products', 'createProduct', { name: `Quote product ${suffix}`, price: { amountMicros: 100000000, currencyCode: 'INR' }, unit: 'Piece' });
    const lead = await create('opportunities', 'createOpportunity', { name: `Quote lead ${suffix}`, companyId: company.id, stage: 'NEW' });
    await create('leadProducts', 'createLeadProduct', { name: 'Integration product', leadId: lead.id, productId: product.id });
    for (let iteration = 0; iteration < 2; iteration++) {
      const launch = await fetch(`${crm}/s/invoify/quote-session`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ opportunityId: lead.id }) }).then(r => r.json());
      assert.equal(launch.ok, true, JSON.stringify(launch));
      const invalid = await browser.post('/api/quote/session', { data: { token: launch.exchangeToken + 'x' } });
      assert.equal(invalid.status(), 401);
      const exchange = await browser.post('/api/quote/session', { data: { token: launch.exchangeToken } });
      assert.equal(exchange.status(), 200, await exchange.text());
      const reference = new URL((await exchange.json()).launchUrl).searchParams.get('session');
      const opened = await browser.get('/api/quote/session', { params: { token: reference } });
      assert.equal(opened.status(), 200, await opened.text());
      const doc = (await opened.json()).document;
      assert.equal(doc.customer.name, company.name);
      assert.equal(doc.items[0].sourceProductId, product.id);
      assert.equal(doc.items[0].price, 100);
      doc.items[0].quantity = 2;
      doc.items[0].gstRate = 18;
      doc.items[0].hsn = '900490';
      const input = { token: reference, document: doc };
      const stranger = await request.newContext({ baseURL: editor });
      assert.equal((await stranger.post('/api/quote/finalize', { data: input })).status(), 401);
      await stranger.dispose();
      const finalized = await browser.post('/api/quote/finalize', { data: input, timeout: 120000 });
      assert.equal(finalized.status(), 200, await finalized.text());
      const pdf = await finalized.body();
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      const id = finalized.headers()['x-twenty-quote-id'];
      assert.ok(id);
      created.push(['invoifyQuotes', id]);
      assert.equal(finalized.headers()['x-twenty-return-url'], `${process.env.TWENTY_PUBLIC_URL}/object/opportunity/${lead.id}`);
      const quote = (await api(`invoifyQuotes/${id}`)).invoifyQuote;
      assert.equal(quote.status, 'FINALIZED');
      assert.equal(quote.leadId, lead.id);
      assert.equal(quote.companyId, company.id);
      assert.equal(quote.amount.amountMicros, 236000000);
      assert.ok(quote.pdfFile[0].fileId);
      const lines = (await api(`invoifyQuoteLines?filter=quoteId[eq]:${id}`)).invoifyQuoteLines;
      assert.equal(lines.length, 1);
      for (const line of lines) created.push(['invoifyQuoteLines', line.id]);
      assert.equal(lines[0].quantity, 2);
      const retry = await browser.post('/api/quote/finalize', { data: input });
      assert.equal(retry.status(), 200);
      assert.equal(retry.headers()['x-twenty-quote-id'], id);
      assert.deepEqual(await retry.body(), pdf);
      doc.items[0].quantity = 3;
      assert.equal((await browser.post('/api/quote/finalize', { data: { token: reference, document: doc } })).status(), 409);
      const quotes = (await api(`invoifyQuotes?filter=leadId[eq]:${lead.id}`)).invoifyQuotes;
      assert.equal(quotes.length, iteration + 1);
      assert.equal(quotes.filter(q => q.isCurrent).length, 1);
      assert.equal(quotes.find(q => q.isCurrent).id, id);
      console.log(`Quote ${iteration + 1}: prefill, GST, PDF, relations, line items, retry and current-quote checks passed.`);
    }
  } finally {
    await browser.dispose();
    for (const [plural, id] of created.reverse()) {
      await api(`${plural}/${id}`, 'DELETE').catch(e => console.error(`Fixture cleanup failed: ${e.message}`));
    }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
