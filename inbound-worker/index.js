/**
 * mailias — inbound capture Worker
 *
 * Bound as the "Send to Worker" action on Cloudflare Email Routing rules.
 * No extra domain, no MX changes — Cloudflare already owns the MX for your
 * zone via Email Routing. Two distinct roles, dispatched by the envelope
 * recipient (message.to):
 *
 * 1. Alias addresses (e.g. shop@yourdomain.com) — the normal path for every
 *    incoming alias email. The raw MIME is parsed directly with postal-mime,
 *    so the real sender comes straight from the RFC822 From/Subject headers
 *    — no guessing from quoted forward text. The clean fields are POSTed to
 *    the mailias backend (so the email shows up in the mailias Inbox ready
 *    to reply to), and the original message is relayed unmodified to your
 *    real mailbox via message.forward(). Capture is best-effort and never
 *    blocks or risks the forward — a bug here must never cause a real email
 *    (bank, shop, etc.) to be dropped.
 *
 * 2. REPLY_ADDRESS (e.g. reply@yourdomain.com) — manual fallback for emails
 *    that never passed through an alias rule (e.g. something forwarded from
 *    outside mailias entirely). Since there are no real headers to read here
 *    (Cloudflare only sees the wrapper email your client just sent), this
 *    path best-effort parses the quoted header block your mail client
 *    (Tuta, Gmail, Outlook...) inserts when forwarding.
 *
 * Secrets to set with `wrangler secret put`:
 *   INBOUND_SECRET — must match INBOUND_SECRET in the backend's .env
 *
 * Vars in wrangler.toml:
 *   BACKEND_URL        — e.g. https://api-mailias.yourdomain.com/inbound
 *   REPLY_ADDRESS       — e.g. reply@yourdomain.com
 *   RELAY_DESTINATION   — your real mailbox, e.g. you@example.com
 */

import PostalMime from 'postal-mime'

function extractEmail(s) {
  const m = s && s.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)
  return m ? m[0] : ''
}

// Best-effort extraction of the original message's From/To from the quoted
// header block mail clients (Tuta, Gmail, Outlook...) insert when forwarding.
// Only used for the REPLY_ADDRESS fallback path — see module docblock.
function parseForwardHeaders(text) {
  if (!text) return { originalFrom: '', originalFromName: '', originalTo: '' }
  // Strip leading quote markers (">", ">>", "> >" ...) so headers from nested
  // forwards (a forward of a forward) are matched too, not just the outermost one.
  const lines = text.split(/\r?\n/).slice(0, 60).map(l => l.replace(/^[\s>]+/, ''))
  const get = keys => {
    const re = new RegExp(`^\\s*(?:${keys.join('|')})\\s*:\\s*(.+)$`, 'i')
    // Take the LAST match: with nested forwards, each re-forward stacks its own
    // header block above the previous one, so the deepest (last) match is the
    // real original sender.
    let found = ''
    for (const line of lines) {
      const m = line.match(re)
      if (m) found = m[1].trim()
    }
    return found
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

async function postInbound({ originalFrom, originalFromName, originalTo, subject, text }, env) {
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
}

// REPLY_ADDRESS fallback: parse the quoted forward text, best-effort.
async function handleReplyAddress(message, env) {
  try {
    const rawBytes = await new Response(message.raw).arrayBuffer()
    const parsed = await PostalMime.parse(rawBytes)
    const text = parsed.text || ''

    const { originalFrom, originalFromName, originalTo } = parseForwardHeaders(text)
    const subject = cleanSubject(parsed.subject || '')

    await postInbound({ originalFrom, originalFromName, originalTo, subject, text }, env)
  } catch (err) {
    console.error('inbound worker error (reply address):', err)
  }
}

// Alias path: read real MIME headers directly, capture, then relay the
// original message unchanged to the real mailbox. The relay must happen
// regardless of whether capture succeeds — losing a real email is far worse
// than missing a mailias Inbox entry.
async function handleAliasAddress(message, env, ctx) {
  let rawBytes = null
  try {
    rawBytes = await new Response(message.raw).arrayBuffer()
  } catch (err) {
    console.error('inbound worker: failed to read raw message for capture:', err)
  }

  if (rawBytes) {
    const capture = (async () => {
      const parsed = await PostalMime.parse(rawBytes)
      await postInbound({
        originalFrom: parsed.from?.address || '',
        originalFromName: parsed.from?.name || parsed.from?.address || '',
        originalTo: message.to || '',
        subject: cleanSubject(parsed.subject || ''),
        text: parsed.text || parsed.html || '',
      }, env)
    })().catch(err => console.error('inbound worker: alias capture failed:', err))
    ctx.waitUntil(capture)
  }

  await message.forward(env.RELAY_DESTINATION)
}

export default {
  async email(message, env, ctx) {
    const to = (message.to || '').toLowerCase()
    const replyAddress = (env.REPLY_ADDRESS || '').toLowerCase()

    if (replyAddress && to === replyAddress) {
      await handleReplyAddress(message, env)
    } else {
      await handleAliasAddress(message, env, ctx)
    }
  },
}
