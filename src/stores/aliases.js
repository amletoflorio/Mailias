// src/stores/aliases.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useCloudflare } from '@/composables/useCloudflare'

export const useAliasStore = defineStore('aliases', () => {
  const aliases = ref([])
  const loading = ref(false)
  const error = ref(null)

  const { getAliases, createAlias, toggleAlias, updateAliasDestination, deleteAlias } = useCloudflare()

  async function fetchAliases() {
    loading.value = true
    error.value = null
    try {
      aliases.value = await getAliases()
    } catch (e) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function addAlias(alias, destination) {
    const created = await createAlias(alias, destination)
    aliases.value.push(created)
    return created
  }

  async function toggle(id, enabled) {
    await toggleAlias(id, enabled)
    const idx = aliases.value.findIndex(a => a.id === id)
    if (idx !== -1) aliases.value[idx].enabled = enabled
  }

  async function updateDestination(id, destination) {
    const result = await updateAliasDestination(id, destination)
    const idx = aliases.value.findIndex(a => a.id === id)
    if (idx !== -1) aliases.value[idx].destination = result.destination
    return result
  }

  async function remove(id) {
    await deleteAlias(id)
    aliases.value = aliases.value.filter(a => a.id !== id)
  }

  return { aliases, loading, error, fetchAliases, addAlias, toggle, updateDestination, remove }
})
