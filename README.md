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
│   │   └── aliases.js             # Pinia store for alias state
│   ├── router/
│   │   └── index.js               # Vue Router with auth guard
│   └── views/
│       ├── LoginView.vue          # Login page
│       ├── CallbackView.vue       # OIDC redirect callback handler
│       ├── AliasesView.vue        # Alias list and management
│       └── ComposeView.vue        # Email composer with attachment support
├── backend/
│   ├── index.js                   # Node.js HTTP server (API proxy)
│   ├── package.json
│   └── Dockerfile                 # Node 22 Alpine image
├── worker/
│   ├── index.js                   # Cloudflare Worker (alternative backend)
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

---

## Security notes

- The Cloudflare API token is **never** exposed to the browser — all Cloudflare API calls go through the backend.
- Authentication is enforced on every backend route via JWT verification against the Pocket ID JWKS endpoint.
- The `ALLOWED_SUB` guard ensures only your specific account can authenticate, even if other users exist in Pocket ID.
- CORS is locked to the origin(s) declared in `FRONTEND_URL` (and optionally `FRONTEND_URL_DEV`). Both variables must match the exact origin from which the frontend is served — no trailing slash.

---

## FAQ

### How do I reply to an email I received?

Mailias is a **sender**, not a full email client. When someone writes to one of your aliases, the message is forwarded by Cloudflare to your real inbox. You then reply from Mailias like this:

1. Open **Compose**
2. **From** — select the alias that received the original email (e.g. `shop@yourdomain.com`)
3. **To** — paste the sender's address
4. **Reply-To** — leave it empty (it defaults to the alias) or set it explicitly
5. **Subject** — prefix with `Re: ` followed by the original subject (e.g. `Re: Your order`)
6. **Message** — write your reply; optionally quote the original text manually

> ℹ️ There is no "Reply" button that auto-fills fields from a received message because Mailias does not read your inbox — it only sends. Your real email client handles incoming mail; Mailias handles the outgoing side from your aliases.

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