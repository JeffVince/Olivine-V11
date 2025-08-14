<template>
  <div>
    <h1>Test Composables</h1>
  </div>
</template>

<script setup lang="ts">

import { showAddDialog } from './state'

// Test if we can access the composable
console.log('showAddDialog:', showAddDialog.value)
</script>
