# Install the quote extension and Invoify on the Real Films server

Updated 4 October 2026 after a read-only SSH inspection. These are instructions for you to execute later. Inspection used file/configuration reads, Docker metadata, HTTP/DNS checks and PostgreSQL SELECTs inside read-only transactions. No server files or code were edited, no packages were installed, and no services were restarted or deployed.

Target: existing Twenty **v2.5.1**, `https://crm.realfilms.co.in`, Ubuntu **22.04.5 LTS**, **ARM64/aarch64**, SSH `ubuntu@130.210.21.173`.

## What gets installed

There are two separate parts:

| Part | Local source | Server destination used in this guide |
| --- | --- | --- |
| Invoify quote editor and PDF server | `C:\Users\darsh\Desktop\invoify` | `/opt/realfilms-quotes/invoify` |
| Twenty community extension | `C:\Darsh\twenty\packages\twenty-apps\community\invoify-quotes` | `/opt/realfilms-quotes/twenty-app` |

You upload these two directories, not the entire Twenty repository. Invoify runs as a separate Docker service. The extension is installed into your existing Twenty workspace through its SDK/API; copying its files onto the server alone does not install it. You do not replace the running Twenty image or modify Twenty core.

This guide uses **`quotes.realfilms.co.in` as a proposed new editor hostname**. Create it in DNS or replace every occurrence with the hostname you actually choose. The server directory and port 3010 are deployment choices, not application source constants.

Result: Twenty Lead → Create Quote → editor with client/products → edits → Finalize → PDF download → Return to Twenty → saved Quotes record with Lead/client relations and line items.

## Actual server layout observed over SSH

| Item | Verified value |
| --- | --- |
| Deployment directory | `/home/ubuntu/twenty` |
| Compose file / environment file | `/home/ubuntu/twenty/docker-compose.yml` / `/home/ubuntu/twenty/.env` |
| Compose project / service names | `twenty`; `server`, `worker`, `db`, `redis` |
| Running CRM containers | `twenty-server-1`, `twenty-worker-1`, `twenty-db-1`, `twenty-redis-1` |
| Running version / architecture | Container `APP_VERSION=v2.5.1`; native `arm64` |
| Configured image tag | `twentycrm/twenty:latest` for both server and worker |
| Exact running image digest | `twentycrm/twenty@sha256:ca7d9ce34fb2d14fcdfa17eefabc85fd510d64200823ae8012771f9edf92f458` |
| Executable code location | Inside the image, `/app/packages/twenty-server`; no host Git/source checkout under `/home/ubuntu/twenty` |
| CRM port | Host `3000` → server container `3000`; currently published on all interfaces |
| PostgreSQL | `postgres:16`; container `twenty-db-1`; user `postgres`, database `default` |
| Database volume | `twenty_db-data` mounted at `/var/lib/postgresql/data` |
| CRM file/app storage | `STORAGE_TYPE=local`; `twenty_server-local-data` shared by server and worker at `/app/packages/twenty-server/.local-storage` |
| Storage host location | `/var/lib/docker/volumes/twenty_server-local-data/_data` |
| Docker network | `twenty_default` |
| Reverse proxy | Host-installed Nginx 1.18.0; `/etc/nginx/sites-available/crm`, enabled by symlink |
| CRM origin proxy | HTTP port 80, `crm.realfilms.co.in` → `http://localhost:3000` |
| Public CRM HTTPS | Responds through Cloudflare; Cloudflare SSL mode/dashboard settings were not accessible through SSH |
| Existing origin HTTPS | Nginx/Certbot HTTPS present for `n8n.realfilms.co.in`; no CRM HTTPS virtual host found in the inspected enabled sites |
| Other application to preserve | n8n: container `n8n-n8n-1`, port 5678, `/home/ubuntu/n8n`, separate Nginx site |
| Docker Compose / Certbot | Compose v5.5.0; Certbot 1.21.0; renewal timer active |
| Capacity at inspection | Approximately 184 GB free disk, 11 GiB RAM total, 9.4 GiB available; no swap |
| Proposed editor destination | `/opt/realfilms-quotes` does not exist yet; port 3010 is free |
| Proposed editor DNS | `quotes.realfilms.co.in` did not resolve at inspection |
| Workspace | `Real FIlms`, ACTIVE, ID `e42ad350-c958-4b31-81a4-23b5800e1699` |
| Installed applications | Only `Custom` and `Standard`; Invoify Quotes is not installed |
| Catalog compatibility | Required opportunity/company/person/product/leadProduct/service objects are active; required product price/name and Lead/product relations exist |
| Legacy quotes | Existing workspace `_quote` table contains **2 rows**; no customer details were read |
| Logic-function configuration | No `LOGIC_FUNCTION_TYPE` in rendered server/worker environment; no database override for this key; compiled default outside development is `DISABLED` |

The new destination folders below are proposed deployment locations, not existing production source directories. The rest of the guide now uses the verified PostgreSQL, Compose and Nginx paths. Keep the two legacy quote records until you have explicitly reviewed their migration/history requirements.

## 1. Check the existing server and take a backup

**Run on Windows PowerShell:**

```powershell
ssh ubuntu@130.210.21.173
```

**Run in the Ubuntu SSH shell:**

```bash
uname -m
sudo docker version
sudo docker compose version
sudo docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
sudo ss -ltnp | grep -E ':(80|443|3010)\b'
df -h
free -h
```

Expected architecture: `aarch64`. The actual services and locations are listed above; recheck before execution because the server may change after this inspection. Keep the running Twenty 2.5.1 image. The existing `latest` tag is mutable: do not run a blanket image pull/upgrade. Port 3010 was free; recheck it before deployment.

Since Twenty already runs here, Docker is likely installed. Reuse it. If Docker or Compose is missing, use the [official Ubuntu installation instructions](https://docs.docker.com/engine/install/ubuntu/), which support Ubuntu 22.04 and ARM64. Do not uninstall or replace the Docker engine underneath the running CRM as part of this guide.

Before installing the extension, back up your Twenty PostgreSQL database, existing uploaded files/object storage, and deployment configuration using your existing backup process. Confirm the backup can be restored. The extension adds schema, so an editor-only backup is insufficient.

For your verified PostgreSQL container, run:

```bash
mkdir -p "$HOME/quote-deployment-backups"
chmod 700 "$HOME/quote-deployment-backups"
sudo docker exec twenty-db-1 pg_dump -U postgres -d default -Fc \
  > "$HOME/quote-deployment-backups/twenty-before-quotes-$(date +%Y%m%d-%H%M%S).dump"
```

Check the command succeeded and the dump is nonempty. Also retain the deployment/proxy configuration and file volume:

```bash
cp /home/ubuntu/twenty/docker-compose.yml "$HOME/quote-deployment-backups/docker-compose.before-quotes.yml"
cp /home/ubuntu/twenty/.env "$HOME/quote-deployment-backups/twenty-env.before-quotes.private"
sudo cp /etc/nginx/sites-available/crm "$HOME/quote-deployment-backups/nginx-crm.before-quotes"
sudo tar -czf "$HOME/quote-deployment-backups/twenty-files-before-quotes-$(date +%Y%m%d-%H%M%S).tar.gz" \
  -C /var/lib/docker/volumes/twenty_server-local-data/_data .
```

The environment backup contains secrets. Keep this directory private and copy backups securely off-server. Arrange a maintenance/quiet period if you require a consistent database/files snapshot; a live file archive by itself does not establish consistency with a concurrent database dump.

### Required Twenty capabilities and schema

The production workspace must contain the same catalog structure used locally. Labels may differ, but API names and relations matter:

| Object | Required/used fields |
| --- | --- |
| `opportunity` (your Leads) | company relation; optional `pointOfContact` and `service` relations |
| `company` / `person` | client identity/contact/address; optional GST/state fields |
| `product` | `name` TEXT, `price` CURRENCY in INR; unit and optional description/warranty |
| `leadProduct` | `lead` and `product` relations |
| `service` | active object required by this installer; optional use on a Lead; price/name/unit |

The installer discovers workspace-specific identifiers; it does not create your existing product/catalog objects. Standard `opportunity` is the supported Lead source. If production uses a different custom Lead object, stop and adapt the extension before installation.

Twenty must support application installation, app UI components and logic functions. The inspected configuration currently defaults logic functions to disabled. Before installing this extension, enable **`LOGIC_FUNCTION_TYPE=LOCAL`** for server and worker. Merely adding it to `/home/ubuntu/twenty/.env` is insufficient: the existing Compose environment list does not pass this key.

For your later deployment, create a small override instead of replacing the existing Compose file:

```bash
cd /home/ubuntu/twenty
nano docker-compose.quotes.yml
```

Put the following in that new override. The digest pins the image that was actually running during inspection, avoiding an accidental `latest` upgrade:

```yaml
services:
  server:
    image: twentycrm/twenty@sha256:ca7d9ce34fb2d14fcdfa17eefabc85fd510d64200823ae8012771f9edf92f458
    environment:
      LOGIC_FUNCTION_TYPE: LOCAL
  worker:
    image: twentycrm/twenty@sha256:ca7d9ce34fb2d14fcdfa17eefabc85fd510d64200823ae8012771f9edf92f458
    environment:
      LOGIC_FUNCTION_TYPE: LOCAL
```

During your planned maintenance window, validate and apply this configuration. These are **future deployment commands**, not commands executed during inspection:

```bash
cd /home/ubuntu/twenty
sudo docker compose -p twenty -f docker-compose.yml -f docker-compose.quotes.yml config --quiet
sudo docker compose -p twenty -f docker-compose.yml -f docker-compose.quotes.yml up -d --no-deps --pull never server worker
sudo docker compose -p twenty -f docker-compose.yml -f docker-compose.quotes.yml ps
sudo docker exec twenty-server-1 printenv LOGIC_FUNCTION_TYPE APP_VERSION
sudo docker exec twenty-worker-1 printenv LOGIC_FUNCTION_TYPE APP_VERSION
```

This recreates only server/worker and briefly interrupts CRM requests. Database/Redis and n8n are not targeted. Preserve the shared `twenty_server-local-data` volume. Use both Compose files for subsequent Twenty operations so the override remains active. Keep existing configuration backups and recheck CRM health after the restart. Runtime configuration is not a core fork.

## 2. Package the current code on Windows

The completed source is also published in [Twenty-CRM](https://github.com/DarshShah10/Twenty-CRM) and [Invoify-](https://github.com/DarshShah10/Invoify-). You may use the Git alternative below instead of archive transfer. The production inventory above remains the read-only snapshot from 4 October 2026.

Use a new PowerShell window on your PC. Do not package from an old Git commit: the completed work includes new/untracked files. These commands package the actual working directories, excluding private configuration, caches and Windows dependencies.

```powershell
$bundleDir = Join-Path $env:TEMP ('realfilms-quotes-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $bundleDir | Out-Null

tar -czf "$bundleDir\invoify-source.tar.gz" --exclude=node_modules --exclude=.git --exclude='.next*' --exclude='.env*' --exclude=.quote-data --exclude=.cache --exclude=.twenty-local --exclude=test-results --exclude=playwright-report --exclude=__agent__ --exclude=tmp --exclude='*.tsbuildinfo' -C 'C:\Users\darsh\Desktop\invoify' .
if ($LASTEXITCODE -ne 0) { throw 'Invoify archive failed' }

tar -czf "$bundleDir\twenty-app-source.tar.gz" --exclude=node_modules --exclude=.git --exclude=.twenty --exclude=.twenty-local --exclude=.yarn --exclude='.env*' --exclude=workspace-report.json --exclude=src/generated --exclude='./src/generated' -C 'C:\Darsh\twenty\packages\twenty-apps\community\invoify-quotes' .
if ($LASTEXITCODE -ne 0) { throw 'Extension archive failed' }

Get-FileHash "$bundleDir\invoify-source.tar.gz","$bundleDir\twenty-app-source.tar.gz" -Algorithm SHA256
tar -tzf "$bundleDir\invoify-source.tar.gz"
tar -tzf "$bundleDir\twenty-app-source.tar.gz"
```

Review the file listings: the editor needs `Dockerfile`, `deploy.compose.yml`, `package.json`, `package-lock.json`, `app`, `lib`, `services`, `public`, and `config/company.example.json`. The extension needs `package.json`, `yarn.lock`, `.yarnrc.yml`, `src`, and `scripts`. Neither archive should contain `.env.local`, `.env.production`, private company profiles, `node_modules`, or `.twenty` output. Bindings under `src/generated` and `workspace-report.json` will be regenerated for production. The broad environment exclusion deliberately excludes `.env.example` too; step 5 supplies the production configuration in full.

## 3. Upload and extract both archives

**Run on Windows PowerShell, in the same window holding `$bundleDir`:**

```powershell
scp "$bundleDir\invoify-source.tar.gz" "$bundleDir\twenty-app-source.tar.gz" ubuntu@130.210.21.173:/home/ubuntu/
```

If your SSH connection requires a private key, use the same `-i 'PATH_TO_KEY'` option with both `ssh` and `scp`.

**Run on Ubuntu:**

```bash
sha256sum /home/ubuntu/invoify-source.tar.gz /home/ubuntu/twenty-app-source.tar.gz
sudo mkdir -p /opt/realfilms-quotes/{invoify,twenty-app,private,backups}
sudo chown -R ubuntu:ubuntu /opt/realfilms-quotes
chmod 700 /opt/realfilms-quotes/private /opt/realfilms-quotes/backups
tar -xzf /home/ubuntu/invoify-source.tar.gz -C /opt/realfilms-quotes/invoify
tar -xzf /home/ubuntu/twenty-app-source.tar.gz -C /opt/realfilms-quotes/twenty-app
ls -la /opt/realfilms-quotes/invoify
ls -la /opt/realfilms-quotes/twenty-app
```

Compare the SHA256 values with Windows. These extraction commands assume a first install into the new directories. For updates, use the release/backup procedure in step 10 rather than mixing old and new files blindly.

### Alternative to steps 2–3: clone the published repositories on Ubuntu

For a first install, this fetches the editor directly and copies only the community app from the Twenty checkout. It does not touch `/home/ubuntu/twenty`, the running CRM deployment directory:

```bash
sudo mkdir -p /opt/realfilms-quotes/{private,backups}
sudo chown -R ubuntu:ubuntu /opt/realfilms-quotes
chmod 700 /opt/realfilms-quotes/private /opt/realfilms-quotes/backups
git clone --branch main --depth 1 https://github.com/DarshShah10/Invoify-.git /opt/realfilms-quotes/invoify
git clone --branch main --depth 1 https://github.com/DarshShah10/Twenty-CRM.git /opt/realfilms-quotes/twenty-source
mkdir /opt/realfilms-quotes/twenty-app
cp -a /opt/realfilms-quotes/twenty-source/packages/twenty-apps/community/invoify-quotes/. /opt/realfilms-quotes/twenty-app/
```

Choose either archives or this alternative; do not run both into populated directories. For private repositories, authenticate Git with your approved SSH/deploy-key or credential-manager setup; do not embed a GitHub token in the clone URL. Record each checkout's `git rev-parse HEAD` for the deployment. Continue with step 4 and regenerate production bindings during installation.

## 4. Create the editor DNS record

In the DNS provider for `realfilms.co.in`, add:

| Type | Name | Value |
| --- | --- | --- |
| A | `quotes` | `130.210.21.173` |

Your current CRM is proxied by Cloudflare. Add the new `quotes` A record as **DNS only initially**, allowing the new editor host to use direct origin HTTPS in step 7. Do not change the existing `crm` record or the zone-wide Cloudflare SSL mode: the inspected CRM origin currently serves HTTP only. You may proxy the editor later after confirming its HTTPS/certificate settings, cache rules and callback behavior. Remove/fix a conflicting AAAA record unless IPv6 is correctly configured.

On Ubuntu, check resolution:

```bash
getent ahostsv4 quotes.realfilms.co.in
```

Your cloud ingress rules and existing host firewall must allow public 80/443 for the reverse proxy. Keep editor port 3010 bound to loopback; do not open it publicly.

## 5. Set private company details and environment

**Run on Ubuntu:**

```bash
cp /opt/realfilms-quotes/invoify/config/company.example.json /opt/realfilms-quotes/private/company.json
nano /opt/realfilms-quotes/private/company.json
```

Replace the example supplier name/address/state and fill GSTIN, email/phone, bank account/IFSC, terms and other needed fields. Keep JSON syntax valid. `state` is the two-digit GST state code, not a state name. Empty optional fields can remain empty. This file is private business configuration; do not upload it to a public repository.

The runtime container reads the profile as the non-root `node` user. The private parent directory remains 700 on the host; make the mounted file readable inside the container:

```bash
chmod 644 /opt/realfilms-quotes/private/company.json
cd /opt/realfilms-quotes/invoify
umask 077
cat > .env.production <<'EOF'
INVOIFY_PUBLIC_URL=https://quotes.realfilms.co.in
TWENTY_PUBLIC_URL=https://crm.realfilms.co.in
TWENTY_CALLBACK_URL=https://crm.realfilms.co.in/s/invoify/finalize-quote
INVOIFY_HANDOFF_SECRET=
INVOIFY_SESSION_STORAGE_DIR=/var/lib/invoify/sessions
INVOIFY_COMPANY_PROFILE_PATH=/etc/invoify/company.json
INVOIFY_NUMBER_PREFIX=Q
INVOIFY_NUMBER_START=0
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
INVOIFY_PROFILE_FILE=/opt/realfilms-quotes/private/company.json
INVOIFY_BIND_ADDRESS=127.0.0.1
INVOIFY_PORT=3010
EOF
quote_secret=$(openssl rand -hex 32)
sed -i "s/^INVOIFY_HANDOFF_SECRET=$/INVOIFY_HANDOFF_SECRET=$quote_secret/" .env.production
unset quote_secret
chmod 600 .env.production
nano .env.production
```

Review URLs and numbering. Set the prefix you want (1–5 characters, letters/numbers/slash/hyphen). If continuing an existing quote sequence, set `INVOIFY_NUMBER_START` to the highest already-used number for the current Indian financial year before the first session. New counters start above this seed. Once counters exist, editing the seed does not reset them. Keep this deployment's counter volume even during upgrades.

The callback must match exactly in the editor and installed app and must reach Twenty's backend route through your CRM proxy. The URLs here assume `crm.realfilms.co.in` serves both CRM frontend and backend APIs. If your backend has a separate origin, use that origin for `TWENTY_API_URL` and the callback, while keeping `TWENTY_PUBLIC_URL` as the browser CRM URL.

Do not put a Twenty API key in the editor runtime file. It only needs the signing secret; Twenty's runtime functions use their application token.

## 6. Build and start Invoify on ARM64

**Run on Ubuntu:**

```bash
cd /opt/realfilms-quotes/invoify
sudo docker compose -p realfilms-quotes -f deploy.compose.yml --env-file .env.production up -d --build
sudo docker compose -p realfilms-quotes -f deploy.compose.yml --env-file .env.production ps
sudo docker compose -p realfilms-quotes -f deploy.compose.yml --env-file .env.production logs --tail=100 quotes
curl -I http://127.0.0.1:3010/en
sudo docker compose -p realfilms-quotes -f deploy.compose.yml --env-file .env.production exec quotes uname -m
sudo docker compose -p realfilms-quotes -f deploy.compose.yml --env-file .env.production exec quotes /usr/bin/chromium --version
```

Build on the server so dependencies/images match ARM64. Do not copy Windows `node_modules`, `.next` or a previously built AMD64 image. The Dockerfile uses Debian Bookworm system Chromium; [Debian publishes it for ARM64](https://packages.debian.org/bookworm/chromium). No Google Chrome AMD64 installer is needed.

The local Linux workflow was verified, but this specific ARM64 server has not been tested. Successful build/start is followed by the real PDF check in step 9. First builds need network access to image/package registries and enough disk/RAM; diagnose resource errors before changing the running CRM.

Opening `/en` directly shows instructions to launch from a Lead. That is expected: a real editable quote requires a signed Twenty session.

## 7. Add HTTPS through the existing reverse proxy

Host-installed Nginx already owns ports 80/443. Use it to add the new hostname. Preserve `/etc/nginx/sites-available/crm`, `/etc/nginx/sites-available/n8n` and their existing enabled links. Do not start a second proxy.

### Your verified host Nginx setup

Create a separate site:

```bash
sudo nano /etc/nginx/sites-available/realfilms-quotes
```

Initial HTTP configuration:

```nginx
server {
    listen 80;
    server_name quotes.realfilms.co.in;
    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
```

Enable and validate it:

```bash
sudo ln -s /etc/nginx/sites-available/realfilms-quotes /etc/nginx/sites-enabled/realfilms-quotes
sudo nginx -t
sudo systemctl reload nginx
```

Reload only after `nginx -t` succeeds. If the link already exists, do not create it again. If Certbot is not already managed another way, install/use it:

```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d quotes.realfilms.co.in
```

Certbot is already installed and its renewal timer is active; the installation command above is only needed if that changes. Choose HTTPS redirection for the **quotes hostname only**, provide your real administrative email when prompted, and follow the existing renewal process. Verify:

```bash
curl -I https://quotes.realfilms.co.in/en
curl -I https://crm.realfilms.co.in
```

### CRM proxy requirement

Your existing `/etc/nginx/sites-available/crm` already proxies every path under `/` to Twenty at `http://localhost:3000`, so no separate backend hostname or new route mapping is needed. That includes `/metadata`, `/rest`, `/s/invoify/quote-session`, `/s/invoify/finalize-quote` and native file routes.

No custom request-size/timeouts were found in the inspected Nginx site/global configuration. During deployment, add these lines **inside the existing CRM `server { ... }` block**, preserving its current routing and all other directives:

```nginx
client_max_body_size 25m;
proxy_read_timeout 180s;
proxy_send_timeout 180s;
```

Edit `/etc/nginx/sites-available/crm`, then run `sudo nginx -t` and reload only if validation succeeds. The callback contains the PDF, so the CRM proxy also needs adequate limits. Nginx normally forwards the required `Authorization` and `x-invoify-signature` request headers; do not add rules stripping them. Cloudflare must also allow these API/callback paths without an interactive login/challenge or inappropriate caching. Cloudflare dashboard rules were not inspected over SSH.

## 8. Install the extension into the production workspace

In the browser, log into the correct workspace at `https://crm.realfilms.co.in` as an administrator. Create a fresh installation API key using Twenty's API key settings. It must be able to read metadata and install/configure applications in this workspace. Use a suitable expiry and revoke the installation key after completion. Do not reuse the API key pasted in chat as an assumed production credential.

The following creates a private temporary installer environment. It copies the editor's secret/URLs so both parts agree, then reads the API key without showing it or placing the literal key in shell history.

**Run on Ubuntu:**

```bash
cd /opt/realfilms-quotes/invoify
umask 077
cp .env.production /opt/realfilms-quotes/private/installer.env
printf '\nTWENTY_API_URL=https://crm.realfilms.co.in\n' >> /opt/realfilms-quotes/private/installer.env
read -rsp 'Paste the production workspace installation API key: ' quote_install_key
printf '\n'
printf 'TWENTY_API_KEY=%s\n' "$quote_install_key" >> /opt/realfilms-quotes/private/installer.env
unset quote_install_key
chmod 600 /opt/realfilms-quotes/private/installer.env
```

If the backend origin differs from the frontend, edit `TWENTY_API_URL` in this temporary file. Keep values one per line with no shell `export` prefix. Do not print this file into logs.

Install using a native Linux Node 24 container; no Node installation on Ubuntu is required:

```bash
sudo docker run --rm --init \
  --env-file /opt/realfilms-quotes/private/installer.env \
  --mount type=bind,source=/opt/realfilms-quotes/twenty-app,target=/app \
  --workdir /app \
  node:24-bookworm \
  sh -c 'corepack yarn install && node scripts/configure-workspace.cjs && node scripts/run-cli.cjs dev --once && node scripts/configure-installed.cjs'
```

The pinned SDK/client are **2.5.0**, tested against Twenty **2.5.1**. Keep the included lockfile. The `dev --once` command applies once and exits; it is the version-appropriate installer command, not a requirement to keep a development server running. New upstream docs have newer CLI commands; do not substitute them without upgrading/revalidating this extension.

The command does three important things after dependency installation:

1. Discovers production object/field identifiers and generates production bindings. A missing catalog object/relation fails here before the app sync.
2. Registers the app, native Create Quote action, logic functions, app-owned Quotes and Quote Line Items, views/relations and role.
3. Sets the installed app's editor URL, signing secret, callback URL, CRM URL and schema mapping through Twenty's metadata API.

Expected final message: **`Application variables configured. No secrets were printed.`** A failure means installation is not complete; check the error before continuing. Do not repeatedly install different app identities.

Refresh Twenty and inspect the installed **Invoify Quotes** app, new Quotes navigation, native Lead action and intended user access. Twenty 2.5's app permission limitation means this app reads workspace records and writes only its own quote tables, with upload/download permissions. Authenticated launch reads are further constrained by the triggering user's access. Review that role before enabling it for production users.

If API names differ, edit the installer environment and rerun discovery using the supported overrides: `TWENTY_PRODUCT_OBJECT`, `TWENTY_SERVICE_OBJECT`, `TWENTY_LEAD_PRODUCT_OBJECT`, `TWENTY_SOURCE_COMPANY_FIELD`, `TWENTY_SOURCE_PERSON_FIELD`, `TWENTY_SOURCE_SERVICE_FIELD`, `TWENTY_JOIN_LEAD_FIELD`, `TWENTY_JOIN_PRODUCT_FIELD`. Relation mapping values use foreign-key names such as `companyId`, `leadId`, `productId`. The source remains standard `opportunity`. Do not guess UUIDs or copy local bindings.

When installation and acceptance succeed, revoke the temporary API key in Twenty, then remove its file:

```bash
rm /opt/realfilms-quotes/private/installer.env
```

Removing the installer key does not stop runtime quoting. Do not remove the editor's `.env.production` or signing secret.

## 9. Perform one production acceptance check

Use a clearly identified test Lead/client and a catalog product in the correct workspace. Avoid changing a live customer's sales data. One manual flow is enough for initial acceptance:

1. Open the Lead. Click **Create Quote**, then **Open prefilled quote** if shown in the action panel.
2. Confirm the correct client, address/contact information and products/service. Missing catalog GST/HSN remains editable; quantity defaults to one where no source quantity exists.
3. Edit quantity, unit price, tax, quote dates and terms. Check the displayed totals and your company/bank profile.
4. Finalize and download the PDF. Open it and confirm the layout, quote number, customer, items, GST and total.
5. Click **Return to Twenty**. Confirm it returns to the original Lead.
6. In the new Quotes table, check quote number, FINALIZED status, total, Lead/client relations, PDF/download field, created/updated/finalized dates and line items.
7. Retry the same finalized document once. It should return the same result without an extra quote. A changed finalized document requires a fresh quote from the Lead.

The old legacy Quote object remains separate; check the new app-owned Quotes table. The production legacy `_quote` table currently has **two rows**; existing historical records are not automatically migrated/deleted. Review their numbers before selecting the new sequence seed. Hide obsolete navigation/actions only after confirming the new path and retaining any needed history. If removing the test quote, use the intended administrator record cleanup process; do not uninstall the whole app.

Do not run `npm run test:workflow` against production as a substitute for this manual check: that script creates and deletes fixture records and is intended for a test workspace.

## 10. Updates, backups and rollback

Keep the exact source archives and lockfiles for each deployed release. Save the current editor image before a subsequent rebuild if you want immediate image rollback. Before updating, back up the extension source/generated deployment outputs, private configuration, Twenty database/files and editor session volume. Extract updates into clean release directories so deleted legacy files do not reappear. Keep the same Compose project name **`realfilms-quotes`**, or deliberately attach the existing volume when changing layouts.

The editor's named volume **`realfilms-quotes_quote-sessions`** holds sessions, quote numbering counters and cached finalized PDFs. Confirm its actual name with `sudo docker volume ls`. Use one editor replica; this implementation needs a shared locking-capable store before independent replicas can be used.

An editor-volume backup with a brief quoting pause:

```bash
cd /opt/realfilms-quotes/invoify
sudo docker compose -p realfilms-quotes -f deploy.compose.yml --env-file .env.production stop quotes
sudo docker run --rm \
  --mount type=volume,source=realfilms-quotes_quote-sessions,target=/data,readonly \
  --mount type=bind,source=/opt/realfilms-quotes/backups,target=/backup \
  debian:bookworm-slim \
  sh -c 'tar -czf /backup/quote-sessions-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .'
sudo docker compose -p realfilms-quotes -f deploy.compose.yml --env-file .env.production start quotes
```

Verify the backup succeeded before relying on it. Encrypt/copy backups off-server according to your existing process. Back up `.env.production` and `private/company.json` securely too. Keep the signing secret consistent between editor/app; rotating it invalidates outstanding sessions.

To update the editor, transfer reviewed source, preserve configuration/volume, then rerun the build/start command in step 6. To update the extension, recreate a temporary installer environment and rerun step 8 against the same app identity. Recheck one quote flow after a version change.

If rollout fails, pause the editor and disable/hide its launch action for users while investigating. Restore the prior editor release/image and configuration if one exists. Extension schema changes need an app-aware rollback; do not uninstall blindly, delete quote tables, or restore a production database over new unrelated CRM activity. Coordinate a maintenance window and an appropriate restore plan if database rollback is necessary.

**Never use `docker compose down -v`, Docker volume pruning, or counter deletion as an update/fix step.** Those can remove persistent numbering/session data.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Editor 502 | Quote container logs; host port; proxy upstream; container proxy cannot use host loopback |
| Direct editor says launch from Lead | Expected; open it using the native Create Quote action |
| No Create Quote button | Correct workspace; Lead is standard opportunity; app installed; triggering user access; refresh browser |
| Installer says missing object/field | Production catalog contract/override names; service object is required by current discovery |
| Installer 401/403 | Fresh key in correct workspace; API origin; admin installation permissions |
| Function execution disabled/fails | Twenty LOCAL/LAMBDA driver and storage/runtime configuration; server/worker logs |
| Prefill empty/wrong | Lead's company/contact, leadProduct joins, product relation and supported INR prices |
| Signature/callback mismatch | Same secret and exact callback in editor/app; no trailing-slash mismatch; proxy forwards signature header |
| Finalize times out | Chromium/container resources; CRM callback reachability; backend/file permissions; proxy timeouts/body limit |
| Number collision | Migration seed and preserved session volume; do not reset counters |
| JSON/profile permission error | Valid company JSON; bind path exists as a file; mounted file readable by node user |
| Build resource/network failure | Disk/RAM, ARM64-native images, DNS/outbound registry access; do not replace CRM containers |

Use targeted logs; do not share `.env` contents, API keys, handoff URLs or browser login tokens in support screenshots/logs.

## References and validation limits

- [Project architecture and deployment notes](DEPLOYMENT.md): the implemented schema, version constraints and local verification results.
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/): supported OS/architecture and installation options.
- [Debian Bookworm Chromium](https://packages.debian.org/bookworm/chromium): system browser packages including ARM64.
- [Twenty current app quick start](https://github.com/twentyhq/twenty/blob/main/packages/twenty-docs/developers/extend/apps/getting-started/quick-start.mdx): current architecture; newer CLI examples are not a replacement for this project's pinned 2.5 installer.

Local validation covered the native Lead launch, editable prefill, PDF generation, return link, saved relations/line items, authorization and retry behavior, plus a Linux production-image build/workflow. Read-only production inspection additionally confirmed the paths, proxy topology, workspace/catalog metadata, image version/digest, volumes and current runtime prerequisites recorded above. No production quote/PDF test or installation was run. ARM64 PDF execution and the post-install acceptance flow remain future deployment checks. No server configuration was changed to update this guide.
