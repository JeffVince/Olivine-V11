<template>
  <v-app>
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
  </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppHeader from '@components/layout/AppHeader.vue'
import AppSidebar from '@components/layout/AppSidebar.vue'
import PageContainer from '@components/layout/PageContainer.vue'
import NotificationBell from '@components/layout/NotificationBell.vue'
import ToastContainer from '@components/common/ToastContainer.vue'
import { useProjectStore } from '@/stores/projectStore'

const drawer = ref(true)
const projectStore = useProjectStore()

// Initialize project store when app starts
onMounted(() => {
  projectStore.initializeProject()
})
</script>

<style>
/* Global styles for Olivine */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  min-height: 100vh;
}
</style>
