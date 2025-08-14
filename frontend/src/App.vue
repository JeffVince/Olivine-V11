<template>
  <v-app>
    <template v-if="showAppShell">
      <AppHeader @toggle-drawer="drawer = !drawer">
        <template #actions>
          <NotificationBell />
        </template>
      </AppHeader>
      <AppSidebar v-model:open="drawer" />
      <PageContainer>
        <router-view />
      </PageContainer>
      <ToastContainer />
    </template>
    <router-view v-else />
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import AppHeader from '@components/layout/AppHeader.vue'
import AppSidebar from '@components/layout/AppSidebar.vue'
import PageContainer from '@components/layout/PageContainer.vue'
import NotificationBell from '@components/layout/NotificationBell.vue'
import ToastContainer from '@components/common/ToastContainer.vue'
import { useProjectStore } from '@/stores/projectStore'
import { useOrganizationStore } from '@/stores/organizationStore'
import { useAuthStore } from '@/stores/authStore'

const drawer = ref(true)
const organizationStore = useOrganizationStore()
const projectStore = useProjectStore()
const authStore = useAuthStore()
const showAppShell = computed(() => authStore.isAuthenticated)

// Initialize stores when app starts
onMounted(async () => {
  try {
    // Initialize organization store first
    organizationStore.initialize()
    if (authStore.isAuthenticated) {
      await projectStore.initializeProject()
    }
  } catch (error) {
    console.error('Failed to initialize app:', error)
  }
})
</script>

<style>
#app { min-height: 100vh; }
</style>
