<template>
  <div>
    <h2>Commits & Branches</h2>
    <v-card title="Commit Timeline" class="glass-card">
      <v-list density="compact">
        <v-list-item
          v-for="c in commits"
          :key="c.id"
          :title="c.message"
          :subtitle="c.createdAt"
        />
      </v-list>
    </v-card>
    <v-card
      class="mt-4 glass-card"
      title="Branches"
    >
      <v-card-text>
        <v-chip
          v-for="b in branches"
          :key="b.id"
          class="ma-1"
          :color="b.active ? 'primary' : undefined"
        >
          {{ b.name }}
        </v-chip>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useCommits } from '@/composables/useCommits'
import { useBranches } from '@/composables/useBranches'
const { items: commits } = useCommits()
const { branches } = useBranches()
</script>


