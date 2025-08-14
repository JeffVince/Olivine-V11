import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'

const routes: Array<RouteRecordRaw> = [
  { path: '/', name: 'Home', component: () => import('../views/Dashboard/DashboardView.vue') },
  { path: '/projects', name: 'Projects', component: () => import('../views/Projects/ProjectsView.vue') },
  { path: '/projects/:id/home', name: 'ProjectHome', component: () => import('../views/Dashboard/DashboardView.vue') },
  { path: '/projects/:id/files', name: 'FileExplorer', component: () => import('../views/FileExplorer/FileExplorerView.vue') },
  { path: '/projects/:id/mapping', name: 'MappingStudio', component: () => import('../views/MappingStudio/MappingStudioView.vue') },
  { path: '/projects/:id/days/:date', name: 'ShootDayCockpit', component: () => import('../views/ShootDayCockpit/ShootDayCockpitView.vue') },
  { path: '/projects/:id/callsheets/:callSheetId', name: 'CallSheetComposer', component: () => import('../views/CallSheetComposer/CallSheetComposerView.vue') },
  { path: '/projects/:id/agents', name: 'AgentConsole', component: () => import('../views/AgentConsole/AgentConsoleView.vue') },
  { path: '/projects/:id/reviews', name: 'ApprovalsReviews', component: () => import('../views/ApprovalsReviews/ApprovalsReviewsView.vue') },
  { path: '/projects/:id/history', name: 'CommitsBranches', component: () => import('../views/CommitsBranches/CommitsBranchesView.vue') },
  { path: '/projects/:id/integrations', name: 'Integrations', component: () => import('../views/Integrations/IntegrationsView.vue') },
  { path: '/projects/:id/inbox', name: 'Notifications', component: () => import('../views/Notifications/NotificationsView.vue') },
  { path: '/projects/:id/settings', name: 'Settings', component: () => import('../views/Settings/SettingsView.vue') },
  { path: '/admin/health', name: 'SystemHealth', component: () => import('../views/SystemHealth/SystemHealthView.vue') },
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
