<template>
  <v-card
    title="Commit Timeline"
    class="glass-card"
  >
    <v-list density="compact">
      <v-list-item
        v-for="commit in commits"
        :key="commit.id"
        :title="commit.message"
        :subtitle="formatDate(commit.createdAt)"
      />
    </v-list>
  </v-card>
</template>

<script setup lang="ts">
import { Commit } from '@/views/CommitsBranches/Composables/Interface'

interface Props {
  commits: Commit[]
}

defineProps<Props>()

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString()
}
</script>

<style scoped>
/* Scoped styles for the commit timeline component */
</style>
