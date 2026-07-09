# Reply by forwarding — full setup guide

This is the complete, step-by-step version of the "Reply by forwarding"
feature setup summarized in the main [README](../README.md#reply-by-forwarding-setup).
It includes the rough edges you're likely to hit on a headless box (NAS,
home server) with no browser and possibly no `npm` — all based on a real
deployment, not just the happy path.

If you're on a normal desktop/laptop with Node.js already installed, skip
straight to [Deploying the Worker](#3-deploy-the-worker) — most of the
friction here is specific to headless/NAS environments.

## What you're building

```
Your real inbox (Tuta, Gmail, ...)
        │  you manually forward a message to reply@yourdomain.com
        ▼
Cloudflare Email Routing (already handles your domain's MX)
        │  rule: reply@yourdomain.com → Send to a Worker
        ▼
inbound-worker (Cloudflare Worker, runs on Cloudflare's edge)
        │  parses the MIME message, extracts original sender/recipient
        │  from the quoted forward header block, POSTs clean JSON
        ▼
mailias backend  →  POST /inbound (authenticated via shared secret header)
        │  stores it in SQLite
        ▼
mailias Inbox panel (browser) → click Reply → Compose pre-filled
```

No second domain, no extra DNS/MX records, no Mailgun receiving domain.
Cloudflare Email Routing already owns your domain's MX — we just add one
more routing rule that points at a Worker instead of a mailbox.

**Why not use Mailgun's inbound routing instead?** Mailgun requires
verifying a domain in your account, and free/lower tiers cap you at one
verified domain — which conflicts with the domain your aliases (and their
DKIM/SPF) already live on. Authenticating outbound SMTP through a *different*
domain than your alias domain breaks DKIM/SPF alignment for your aliases —
a real deliverability risk, not a cosmetic one. The Worker route sidesteps
this entirely.

---

## 1. Pick a capture address and create the Email Routing rule

Pick a local part on your **existing** domain you won't use for anything
else, e.g. `reply@yourdomain.com`.

Cloudflare dashboard → your zone → **Email** → **Email Routing** →
**Routing rules** → **Create address**:

- **Custom address**: `reply@yourdomain.com`
- **Action**: **Send to a Worker**

The Worker doesn't exist yet, so the dropdown will be empty — that's fine,
you'll come back and point it at `mailias-inbound` in [step 6](#6-point-the-email-routing-rule-at-the-worker).

## 2. Generate a shared secret

This is how the Worker authenticates itself to the backend — the Worker
can't hold a Bearer/OIDC token like the browser does, so a shared secret
header stands in for it.

```bash
openssl rand -hex 32
```

Save the output. You'll use the exact same value in two places: the
backend's `.env` and the Worker's secret store.

## 3. Deploy the Worker

The Worker's code already lives in `inbound-worker/` in the repo — you're
not writing anything, just installing dependencies (`postal-mime`, `wrangler`)
and pushing it to Cloudflare's edge with `wrangler deploy`.

### 3a. If you have Node.js + npm

```bash
cd inbound-worker
npm install -g wrangler   # skip if already installed
npm install
```

Skip to [step 4](#4-authenticate-wrangler).

### 3b. If `npm` isn't available (common on NAS Node.js packages)

Some NAS vendors (Synology's official Node.js package is one) ship `node`
without `npm` at all — `node -v` works, `npm -v` says command not found,
and there's no `npm` or `npm-cli.js` anywhere on disk (`find / -xdev -iname
'npm-cli.js'` comes back empty). Don't try to hack the system Node.js
install; bootstrap a throwaway copy of npm instead, entirely inside your
own writable directories — no root, no touching `/usr`:

```bash
cd inbound-worker

# Download npm directly from the registry — this only needs curl, not npm
curl -o /tmp/npm.tgz https://registry.npmjs.org/npm/-/npm-10.8.2.tgz
mkdir -p /tmp/npm-bootstrap
tar xzf /tmp/npm.tgz -C /tmp/npm-bootstrap

# Sanity check
node /tmp/npm-bootstrap/package/bin/npm-cli.js -v

# Use it to install this project's dependencies (reads package.json,
# installs postal-mime + wrangler into inbound-worker/node_modules/)
node /tmp/npm-bootstrap/package/bin/npm-cli.js install
```

From here on, `wrangler` is available locally at `node_modules/.bin/wrangler`
— every command below that says `wrangler ...` means
`node_modules/.bin/wrangler ...` in this setup (or `npx wrangler ...` if
`npx` happens to work, but on a from-scratch bootstrap it usually doesn't
either — the explicit path is the reliable option).

> If `npm install -g wrangler` succeeded but the shell still says `wrangler:
> command not found`, that's a `PATH` issue, not a missing package — the
> global npm bin directory isn't on your shell's `PATH`. `npx wrangler
> <command>` sidesteps it without editing `PATH`.

## 4. Authenticate wrangler

`wrangler login` opens a browser and waits for an OAuth redirect back to a
local port. That works fine on a desktop. On a headless box (NAS, server
with no display) it hangs or fails outright — the browser has nowhere to run,
and even opening the URL from a *different* machine doesn't work, because the
OAuth callback needs to reach the CLI's own local listener.

Use an API token instead — no browser involved at any point:

1. [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → **Custom token**
2. Add these three permissions (all three — Wrangler calls both `/user` and
   `/memberships` internally even for a plain deploy, and fails with an
   opaque `Authentication error [code: 10000]` if any one is missing):
   - **Account → Workers Scripts → Edit**
   - **User → User Details → Read**
   - **User → Memberships → Read**
3. Create the token, copy it

```bash
export CLOUDFLARE_API_TOKEN=paste-your-token-here
```

Keep this exported for the rest of the session — every `wrangler` command
below picks it up automatically from the environment. If you open a new
shell, re-export it.

> If you already created a token with just "Edit Cloudflare Workers" and hit
> `Authentication error [code: 10000]`, edit that same token (no need to
> regenerate it — editing permissions doesn't change the token string) and
> add the two missing `User` permissions above.

## 5. Configure the Worker

Edit `inbound-worker/wrangler.toml`:

```toml
[vars]
BACKEND_URL = "https://api-mailias.yourdomain.com/inbound"
```

Set this to your backend's actual public URL, with `/inbound` appended.

Then upload the secret from step 2 (this also creates the Worker if it
doesn't exist yet — answer "yes" if prompted):

```bash
wrangler secret put INBOUND_SECRET
# paste the value from step 2 when prompted, press enter
```

## 6. Deploy

```bash
wrangler deploy
```

You'll likely hit this prompt on first deploy:

```
You need to register a workers.dev subdomain before publishing to workers.dev
Would you like to register a workers.dev subdomain now? (Y/n)
```

Answer **yes**. Wrangler 3.x needs *some* publish target even for a
Worker that's only triggered by email, not HTTP. This is harmless — the
Worker exports only an `email()` handler, no `fetch()` handler, so the
resulting public URL responds with nothing useful even if someone finds it.
It'll then ask for a subdomain name (account-wide, shared across all your
Workers) — any short, globally-unique string works, e.g. your name or
domain without dots.

On success you'll see something like:

```
Deployed mailias-inbound triggers (6.99 sec)
  https://mailias-inbound.<your-subdomain>.workers.dev
Current Version ID: ...
```

## 7. Point the Email Routing rule at the Worker

Back in the Cloudflare dashboard → **Email** → **Email Routing** →
**Routing rules** → edit the rule from step 1 → **Action**: **Send to a
Worker** → select **mailias-inbound** → **Save**.

## 8. Configure and redeploy the backend

In the mailias project's `.env` (on the machine running Docker Compose —
this can be a *different* machine than the one you used for `wrangler`):

```bash
INBOUND_SECRET=<same value as step 2>
```

```bash
docker compose up -d --build backend
```

Verify the value actually landed in the container:

```bash
docker compose exec backend env | grep INBOUND_SECRET
```

## 9. Test it end to end

Save `reply@yourdomain.com` as a contact in your real inbox for convenience.

Forward any email you've received to `reply@yourdomain.com` **as-is** — not
as an attachment. Mailias parses the quoted header block (`From:`, `To:`,
`Subject:`) that mail clients insert into the body on forward to recover the
original sender and recipient; sending as an attachment hides that from the
parser.

### Watching it happen (logs)

Two log streams, ideally in two terminals, **before** you forward the test
email:

```bash
# Terminal 1 — Worker logs (from inbound-worker/, on whichever machine has wrangler)
wrangler tail mailias-inbound
```

```bash
# Terminal 2 — backend logs (on the machine running Docker Compose)
docker compose logs -f backend
```

What to expect:

- **Worker log**: a line like `Email from:you@youremail.com
  to:reply@yourdomain.com size:12345 - Ok`. This confirms Cloudflare handed
  the email to the Worker and the handler didn't throw — it does **not** by
  itself confirm the POST to the backend succeeded, since the Worker only
  logs on failure (`inbound worker error`), not success.
- **Backend log**: normally **silent on success** — the backend only logs on
  auth failure (`INBOUND_SECRET not set`, `secret mismatch`) or a thrown
  exception. No output here is expected, not a bad sign.

The one unambiguous confirmation: open mailias in the browser → **Inbox**
tab. If the forwarded message appears there, the entire chain worked —
Worker → backend → SQLite → frontend.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `wrangler: command not found` after global install | npm global bin dir not on `PATH` (common on NAS) | Use `npx wrangler <cmd>`, or the full path `node_modules/.bin/wrangler` for a local install |
| `npm: command not found`, but `node` works | Some NAS Node.js packages ship without npm | Bootstrap npm manually — see [step 3b](#3b-if-npm-isnt-available-common-on-nas-nodejs-packages) |
| `wrangler login` hangs / never completes | Headless machine, no browser to complete OAuth | Use `CLOUDFLARE_API_TOKEN` instead — see [step 4](#4-authenticate-wrangler) |
| `Authentication error [code: 10000]` on any wrangler command, even though the account/token show up | Token is missing `User → User Details → Read` and/or `User → Memberships → Read` — Wrangler needs these even for basic operations, not just Workers Scripts | Edit the token (same token, no need to regenerate) and add both permissions |
| `wrangler deploy` asks about a `workers.dev` subdomain and errors if you decline | Wrangler 3.x requires a publish target (route or workers.dev) even for email-only Workers | Accept it — harmless, no `fetch()` handler is exposed |
| Nothing appears in mailias Inbox after forwarding | Several possible causes — see the logs walkthrough above | Check `wrangler tail` first (did the Worker receive the email at all?), then `docker compose logs -f backend` for `INBOUND_SECRET not set` / `secret mismatch`, then double-check the Email Routing rule really points at `mailias-inbound` |
| Backend log: `INBOUND_SECRET not set in this container` | `.env` wasn't picked up, or the container wasn't rebuilt after editing it | `docker compose exec backend env \| grep INBOUND_SECRET` to check; if empty, confirm `.env` has the value and rerun `docker compose up -d --build backend` |
| Backend log: `secret mismatch` | The Worker's secret (`wrangler secret put INBOUND_SECRET`) and the backend's `.env` value don't match | Regenerate one value with `openssl rand -hex 32` and set it in **both** places again |
| Inbox item has empty From/To fields | The forwarding mail client's header block format wasn't recognized by the parser | Not a failure — the item still lands in Inbox with the subject cleaned up; fill From/To manually in Compose. If this happens consistently with your mail client, open an issue with a sample forwarded body (redact real addresses) so the parser regex can be extended |

## Updating the Worker later

Any time you change `inbound-worker/index.js` or `wrangler.toml`, redeploy
with the same command from [step 6](#6-deploy) — no need to repeat the
secret or the Email Routing rule, both persist:

```bash
cd inbound-worker
wrangler deploy
```
