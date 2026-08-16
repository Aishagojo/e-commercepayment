const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

class LndClient {
  constructor(options = {}) {
    const projectRoot = path.join(__dirname, '..');
    this.network = options.network || process.env.LND_NETWORK || 'mainnet';
    this.lndDataDir = options.lndDataDir || process.env.LND_DATA_DIR || path.join(projectRoot, '.lnd-data');
    this.host = options.host || process.env.LND_REST_HOST || 'localhost';
    this.port = Number(options.port || process.env.LND_REST_PORT || 8080);
    this.tlsPath = options.tlsPath || process.env.LND_TLS_PATH || path.join(this.lndDataDir, 'tls.cert');
    this.macaroonPath = options.macaroonPath || process.env.LND_MACAROON_PATH || path.join(
      this.lndDataDir,
      'data',
      'chain',
      'bitcoin',
      this.network,
      'invoice.macaroon'
    );
  }

  credentials() {
    try {
      return {
        ca: fs.readFileSync(this.tlsPath),
        macaroon: fs.readFileSync(this.macaroonPath).toString('hex')
      };
    } catch (error) {
      throw new Error(`LND credentials are unavailable: ${error.message}`);
    }
  }

  request(method, requestPath, body) {
    const { ca, macaroon } = this.credentials();
    const payload = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
      const request = https.request({
        hostname: this.host,
        port: this.port,
        path: requestPath,
        method,
        ca,
        servername: this.host,
        headers: {
          'Grpc-Metadata-macaroon': macaroon,
          ...(payload ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          } : {})
        },
        timeout: 10_000
      }, (response) => {
        let responseBody = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { responseBody += chunk; });
        response.on('end', () => {
          let data = {};
          try {
            data = responseBody ? JSON.parse(responseBody) : {};
          } catch {
            return reject(new Error('LND returned an invalid JSON response'));
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(new Error(data.message || `LND request failed with status ${response.statusCode}`));
          }
          return resolve(data);
        });
      });

      request.on('timeout', () => request.destroy(new Error('LND request timed out')));
      request.on('error', (error) => reject(new Error(`Cannot reach LND: ${error.message}`)));
      if (payload) request.write(payload);
      request.end();
    });
  }

  async createInvoice({ sats, memo, expirySeconds }) {
    const response = await this.request('POST', '/v1/invoices', {
      value: String(sats),
      memo,
      expiry: String(expirySeconds),
      private: true
    });

    return {
      paymentRequest: response.payment_request,
      paymentHash: Buffer.from(response.r_hash, 'base64').toString('hex')
    };
  }

  lookupInvoice(paymentHash) {
    return this.request('GET', `/v1/invoice/${encodeURIComponent(paymentHash)}`);
  }

  async health() {
    await this.request('GET', '/v1/invoices?num_max_invoices=1');
    return { connected: true, network: this.network };
  }
}

module.exports = { LndClient };
