# LND mainnet learning setup

This project uses LND with its Neutrino light client. Mainnet funds are real and
irreversible. Keep the first test balance below the agreed $1 learning limit.

## Safety rules

- Never paste the 24-word wallet seed into source code, chat, screenshots, or Git.
- Write the seed on paper and store it privately.
- Never put a macaroon or TLS private key in the React frontend.
- Do not fund the wallet until LND reports that it is synced.
- Start with only an amount you can afford to lose.

## Planned sequence

1. Download and verify the official LND binary.
2. Start LND in mainnet Neutrino mode.
3. Create the wallet interactively with `lncli create`.
4. Wait for chain and graph synchronization.
5. Create a restricted invoice-only macaroon for the backend.
6. Connect the Node.js backend to LND.
7. Fund with a tiny amount and acquire inbound liquidity.
8. Perform the first $1 scan-to-pay test.

Do not skip directly to step 7.
