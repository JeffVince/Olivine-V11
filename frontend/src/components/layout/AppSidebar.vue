<template>
  <v-navigation-drawer v-model="internalOpen" app>
    <v-list density="comfortable" nav>
      <v-list-item
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        :title="link.title"
        :prepend-icon="link.icon"
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

import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'

const router = useRouter()
const projectStore = useProjectStore()

const projectPath = (suffix: string) => `/projects/${projectStore.currentProjectId || ''}${suffix}`

const links = computed(() => [
  { to: projectStore.currentProjectId ? projectPath('/home') : '/projects', title: 'Home / Today', icon: 'mdi-home' },
  { to: projectStore.currentProjectId ? projectPath('/files') : '/projects', title: 'File Explorer', icon: 'mdi-folder' },
  { to: projectStore.currentProjectId ? projectPath('/mapping') : '/projects', title: 'Mapping Studio', icon: 'mdi-tune' },
  { to: projectStore.currentProjectId ? projectPath('/agents') : '/projects', title: 'Agent Console', icon: 'mdi-robot' },
  { to: projectStore.currentProjectId ? projectPath('/reviews') : '/projects', title: 'Approvals & Reviews', icon: 'mdi-check-decagram' },
  { to: projectStore.currentProjectId ? projectPath('/history') : '/projects', title: 'Commits & Branches', icon: 'mdi-source-fork' },
  { to: projectStore.currentProjectId ? projectPath('/integrations') : '/projects', title: 'Integrations', icon: 'mdi-puzzle' },
  { to: projectStore.currentProjectId ? projectPath('/inbox') : '/projects', title: 'Notifications', icon: 'mdi-bell' },
  { to: projectStore.currentProjectId ? projectPath('/settings') : '/projects', title: 'Settings & Roles', icon: 'mdi-cog' },
  { to: '/admin/health', title: 'System Health', icon: 'mdi-heart-pulse' },
])
</script>


