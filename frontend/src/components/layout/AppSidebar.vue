<template>
  <v-navigation-drawer
    v-model="internalOpen"
    app
    class="glass glass-sidebar"
  >
    <v-list
      density="comfortable"
      nav
    >
      <v-list-item
        v-for="link in links"
        :key="link.id"
        :to="link.to"
        :title="link.title"
        :prepend-icon="link.icon"
        :value="link.id"
        link
        router
      />
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const internalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

import { useProjectStore } from '@/stores/projectStore'

const projectStore = useProjectStore()

const projectPath = (suffix: string) => `/projects/${projectStore.currentProjectId || ''}${suffix}`

const links = computed(() => [
  { id: 'home', to: projectStore.currentProjectId ? projectPath('/home') : '/projects', title: 'Home / Today', icon: 'mdi-home' },
  { id: 'files', to: projectStore.currentProjectId ? projectPath('/files') : '/projects', title: 'File Explorer', icon: 'mdi-folder' },
  { id: 'mapping', to: projectStore.currentProjectId ? projectPath('/mapping') : '/projects', title: 'Mapping Studio', icon: 'mdi-tune' },
  { id: 'agents', to: projectStore.currentProjectId ? projectPath('/agents') : '/projects', title: 'Agent Console', icon: 'mdi-robot' },
  { id: 'reviews', to: projectStore.currentProjectId ? projectPath('/reviews') : '/projects', title: 'Approvals & Reviews', icon: 'mdi-check-decagram' },
  { id: 'history', to: projectStore.currentProjectId ? projectPath('/history') : '/projects', title: 'Commits & Branches', icon: 'mdi-source-fork' },
  { id: 'integrations', to: projectStore.currentProjectId ? projectPath('/integrations') : '/projects', title: 'Integrations', icon: 'mdi-puzzle' },
  { id: 'inbox', to: projectStore.currentProjectId ? projectPath('/inbox') : '/projects', title: 'Notifications', icon: 'mdi-bell' },
  { id: 'settings', to: projectStore.currentProjectId ? projectPath('/settings') : '/projects', title: 'Settings & Roles', icon: 'mdi-cog' },
  { id: 'health', to: '/admin/health', title: 'System Health', icon: 'mdi-heart-pulse' },
])
</script>


