// i18n setup — loads locale from localStorage so the preference persists across sessions
import { createI18n } from 'vue-i18n'
import it from './it'
import en from './en'

const STORAGE_KEY = 'mailias-locale'

// Detect saved preference, then browser language, then fall back to Italian
function detectLocale() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'it' || saved === 'en') return saved
  const browser = navigator.language?.slice(0, 2)
  return browser === 'en' ? 'en' : 'it'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { it, en },
  // Suppress missing-key warnings in the console
  missingWarn: false,
  fallbackWarn: false,
  // Do not treat '@' as a linked-message prefix — avoids SyntaxError on
  // plain strings that contain email addresses or Italian apostrophes
  warnHtmlMessage: false,
})

// Persist locale change to localStorage whenever it is updated
export function setLocale(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}