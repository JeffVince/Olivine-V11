<template>
  <div>
    <h2>Approvals & Reviews</h2>
    <ApprovalsTable 
      :items="filteredItems" 
      :loading="loading"
      @approve="handleApprove"
      @reject="handleReject"
    />
  </div>
</template>

<script setup lang="ts">
import { useApprovalsManagement } from './Composables/useApprovalsManagement'
import ApprovalsTable from './Components/ApprovalsTable.vue'

const {
  items,
  loading,
  filteredItems,
  handleApprove,
  handleReject
} = useApprovalsManagement()
</script>


