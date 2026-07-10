<template>
  <div>
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ t('compose.title') }}</h2>
        <p class="page-subtitle">{{ t('compose.subtitle') }}</p>
      </div>
    </div>

    <div class="card">
      <div style="display:flex;flex-direction:column;gap:18px">

        <!-- From alias — searchable dropdown -->
        <div class="field" ref="aliasFieldRef">
          <label class="label">{{ t('compose.from') }}</label>
          <div style="position:relative">
            <input
              class="input"
              type="text"
              v-model="aliasSearch"
              :placeholder="form.from || t('compose.fromPlaceholder')"
              :style="form.from ? 'color:var(--accent)' : ''"
              @focus="aliasOpen = true"
              @input="aliasOpen = true"
              @keydown.escape="closeAlias"
              @keydown.enter.prevent="selectHighlighted"
              @keydown.down.prevent="moveHighlight(1)"
              @keydown.up.prevent="moveHighlight(-1)"
              autocomplete="off"
            />
            <button
              v-if="form.from"
              @click="clearAlias"
              style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:4px;line-height:1"
            >✕</button>

            <!-- Alias dropdown -->
            <div v-if="aliasOpen && filteredAliases.length" class="alias-dropdown">
              <div
                v-for="(a, i) in filteredAliases"
                :key="a.id"
                class="alias-option"
                :class="{ 'alias-option--active': i === highlighted }"
                @mousedown.prevent="selectAlias(a)"
                @mouseover="highlighted = i"
              >
                <span class="alias-option-addr" v-html="highlightAlias(a.alias)"></span>
                <span class="alias-option-dest">→ {{ a.destination }}</span>
              </div>
            </div>
            <div v-else-if="aliasOpen && aliasSearch && !filteredAliases.length" class="alias-dropdown">
              <div class="alias-option" style="color:var(--muted);cursor:default">
                {{ t('compose.noAlias') }}
              </div>
            </div>
          </div>
        </div>

        <!-- To -->
        <div class="field">
          <label class="label">{{ t('compose.to') }}</label>
          <input class="input" type="email" v-model="form.to" :placeholder="t('compose.toPlaceholder')" />
        </div>

        <!-- Reply-To (optional) -->
        <div class="field">
          <label class="label">
            {{ t('compose.replyTo') }}
            <span style="color:var(--muted);font-weight:400;text-transform:none">{{ t('compose.replyToOptional') }}</span>
          </label>
          <input class="input" type="email" v-model="form.replyTo" :placeholder="t('compose.replyToPlaceholder')" />
        </div>

        <!-- Subject -->
        <div class="field">
          <label class="label">{{ t('compose.subject') }}</label>
          <input class="input" type="text" v-model="form.subject" :placeholder="t('compose.subjectPlaceholder')" />
        </div>

        <!-- Body -->
        <div class="field">
          <label class="label">{{ t('compose.body') }}</label>
          <textarea class="textarea" v-model="form.body" :placeholder="t('compose.bodyPlaceholder')" style="min-height:220px"></textarea>
        </div>

        <!-- Attachments -->
        <div class="field">
          <label class="label">
            {{ t('compose.attachments') }}
            <span style="color:var(--muted);font-weight:400;text-transform:none">{{ t('compose.attachmentsHint') }}</span>
          </label>
          <div
            class="drop-zone"
            :class="{ 'drop-zone--over': isDragging }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
            @click="fileInput.click()"
          >
            <span style="font-size:18px">📎</span>
            <span style="color:var(--muted);font-size:12px;font-family:var(--mono)">
              {{ attachments.length ? t('compose.dropZoneAdd') : t('compose.dropZone') }}
            </span>
          </div>
          <input ref="fileInput" type="file" multiple style="display:none" @change="onFileInput" />
          <div v-if="attachments.length" style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
            <div v-for="(f, i) in attachments" :key="i" class="attachment-row">
              <span class="attachment-icon">{{ fileIcon(f.name) }}</span>
              <span class="attachment-name mono">{{ f.name }}</span>
              <span class="attachment-size">{{ formatSize(f.size) }}</span>
              <button class="btn-remove" @click="removeAttachment(i)" :title="t('compose.removeAttachment')">✕</button>
            </div>
          </div>
          <div v-if="totalSize > 8 * 1024 * 1024" style="margin-top:6px;font-size:11px;color:var(--red);font-family:var(--mono)">
            {{ t('compose.sizeLimitWarning', { size: formatSize(totalSize) }) }}
          </div>
        </div>

        <!-- Actions bar -->
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:12px;padding-top:8px">
          <span v-if="charCount > 0" class="mono" style="font-size:11px;color:var(--muted)">
            {{ t('compose.chars', { n: charCount }) }}
          </span>
          <span v-if="attachments.length" class="mono" style="font-size:11px;color:var(--muted)">
            {{ attachments.length > 1 ? t('compose.attachmentCountPlural', { n: attachments.length }) : t('compose.attachmentCount', { n: attachments.length }) }} · {{ formatSize(totalSize) }}
          </span>
          <button class="btn btn-ghost btn-sm" @click="clearForm">{{ t('compose.clearBtn') }}</button>
          <button class="btn btn-primary" @click="send" :disabled="!canSend || sending">
            <span v-if="sending" class="spinner" style="width:14px;height:14px;border-width:2px"></span>
            <span v-else>{{ t('compose.sendBtn') }}</span>
          </button>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAliasStore } from '@/stores/aliases'
import { useInboxStore } from '@/stores/inbox'
import { useCloudflare } from '@/composables/useCloudflare'

const { t } = useI18n()
const aliasStore = useAliasStore()
const inboxStore = useInboxStore()
const { sendEmail } = useCloudflare()

const form        = ref({ from: '', to: '', replyTo: '', subject: '', body: '' })
const attachments = ref([])
const sending     = ref(false)
const isDragging  = ref(false)
const fileInput   = ref(null)
const toast       = ref({ show: false, type: 'success', message: '' })

// Set when Compose was opened via "Reply" from an Inbox item — the source
// item is dismissed once the reply is sent successfully.
const replyingToId = ref(null)

// Alias searchable dropdown state
const aliasSearch   = ref('')
const aliasOpen     = ref(false)
const highlighted   = ref(0)
const aliasFieldRef = ref(null)

const enabledAliases = computed(() => aliasStore.aliases.filter(a => a.enabled))

const filteredAliases = computed(() => {
  const q = aliasSearch.value.trim().toLowerCase()
  if (!q) return enabledAliases.value
  return enabledAliases.value.filter(a =>
    a.alias.toLowerCase().includes(q) ||
    a.destination.toLowerCase().includes(q)
  )
})

function highlightAlias(text) {
  const q = aliasSearch.value.trim()
  if (!q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:rgba(124,109,250,0.35);color:var(--text);border-radius:2px;padding:0 1px">$1</mark>'
  )
}

function selectAlias(a) {
  form.value.from = a.alias
  aliasSearch.value = ''
  aliasOpen.value = false
  highlighted.value = 0
}

function clearAlias() {
  form.value.from = ''
  aliasSearch.value = ''
}

function closeAlias() {
  aliasOpen.value = false
}

function selectHighlighted() {
  if (filteredAliases.value[highlighted.value]) {
    selectAlias(filteredAliases.value[highlighted.value])
  }
}

function moveHighlight(dir) {
  const max = filteredAliases.value.length - 1
  highlighted.value = Math.max(0, Math.min(max, highlighted.value + dir))
}

// Close dropdown when clicking outside the alias field
function handleClickOutside(e) {
  if (aliasFieldRef.value && !aliasFieldRef.value.contains(e.target)) {
    aliasOpen.value = false
  }
}

// ── Attachments ───────────────────────────────────────────────────────────────

const MAX_TOTAL = 10 * 1024 * 1024
const charCount  = computed(() => form.value.body.length)
const totalSize  = computed(() => attachments.value.reduce((sum, f) => sum + f.size, 0))
const canSend    = computed(() => form.value.from && form.value.to && form.value.subject && form.value.body)

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['zip','gz','tar','7z'].includes(ext)) return '📦'
  if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼'
  if (['doc','docx'].includes(ext)) return '📝'
  if (['xls','xlsx'].includes(ext)) return '📊'
  return '📎'
}

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function addFiles(fileList) {
  let accumulated = 0
  let exceeded = false
  for (const f of Array.from(fileList)) {
    if (totalSize.value + accumulated + f.size > MAX_TOTAL) { exceeded = true; continue }
    if (!attachments.value.find(a => a.name === f.name && a.size === f.size)) {
      attachments.value.push(f)
      accumulated += f.size
    }
  }
  if (exceeded) showToast('error', t('compose.sizeLimitWarning', { size: formatSize(MAX_TOTAL) }))
}

function onFileInput(e) { addFiles(e.target.files); e.target.value = '' }
function onDrop(e)      { isDragging.value = false; addFiles(e.dataTransfer.files) }
function removeAttachment(i) { attachments.value.splice(i, 1) }

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Toast & Send ─────────────────────────────────────────────────────────────

function showToast(type, message) {
  toast.value = { show: true, type, message }
  setTimeout(() => { toast.value.show = false }, 3500)
}

function clearForm() {
  form.value = { from: '', to: '', replyTo: '', subject: '', body: '' }
  attachments.value = []
  aliasSearch.value = ''
}

// ── Reply-by-forward hand-off ────────────────────────────────────────────────

function applyPendingReply() {
  const item = inboxStore.pendingReply
  if (!item) return
  form.value.from = item.matchedAlias || ''
  form.value.to = item.originalFrom || ''
  form.value.subject = item.subject ? `Re: ${item.subject}` : ''
  form.value.body = item.body
    ? `\n\n----- ${t('compose.originalMessage')} -----\n${item.body}`
    : ''
  replyingToId.value = item.id
  inboxStore.clearPendingReply()
}

async function send() {
  if (!canSend.value) return
  sending.value = true
  try {
    const encoded = await Promise.all(
      attachments.value.map(async f => ({
        filename: f.name,
        contentType: f.type || 'application/octet-stream',
        data: await fileToBase64(f),
      }))
    )
    await sendEmail({
      from: form.value.from,
      to: form.value.to,
      subject: form.value.subject,
      body: form.value.body,
      replyTo: form.value.replyTo || form.value.from,
      attachments: encoded,
    })
    const n = encoded.length
    const msg = n === 0
      ? t('compose.sendSuccess')
      : n === 1
        ? t('compose.sendSuccessAttachments', { n })
        : t('compose.sendSuccessAttachmentsPlural', { n })
    showToast('success', msg)
    clearForm()
    if (replyingToId.value) {
      inboxStore.dismiss(replyingToId.value).catch(() => {})
      replyingToId.value = null
    }
  } catch (e) {
    showToast('error', e.response?.data?.error || t('compose.sendError'))
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  if (!aliasStore.aliases.length) aliasStore.fetchAliases()
  applyPendingReply()
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(6px); }

/* Alias dropdown */
.alias-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: var(--radius-sm);
  max-height: 260px;
  overflow-y: auto;
  z-index: 50;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
}

.alias-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 120ms ease;
}
.alias-option:last-child { border-bottom: none; }
.alias-option:hover,
.alias-option--active { background: var(--surface); }

.alias-option-addr {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--text);
}
.alias-option-dest {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
}

/* Drop zone */
.drop-zone {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 18px; border: 1px dashed var(--border2); border-radius: var(--radius);
  cursor: pointer; background: var(--surface2); user-select: none;
  transition: border-color 180ms ease, background 180ms ease;
}
.drop-zone:active, .drop-zone--over {
  border-color: var(--accent);
  background: rgba(124,109,250,0.06);
}

/* Attachment row */
.attachment-row {
  display: grid; grid-template-columns: 22px 1fr auto auto;
  align-items: center; gap: 10px; padding: 10px 14px;
  background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.attachment-icon { font-size: 16px; }
.attachment-name { font-family: var(--mono); font-size: 12px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.attachment-size { font-family: var(--mono); font-size: 11px; color: var(--muted); white-space: nowrap; }
.btn-remove {
  background: none; border: none; color: var(--muted); cursor: pointer;
  font-size: 14px; padding: 4px 6px; border-radius: 4px;
  min-height: 32px; min-width: 32px; display: flex; align-items: center; justify-content: center;
}
.btn-remove:active { color: var(--red); }
</style>