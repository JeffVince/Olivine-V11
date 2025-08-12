<template>
  <div>
    <h2>Approvals & Reviews</h2>
    <v-card>
      <v-data-table :items="items" :headers="headers" :loading="loading" item-key="id" density="compact">
        <template #item.actions="{ item }">
          <v-btn size="small" color="success" class="mr-2" @click="onApprove(item.id)">Approve</v-btn>
          <v-btn size="small" color="error" @click="onReject(item.id)">Reject</v-btn>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { useApprovals } from '@/composables/useApprovals'
const { items, loading, approve, reject, refetch } = useApprovals()
const headers = [
  { title: 'Type', value: 'type' },
  { title: 'Status', value: 'status' },
  { title: 'Created', value: 'createdAt' },
  { title: 'Actions', value: 'actions', sortable: false },
]

async function onApprove(id: string) {
  await approve({ orgId: items.value[0]?.orgId, id })
  await refetch()
}
async function onReject(id: string) {
  await reject({ orgId: items.value[0]?.orgId, id })
  await refetch()
}
</script>


