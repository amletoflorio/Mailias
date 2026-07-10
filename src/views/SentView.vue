<template>
  <div>
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('sent.title') }}</h2>
        <p class="page-subtitle">{{ t('sent.subtitle', { n: store.items.length }) }}</p>
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
      <div class="empty">{{ t('sent.empty') }}</div>
    </div>

    <!-- Sent items -->
    <div v-else style="display:flex;flex-direction:column;gap:10px">
      <div
        v-for="item in store.items"
        :key="item.id"
        class="card sent-item"
        :class="{ 'sent-item--open': expandedId === item.id }"
        @click="toggle(item.id)"
      >
        <div class="sent-item-row">
          <div class="sent-item-main">
            <div class="sent-item-subject">{{ item.subject || t('sent.noSubject') }}</div>
            <div class="sent-item-meta mono">
              {{ t('sent.from') }} <span>{{ item.from }}</span> → <span>{{ item.to }}</span>
            </div>
            <div v-if="item.replyTo && item.replyTo !== item.from" class="sent-item-meta mono">
              Reply-To: <span>{{ item.replyTo }}</span>
            </div>
            <div v-if="item.attachmentCount" class="sent-item-meta mono">
              📎 {{ item.attachmentCount }}
            </div>
            <div class="sent-item-date mono">{{ formatDate(item.createdAt) }}</div>
          </div>
          <button class="btn-icon-danger" @click.stop="confirmDelete(item)" :title="t('sent.deleteTitle')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>

        <Transition name="expand">
          <div v-if="expandedId === item.id" class="sent-item-body">{{ item.body }}</div>
        </Transition>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <Transition name="fade">
      <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
        <div class="modal-box">
          <p style="font-size:14px;margin-bottom:8px">
            {{ t('sent.deleteConfirmTitle') }}
          </p>
          <p style="font-size:13px;color:var(--muted);margin-bottom:24px">{{ t('sent.deleteConfirmBody') }}</p>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost btn-sm" style="flex:1" @click="deleteTarget = null">{{ t('sent.cancelBtn') }}</button>
            <button class="btn btn-sm" style="flex:1;background:var(--red);color:#fff;border:none" @click="doDelete">{{ t('sent.deleteBtn') }}</button>
          </div>
        </div>
      </div>
    </Transition>

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
import { useSentStore } from '@/stores/sent'

const { t } = useI18n()
const store = useSentStore()
const expandedId = ref(null)
const deleteTarget = ref(null)
const toast = ref({ show: false, type: 'success', message: '' })

function toggle(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDate(ts) {
  return new Date(ts).toLocaleString()
}

function showToast(type, message) {
  toast.value = { show: true, type, message }
  setTimeout(() => { toast.value.show = false }, 3000)
}

function confirmDelete(item) { deleteTarget.value = item }

async function doDelete() {
  try {
    await store.remove(deleteTarget.value.id)
  } catch {
    showToast('error', t('sent.deleteError'))
  } finally {
    deleteTarget.value = null
  }
}

onMounted(store.fetchSent)
</script>

<style scoped>
.sent-item { cursor: pointer; transition: border-color var(--transition); }
.sent-item--open { border-color: var(--border2); }
.sent-item-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.sent-item-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.sent-item-subject { font-size: 14px; font-weight: 600; color: var(--text); }
.sent-item-meta { font-size: 12px; color: var(--muted); }
.sent-item-meta span { color: var(--text); }
.sent-item-date { font-size: 11px; color: var(--muted); margin-top: 2px; }

.sent-item-body {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
}

.expand-enter-active, .expand-leave-active { transition: opacity 0.15s; }
.expand-enter-from, .expand-leave-to { opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

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
  flex-shrink: 0;
  transition: all var(--transition);
}
.btn-icon-danger:hover,
.btn-icon-danger:active {
  color: var(--red);
  background: var(--red-soft);
}

.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 150;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
.modal-box {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 16px 16px 0 0;
  padding: 28px 24px;
  width: 100%;
  max-width: 480px;
}
@media (min-width: 768px) {
  .modal-backdrop { align-items: center; padding: 0; }
  .modal-box { border-radius: 12px; max-width: 360px; }
}
</style>
