# Invoify Quotes for Twenty

Quote editor for the Twenty community extension. Start from a Lead in Twenty, edit the prefilled client/products, finalize, download the PDF and return to the original Lead. Quotes, line items, snapshots and native PDF files are stored by the app in Twenty.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the audit, final architecture, workspace schema, Linux installation, environment configuration and verification commands. No Twenty core patch is required.

For code transfer and installation on the existing Real Films Ubuntu ARM64 server, follow [SERVER_INSTALLATION_REALFILMS.md](SERVER_INSTALLATION_REALFILMS.md).

The companion extension lives in [Twenty-CRM](https://github.com/DarshShah10/Twenty-CRM/tree/main/packages/twenty-apps/community/invoify-quotes). Install both components; cloning this editor alone does not register the Twenty app. Private environment files, company profiles, session data and API keys are intentionally excluded. Use `.env.example` and `config/company.example.json` as configuration templates.

This project retains the upstream Invoify history and MIT license. The completed quote flow uses the retained GST editor and PDF renderer with a Twenty community extension.

Development: `npm ci`, configure `.env.local`, then `npm run dev -- --port 3010`. The port and deployment settings are configurable. Company details belong in your private JSON profile.

Validation: `npx tsc --noEmit`, `npm run test:e2e`, `npm run test:workflow` and `npm run test:integration` (integration commands require a test workspace).
