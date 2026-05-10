<template>
  <div class="login-page">
    <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px">
      <div class="spinner" style="width:28px;height:28px"></div>
      <p style="font-family:var(--mono);font-size:12px;color:var(--muted)">Autenticazione in corso…</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const { handleCallback } = useAuth()
const router = useRouter()

onMounted(async () => {
  try {
    await handleCallback()
    router.replace('/compose')
  } catch (e) {
    console.error('OIDC callback error:', e)
    router.replace('/login')
  }
})
</script>
