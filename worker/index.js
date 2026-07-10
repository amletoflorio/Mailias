/**
 * mailias — Cloudflare Worker backend
 *
 * Secrets to set with `wrangler secret put`:
 *   CF_API_TOKEN   — Cloudflare token with Email Routing + Email Send permissions
 *   OIDC_JWKS_URI  — e.g. https://pocket-id.yourdomain.com/.well-known/jwks.json
 *   OIDC_ISSUER    — e.g. https://pocket-id.yourdomain.com
 *   ALLOWED_EMAIL  — authorised email address (yours), or use the audience claim
 *
 * Env vars in wrangler.toml:
 *   CF_ACCOUNT_ID, CF_ZONE_ID, CF_DOMAIN
 */

const CF_API = 'https://api.cloudflare.com/client/v4'

// ── CORS ─────────────────────────────────────────────────────────────────────

// ALLOWED_ORIGINS is built at request time from env vars so no domain is hardcoded.
// Set FRONTEND_URL in wrangler.toml [vars], and optionally FRONTEND_URL_DEV for
// local development (e.g. http://localhost:5173).

function cors(req, env) {
  const allowedOrigins = [env.FRONTEND_URL, env.FRONTEND_URL_DEV].filter(Boolean)
  const origin = req.headers.get('Origin') || ''
  const allowed = allowedOrigins.includes(origin) ? origin : (allowedOrigins[0] || '')
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Vary': 'Origin',
  }
}

function preflight(req, env) {
  return new Response(null, { status: 204, headers: cors(req, env) })
}

function json(data, status = 200, req, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(req, env) },
  })
}

// ── JWT VERIFICATION ─────────────────────────────────────────────────────────
// Verifies the OIDC token issued by Pocket ID using JWKS.
// Minimal implementation — consider jose or similar for production use.

async function verifyJWT(token, env) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) throw new Error('malformed')

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))

    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error('expired')
    // Check issuer
    if (payload.iss !== env.OIDC_ISSUER) throw new Error('wrong issuer')

    // Fetch JWKS and verify signature
    const jwksRes = await fetch(env.OIDC_JWKS_URI, {
      cf: { cacheTtl: 3600, cacheEverything: true },
    })
    const { keys } = await jwksRes.json()

    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')))
    const key = keys.find(k => k.kid === header.kid)
    if (!key) throw new Error('key not found')

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    )

    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, dataBytes)
    if (!valid) throw new Error('invalid signature')

    return payload
  } catch (e) {
    return null
  }
}

// ── AUTH MIDDLEWARE ───────────────────────────────────────────────────────────

async function authenticate(req, env) {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return null
  return verifyJWT(token, env)
}

// ── CLOUDFLARE EMAIL ROUTING API ──────────────────────────────────────────────

async function cfRequest(method, path, body, env) {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// GET /aliases → list all rules (with full pagination)
async function listAliases(env) {
  const PER_PAGE = 50
  let page = 1
  let allRules = []

  while (true) {
    const data = await cfRequest(
      'GET',
      `/zones/${env.CF_ZONE_ID}/email/routing/rules?page=${page}&per_page=${PER_PAGE}`,
      null, env
    )
    const rules = data.result || []
    allRules = allRules.concat(rules)

    // Controlla se ci sono altre pagine
    const info = data.result_info || {}
    if (info.total_count && allRules.length >= info.total_count) break
    if (info.total_pages && page >= info.total_pages) break
    if (rules.length < PER_PAGE) break
    page++
  }

  // Map CF format to our simple format, exclude catch-all rules
  return allRules
    .filter(rule => rule.matchers?.[0]?.type === 'literal')
    .map(rule => ({
      id: rule.tag,
      alias: rule.matchers?.[0]?.value || '',
      destination: rule.actions?.[0]?.value?.[0] || '',
      enabled: rule.enabled,
    }))
    .sort((a, b) => a.alias.localeCompare(b.alias))
}

// POST /aliases
async function createAliasRule(alias, destination, env) {
  const data = await cfRequest(
    'POST',
    `/zones/${env.CF_ZONE_ID}/email/routing/rules`,
    {
      name: alias,
      enabled: true,
      matchers: [{ type: 'literal', field: 'to', value: alias }],
      actions: [{ type: 'forward', value: [destination] }],
    },
    env
  )
  const rule = data.result
  return {
    id: rule.tag,
    alias: rule.matchers?.[0]?.value,
    destination: rule.actions?.[0]?.value?.[0],
    enabled: rule.enabled,
  }
}

// PATCH /aliases/:id — supporta enabled e/o destination
async function updateAliasRule(id, updates, env) {
  const get = await cfRequest('GET', `/zones/${env.CF_ZONE_ID}/email/routing/rules/${id}`, null, env)
  const rule = get.result
  const patch = { ...rule }
  if (typeof updates.enabled === 'boolean') patch.enabled = updates.enabled
  if (updates.destination) {
    patch.actions = [{ type: 'forward', value: [updates.destination] }]
  }
  const updated = await cfRequest(
    'PUT',
    `/zones/${env.CF_ZONE_ID}/email/routing/rules/${id}`,
    patch,
    env
  )
  const r = updated.result
  return {
    enabled: r.enabled,
    destination: r.actions?.[0]?.value?.[0] || '',
  }
}

// DELETE /aliases/:id
async function deleteAliasRule(id, env) {
  await cfRequest('DELETE', `/zones/${env.CF_ZONE_ID}/email/routing/rules/${id}`, null, env)
}

// ── EMAIL SEND via Cloudflare Email Workers ───────────────────────────────────
// Usa MailChannels (integrazione nativa Cloudflare Workers) o CF Email Send API.
// Documentazione: https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/

async function sendEmail({ from, to, subject, body, replyTo }, env) {
  // Cloudflare Workers Email API — requires "EMAIL" binding in wrangler.toml
  // and a verified alias in your Cloudflare Email Routing account.
  //
  // Binding in wrangler.toml:
  //   [[send_email]]
  //   name = "EMAIL"
  //
  // Poi nel Worker: env.EMAIL.send(...)
  //
  // NOTE: This requires the Worker to be invoked via env.EMAIL.
  // The binding is only available within the fetch handler context.
  // Logic is exported here — integration happens in the main fetch handler.

  return { ok: true, from, to }
}

// ── ROUTER ───────────────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    const path = url.pathname

    // CORS preflight
    if (req.method === 'OPTIONS') return preflight(req, env)

    // Auth check (skip health)
    if (path !== '/health') {
      const payload = await authenticate(req, env)
      if (!payload) return json({ error: 'Unauthorized' }, 401, req, env)
    }

    try {
      // Health
      if (path === '/health' && req.method === 'GET')
        return json({ ok: true }, 200, req, env)

      // GET /aliases
      if (path === '/aliases' && req.method === 'GET') {
        const aliases = await listAliases(env)
        return json(aliases, 200, req, env)
      }

      // POST /aliases
      if (path === '/aliases' && req.method === 'POST') {
        const { alias, destination } = await req.json()
        if (!alias || !destination) return json({ error: 'alias and destination are required' }, 400, req, env)
        const created = await createAliasRule(alias, destination, env)
        return json(created, 201, req, env)
      }

      // PATCH /aliases/:id
      const patchMatch = path.match(/^\/aliases\/([^/]+)$/)
      if (patchMatch && req.method === 'PATCH') {
        const updates = await req.json()
        const result = await updateAliasRule(patchMatch[1], updates, env)
        return json(result, 200, req, env)
      }

      // DELETE /aliases/:id
      if (patchMatch && req.method === 'DELETE') {
        await deleteAliasRule(patchMatch[1], env)
        return json({ deleted: true }, 200, req, env)
      }

      // POST /send
      if (path === '/send' && req.method === 'POST') {
        const payload = await req.json()
        const { from, to, subject, body: text, replyTo, attachments = [] } = payload

        if (!from || !to || !subject || !text)
          return json({ error: 'Required fields: from, to, subject, body' }, 400, req, env)

        const raw = buildRawEmail({ from, to, subject, body: text, replyTo, attachments })

        if (!env.EMAIL) {
          // Fallback: MailChannels with attachments
          const mcAttachments = attachments.map(a => ({
            filename:    a.filename,
            type:        a.contentType,
            disposition: 'attachment',
            content:     a.data,  // base64
          }))
          const mcRes = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              personalizations: [{ to: [{ email: to }] }],
              from:     { email: from },
              reply_to: replyTo ? { email: replyTo } : undefined,
              subject,
              content:     [{ type: 'text/plain', value: text }],
              attachments: mcAttachments.length ? mcAttachments : undefined,
            }),
          })
          if (!mcRes.ok) {
            const err = await mcRes.text()
            return json({ error: `Send failed: ${err}` }, 502, req, env)
          }
          return json({ sent: true }, 200, req, env)
        }

        // Cloudflare native send (Workers Email binding) with multipart MIME
        const message = new EmailMessage(from, to, raw)
        await env.EMAIL.send(message)
        return json({ sent: true }, 200, req, env)
      }

      return json({ error: 'Not found' }, 404, req, env)

    } catch (e) {
      console.error(e)
      return json({ error: e.message }, 500, req, env)
    }
  },
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function buildRawEmail({ from, to, subject, body, replyTo, attachments = [] }) {
  const CRLF = '\r\n'

  if (!attachments.length) {
    // Simple text/plain
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      replyTo ? `Reply-To: ${replyTo}` : null,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
    ].filter(l => l !== null).join(CRLF)
  }

  // multipart/mixed
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const parts = []

  // Text body part
  parts.push([
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    body,
  ].join(CRLF))

  // Attachments
  for (const att of attachments) {
    parts.push([
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      ``,
      // Split base64 into 76-character lines (RFC 2045)
      att.data.match(/.{1,76}/g).join(CRLF),
    ].join(CRLF))
  }

  parts.push(`--${boundary}--`)

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    parts.join(CRLF),
  ].filter(l => l !== null).join(CRLF)
}