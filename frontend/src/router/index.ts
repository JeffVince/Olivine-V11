import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'

const routes: Array<RouteRecordRaw> = [
  { path: '/', name: 'Home', component: () => import('../views/Dashboard/index.vue') },
  { path: '/projects', name: 'Projects', component: () => import('../views/Projects/index.vue') },
  { path: '/projects/:id/home', name: 'ProjectHome', component: () => import('../views/Dashboard/index.vue') },
  { path: '/projects/:id/files', name: 'FileExplorer', component: () => import('../views/FileExplorer/index.vue') },
  { path: '/projects/:id/mapping', name: 'MappingStudio', component: () => import('../views/MappingStudio/index.vue') },
  { path: '/projects/:id/days/:date', name: 'ShootDayCockpit', component: () => import('../views/ShootDayCockpit/index.vue') },
  { path: '/projects/:id/callsheets/:callSheetId', name: 'CallSheetComposer', component: () => import('../views/CallSheetComposer/index.vue') },
  { path: '/projects/:id/agents', name: 'AgentConsole', component: () => import('../views/AgentConsole/index.vue') },
  { path: '/projects/:id/reviews', name: 'ApprovalsReviews', component: () => import('../views/ApprovalsReviews/index.vue') },
  { path: '/projects/:id/history', name: 'CommitsBranches', component: () => import('../views/CommitsBranches/index.vue') },
  { path: '/projects/:id/integrations', name: 'Integrations', component: () => import('../views/Integrations/index.vue') },
  { path: '/projects/:id/inbox', name: 'Notifications', component: () => import('../views/Notifications/index.vue') },
  { path: '/projects/:id/settings', name: 'Settings', component: () => import('../views/Settings/index.vue') },
  { path: '/admin/health', name: 'SystemHealth', component: () => import('../views/SystemHealth/index.vue') },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const projectStore = useProjectStore()
  const maybeId = to.params.id as string | undefined
  if (maybeId) projectStore.setProject(maybeId)
})

export default router
