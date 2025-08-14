<template>
  <div>
    <h1>Test Integrations View</h1>
    <p>Loading: {{ loading }}</p>
    <p>Show Add Dialog: {{ showAddDialog }}</p>
    <button @click="testFunction">
      Test Function
    </button>
  </div>
</template>

<script setup lang="ts">
// Import state variables directly from state file
import { 
  showAddDialog,
  loading
} from '@/views/Integrations/Composables/state'

// Import functions directly from api file
// connectIntegration is imported but not used
// eslint-disable-next-line @typescript-eslint/no-unused-vars


// Import Apollo Client composable
// useRoute and useOrganizationStore are imported but not used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useRoute } from 'vue-router'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useOrganizationStore } from '@/stores/organizationStore'

function testFunction() {
  console.log('Test function called')
  console.log('showAddDialog:', showAddDialog.value)
  console.log('loading:', loading.value)
}
</script>
