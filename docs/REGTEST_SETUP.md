# Free end-to-end Lightning payments with Polar

Regtest is a private Bitcoin network. Its keys, addresses, invoices, channels,
and settlements use the real Bitcoin and Lightning protocols, but its coins
have no monetary value. Never reuse a regtest seed for mainnet.

## Why Polar

Polar packages Bitcoin Core and Lightning nodes into a local Docker network.
It provides controls to mine blocks, fund nodes, open channels, create invoices,
and pay them. This makes the project reproducible without buying bitcoin.

## Prerequisite: Docker

Polar requires Docker Server on Linux. Docker and Polar are free software. On
Kali/Debian, install Docker from a terminal you control:

```bash
sudo apt update
sudo apt install docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Log out and back in after changing the Docker group, then verify:

```bash
docker version
docker compose version
```

Follow Docker's official Linux installation guidance if your distribution does
not provide these package names.

## Create the network

1. Install Polar from its official GitHub release page.
2. Create a new network named `ecommerce-regtest`.
3. Add one Bitcoin Core node.
4. Add two LND v0.20 nodes:
   - `Merchant` — receives the store payments.
   - `Customer` — represents the shopper's wallet.
5. Start the network.
6. Use Polar to deposit free regtest bitcoin into `Customer`.
7. Open a channel **from Customer to Merchant**.
8. Mine the requested confirmation blocks using Polar.

Because Customer funds the channel, Customer receives outbound capacity and
Merchant receives inbound capacity. That is exactly what the checkout needs.

## Connect this backend to Merchant

In Polar, open the `Merchant` node's **Connect** tab and locate its REST port,
TLS certificate, and invoice macaroon paths. Copy `.env.example` to `.env` and
replace the example values:

```bash
cp .env.example .env
```

The result should resemble:

```dotenv
LND_NETWORK=regtest
LND_REST_HOST=127.0.0.1
LND_REST_PORT=<merchant REST port shown by Polar>
LND_TLS_PATH=<absolute Merchant tls.cert path>
LND_MACAROON_PATH=<absolute Merchant invoice.macaroon path>
```

Do not commit `.env`, macaroons, certificates, seeds, or Polar node data.

## Run and pay

Start the React frontend and Node.js backend:

```bash
npm run dev
```

Open <http://localhost:5173>, choose **Pay with Bitcoin**, then copy or scan the
`lnbcrt...` invoice using Polar's `Customer` node. The backend polls Merchant's
LND invoice state and pushes `PAID` to React after settlement.

## Verify the selected network

```bash
curl http://localhost:3000/api/v1/lnd/health
```

Expected response:

```json
{"connected":true,"network":"regtest"}
```

Stop immediately if this says `mainnet` during a free regtest exercise.

## Render

Deploy the React/Express service to Render only after adding PostgreSQL. A local
Polar network is not reachable from Render. Running LND on Render would require
separate persistent infrastructure and is not part of the free local demo.
