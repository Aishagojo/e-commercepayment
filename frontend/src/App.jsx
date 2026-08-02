export default function App() {

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

          <button className="pay-button" disabled>
            <span className="bitcoin-icon">₿</span>
            Pay with Bitcoin
          </button>
          <p className="payment-note">Fast, secure payment via the Lightning Network</p>
        </div>
      </section>
    </main>
  );
}
