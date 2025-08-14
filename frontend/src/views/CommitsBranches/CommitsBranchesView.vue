<template>
  <div>
    <h2>Commits & Branches</h2>
    <CommitTimeline :commits="commits" />
    <BranchList :branches="branches" />
  </div>
</template>

<script setup lang="ts">
import { useCommits } from '@/composables/useCommits'
import { useBranches } from '@/composables/useBranches'
import CommitTimeline from './Components/CommitTimeline.vue'
import BranchList from './Components/BranchList.vue'
import { useCommitsBranchesState } from './Composables/state'

const { items: commits } = useCommits()
const { branches } = useBranches()
const { state } = useCommitsBranchesState()
</script>

<style scoped>
/* Scoped styles for the main orchestrator component */
</style>