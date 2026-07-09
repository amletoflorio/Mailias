// src/composables/useCloudflare.js
// NOTE: The CF API token must NEVER be exposed in the frontend.
// All calls go through your backend/Worker acting as a proxy.
// VITE_API_BASE_URL points to your Cloudflare Worker or Node.js backend.

import axios from 'axios'
import { useAuth } from './useAuth'

const BASE = import.meta.env.VITE_API_BASE_URL

function apiClient() {
  const { accessToken } = useAuth()
  return axios.create({
    baseURL: BASE,
    headers: {
      Authorization: `Bearer ${accessToken.value}`,
      'Content-Type': 'application/json',
    },
  })
}

export function useCloudflare() {
  // ── ALIAS (Email Routing Rules) ─────────────────────────────────────────

  async function getAliases() {
    const { data } = await apiClient().get('/aliases')
    return data // [{ id, alias, destination, enabled }]
  }

  async function createAlias(alias, destination) {
    const { data } = await apiClient().post('/aliases', { alias, destination })
    return data
  }

  async function toggleAlias(id, enabled) {
    const { data } = await apiClient().patch(`/aliases/${id}`, { enabled })
    return data
  }

  async function updateAliasDestination(id, destination) {
    const { data } = await apiClient().patch(`/aliases/${id}`, { destination })
    return data
  }

  async function deleteAlias(id) {
    await apiClient().delete(`/aliases/${id}`)
  }

  // ── SEND EMAIL ───────────────────────────────────────────────────────────

  async function sendEmail({ from, to, subject, body, replyTo, attachments = [] }) {
    const { data } = await apiClient().post('/send', {
      from,   // one of your aliases, e.g. info@yourdomain.com
      to,
      subject,
      body,
      replyTo,
      attachments,
    })
    return data
  }

  // ── INBOX (forwarded emails awaiting reply) ─────────────────────────────

  async function getInbox() {
    const { data } = await apiClient().get('/inbox')
    return data // [{ id, createdAt, originalFrom, originalFromName, originalTo, subject, body, matchedAlias }]
  }

  async function dismissInboxItem(id) {
    await apiClient().delete(`/inbox/${id}`)
  }

  // ── SENT (history of emails sent through mailias) ───────────────────────

  async function getSent() {
    const { data } = await apiClient().get('/sent')
    return data // [{ id, createdAt, from, to, replyTo, subject, body, attachmentCount }]
  }

  async function deleteSentItem(id) {
    await apiClient().delete(`/sent/${id}`)
  }

  return {
    getAliases,
    createAlias,
    toggleAlias,
    updateAliasDestination,
    deleteAlias,
    sendEmail,
    getInbox,
    dismissInboxItem,
    getSent,
    deleteSentItem,
  }
}