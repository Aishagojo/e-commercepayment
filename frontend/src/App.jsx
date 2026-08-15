import { useEffect, useRef, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

function formatCountdown(expiresAt) {
  const remaining = Math.max(0, Date.parse(expiresAt) - Date.now());
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function CheckoutModal({ onClose }) {
  const [invoice, setInvoice] = useState(null);
  const [countdown, setCountdown] = useState('15:00');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [qrError, setQrError] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    const controller = new AbortController();

    async function createInvoice() {
      try {
        const response = await fetch(`${API_URL}/api/v1/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: `ORDER-${Date.now()}`, fiat_amount: 20 }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error('Could not create the invoice.');
        setInvoice(await response.json());
      } catch (requestError) {
        if (requestError.name !== 'AbortError') setError(requestError.message);
      }
    }

    createInvoice();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!invoice || invoice.status !== 'PENDING') return undefined;

    setCountdown(formatCountdown(invoice.expires_at));
    const timer = window.setInterval(() => {
      const nextCountdown = formatCountdown(invoice.expires_at);
      setCountdown(nextCountdown);
      if (nextCountdown === '0:00') {
        setInvoice((current) => ({ ...current, status: 'EXPIRED' }));
      }
    }, 1000);

    const apiOrigin = API_URL || window.location.origin;
    const wsUrl = new URL(`/api/v1/invoices/${invoice.invoice_id}/ws`, apiOrigin);
    wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(wsUrl);
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.invoice) setInvoice(message.invoice);
    });

    return () => {
      window.clearInterval(timer);
      socket.close();
    };
  }, [invoice?.invoice_id]);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  async function copyValue(label, value) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1500);
    } catch {
      setError('Could not copy automatically. Select the text and copy it manually.');
    }
  }

  return (
    <dialog ref={dialogRef} onCancel={close}>
      <button className="close" aria-label="Close" onClick={close}>×</button>
      {!invoice && !error && (
        <div className="centered"><div className="spinner" /><p>Creating invoice…</p></div>
      )}

      {invoice?.status === 'PENDING' && (
        <section>
          <span className="eyebrow">Lightning payment</span>
          <h2>Scan to pay</h2>
          {!qrError ? (
            <img
              className="qr"
              src={invoice.qr_code}
              alt="Lightning payment QR code"
              onError={() => setQrError(true)}
            />
          ) : (
            <p className="error">The QR image could not be displayed. Copy the payment request below.</p>
          )}
          <div className="amount"><strong>{invoice.sats_due.toLocaleString()}</strong> sats</div>
          <div className="status pending">Waiting for payment</div>
          <p className="expires">Invoice expires in <strong>{countdown}</strong></p>

          <div className="payment-details">
            <div className="detail-heading">
              <span>Lightning payment request</span>
              <button className="copy-button" onClick={() => copyValue('request', invoice.payment_request)}>
                {copied === 'request' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code>{invoice.payment_request}</code>
          </div>

          <div className="payment-details invoice-id">
            <div className="detail-heading">
              <span>Invoice ID</span>
              <button className="copy-button" onClick={() => copyValue('id', invoice.invoice_id)}>
                {copied === 'id' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <code>{invoice.invoice_id}</code>
          </div>
          <p className="hint real-payment">Scan with a Lightning wallet to complete your payment.</p>
        </section>
      )}

      {invoice?.status === 'PAID' && (
        <section className="centered success">
          <div className="check">✓</div>
          <h2>Payment received</h2>
          <p>Your simulated order is confirmed.</p>
          <button onClick={close}>Done</button>
        </section>
      )}

      {invoice?.status === 'EXPIRED' && (
        <section className="centered">
          <h2>Invoice expired</h2>
          <p>Close this window and create a new invoice to try again.</p>
        </section>
      )}

      {error && <p className="error">{error}</p>}
    </dialog>
  );
}

export default function App() {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <main className="shell">
      <header className="store-header">
        <a className="brand" href="#" aria-label="Stride home">
          <span className="brand-mark">S</span>
          Stride
        </a>
        <span className="secure-label">Secure checkout</span>
      </header>
      <section className="product-card">
        <div className="product-visual">
          <span className="product-badge">New release</span>
          <img src="/images/aero-runner.png" alt="Black and orange Aero Runner athletic shoe" />
        </div>
        <div className="product-details">
          <span className="eyebrow">Running shoes</span>
          <h1>Aero Runner</h1>
          <p className="description">Lightweight everyday trainers with breathable cushioning and a responsive sole.</p>

          <div className="selection-row">
            <div><span>Color</span><strong>Black / Orange</strong></div>
            <div><span>Size</span><strong>42 EU</strong></div>
          </div>

          <div className="total-row">
            <span>Order total</span>
            <strong>$20.00 <small>USD</small></strong>
          </div>

          <button className="pay-button" onClick={() => setCheckoutOpen(true)}>
            <span className="bitcoin-icon">₿</span>
            Pay with Bitcoin
          </button>
          <p className="payment-note">Fast, secure payment via the Lightning Network</p>
        </div>
      </section>
      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}
    </main>
  );
}
