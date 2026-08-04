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
}

module.exports = { LndClient };
