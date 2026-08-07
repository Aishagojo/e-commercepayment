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

  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    return res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });

  return { app, server, invoices };
}

if (require.main === module) {
  const { server } = createApplication();
  server.listen(DEFAULT_PORT, () => {
    console.log(`Payment prototype running at http://localhost:${DEFAULT_PORT}`);
  });
}

module.exports = { createApplication };
