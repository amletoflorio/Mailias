<template>
  <div>
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('inbox.title') }}</h2>
        <p class="page-subtitle">{{ t('inbox.subtitle', { n: store.items.length }) }}</p>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="store.loading" class="card">
      <div class="empty">
        <div class="spinner" style="margin:0 auto"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.items.length" class="card">
      <div class="empty">{{ t('inbox.empty') }}</div>
    </div>

    <!-- Pending items -->
    <div v-else style="display:flex;flex-direction:column;gap:10px">
      <div v-for="item in store.items" :key="item.id" class="card inbox-item">
        <div class="inbox-item-main">
          <div class="inbox-item-subject">{{ item.subject || t('inbox.noSubject') }}</div>
          <div class="inbox-item-meta mono">
            {{ t('inbox.from') }} <span>{{ item.originalFromName || item.originalFrom || t('inbox.unknown') }}</span>
          </div>
          <div class="inbox-item-meta mono">
            {{ t('inbox.replyAs') }}
            <span :class="{ 'inbox-item-unmatched': !item.matchedAlias }">
              {{ item.matchedAlias || t('inbox.noAliasMatch') }}
            </span>
          </div>
          <div class="inbox-item-date mono">{{ formatDate(item.createdAt) }}</div>
        </div>
        <div class="inbox-item-actions">
          <button class="btn btn-primary btn-sm" @click="reply(item)">{{ t('inbox.replyBtn') }}</button>
          <button class="btn-icon-danger" @click="dismiss(item)" :title="t('inbox.dismissBtn')">✕</button>
        </div>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="toast.show" class="toast" :class="`toast-${toast.type}`">
        {{ toast.type === 'success' ? '✓' : '✕' }} {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useInboxStore } from '@/stores/inbox'

const { t } = useI18n()
const router = useRouter()
const store  = useInboxStore()
const toast  = ref({ show: false, type: 'success', message: '' })

function formatDate(ts) {
  return new Date(ts).toLocaleString()
}

function showToast(type, message) {
  toast.value = { show: true, type, message }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function reply(item) {
  store.setPendingReply(item)
  router.push('/compose')
}

async function dismiss(item) {
  try {
    await store.dismiss(item.id)
  } catch {
    showToast('error', t('inbox.dismissError'))
  }
}

onMounted(store.fetchInbox)
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(6px); }

.inbox-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.inbox-item-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.inbox-item-subject { font-size: 14px; font-weight: 600; color: var(--text); }
.inbox-item-meta { font-size: 12px; color: var(--muted); }
.inbox-item-meta span { color: var(--text); }
.inbox-item-unmatched { color: var(--red) !important; }
.inbox-item-date { font-size: 11px; color: var(--muted); margin-top: 2px; }
.inbox-item-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.btn-icon-danger {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  min-width: 32px;
  transition: all var(--transition);
}
.btn-icon-danger:hover,
.btn-icon-danger:active {
  color: var(--red);
  background: var(--red-soft);
}
</style>
