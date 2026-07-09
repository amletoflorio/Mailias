// src/stores/sent.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCloudflare } from '@/composables/useCloudflare'

export const useSentStore = defineStore('sent', () => {
  const items   = ref([])
  const loading = ref(false)
  const error   = ref(null)

  const { getSent, deleteSentItem } = useCloudflare()

  async function fetchSent() {
    loading.value = true
    error.value = null
    try {
      items.value = await getSent()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function remove(id) {
    await deleteSentItem(id)
    items.value = items.value.filter(i => i.id !== id)
  }

  return { items, loading, error, fetchSent, remove }
})
