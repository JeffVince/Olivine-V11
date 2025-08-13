<template>
  <v-card
    class="mt-4 glass-card"
    title="Branches"
  >
    <v-card-text>
      <v-chip
        v-for="branch in branches"
        :key="branch.id"
        class="ma-1"
        :color="branch.active ? 'primary' : undefined"
      >
        {{ branch.name }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { Branch } from '@/views/CommitsBranches/Composables/Interface'

interface Props {
  branches: Branch[]
}

defineProps<Props>()
</script>

<style scoped>
/* Scoped styles for the branch list component */
</style>
