/**
 * mailias backend — Node.js HTTP adapter
 * Supports attachments via multipart/mixed MIME.
 */
import { createServer } from 'node:http'
import crypto from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import nodemailer from 'nodemailer'
import Database from 'better-sqlite3'

const PORT            = process.env.PORT          || 8787
const CF_API_TOKEN    = process.env.CF_API_TOKEN
const CF_ZONE_ID      = process.env.CF_ZONE_ID
const OIDC_ISSUER     = process.env.OIDC_ISSUER
const OIDC_JWKS       = process.env.OIDC_JWKS_URI
const ALLOWED_SUB     = process.env.ALLOWED_SUB
const INBOUND_SECRET  = process.env.INBOUND_SECRET
const DB_PATH         = process.env.DB_PATH || './data/mailias.db'
const CF_API          = 'https://api.cloudflare.com/client/v4'

const JWKS = createRemoteJWKSet(new URL(OIDC_JWKS))

// ── INBOX STORE (forwarded emails awaiting reply) ────────────────────────────
mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new Database(DB_PATH)
db.exec(`
  CREATE TABLE IF NOT EXISTS inbox_items (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    original_from TEXT,
    original_from_name TEXT,
    original_to TEXT,
    subject TEXT,
    body TEXT,
    replied INTEGER DEFAULT 0
  )
`)

// ── SENT STORE (history of emails sent through mailias) ──────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS sent_items (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    from_alias TEXT,
    "to" TEXT,
    reply_to TEXT,
    subject TEXT,
    body TEXT,
    attachment_count INTEGER DEFAULT 0
  )
`)

async function authenticate(req) {
  const auth  = req.headers['authorization'] || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: OIDC_ISSUER })
    // Pocket ID access token does not include email — we use sub instead
    if (ALLOWED_SUB && payload.sub !== ALLOWED_SUB) return null
    return payload
  } catch { return null }
}

async function cfRequest(method, path, body) {
  const res = await fetch(`${CF_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

// FRONTEND_URL must be set in .env, e.g. https://mailias.yourdomain.com
// Optionally add FRONTEND_URL_DEV=http://localhost:5173 for local development.
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_DEV,
].filter(Boolean)

function cors(res, req) {
  const origin = req?.headers?.['origin'] || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin',  allowed)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.setHeader('Vary', 'Origin')
}

function send(res, status, data, req) {
  cors(res, req)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

async function readBody(req) {
  return new Promise(resolve => {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => { try { resolve(JSON.parse(body)) } catch { resolve({}) } })
  })
}

function buildRawEmail({ from, to, subject, body, replyTo, attachments = [] }) {
  const CRLF = '\r\n'
  if (!attachments.length) {
    return [
      `From: ${from}`, `To: ${to}`, `Subject: ${subject}`,
      replyTo ? `Reply-To: ${replyTo}` : null,
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', '', body,
    ].filter(l => l !== null).join(CRLF)
  }
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const parts = []
  parts.push([`--${boundary}`, 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable', '', body].join(CRLF))
  for (const att of attachments) {
    parts.push([
      `--${boundary}`,
      `Content-Type: ${att.contentType}; name="${att.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${att.filename}"`,
      '', att.data.match(/.{1,76}/g).join(CRLF),
    ].join(CRLF))
  }
  parts.push(`--${boundary}--`)
  return [
    `From: ${from}`, `To: ${to}`, `Subject: ${subject}`,
    replyTo ? `Reply-To: ${replyTo}` : null,
    'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '', parts.join(CRLF),
  ].filter(l => l !== null).join(CRLF)
}

// Fetch all Email Routing rules, fully paginated. Shared by GET /aliases
// and the inbox alias-matching logic in GET /inbox.
async function fetchAllAliasRules() {
  let page = 1
  let allRules = []
  const PER_PAGE = 50
  while (true) {
    const data = await cfRequest('GET', `/zones/${CF_ZONE_ID}/email/routing/rules?page=${page}&per_page=${PER_PAGE}`)
    const rules = data.result || []
    allRules = allRules.concat(rules)
    const info = data.result_info || {}
    if (info.total_count && allRules.length >= info.total_count) break
    if (info.total_pages && page >= info.total_pages) break
    if (rules.length < PER_PAGE) break
    page++
  }
  return allRules
}

// ── SENT LOG ──────────────────────────────────────────────────────────────────
function logSentItem({ from, to, replyTo, subject, text, attachmentCount }) {
  db.prepare(`
    INSERT INTO sent_items (id, created_at, from_alias, "to", reply_to, subject, body, attachment_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), Date.now(), from, to, replyTo || null, subject, text.slice(0, 20000), attachmentCount)
}

// ── INBOUND CAPTURE (reply-by-forward feature) ───────────────────────────────
// A dedicated Cloudflare Worker receives the forward via Cloudflare Email
// Routing (env.email()), parses the MIME message and extracts the original
// sender/recipient from the quoted forward header block, then POSTs the
// clean JSON here. Auth is a shared secret header, not Bearer/JWT, since the
// caller is the Worker, not the browser. See inbound-worker/index.js.

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(a || '')
  const bufB = Buffer.from(b || '')
  return bufA.length === bufB.length && bufA.length > 0 && crypto.timingSafeEqual(bufA, bufB)
}

async function handleInbound(req, res) {
  try {
    if (!INBOUND_SECRET) {
      console.warn('[inbound] INBOUND_SECRET not set in this container')
      res.writeHead(401); res.end(); return
    }
    const provided = req.headers['x-inbound-secret'] || ''
    if (!timingSafeEqualStr(provided, INBOUND_SECRET)) {
      console.warn('[inbound] secret mismatch — check INBOUND_SECRET matches the Worker secret')
      res.writeHead(401); res.end(); return
    }

    const body = await readBody(req)
    const { originalFrom = '', originalFromName = '', originalTo = '', subject = '', text = '' } = body
    const id = crypto.randomUUID()

    db.prepare(`
      INSERT INTO inbox_items (id, created_at, original_from, original_from_name, original_to, subject, body, replied)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, Date.now(), originalFrom, originalFromName, originalTo, subject, text.slice(0, 20000))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  } catch (e) {
    console.error(e)
    res.writeHead(500); res.end()
  }
}

createServer(async (req, res) => {
  const url  = new URL(req.url, 'http://localhost')
  const path = url.pathname

  // CORS preflight — always responds 204, no auth required
  if (req.method === 'OPTIONS') { cors(res, req); res.writeHead(204); res.end(); return }

  // Health check — no auth required
  if (path === '/health' && req.method === 'GET') {
    return send(res, 200, { ok: true }, req)
  }

  // Inbound capture Worker — no Bearer auth possible (it's the Worker calling,
  // not the browser), authenticity is verified via shared secret header instead
  if (path === '/inbound' && req.method === 'POST') {
    return handleInbound(req, res)
  }

  // All other routes require authentication
  const payload = await authenticate(req)
  if (!payload) { send(res, 401, { error: 'Unauthorized' }, req); return }

  try {
    if (path === '/aliases' && req.method === 'GET') {
      const allRules = await fetchAllAliasRules()
      const aliases = allRules
        .filter(r => r.matchers?.[0]?.type === 'literal')  // exclude catch-all rules
        .map(r => ({
          id: r.tag,
          alias: r.matchers?.[0]?.value || '',
          destination: r.actions?.[0]?.value?.[0] || '',
          enabled: r.enabled,
        }))
        .sort((a, b) => a.alias.localeCompare(b.alias))    // ordine alfabetico
      return send(res, 200, aliases, req)
    }

    if (path === '/aliases' && req.method === 'POST') {
      const { alias, destination } = await readBody(req)
      if (!alias || !destination) return send(res, 400, { error: 'alias and destination are required' }, req)
      const data = await cfRequest('POST', `/zones/${CF_ZONE_ID}/email/routing/rules`, {
        name: alias, enabled: true,
        matchers: [{ type: 'literal', field: 'to', value: alias }],
        actions:  [{ type: 'forward', value: [destination] }],
      })
      const r = data.result
      return send(res, 201, { id: r.tag, alias: r.matchers?.[0]?.value,
        destination: r.actions?.[0]?.value?.[0], enabled: r.enabled }, req)
    }

    const matchId = path.match(/^\/aliases\/([^/]+)$/)
    if (matchId && req.method === 'PATCH') {
      const updates = await readBody(req)
      const get = await cfRequest('GET', `/zones/${CF_ZONE_ID}/email/routing/rules/${matchId[1]}`)
      const rule = get.result
      const patch = { ...rule }
      if (typeof updates.enabled === 'boolean') patch.enabled = updates.enabled
      if (updates.destination) {
        patch.actions = [{ type: 'forward', value: [updates.destination] }]
      }
      const updated = await cfRequest('PUT', `/zones/${CF_ZONE_ID}/email/routing/rules/${matchId[1]}`, patch)
      const r = updated.result
      return send(res, 200, {
        enabled: r.enabled,
        destination: r.actions?.[0]?.value?.[0] || '',
      }, req)
    }
    if (matchId && req.method === 'DELETE') {
      await cfRequest('DELETE', `/zones/${CF_ZONE_ID}/email/routing/rules/${matchId[1]}`)
      return send(res, 200, { deleted: true }, req)
    }

    // GET /inbox — forwarded emails awaiting reply, newest first
    if (path === '/inbox' && req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM inbox_items WHERE replied = 0 ORDER BY created_at DESC').all()
      let activeAliases = []
      try {
        const rules = await fetchAllAliasRules()
        activeAliases = rules
          .filter(r => r.matchers?.[0]?.type === 'literal' && r.enabled)
          .map(r => (r.matchers[0].value || '').toLowerCase())
      } catch (e) { console.error(e) }
      const items = rows.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        originalFrom: r.original_from,
        originalFromName: r.original_from_name,
        originalTo: r.original_to,
        subject: r.subject,
        body: r.body,
        matchedAlias: r.original_to && activeAliases.includes(r.original_to.toLowerCase()) ? r.original_to : null,
      }))
      return send(res, 200, items, req)
    }

    // DELETE /inbox/:id — dismiss a pending item (discard, or after a reply is sent)
    const inboxMatch = path.match(/^\/inbox\/([^/]+)$/)
    if (inboxMatch && req.method === 'DELETE') {
      db.prepare('DELETE FROM inbox_items WHERE id = ?').run(inboxMatch[1])
      return send(res, 200, { deleted: true }, req)
    }

    // POST /send — with attachment support
    if (path === '/send' && req.method === 'POST') {
      const { from, to, subject, body: text, replyTo, attachments = [] } = await readBody(req)
      if (!from || !to || !subject || !text)
        return send(res, 400, { error: 'Missing fields: from, to, subject, body' }, req)

      // Option A: Resend
      if (process.env.RESEND_API_KEY) {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from, to: [to], subject, text, reply_to: replyTo || from,
            attachments: attachments.length
              ? attachments.map(a => ({ filename: a.filename, content: a.data }))
              : undefined,
          }),
        })
        if (!r.ok) return send(res, 502, { error: `Resend error: ${await r.text()}` }, req)
        logSentItem({ from, to, replyTo, subject, text, attachmentCount: attachments.length })
        return send(res, 200, { sent: true, via: 'resend' }, req)
      }

      // Option B: SMTP (nodemailer)
      if (process.env.SMTP_HOST) {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        })
        await transport.sendMail({
          from, to, subject, text, replyTo: replyTo || from,
          attachments: attachments.map(a => ({
            filename: a.filename,
            content:  Buffer.from(a.data, 'base64'),
            contentType: a.contentType,
          })),
        })
        logSentItem({ from, to, replyTo, subject, text, attachmentCount: attachments.length })
        return send(res, 200, { sent: true, via: 'smtp' }, req)
      }

      return send(res, 501, { error: 'Set RESEND_API_KEY or SMTP_HOST in .env' }, req)
    }

    // GET /sent — history of emails sent through mailias, newest first
    if (path === '/sent' && req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM sent_items ORDER BY created_at DESC LIMIT 200').all()
      const items = rows.map(r => ({
        id: r.id,
        createdAt: r.created_at,
        from: r.from_alias,
        to: r.to,
        replyTo: r.reply_to,
        subject: r.subject,
        body: r.body,
        attachmentCount: r.attachment_count,
      }))
      return send(res, 200, items, req)
    }

    // DELETE /sent/:id — remove a sent item from the history
    const sentMatch = path.match(/^\/sent\/([^/]+)$/)
    if (sentMatch && req.method === 'DELETE') {
      db.prepare('DELETE FROM sent_items WHERE id = ?').run(sentMatch[1])
      return send(res, 200, { deleted: true }, req)
    }

    send(res, 404, { error: 'Not found' }, req)
  } catch (e) {
    console.error(e)
    send(res, 500, { error: e.message }, req)
  }
}).listen(PORT, () => console.log(`mailias backend :${PORT}`))