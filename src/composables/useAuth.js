// src/composables/useAuth.js
import { UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { ref, computed } from 'vue'

const userManager = new UserManager({
  authority: import.meta.env.VITE_OIDC_AUTHORITY,
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI,
  response_type: 'code',
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
})

const user = ref(null)
const loading = ref(true)

async function init() {
  try {
    user.value = await userManager.getUser()
  } finally {
    loading.value = false
  }
}

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value && !user.value.expired)
  const profile = computed(() => user.value?.profile ?? null)
  const accessToken = computed(() => user.value?.access_token ?? null)

  async function login() {
    await userManager.signinRedirect()
  }

  async function handleCallback() {
    user.value = await userManager.signinRedirectCallback()
  }

  async function logout() {
    await userManager.signoutRedirect()
    user.value = null
  }

  return {
    user,
    profile,
    accessToken,
    isAuthenticated,
    loading,
    init,
    login,
    handleCallback,
    logout,
  }
}
