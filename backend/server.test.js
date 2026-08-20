const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApplication } = require('./server');

let server;
let baseUrl;
const fakeInvoices = new Map();
const paymentService = {
  async createInvoice({ sats }) {
    const paymentHash = `${fakeInvoices.size + 1}`.padStart(64, '0');
    fakeInvoices.set(paymentHash, { state: 'OPEN', amt_paid_sat: '0' });
    return { paymentRequest: `lntest-${sats}-${paymentHash}`, paymentHash };
  },
  async lookupInvoice(paymentHash) {
    return fakeInvoices.get(paymentHash);
  },
  async health() {
    return { connected: true, network: 'test' };
  }
};

before(async () => {
  ({ server } = createApplication({ paymentService }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('creates and retrieves an invoice', async () => {
  const createResponse = await fetch(`${baseUrl}/api/v1/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: 'ORDER-1', fiat_amount: 50 })
  });
  assert.equal(createResponse.status, 201);
  const invoice = await createResponse.json();
  assert.equal(invoice.status, 'PENDING');
  assert.equal(invoice.sats_due, 75_000);
  assert.equal(invoice.qr_code, `/api/v1/invoices/${invoice.invoice_id}/qr`);

  const qrResponse = await fetch(`${baseUrl}${invoice.qr_code}`);
  assert.equal(qrResponse.status, 200);
  assert.equal(qrResponse.headers.get('content-type'), 'image/png');
  assert.ok((await qrResponse.arrayBuffer()).byteLength > 100);

  const getResponse = await fetch(`${baseUrl}/api/v1/invoices/${invoice.invoice_id}`);
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).order_id, 'ORDER-1');
});

test('validates invoice input', async () => {
  const response = await fetch(`${baseUrl}/api/v1/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: '', fiat_amount: -2 })
  });
  assert.equal(response.status, 400);
});

test('reports settlement from the payment service', async () => {
  const created = await fetch(`${baseUrl}/api/v1/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: 'ORDER-2', fiat_amount: 10 })
  }).then((response) => response.json());

  const paymentHash = [...fakeInvoices.keys()].at(-1);
  fakeInvoices.set(paymentHash, {
    state: 'SETTLED',
    amt_paid_sat: '15000',
    settle_date: String(Math.floor(Date.now() / 1000))
  });

  const response = await fetch(`${baseUrl}/api/v1/invoices/${created.invoice_id}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'PAID');
});

test('reports payment service health', async () => {
  const response = await fetch(`${baseUrl}/api/v1/lnd/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { connected: true, network: 'test' });
});
