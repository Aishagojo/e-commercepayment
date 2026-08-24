# Bitcoin Lightning E-commerce Payment Gateway

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![LND](https://img.shields.io/badge/Lightning-LND-792EE5?logo=lightning&logoColor=white)
![Bitcoin](https://img.shields.io/badge/Bitcoin-Regtest-F7931A?logo=bitcoin&logoColor=white)
![Tests](https://img.shields.io/badge/tests-4%20passing-2EA44F)
![Status](https://img.shields.io/badge/status-learning%20project-blue)

A learning project that demonstrates how an online store can create Bitcoin
Lightning invoices, display them as QR codes, detect settlement, and update a
customer's checkout in real time.

The project is being built step by step to understand the infrastructure behind
a non-custodial Bitcoin payment gateway. It is not production-ready and should
not currently be used to process customer money.

> Create invoice → show QR → pay from a Lightning wallet → detect LND settlement
> → update the checkout over WebSockets.

## Demo gallery

![React product checkout](docs/images/storefront.png)

![Lightning QR payment modal](docs/images/lightning-checkout.png)

More screenshots can be added as the project grows:

<!--
![Customer paying the invoice in Polar](docs/images/polar-payment.png)
![Successful payment confirmation](docs/images/payment-received.png)
![Merchant and Customer channel topology](docs/images/polar-network.png)
-->

Recommended screenshots:

| Filename | What it should show |
|---|---|
| `storefront.png` | The shoe product, $20 total, and Pay with Bitcoin button |
| `lightning-checkout.png` | QR code, `lnbcrt...` request, amount, and countdown |
| `polar-network.png` | Bitcoin Core, Merchant LND, Customer LND, and their channels |
| `polar-payment.png` | Customer node paying the Merchant invoice |
| `payment-received.png` | React's successful Payment received state |

The storefront and Lightning checkout screenshots are included. After adding
any remaining files, move their image markup outside the `<!--` and `-->`
comment lines to display them on GitHub.

