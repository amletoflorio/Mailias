/**
 * mailias — inbound capture Worker
 *
 * Bound to a Cloudflare Email Routing rule (action "Send to Worker") on a
 * dedicated local part of your existing domain (e.g. reply@yourdomain.com).
 * No extra domain, no MX changes — Cloudflare already owns the MX for your
 * zone via Email Routing.
 *
 * Flow: user forwards a received email to reply@yourdomain.com → Cloudflare
 * hands the raw MIME to this Worker's email() handler → parsed here → the
 * clean fields are POSTed to the mailias backend, authenticated with a
 * shared secret header (the Worker can't hold a Bearer/OIDC token).
 *
 * Secrets to set with `wrangler secret put`:
 *   INBOUND_SECRET — must match INBOUND_SECRET in the backend's .env
 *
 * Vars in wrangler.toml:
 *   BACKEND_URL — e.g. https://api-mailias.yourdomain.com/inbound
 */

import PostalMime from 'postal-mime'

function extractEmail(s) {
  const m = s && s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  return m ? m[0] : ''
}

// Best-effort extraction of the original message's From/To from the quoted
// header block mail clients (Tuta, Gmail, Outlook...) insert when forwarding.
// If parsing fails the item still lands in the mailias inbox with empty
// fields — the user just fills From/To manually in Compose instead.
function parseForwardHeaders(text) {
  if (!text) return { originalFrom: '', originalFromName: '', originalTo: '' }
  const lines = text.split(/\r?\n/).slice(0, 30)
  const get = keys => {
    const re = new RegExp(`^\\s*(?:${keys.join('|')})\\s*:\\s*(.+)$`, 'i')
    for (const line of lines) {
      const m = line.match(re)
      if (m) return m[1].trim()
    }
    return ''
  }
  const fromRaw = get(['From', 'Da', 'Mittente'])
  const toRaw   = get(['To', 'A', 'Destinatario'])
  return {
    originalFrom: extractEmail(fromRaw),
    originalFromName: fromRaw.replace(/<.*?>/, '').replace(/["']/g, '').trim(),
    originalTo: extractEmail(toRaw),
  }
}

// Strips repeated Fwd:/Fw:/Re:/Inoltra: prefixes so "Re: " can be added once, cleanly.
function cleanSubject(subject) {
  let s = (subject || '').trim()
  let prev
  do {
    prev = s
    s = s.replace(/^\s*(fwd|fw|re|inoltra|inoltro|risposta)\s*:\s*/i, '')
  } while (s !== prev)
  return s.trim()
}

export default {
  async email(message, env, ctx) {
    try {
      const rawBytes = await new Response(message.raw).arrayBuffer()
      const parsed = await PostalMime.parse(rawBytes)
      const text = parsed.text || ''

      const { originalFrom, originalFromName, originalTo } = parseForwardHeaders(text)
      const subject = cleanSubject(parsed.subject || '')

      const res = await fetch(env.BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Inbound-Secret': env.INBOUND_SECRET,
        },
        body: JSON.stringify({ originalFrom, originalFromName, originalTo, subject, text }),
      })

      if (!res.ok) {
        console.error('mailias backend rejected inbound item:', res.status, await res.text())
      }
    } catch (err) {
      console.error('inbound worker error:', err)
    }
  },
}
