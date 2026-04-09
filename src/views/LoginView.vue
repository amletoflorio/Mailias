<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">mail<span>ias</span></div>
      <p class="login-tagline">{{ t('login.tagline') }}</p>
      <p class="login-desc">
        {{ t('login.desc').split('\n')[0] }}<br>
        {{ t('login.desc').split('\n')[1] }}
      </p>
      <button class="btn btn-primary" style="width:100%" @click="login" :disabled="busy">
        <span v-if="busy" class="spinner" style="width:14px;height:14px;border-width:2px"></span>
        <span v-else>{{ t('login.button') }}</span>
      </button>
      <!-- Language switcher on the login page -->
      <button class="lang-toggle" @click="toggleLocale">
        {{ locale === 'it' ? 'English' : 'Italiano' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { setLocale } from '@/i18n'

const { t, locale } = useI18n()
const { login } = useAuth()
const busy = ref(false)

function toggleLocale() {
  setLocale(locale.value === 'it' ? 'en' : 'it')
}
</script>

<style scoped>
.lang-toggle {
  margin-top: 20px;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--mono);
  font-size: 12px;
  text-decoration: underline;
  padding: 4px;
}
.lang-toggle:hover {
  color: var(--text);
}
</style>
