// src/stores/inbox.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCloudflare } from '@/composables/useCloudflare'

export const useInboxStore = defineStore('inbox', () => {
  const items   = ref([])
  const loading = ref(false)
  const error   = ref(null)

  // Item handed off to ComposeView when the user clicks "Reply" on an
  // inbox entry — kept in memory (not the URL) since forwarded bodies
  // can be long. Consumed once by ComposeView on mount.
  const pendingReply = ref(null)

  const { getInbox, dismissInboxItem } = useCloudflare()

  async function fetchInbox() {
    loading.value = true
    error.value = null
    try {
      items.value = await getInbox()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function dismiss(id) {
    await dismissInboxItem(id)
    items.value = items.value.filter(i => i.id !== id)
  }

  function setPendingReply(item) {
    pendingReply.value = item
  }

  function clearPendingReply() {
    pendingReply.value = null
  }

  return { items, loading, error, fetchInbox, dismiss, pendingReply, setPendingReply, clearPendingReply }
})
