# mailias

<p align="center">
  <img src="./public/favicon.svg" width="120" alt="mailias icon"/>
</p>

<p align="center">
  <strong>Self-hosted email alias manager powered by Cloudflare Email Routing</strong><br/>
  Create, toggle, and send from your aliases — authenticated via Pocket ID.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" />
  <img src="https://img.shields.io/badge/Vue-3-brightgreen?logo=vue.js" />
  <img src="https://img.shields.io/badge/Node.js-22-green?logo=node.js" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker" />
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20IT-orange" />
  <img src="https://img.shields.io/badge/License-MIT-lightgrey" />
</p>

---

## What it does

Mailias is a self-hosted web app that lets you manage your **Cloudflare Email Routing** aliases and send email from them — all from a clean mobile-friendly interface. Access is protected by **Pocket ID**, a self-hosted OIDC provider, so only you can log in.

---

## Why Mailias

If you own a domain on Cloudflare, **Email Routing** lets you create unlimited
aliases on that domain for free — `anything@yourdomain.com` forwarded wherever
you want, no subscription required. The catch: Cloudflare only handles
*inbound* mail. There is no native way to reply or send a new message from one
of those aliases.

The obvious alternative is a provider like **Proton Mail** or **Tuta**, which
support custom domains and outbound sending — but only on a paid plan. On their
free tiers you are locked to their own domains (`@proton.me`, `@tuta.com`), so
your aliases cannot carry your own domain name.

**Mailias bridges that gap.** It sits on top of Cloudflare Email Routing and
adds the missing outbound layer through your own SMTP provider or Resend,
giving you unlimited aliases on your domain with full send-and-receive — at no
per-alias cost:

| | Proton / Tuta free | Proton / Tuta paid | Cloudflare alone | Cloudflare + Mailias |
|---|---|---|---|---|
| Receive on custom domain aliases | ❌ | ✅ | ✅ | ✅ |
| Unlimited aliases | ❌ | ✅ | ✅ | ✅ |
| Send from custom domain aliases | ❌ | ✅ | ❌ | ✅ |
| Self-hosted | ❌ | ❌ | ✅ | ✅ |
| Monthly cost | Free | €/month | Free | Free + SMTP costs |

---

## Architecture

```
Browser (Vue 3 SPA)
  └── OIDC login  ──────────────────────► Pocket ID
  └── API calls (Bearer token) ─────────► Backend (Node.js or Cloudflare Worker)
                                               └── Alias management ─► Cloudflare Email Routing API
                                               └── Send email       ─► SMTP / Resend / CF Workers Email
```

The backend comes in two flavours — choose one:

| Flavour | Where it runs | Best for |
|---------|--------------|---------|
| **Node.js container** | Your server via Docker Compose | Full self-hosting with Nginx Proxy Manager |
| **Cloudflare Worker** | Cloudflare edge | Zero-server setup, native email binding |

---

## Features

### 📬 Alias management
- List all Cloudflare Email Routing rules at a glance
- Create new aliases with a custom local part and forwarding destination
- Toggle aliases on/off without deleting them
- Update the destination address of an existing alias inline
- Delete aliases you no longer need
- Full-text search across alias and destination

### ✉️ Email composer
- Send email from any of your active aliases
- Set a custom Reply-To address
- Attach files (base64 encoded, multipart MIME)
- Supports three sending backends: **Resend**, **SMTP** (Mailgun, etc.), or **Cloudflare Workers Email**

### 📥 Inbox (reply by forwarding)
- Forward a received email from your real inbox to a dedicated address on your
  own domain — it lands in the mailias Inbox panel
- One click **Reply** opens Compose with To, Subject (`Re: …`, prefixes deduped)
  and the original message pre-filled — no more retyping or losing the thread
- **From** is auto-matched to whichever of your aliases the email originally
  arrived on, so replies always go out with the alias, never your real address
- Captured by a small Cloudflare Worker via Email Routing — no second domain
  needed. See
  [Reply by forwarding](#reply-by-forwarding-setup) below

### 📤 Sent
- Every email sent through mailias (Compose or Reply) is logged locally
- Browse the full history — from, to, subject, date, attachment count

### 🔐 Authentication
- OIDC login via [Pocket ID](https://github.com/pocket-id/pocket-id) (self-hosted)
- JWT verification with JWKS — no shared secrets in the frontend
- Single-user lockdown via `ALLOWED_SUB` (your Pocket ID subject claim)
- Automatic silent token renewal

### 🌍 Internationalisation
- UI available in **Italian** and **English**
- Language auto-detected from browser settings
- Preference persisted in `localStorage`
- Toggle available on every page (login included)

### 🐳 Docker-first deployment
- Multi-stage Docker build for the Vue frontend (Vite → Nginx)
- Minimal Node.js backend image
- Single `docker-compose.yaml` with health checks and restart policies
- All secrets passed via environment variables — nothing hardcoded

---

## Requirements

- A domain managed by **Cloudflare** with **Email Routing** enabled
- A **Pocket ID** instance (self-hosted OIDC provider)
- Docker + Docker Compose (for the Node.js backend path)
- **OR** a Cloudflare account with Workers enabled (for the Worker backend path)
- An SMTP provider or Resend account (optional — only needed for email sending)

---

## Quick start (Docker Compose)

### 1. Clone the repository

```bash
git clone https://github.com/amletoflorio/Mailias.git
cd mailias
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in every value. See the [Environment variables](#environment-variables) section below for a full explanation.

### 3. Set up Pocket ID

1. Open your Pocket ID dashboard → **OIDC Clients** → **New Client**
2. Set **Name** to `mailias`
3. Add **Redirect URIs**:
   - `https://mailias.yourdomain.com/callback` (production)
   - `http://localhost:5173/callback` (local development)
4. Copy the **Client ID** → paste it into `VITE_OIDC_CLIENT_ID` in your `.env`
5. Make sure your user is assigned to the application
6. Find your **subject claim** (`sub`) — see [Finding your ALLOWED_SUB](#finding-your-allowed_sub)

### 4. Create a Cloudflare API token

Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Custom Token**:

| Permission | Value |
|-----------|-------|
| Zone > Email Routing Rules | Edit |
| Zone > Zone | Read |

Scope both permissions to your specific domain. Copy the generated token → `CF_API_TOKEN` in `.env`.

### 5. Find your Cloudflare Zone ID

In the Cloudflare dashboard, click your domain → scroll down the right sidebar → copy **Zone ID** → paste into `CF_ZONE_ID` in `.env`.

### 6. Start the containers

```bash
docker compose up -d --build
```

This builds and starts two containers:
- `mailias-frontend` — Nginx serving the compiled Vue SPA on port `7080`
- `mailias-backend` — Node.js API on port `8787`

Check they are healthy:

```bash
docker compose ps
docker compose logs -f
```

### 7. Expose via Nginx Proxy Manager

Add two proxy hosts in Nginx Proxy Manager (or any reverse proxy):

| Domain | Forward to | Port |
|--------|-----------|------|
| `mailias.yourdomain.com` | `mailias-frontend` | `7080` |
| `api-mailias.yourdomain.com` | `mailias-backend` | `8787` |

Enable SSL for both. Make sure both containers are on the `npm_default` network (already set in `docker-compose.yaml`).

> **Cloudflare Tunnel alternative:** If you use a Cloudflare Tunnel instead of Nginx Proxy Manager, point the tunnel hostnames to `localhost:7080` and `localhost:8787` respectively.

---

## Alternative: Cloudflare Worker backend

If you prefer to run the backend on Cloudflare's edge rather than your own server:

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Configure `wrangler.toml`

Edit `worker/wrangler.toml` and fill in your values:

```toml
name = "mailias-api"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
CF_ACCOUNT_ID = "your_account_id"
CF_ZONE_ID    = "your_zone_id"
CF_DOMAIN     = "yourdomain.com"
OIDC_ISSUER   = "https://pocket-id.yourdomain.com"
OIDC_JWKS_URI = "https://pocket-id.yourdomain.com/.well-known/jwks.json"

[[send_email]]
name = "EMAIL"
```

> The `[[send_email]]` binding enables the native Cloudflare Workers Email API. Your domain must be verified in Cloudflare Email Routing and the destination address must be verified as well. See the [Cloudflare docs](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/) for details.

### 3. Set secrets

```bash
cd worker
wrangler secret put CF_API_TOKEN    # your Cloudflare API token
wrangler secret put ALLOWED_EMAIL   # your authorised email address
```

### 4. Deploy

```bash
wrangler deploy
```

Copy the Worker URL (e.g. `https://mailias-api.yourusername.workers.dev`) → set it as `VITE_API_BASE_URL` in your frontend `.env`.

---

## Reply by forwarding (setup)

This lets you forward a received email from your real inbox (e.g. Tuta) to a
dedicated address on your **own domain**, and have it show up in the mailias
Inbox panel ready to reply — From/To/Subject already filled in, always sent
from the alias.

Capture is handled by a small standalone Cloudflare Worker
(`inbound-worker/`), triggered by a Cloudflare Email Routing rule — the same
free, unlimited routing engine already forwarding your aliases to your real
inbox. No second domain, no extra MX records, no conflict with your existing
routing.

> Why not just add a Mailgun route? Mailgun's inbound routing requires
> verifying a domain in your Mailgun account, and free/lower-tier plans cap
> you at one verified domain. Authenticating outbound SMTP through a
> different domain than the one your aliases live on breaks DKIM/SPF
> alignment for the alias domain — real deliverability risk. The Worker
> route avoids all of that: Cloudflare Email Routing already owns your
> domain's MX, at no extra cost.

> 📖 For a fuller walkthrough — including deploying `wrangler` on a machine
> that has no `npm` (common on NAS Node.js packages), authenticating
> headless via an API token instead of `wrangler login`, and where to look
> at logs on both sides — see
> [docs/REPLY_BY_FORWARDING.md](docs/REPLY_BY_FORWARDING.md).

### 1. Pick a capture address and create the Email Routing rule

Choose a local part on your existing domain that you'll only use for this,
e.g. `reply@yourdomain.com`. In the Cloudflare dashboard → your zone →
**Email** → **Email Routing** → **Routing rules** → **Create address**:
- **Custom address**: `reply@yourdomain.com`
- **Action**: **Send to a Worker** (not "Send to an email" — you haven't
  deployed the Worker yet, so leave this rule disabled or come back after step 2)

### 2. Generate a shared secret

```bash
openssl rand -hex 32
```

Set the same value in two places:
- `.env` at the project root → `INBOUND_SECRET=<value>`
- The Worker's secret (next step)

### 3. Deploy the Worker

```bash
cd inbound-worker
npm install -g wrangler   # if not already installed
wrangler login
npm install
wrangler secret put INBOUND_SECRET   # paste the same value as above
```

Edit `inbound-worker/wrangler.toml` and set `BACKEND_URL` to your backend's
public inbound endpoint, e.g. `https://api-mailias.yourdomain.com/inbound`.
Then deploy:

```bash
wrangler deploy
```

### 4. Point the Email Routing rule at the Worker

Back in the Cloudflare dashboard → **Email Routing** → **Routing rules** →
edit the rule from step 1 → **Action**: **Send to a Worker** → select
`mailias-inbound` (the name from `wrangler.toml`) → **Save**.

### 5. Redeploy the backend

```bash
docker compose up -d --build backend
```

### 6. Use it

Save `reply@yourdomain.com` as a contact in your real inbox. Whenever you
want to reply to something through mailias, forward that message to it as-is
(don't send as attachment — mailias parses the quoted header block your mail
client inserts on forward to recover the original sender and recipient).
It appears in the mailias **Inbox** tab within seconds; click **Reply** to
jump into Compose with everything pre-filled.

> ℹ️ If your mail client's forward format can't be parsed (varies by client),
> the item still lands in Inbox with just the subject cleaned up — you fill
> To/From manually, same as before, just without retyping the subject.

### Troubleshooting

- **Nothing shows up in Inbox** — check the Worker's logs:
  `wrangler tail mailias-inbound` (from `inbound-worker/`), then forward a
  test email. A line like `Email from:… to:… - Ok` means the Worker ran
  without throwing — it does **not** by itself confirm the backend received
  the POST, since neither side logs on success. The definitive check is
  opening the mailias **Inbox** tab after forwarding a test email.
- **Backend logs show `INBOUND_SECRET not set`** — the env var isn't reaching
  the container; confirm it's under `environment:` for the `backend` service
  in `docker-compose.yaml` (already wired) and that `.env` has a value, then
  redeploy: `docker compose up -d --build backend`.
- **Backend logs show `secret mismatch`** — the value in `.env` doesn't match
  what you set with `wrangler secret put INBOUND_SECRET`. Regenerate one
  value and set it in both places.
- **`wrangler: command not found`** after `npm install -g wrangler` — the
  global npm bin dir often isn't on `PATH` on NAS devices. Try `npx wrangler
  <command>` instead, or see the full guide for a no-npm workaround.
- **`npm: command not found` even though `node` works** — some NAS Node.js
  packages (e.g. Synology's) ship without npm. See
  [docs/REPLY_BY_FORWARDING.md](docs/REPLY_BY_FORWARDING.md) for a
  self-contained bootstrap that doesn't need root/package-manager access.
- **`wrangler login` hangs or fails** on a headless machine (NAS, server with
  no browser) — the OAuth flow expects the browser to run on the same host as
  the CLI. Use an API token instead: create one at
  [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens)
  with **Account → Workers Scripts → Edit**, **User → User Details → Read**,
  and **User → Memberships → Read**, then `export CLOUDFLARE_API_TOKEN=...`
  before running `wrangler` commands (all three permissions are required —
  Wrangler calls `/memberships` and `/user` internally even for a plain
  deploy, and fails with a generic `Authentication error [code: 10000]` if
  any one is missing).
- **`wrangler deploy` asks about a `workers.dev` subdomain** — Wrangler 3.x
  needs *some* publish target even for an email-triggered Worker with no
  `fetch()` handler. Accepting it is harmless: there's no `fetch()` handler,
  so the public URL serves nothing. Pick any unclaimed name.

---

## Environment variables

All variables live in a single `.env` file at the project root. The Docker Compose build injects the `VITE_*` variables at build time via `ARG`/`ENV`. The remaining variables are injected at runtime into the backend container.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_OIDC_AUTHORITY` | ✅ | Base URL of your Pocket ID instance, e.g. `https://id.yourdomain.com` |
| `VITE_OIDC_CLIENT_ID` | ✅ | Client ID from Pocket ID → OIDC Clients → mailias |
| `VITE_OIDC_REDIRECT_URI` | ✅ | `https://mailias.yourdomain.com/callback` |
| `VITE_OIDC_POST_LOGOUT_REDIRECT_URI` | ✅ | `https://mailias.yourdomain.com` |
| `VITE_CF_DOMAIN` | ✅ | Your Cloudflare domain, e.g. `yourdomain.com` |
| `VITE_API_BASE_URL` | ✅ | Public URL of the backend, e.g. `https://api-mailias.yourdomain.com` |
| `CF_ZONE_ID` | ✅ | Zone ID from the Cloudflare dashboard (right sidebar of your domain) |
| `CF_API_TOKEN` | ✅ | Cloudflare API token with Email Routing Rules (Edit) + Zone (Read) |
| `ALLOWED_SUB` | ✅ | Your Pocket ID subject claim (`sub`) — see below |
| `FRONTEND_URL` | ✅ | Public URL of the frontend — used by the backend for CORS validation, e.g. `https://mailias.yourdomain.com` |
| `FRONTEND_URL_DEV` | ☑️ | Optional second allowed CORS origin for local development, e.g. `http://localhost:5173` |
| `SMTP_HOST` | ⚠️ | SMTP hostname, e.g. `smtp.mailgun.org` — required if using SMTP sending |
| `SMTP_PORT` | ⚠️ | SMTP port, typically `587` |
| `SMTP_SECURE` | ⚠️ | `true` for port 465 (TLS), `false` for STARTTLS |
| `SMTP_USER` | ⚠️ | SMTP username |
| `SMTP_PASS` | ⚠️ | SMTP password |
| `RESEND_API_KEY` | ⚠️ | [Resend](https://resend.com) API key — alternative to SMTP |
| `INBOUND_SECRET` | ☑️ | Shared secret with `inbound-worker/` — required only for the [reply-by-forwarding](#reply-by-forwarding-setup) Inbox feature. Generate with `openssl rand -hex 32` |
| `DB_PATH` | ☑️ | Path to the SQLite file backing the Inbox feature. Defaults to `./data/mailias.db`; set to `/app/data/mailias.db` in Docker (already set in `docker-compose.yaml`) |

> ⚠️ At least one of `SMTP_HOST` or `RESEND_API_KEY` must be set for email sending to work. If both are set, Resend takes precedence.

> ℹ️ `FRONTEND_URL` must be set correctly or all API calls from the browser will be blocked by CORS. It must match the exact origin (protocol + domain, no trailing slash) from which the frontend is served.

---

## Finding your ALLOWED_SUB

The `ALLOWED_SUB` value is the `sub` claim from your Pocket ID JWT. To find it:

1. Log in to mailias at least once (you can leave `ALLOWED_SUB` empty temporarily)
2. Open the browser developer tools → **Application** → **Local Storage**
3. Find the `oidc.user:...` key and expand the JSON
4. Copy the value of `"sub"` (a UUID, e.g. `8b3c034f-a76d-44f0-9e54-...`)
5. Set it as `ALLOWED_SUB` in `.env` and restart the backend:

```bash
docker compose restart backend
```

---

## Local development

```bash
# Install dependencies
npm install

# Copy and fill in the environment file
cp .env.example .env.local

# Start the dev server (Vite HMR on http://localhost:5173)
npm run dev
```

For local development to work against the Docker backend, add this line to your `.env`:

```properties
FRONTEND_URL_DEV=http://localhost:5173
```

Then rebuild:

```bash
docker compose up -d --build backend
```

For the backend, you can also run it directly without Docker:

```bash
cd backend
npm install
node index.js
```

---

## Project structure

```
mailias/
├── src/
│   ├── assets/
│   │   └── main.css               # Design system (CSS variables, components)
│   ├── composables/
│   │   ├── useAuth.js             # OIDC / Pocket ID integration (oidc-client-ts)
│   │   └── useCloudflare.js       # API client for backend calls
│   ├── i18n/
│   │   ├── index.js               # vue-i18n setup, locale detection, setLocale()
│   │   ├── en.js                  # English strings
│   │   └── it.js                  # Italian strings
│   ├── stores/
│   │   ├── aliases.js             # Pinia store for alias state
│   │   ├── inbox.js               # Pinia store for pending forwarded emails
│   │   └── sent.js                # Pinia store for the sent-emails history
│   ├── router/
│   │   └── index.js               # Vue Router with auth guard
│   └── views/
│       ├── LoginView.vue          # Login page
│       ├── CallbackView.vue       # OIDC redirect callback handler
│       ├── AliasesView.vue        # Alias list and management
│       ├── ComposeView.vue        # Email composer with attachment support
│       ├── InboxView.vue          # Forwarded emails awaiting reply
│       └── SentView.vue           # History of emails sent through mailias
├── backend/
│   ├── index.js                   # Node.js HTTP server (API proxy)
│   ├── package.json
│   └── Dockerfile                 # Node 22 Alpine image
├── worker/
│   ├── index.js                   # Cloudflare Worker (alternative backend)
│   └── wrangler.toml              # Wrangler configuration
├── inbound-worker/
│   ├── index.js                   # Cloudflare Worker: parses forwarded emails, POSTs to backend
│   ├── package.json               # postal-mime dependency
│   └── wrangler.toml              # Wrangler configuration
├── frontend/
│   ├── Dockerfile                 # Multi-stage: Vite build → Nginx serve
│   └── nginx.conf                 # Nginx SPA config (history mode fallback)
├── public/
│   ├── favicon.svg
│   └── site.webmanifest           # PWA manifest
├── docker-compose.yaml
├── .env.example
└── vite.config.js
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, Vite, Vue Router, Pinia |
| Internationalisation | vue-i18n v9 (EN / IT) |
| Styling | Plain CSS with custom design system |
| Auth | oidc-client-ts (PKCE flow) + Pocket ID |
| Backend (Docker) | Node.js 22, jose (JWT), nodemailer |
| Backend (Edge) | Cloudflare Workers, Workers Email binding |
| Email sending | SMTP (nodemailer), Resend API, or Cloudflare Workers Email |
| Alias management | Cloudflare Email Routing REST API |
| Containerisation | Docker, Docker Compose, Nginx (Alpine) |

---

## API reference

The backend exposes a small REST API, protected by Bearer token (Pocket ID JWT).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — no auth required |
| `GET` | `/aliases` | List all email routing rules |
| `POST` | `/aliases` | Create a new alias |
| `PATCH` | `/aliases/:id` | Update enabled state or destination |
| `DELETE` | `/aliases/:id` | Delete an alias |
| `POST` | `/send` | Send an email from an alias |
| `GET` | `/inbox` | List forwarded emails awaiting reply |
| `DELETE` | `/inbox/:id` | Dismiss a pending inbox item |
| `POST` | `/inbound` | Called by `inbound-worker/` — not Bearer-protected, verified via shared secret header instead. See [Reply by forwarding](#reply-by-forwarding-setup) |
| `GET` | `/sent` | History of emails sent through mailias (most recent 200) |
| `DELETE` | `/sent/:id` | Remove an item from the sent history |

---

## Security notes

- The Cloudflare API token is **never** exposed to the browser — all Cloudflare API calls go through the backend.
- Authentication is enforced on every backend route via JWT verification against the Pocket ID JWKS endpoint.
- The `ALLOWED_SUB` guard ensures only your specific account can authenticate, even if other users exist in Pocket ID.
- CORS is locked to the origin(s) declared in `FRONTEND_URL` (and optionally `FRONTEND_URL_DEV`). Both variables must match the exact origin from which the frontend is served — no trailing slash.

---

## FAQ

### How do I reply to an email I received?

Mailias is a **sender**, not a full email client — it doesn't read your inbox on its own. When someone writes to one of your aliases, the message is forwarded by Cloudflare to your real inbox. Two ways to reply from there:

**Fastest — forward it into mailias** (requires the [reply-by-forwarding setup](#reply-by-forwarding-setup)):

1. In your real inbox, forward the message to your configured capture address (e.g. `reply@yourdomain.com`)
2. Open **Inbox** in mailias — the message appears within seconds
3. Click **Reply** — Compose opens with From (alias), To, and Subject already filled in
4. Write your reply and send

**Manual — always works, no extra setup:**

1. Open **Compose**
2. **From** — select the alias that received the original email (e.g. `shop@yourdomain.com`)
3. **To** — paste the sender's address
4. **Reply-To** — leave it empty (it defaults to the alias) or set it explicitly
5. **Subject** — prefix with `Re: ` followed by the original subject (e.g. `Re: Your order`)
6. **Message** — write your reply; optionally quote the original text manually

---

### How do I forward a message to someone else?

Same principle as replying:

1. In your real inbox, copy the body of the message you want to forward
2. Open **Compose** in Mailias
3. **From** — choose the alias you want to forward from
4. **To** — the recipient you want to forward to
5. **Subject** — prefix with `Fwd: ` followed by the original subject
6. **Message** — paste the original content; add any introductory note on top
7. Attach any files from the original if needed

---

### Can I send from an alias that is currently toggled off?

No. The **From** dropdown in Compose only shows aliases that are **active** (toggled on). Enable the alias first in the Aliases view, then come back to Compose.

---

### My API calls fail with a CORS error. What should I do?

This almost always means `FRONTEND_URL` is missing or wrong in your `.env`. Make sure:

1. `FRONTEND_URL` is set to the exact public URL of the frontend, e.g. `https://mailias.yourdomain.com` — no trailing slash, correct protocol.
2. The variable is present in the `environment` section of the **backend** service in `docker-compose.yaml` (it is not injected automatically from the `.env` file alone).
3. After editing `.env`, rebuild the backend: `docker compose up -d --build backend`

For local development, also add `FRONTEND_URL_DEV=http://localhost:5173` and rebuild.

---

### I get `Invalid value "undefined" for header "Access-Control-Allow-Origin"` in the backend logs.

This is the same root cause as the CORS error above: `FRONTEND_URL` is not reaching the backend process. Check that it appears under `environment:` in `docker-compose.yaml` for the `backend` service, then restart.

---

### The PWA icon looks zoomed in on Android.

The `site.webmanifest` ships with both icons set to `"purpose": "maskable"`. Maskable icons are designed to be cropped by Android into circles or rounded squares, so the OS zooms in and uses only the central 80% of the image. If the icon looks too big, either:

- Redesign the icon PNG to have ~10% padding on all sides (use [maskable.app](https://maskable.app/editor) to preview), **or**
- Change one entry to `"purpose": "any"` in `public/site.webmanifest` so Android uses it as-is without cropping.

---

### How do I add a new language?

1. Create `src/i18n/xx.js` (where `xx` is the BCP 47 language code) by copying `en.js` and translating all values.
2. Import and register it in `src/i18n/index.js`:
   ```js
   import xx from './xx'
   // add to messages:
   messages: { it, en, xx }
   ```
3. Update the `detectLocale()` function if you want the new language to be auto-detected from the browser.
4. Add the toggle button logic in `App.vue` and `LoginView.vue`.

> ⚠️ vue-i18n's message compiler treats `@` as a linked-message prefix and `'` (ASCII apostrophe) as an ICU escape character. In locale files, escape email addresses as `{'@'}` and use the Unicode right single quotation mark `'` (U+2019) instead of the straight apostrophe in any string value.

---

### Emails sent from Mailias land in spam. What can I do?

This is a deliverability issue unrelated to Mailias itself. Common fixes:

- Make sure your domain has valid **SPF**, **DKIM**, and **DMARC** DNS records.
- If using SMTP, verify that the sending domain matches the `From` address.
- If using Resend, verify your domain in the Resend dashboard and send from `alias@yourdomain.com` (not a free subdomain).
- Cloudflare Email Routing does not support outbound sending natively — you need an SMTP provider or Resend even when using the Worker backend.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Credits

App developed by **Amlet**