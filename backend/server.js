const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const QRCode = require('qrcode');
const { WebSocketServer, WebSocket } = require('ws');
const { LndClient } = require('./lnd-client');

const DEFAULT_PORT = Number(process.env.PORT || 3000);
const INVOICE_LIFETIME_MS = 15 * 60 * 1000;
const SATS_PER_USD = 1_500;

function createApplication(options = {}) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  const invoices = new Map();
  const subscribers = new Map();
  const paymentService = options.paymentService || new LndClient();

  app.use(express.json());
  const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDist));

  function publicInvoice(invoice) {
    return {
      invoice_id: invoice.id,
      order_id: invoice.orderId,
      fiat_amount: invoice.fiatAmount,
      sats_due: invoice.satsDue,
      payment_request: invoice.paymentRequest,
      qr_code: `/api/v1/invoices/${invoice.id}/qr`,
      status: invoice.status,
      expires_at: invoice.expiresAt
    };
  }

  function refreshStatus(invoice) {
    if (invoice.status === 'PENDING' && Date.now() >= Date.parse(invoice.expiresAt)) {
      invoice.status = 'EXPIRED';
      broadcast(invoice);
    }
    return invoice;
  }

  async function syncInvoiceStatus(invoice) {
    refreshStatus(invoice);
    if (invoice.status !== 'PENDING') return invoice;

    const lndInvoice = await paymentService.lookupInvoice(invoice.paymentHash);
    if (lndInvoice.state === 'SETTLED') {
      invoice.status = 'PAID';
      invoice.satsReceived = Number(lndInvoice.amt_paid_sat || invoice.satsDue);
      invoice.paidAt = new Date(Number(lndInvoice.settle_date) * 1000).toISOString();
      broadcast(invoice);
    } else if (lndInvoice.state === 'CANCELED') {
      invoice.status = 'EXPIRED';
      broadcast(invoice);
    }
    return invoice;
  }

  function broadcast(invoice) {
    const clients = subscribers.get(invoice.id);
    if (!clients) return;

    const message = JSON.stringify({
      event: 'INVOICE_UPDATED',
      invoice: publicInvoice(invoice)
    });

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  app.post('/api/v1/invoices', async (req, res) => {
    const { order_id: orderId, fiat_amount: rawFiatAmount } = req.body;
    const fiatAmount = Number(rawFiatAmount);

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'order_id is required' });
    }
    if (!Number.isFinite(fiatAmount) || fiatAmount <= 0) {
      return res.status(400).json({ error: 'fiat_amount must be greater than zero' });
    }

    const id = crypto.randomUUID();
    const satsDue = Math.round(fiatAmount * SATS_PER_USD);
    try {
      const lndInvoice = await paymentService.createInvoice({
        sats: satsDue,
        memo: `Order ${orderId.trim()}`,
        expirySeconds: Math.floor(INVOICE_LIFETIME_MS / 1000)
      });
      const qrCode = await QRCode.toBuffer(lndInvoice.paymentRequest.toUpperCase(), {
        type: 'png',
        width: 320,
        margin: 2
      });
      const invoice = {
        id,
        orderId: orderId.trim(),
        fiatAmount: Number(fiatAmount.toFixed(2)),
        satsDue,
        paymentRequest: lndInvoice.paymentRequest,
        paymentHash: lndInvoice.paymentHash,
        qrCode,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + INVOICE_LIFETIME_MS).toISOString()
      };

      invoices.set(id, invoice);
      return res.status(201).json(publicInvoice(invoice));
    } catch (error) {
      return res.status(503).json({ error: error.message });
    }
  });

  app.get('/api/v1/invoices/:id', async (req, res) => {
    const invoice = invoices.get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    try {
      return res.json(publicInvoice(await syncInvoiceStatus(invoice)));
    } catch (error) {
      return res.status(503).json({ error: error.message });
    }
  });

  app.get('/api/v1/invoices/:id/qr', (req, res) => {
    const invoice = invoices.get(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.set('Cache-Control', 'private, no-store');
    res.type('png');
    return res.send(invoice.qrCode);
  });

  app.get('/api/v1/lnd/health', async (_req, res) => {
    try {
      return res.json(await paymentService.health());
    } catch (error) {
      return res.status(503).json({ connected: false, error: error.message });
    }
  });

  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });

  server.on('upgrade', (request, socket, head) => {
    const match = request.url?.match(/^\/api\/v1\/invoices\/([^/]+)\/ws$/);
    if (!match || !invoices.has(match[1])) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    request.invoiceId = match[1];
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  });

  wss.on('connection', (ws, request) => {
    const { invoiceId } = request;
    const clients = subscribers.get(invoiceId) || new Set();
    clients.add(ws);
    subscribers.set(invoiceId, clients);

    ws.send(JSON.stringify({
      event: 'INVOICE_UPDATED',
      invoice: publicInvoice(refreshStatus(invoices.get(invoiceId)))
    }));

    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0) subscribers.delete(invoiceId);
    });
  });

  const invoiceMonitor = setInterval(async () => {
    for (const invoice of invoices.values()) {
      if (invoice.status !== 'PENDING') continue;
      try {
        await syncInvoiceStatus(invoice);
      } catch (error) {
        console.error(`Could not check LND invoice ${invoice.id}: ${error.message}`);
      }
    }
  }, 2_000);
  invoiceMonitor.unref();
  server.on('close', () => clearInterval(invoiceMonitor));

  return { app, server, invoices };
}

if (require.main === module) {
  const { server } = createApplication();
  server.listen(DEFAULT_PORT, () => {
    console.log(`Payment prototype running at http://localhost:${DEFAULT_PORT}`);
  });
}

module.exports = { createApplication };
