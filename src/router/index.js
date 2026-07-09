// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

import LoginView from '@/views/LoginView.vue'
import CallbackView from '@/views/CallbackView.vue'
import ComposeView from '@/views/ComposeView.vue'
import AliasesView from '@/views/AliasesView.vue'
import InboxView from '@/views/InboxView.vue'
import SentView from '@/views/SentView.vue'

const routes = [
  { path: '/', redirect: '/compose' },
  { path: '/login', component: LoginView, meta: { public: true } },
  { path: '/callback', component: CallbackView, meta: { public: true } },
  { path: '/compose', component: ComposeView, meta: { requiresAuth: true } },
  { path: '/aliases', component: AliasesView, meta: { requiresAuth: true } },
  { path: '/inbox', component: InboxView, meta: { requiresAuth: true } },
  { path: '/sent', component: SentView, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const { isAuthenticated, loading, init } = useAuth()
  if (loading.value) await init()
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { path: '/login' }
  }
})

export default router
