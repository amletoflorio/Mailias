<template>
  <!-- Public pages (login, callback) -->
  <div v-if="isPublicRoute">
    <RouterView />
  </div>

  <!-- Authenticated app shell -->
  <div v-else-if="isAuthenticated" class="app-shell">

    <!-- MOBILE: top bar -->
    <header class="top-bar">
      <div class="top-bar-brand">mail<span>ias</span></div>
      <div class="top-bar-user">
        <button class="lang-btn" @click="toggleLocale" :title="currentLocale === 'it' ? 'Switch to English' : 'Passa all\'italiano'">
          {{ currentLocale === 'it' ? 'EN' : 'IT' }}
        </button>
        <div class="user-avatar" @click="logout" :title="t('nav.logout')">{{ initials }}</div>
      </div>
    </header>

    <!-- DESKTOP: sidebar -->
    <aside class="sidebar" style="display:none">
      <div class="sidebar-brand">
        <h1>mail<span>ias</span></h1>
        <p>{{ domain }}</p>
      </div>
      <nav class="sidebar-nav">
        <RouterLink to="/compose" class="nav-item" active-class="active">
          <span class="nav-icon">✏️</span> {{ t('nav.compose') }}
        </RouterLink>
        <RouterLink to="/inbox" class="nav-item" active-class="active">
          <span class="nav-icon">📥</span> {{ t('nav.inbox') }}
          <span v-if="inboxStore.items.length" class="nav-badge">{{ inboxStore.items.length }}</span>
        </RouterLink>
        <RouterLink to="/sent" class="nav-item" active-class="active">
          <span class="nav-icon">📤</span> {{ t('nav.sent') }}
        </RouterLink>
        <RouterLink to="/aliases" class="nav-item" active-class="active">
          <span class="nav-icon">🏷️</span> {{ t('nav.aliases') }}
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <div class="user-chip">
          <div class="user-avatar">{{ initials }}</div>
          <div class="user-info">
            <div class="user-name">{{ profile?.name || 'User' }}</div>
            <div class="user-email">{{ profile?.email || '' }}</div>
          </div>
          <button class="lang-btn lang-btn--sidebar" @click="toggleLocale">
            {{ currentLocale === 'it' ? 'EN' : 'IT' }}
          </button>
          <button class="btn-logout" @click="logout" :title="t('nav.logout')">✕</button>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <RouterView />
    </main>

    <!-- MOBILE: bottom navigation -->
    <nav class="bottom-nav">
      <RouterLink to="/compose" class="nav-item" active-class="active">
        <span class="nav-icon">✏️</span>
        <span>{{ t('nav.compose') }}</span>
      </RouterLink>
      <RouterLink to="/inbox" class="nav-item" active-class="active">
        <span class="nav-icon" style="position:relative">
          📥
          <span v-if="inboxStore.items.length" class="nav-badge nav-badge--mobile">{{ inboxStore.items.length }}</span>
        </span>
        <span>{{ t('nav.inbox') }}</span>
      </RouterLink>
      <RouterLink to="/sent" class="nav-item" active-class="active">
        <span class="nav-icon">📤</span>
        <span>{{ t('nav.sent') }}</span>
      </RouterLink>
      <RouterLink to="/aliases" class="nav-item" active-class="active">
        <span class="nav-icon">🏷️</span>
        <span>{{ t('nav.aliases') }}</span>
      </RouterLink>
    </nav>

  </div>

  <!-- Loading spinner -->
  <div v-else class="login-page">
    <div class="spinner"></div>
  </div>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { useInboxStore } from '@/stores/inbox'
import { setLocale } from '@/i18n'

const { t, locale } = useI18n()
const { isAuthenticated, profile, init, logout } = useAuth()
const route = useRoute()
const inboxStore = useInboxStore()

const isPublicRoute = computed(() => route.meta.public)
const domain = import.meta.env.VITE_CF_DOMAIN || 'yourdomain.com'
const currentLocale = computed(() => locale.value)

const initials = computed(() => {
  const name = profile.value?.name || ''
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
})

function toggleLocale() {
  setLocale(locale.value === 'it' ? 'en' : 'it')
}

onMounted(init)
watch(isAuthenticated, (v) => { if (v) inboxStore.fetchInbox() }, { immediate: true })
</script>

<style scoped>
/* Language toggle button */
.lang-btn {
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 4px 8px;
  transition: all var(--transition);
}
.lang-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.lang-btn--sidebar {
  margin-left: auto;
  margin-right: 4px;
}

/* Inbox pending-count badge */
.nav-badge {
  margin-left: auto;
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  border-radius: 999px;
  padding: 3px 6px;
  min-width: 16px;
  text-align: center;
}
.nav-badge--mobile {
  position: absolute;
  top: -6px;
  right: -10px;
  margin-left: 0;
}
</style>
