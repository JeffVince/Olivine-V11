import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  { path: '/', name: 'Home', component: () => import('../views/Dashboard.vue') },
  { path: '/projects/:id/home', name: 'ProjectHome', component: () => import('../views/Dashboard.vue') },
  { path: '/projects/:id/files', name: 'FileExplorer', component: () => import('../views/FileExplorer.vue') },
  { path: '/projects/:id/mapping', name: 'MappingStudio', component: () => import('../views/MappingStudio.vue') },
  { path: '/projects/:id/days/:date', name: 'ShootDayCockpit', component: () => import('../views/ShootDayCockpit.vue') },
  { path: '/projects/:id/callsheets/:id', name: 'CallSheetComposer', component: () => import('../views/CallSheetComposer.vue') },
  { path: '/projects/:id/agents', name: 'AgentConsole', component: () => import('../views/AgentConsole.vue') },
  { path: '/projects/:id/reviews', name: 'ApprovalsReviews', component: () => import('../views/ApprovalsReviews.vue') },
  { path: '/projects/:id/history', name: 'CommitsBranches', component: () => import('../views/CommitsBranches.vue') },
  { path: '/projects/:id/integrations', name: 'Integrations', component: () => import('../views/Integrations.vue') },
  { path: '/projects/:id/inbox', name: 'Notifications', component: () => import('../views/Notifications.vue') },
  { path: '/projects/:id/settings', name: 'Settings', component: () => import('../views/Settings.vue') },
  { path: '/admin/health', name: 'SystemHealth', component: () => import('../views/SystemHealth.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
