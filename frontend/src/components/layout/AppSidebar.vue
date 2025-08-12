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
import { useRoute } from 'vue-router'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'update:open', value: boolean): void }>()

const internalOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
})

const route = useRoute()

const links = [
  { to: '/', title: 'Home / Today', icon: 'mdi-home' },
  { to: '/projects/:id/files', title: 'File Explorer', icon: 'mdi-folder' },
  { to: '/projects/:id/mapping', title: 'Mapping Studio', icon: 'mdi-tune' },
  { to: '/projects/:id/agents', title: 'Agent Console', icon: 'mdi-robot' },
  { to: '/projects/:id/reviews', title: 'Approvals & Reviews', icon: 'mdi-check-decagram' },
  { to: '/projects/:id/history', title: 'Commits & Branches', icon: 'mdi-source-fork' },
  { to: '/projects/:id/integrations', title: 'Integrations', icon: 'mdi-puzzle' },
  { to: '/projects/:id/inbox', title: 'Notifications', icon: 'mdi-bell' },
  { to: '/projects/:id/settings', title: 'Settings & Roles', icon: 'mdi-cog' },
  { to: '/admin/health', title: 'System Health', icon: 'mdi-heart-pulse' },
]
</script>


