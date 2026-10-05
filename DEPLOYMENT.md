# Quote extension deployment

For the Windows-to-Ubuntu ARM64 transfer and installation steps for `crm.realfilms.co.in`, use [the Real Films server installation guide](SERVER_INSTALLATION_REALFILMS.md).

The editor and the Twenty community app deploy separately. No Twenty core patch is required. This version is tested against Twenty 2.5.1 and pins twenty-sdk / twenty-client-sdk 2.5.0. Revalidate app installation before upgrading Twenty: current upstream documentation describes features newer than this runtime.

## Final architecture

1. The app installs a native **Create Quote** record command on Twenty's standard `opportunity` object (your Leads).
2. An authenticated app logic function reads that Lead, its company/contact, `leadProduct` joins, products and optional service. It signs a one-hour handoff containing the prefill and original Lead identity.
3. The editor exchanges the handoff for an opaque session URL, then binds editing/finalization to an HttpOnly browser cookie. No API key is sent to the editor browser.
4. The user edits client/items/GST/layout and finalizes. The editor validates, calculates tax in integer paise and generates the PDF in Chromium.
5. A server-signed callback uploads the PDF through Twenty's native FILES API, saves `invoifyQuote`, creates related `invoifyQuoteLine` records and marks the quote FINALIZED. Native Lead/company/person relations and complete document/customer/item snapshots preserve the source and finalized details. Standard createdAt/updatedAt and finalizedAt record dates. The PDF field supplies Twenty's download link.
6. The editor downloads the saved PDF and shows **Return to Twenty**, linking to the original Lead. The most recently created finalized quote is current; prior quotes remain available. Lead stage is unchanged.

Each session has a deterministic quote ID and deterministic line IDs. A retry completes missing lines and returns the same PDF; changing a finalized document requires a new quote. The number is unique in the new Quotes table. A failed callback does not claim successful finalization.

## Prepare the workspace

Use the app under `packages/twenty-apps/community/invoify-quotes` in the Twenty repository. It creates its own Quotes and Quote Line Items schema. Existing legacy `quote` records are preserved; they are never converted or deleted automatically.

Expected existing schema:

| Object | Fields used |
| --- | --- |
| opportunity | company relation; optional pointOfContact and service relations; name, notes |
| company | name/businessName, address compound, state, gstNumber, email/phone compounds |
| person | name, emails, phones |
| product | name, price CURRENCY in INR, unit; optional quoteDescription/warrantyPeriod/warrantyTerms |
| leadProduct | lead and product relations |
| service | name, price CURRENCY in INR, unit and optional description |

Installer metadata discovery resolves object UUIDs per workspace. Product/service/join object names and source/join relation names can be overridden with the environment variables in `scripts/configure-workspace.cjs`. Native Lead relations in this version require standard opportunity; an arbitrary custom Lead object requires an intentional app schema change. Missing catalog quantity/GST/HSN defaults to quantity one and editable tax/HSN fields. Unsupported currency is rejected.

Twenty 2.5 cannot scope application manifest references to custom catalog objects owned by another application. Therefore this app role reads workspace records (authenticated launch reads are additionally limited by the triggering user's access), writes only its own quote tables, and has UPLOAD_FILE/DOWNLOAD_FILE flags. It has no record deletion or settings-write permission. Anonymous callback execution is authorized by HMAC and the original signed session.

## Linux editor

1. Copy `.env.example` to an untracked `.env.production`. Set real public/editor/CRM URLs and the callback URL reachable from the editor server. HTTPS is required for production browser cookies. Generate `INVOIFY_HANDOFF_SECRET` with `openssl rand -hex 32`.
2. Copy `config/company.example.json` to a private configuration file, fill your business/bank details, and set `INVOIFY_PROFILE_FILE` to its host path for Compose. Keep deployment credentials and business configuration outside source control.
3. Set `INVOIFY_NUMBER_PREFIX` (e.g. Q or RF/Q, maximum five characters). `INVOIFY_NUMBER_START` seeds the first counter for each workspace/Indian financial year; set it to your highest existing sequence when migrating. Number gaps are allowed for abandoned sessions.
4. Run `docker compose -f deploy.compose.yml --env-file .env.production up -d --build`. Put an HTTPS reverse proxy in front of the configured loopback port.

The image builds on Linux, bundles Next's standalone server and installs system Chromium. Runtime URLs/secrets/company data are injected after build. `INVOIFY_SESSION_STORAGE_DIR` must be a persistent writable directory: it holds session records, finalized retry PDFs and numbering counters, protected by filesystem locks and atomic writes. Compose runs as non-root and uses a named volume. Back up that volume with Twenty's database/files and company configuration. Deploy one editor replica; multiple replicas require a shared filesystem with reliable exclusive-create locks, or a shared database/session store implementation. Do not mount a separate volume per replica.

Outside Docker: Node 24, `npm ci`, `npm run build`, then `PORT=3010 npm start`. Set `PUPPETEER_EXECUTABLE_PATH` if using a system browser. The port is supplied by deployment, not baked into npm scripts.

## Install the Twenty app

In the community app directory, export `TWENTY_API_URL` (backend URL reachable from the installer), `TWENTY_API_KEY` (workspace administrator installation credential), `TWENTY_PUBLIC_URL`, `INVOIFY_PUBLIC_URL`, `TWENTY_CALLBACK_URL`, and the same `INVOIFY_HANDOFF_SECRET` as the editor. Then on Linux:

```sh
corepack yarn install
yarn install:workspace
```

The installer discovers workspace bindings, compiles/registers the supported SDK manifest and sets application variables through the metadata API. Installation credentials remain in process memory rather than being written into the CLI's home configuration. Remove the installation key from the environment afterward. Runtime logic functions use Twenty's application token.

On Windows targeting a Linux Twenty server, build the app using `yarn sync:linux` between `yarn configure` and `node scripts/configure-installed.cjs`. `TWENTY_API_URL` inside Docker must be reachable from the build container (use your deployment URL or an appropriate host gateway). Twenty 2.5's Windows CLI emits backslash manifest paths; Linux building avoids that upstream incompatibility. Optional `TWENTY_DOWNLOAD_NETWORK` chooses the build container network; it is not an application runtime requirement.

After every install, confirm the app variables have the intended URLs/secret, the new Quotes navigation is visible to the intended users, and the application role is acceptable for your workspace. Do not use the supplied chat API key blindly: it did not authenticate against the restored local workspace.

## Verification

Completed locally: native Lead command → prefilled editor → edits → finalized PDF → return to the original Lead, with stored quote/line-item relations verified. The final Linux production image also passed two complete quote/PDF finalizations, retry and authorization checks. Production build, Windows startup, TypeScript checks, catalog mapping tests and GST regression tests passed. Production deployment has not been performed.

`npm run test:workflow` requires `TWENTY_API_URL`, `TWENTY_API_KEY` and `INVOIFY_PUBLIC_URL`, plus `TWENTY_PUBLIC_URL` for return-link assertions. It creates temporary company/product/Lead/join fixtures, verifies two complete finalizations, native PDF fields/line items/relations, one current quote, retry safety, tampered handoff rejection and unauthorized finalization rejection, then removes its fixture records through Twenty's DELETE API. Run only against a test workspace.

For browser launch checks, set `TWENTY_EMAIL`, `TWENTY_PASSWORD`, `TWENTY_WORKSPACE_ID`, CRM URLs and optionally `PLAYWRIGHT_CHANNEL`, then run `npx playwright test --config playwright.integration.config.ts`. It uses Twenty's supported workspace login link. Trace capture is disabled to avoid recording login tokens. `npm run test:e2e` retains GST arithmetic/validation regression tests; `yarn test` in the app checks catalog mappings.

The editor pins patched Next 15.5.27 and current PDF dependencies. `npm audit --omit=dev` reported zero vulnerabilities after locking the nested PostCSS override. The full development audit still reports the upstream braces advisory through Tailwind 3 and lint glob tooling; these build tools consume repository configuration, not quote content. A Tailwind 4 migration is separate work and is not required to run the quote extension.

## Audit and replacement

The existing GST editor/calculator/five-layout renderer were retained. Replaced the incomplete launch/session/callback implementation: it previously omitted product/client details, lacked runtime authentication, mixed legacy attachment uploads with quote creation and could treat partially saved records as complete. Removed the unmounted invoice wizard/actions/modals/13 legacy templates, browser draft/address-book paths and public invoice email/export/generate/warm routes. Removed fixed business defaults, donation/analytics scripts and old marketing metadata. Deployment does not contain workstation paths or local credentials.

Retain legacy CRM schema/data until reviewed for your production workspace. Replacing the app's code is separate from deleting historical CRM records. A production migration must inspect existing quote numbers/records and permissions before hiding or deleting a legacy object.
