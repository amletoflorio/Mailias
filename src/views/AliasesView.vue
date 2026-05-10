<template>
  <div>
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('aliases.title') }}</h2>
        <p class="page-subtitle">{{ t('aliases.subtitle', { filtered: filteredAliases.length, total: store.aliases.length }) }}</p>
      </div>
      <button class="btn btn-primary btn-sm" @click="showForm = !showForm">
        {{ showForm ? t('aliases.closeBtn') : t('aliases.newBtn') }}
      </button>
    </div>

    <!-- New alias form -->
    <Transition name="slide">
      <div v-if="showForm" class="card" style="margin-bottom:16px">
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="field">
            <label class="label">{{ t('aliases.aliasLabel') }}</label>
            <div style="display:flex;align-items:stretch">
              <input
                class="input"
                type="text"
                v-model="newAlias.local"
                :placeholder="t('aliases.aliasPlaceholder')"
                style="border-radius:var(--radius-sm) 0 0 var(--radius-sm);border-right:none;flex:1"
              />
              <span class="input-suffix">@{{ domain }}</span>
            </div>
          </div>
          <div class="field">
            <label class="label">{{ t('aliases.destinationLabel') }}</label>
            <input class="input" type="email" v-model="newAlias.destination" :placeholder="t('aliases.destinationPlaceholder')" />
          </div>
          <button class="btn btn-primary btn-full" @click="addAlias" :disabled="!canCreate || creating">
            <span v-if="creating" class="spinner" style="width:16px;height:16px;border-width:2px"></span>
            <span v-else>{{ t('aliases.createBtn') }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Search bar -->
    <div class="field" style="margin-bottom:16px">
      <div style="position:relative">
        <span class="search-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input
          class="input"
          type="text"
          v-model="search"
          :placeholder="t('aliases.searchPlaceholder')"
          style="padding-left:40px"
        />
        <button v-if="search" @click="search = ''" class="search-clear">✕</button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="store.loading" class="card">
      <div class="empty">
        <div class="spinner" style="margin:0 auto"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!store.aliases.length" class="card">
      <div class="empty">{{ t('aliases.noAliases') }}</div>
    </div>

    <!-- No search results -->
    <div v-else-if="!filteredAliases.length" class="card">
      <div class="empty">{{ t('aliases.noResults', { q: search }) }}</div>
    </div>

    <!-- Alias list -->
    <div v-else class="card alias-card-container">

      <!-- ═══ DESKTOP TABLE ═══ -->
      <div class="alias-table-wrap desktop-only">
        <table class="alias-table">
          <thead>
            <tr>
              <th>{{ t('aliases.aliasLabel') }}</th>
              <th>{{ t('aliases.destinationLabel') }}</th>
              <th class="col-status">{{ t('aliases.statusHeader') }}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="alias in filteredAliases" :key="alias.id">
              <td class="col-alias" v-html="highlight(alias.alias)"></td>

              <!-- Destination: inline edit -->
              <td class="col-dest">
                <div v-if="editing === alias.id" class="edit-inline">
                  <input
                    ref="editInputDesktop"
                    class="edit-input"
                    type="email"
                    v-model="editValue"
                    @keydown.enter="saveEdit(alias)"
                    @keydown.escape="cancelEdit"
                    @blur="saveEdit(alias)"
                  />
                  <span v-if="saving === alias.id" class="spinner edit-spinner"></span>
                </div>
                <div v-else class="dest-display" @click="startEdit(alias)">
                  <span v-html="highlight(alias.destination)"></span>
                  <svg class="edit-pencil" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </div>
              </td>

              <td class="col-status">
                <button
                  class="badge"
                  :class="alias.enabled ? 'badge-on' : 'badge-off'"
                  style="cursor:pointer;border:none"
                  @click="toggleAlias(alias)"
                >
                  {{ alias.enabled ? t('aliases.enabled') : t('aliases.disabled') }}
                </button>
              </td>
              <td class="col-actions">
                <button class="btn-icon-danger" @click="confirmDelete(alias)" :title="t('aliases.deleteTitle')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ═══ MOBILE CARDS ═══ -->
      <div class="alias-list-mobile mobile-only">
        <div v-for="alias in filteredAliases" :key="alias.id" class="alias-card">
          <span class="alias-card-addr" v-html="highlight(alias.alias)"></span>
          <div class="alias-card-badge">
            <button
              class="badge"
              :class="alias.enabled ? 'badge-on' : 'badge-off'"
              style="cursor:pointer;border:none"
              @click="toggleAlias(alias)"
            >
              {{ alias.enabled ? t('aliases.enabled') : t('aliases.disabled') }}
            </button>
          </div>

          <!-- Destination: inline edit (mobile) -->
          <div v-if="editing === alias.id" class="alias-card-dest" style="grid-column:1/-1">
            <div class="edit-inline">
              <input
                ref="editInputMobile"
                class="edit-input"
                type="email"
                v-model="editValue"
                @keydown.enter="saveEdit(alias)"
                @keydown.escape="cancelEdit"
                @blur="saveEdit(alias)"
              />
              <span v-if="saving === alias.id" class="spinner edit-spinner"></span>
            </div>
          </div>
          <template v-else>
            <div class="alias-card-dest dest-display" @click="startEdit(alias)">
              <span v-html="'→ ' + highlight(alias.destination)"></span>
              <svg class="edit-pencil" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </div>
            <div class="alias-card-actions">
              <button class="btn-icon-danger" @click="confirmDelete(alias)" :title="t('aliases.deleteTitle')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <Transition name="fade">
      <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
        <div class="modal-box">
          <p style="font-size:14px;margin-bottom:8px">
            {{ t('aliases.deleteConfirmTitle', { alias: deleteTarget.alias }) }}
          </p>
          <p style="font-size:13px;color:var(--muted);margin-bottom:24px">{{ t('aliases.deleteConfirmBody') }}</p>
          <div style="display:flex;gap:10px">
            <button class="btn btn-ghost btn-sm" style="flex:1" @click="deleteTarget = null">{{ t('aliases.cancelBtn') }}</button>
            <button class="btn btn-sm" style="flex:1;background:var(--red);color:#fff;border:none" @click="doDelete">{{ t('aliases.deleteBtn') }}</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Toast notification -->
    <Transition name="fade">
      <div v-if="toast.show" class="toast" :class="`toast-${toast.type}`">
        {{ toast.type === 'success' ? '✓' : '✕' }} {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAliasStore } from '@/stores/aliases'

const { t } = useI18n()
const store  = useAliasStore()
const domain = import.meta.env.VITE_CF_DOMAIN || 'yourdomain.com'

const showForm     = ref(false)
const creating     = ref(false)
const deleteTarget = ref(null)
const toast        = ref({ show: false, type: 'success', message: '' })
const newAlias     = ref({ local: '', destination: '' })
const search       = ref('')

// Inline edit state
const editing      = ref(null)   // id of the alias being edited
const editValue    = ref('')     // current input value
const editOriginal = ref('')     // original value to detect changes
const saving       = ref(null)   // id of the alias being saved

// Template refs for autofocus
const editInputDesktop = ref(null)
const editInputMobile  = ref(null)

const canCreate = computed(() => newAlias.value.local.trim() && newAlias.value.destination.trim())

const filteredAliases = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.aliases
  return store.aliases.filter(a =>
    a.alias.toLowerCase().includes(q) ||
    a.destination.toLowerCase().includes(q)
  )
})

function highlight(text) {
  const q = search.value.trim()
  if (!q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:rgba(99,102,241,0.25);color:var(--text);border-radius:2px;padding:0 2px">$1</mark>'
  )
}

function showToast(type, message) {
  toast.value = { show: true, type, message }
  setTimeout(() => { toast.value.show = false }, 3000)
}

// ── Inline destination edit ───────────────────────────────────────────────────

function startEdit(alias) {
  editing.value = alias.id
  editValue.value = alias.destination
  editOriginal.value = alias.destination
  nextTick(() => {
    // Template refs on v-for may be arrays; pick whichever ref is populated
    const desktopEl = editInputDesktop.value
    const mobileEl  = editInputMobile.value
    const el = Array.isArray(desktopEl) ? desktopEl[0] : desktopEl
      || (Array.isArray(mobileEl) ? mobileEl[0] : mobileEl)
    if (el) { el.focus(); el.select() }
  })
}

function cancelEdit() {
  editing.value = null
  editValue.value = ''
  editOriginal.value = ''
}

async function saveEdit(alias) {
  const trimmed = editValue.value.trim()

  // No change or empty → just cancel
  if (!trimmed || trimmed === editOriginal.value) {
    cancelEdit()
    return
  }

  if (!trimmed.includes('@')) {
    showToast('error', t('aliases.invalidEmail'))
    return
  }

  saving.value = alias.id
  try {
    await store.updateDestination(alias.id, trimmed)
    showToast('success', t('aliases.updateSuccess'))
  } catch (e) {
    showToast('error', e.response?.data?.error || t('aliases.updateError'))
  } finally {
    saving.value = null
    editing.value = null
    editValue.value = ''
    editOriginal.value = ''
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

async function addAlias() {
  if (!canCreate.value) return
  creating.value = true
  try {
    const full = `${newAlias.value.local.trim()}@${domain}`
    await store.addAlias(full, newAlias.value.destination.trim())
    newAlias.value = { local: '', destination: '' }
    showForm.value = false
    showToast('success', t('aliases.createSuccess'))
  } catch (e) {
    showToast('error', e.response?.data?.error || t('aliases.createError'))
  } finally {
    creating.value = false
  }
}

async function toggleAlias(alias) {
  try {
    await store.toggle(alias.id, !alias.enabled)
  } catch {
    showToast('error', t('aliases.toggleError'))
  }
}

function confirmDelete(alias) { deleteTarget.value = alias }

async function doDelete() {
  try {
    await store.remove(deleteTarget.value.id)
    showToast('success', t('aliases.deleteSuccess'))
  } catch {
    showToast('error', t('aliases.deleteError'))
  } finally {
    deleteTarget.value = null
  }
}

onMounted(store.fetchAliases)
</script>

<style scoped>
.slide-enter-active, .slide-leave-active { transition: all 0.2s ease; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(-8px); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.input-suffix {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: 0 12px;
  font-family: var(--mono);
  font-size: 13px;
  color: var(--muted);
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
  display: flex;
  align-items: center;
}

.search-clear {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
  line-height: 1;
}

.alias-card-container {
  padding: 0;
  overflow: hidden;
}

.alias-card-container .alias-table-wrap {
  padding: 0;
}

.alias-card-container .alias-list-mobile {
  padding: 0 16px;
}

/* ── Inline edit ──────────────────────────────────────────────────────────── */

.dest-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 6px;
  margin: -4px -6px;
  border-radius: var(--radius-sm);
  transition: background var(--transition);
}

.dest-display:hover {
  background: var(--accent-soft);
}

.edit-pencil {
  color: var(--muted);
  opacity: 0;
  flex-shrink: 0;
  transition: opacity var(--transition);
}

.dest-display:hover .edit-pencil {
  opacity: 1;
}

/* Always show pencil on touch devices */
@media (hover: none) {
  .edit-pencil { opacity: 0.5; }
}

.edit-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.edit-input {
  background: var(--surface2);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-family: var(--mono);
  font-size: 13px;
  padding: 6px 10px;
  outline: none;
  width: 100%;
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.edit-spinner {
  width: 14px;
  height: 14px;
  border-width: 2px;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
}

/* ── Action buttons ───────────────────────────────────────────────────────── */

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

/* Responsive: table on desktop, cards on mobile */
.desktop-only { display: none; }
.mobile-only  { display: flex; }

@media (min-width: 768px) {
  .desktop-only { display: block; }
  .mobile-only  { display: none !important; }
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
