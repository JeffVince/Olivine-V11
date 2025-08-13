<template>
  <v-card class="glass-card">
    <v-data-table
      :items="items"
      :headers="headers"
      :loading="loading"
      item-key="id"
      density="compact"
    >
      <template #item.actions="{ item }">
        <v-btn
          size="small"
          color="success"
          class="mr-2"
          @click="onApprove(item.id)"
        >
          Approve
        </v-btn>
        <v-btn
          size="small"
          color="error"
          @click="onReject(item.id)"
        >
          Reject
        </v-btn>
      </template>
    </v-data-table>
  </v-card>
</template>

<script setup lang="ts">
import { ApprovalItem } from '../Composables/useApprovalsManagement'

defineProps<{
  items: ApprovalItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'approve', id: string): void
  (e: 'reject', id: string): void
}>()

const headers = [
  { title: 'Type', value: 'type' },
  { title: 'Status', value: 'status' },
  { title: 'Created', value: 'createdAt' },
  { title: 'Actions', value: 'actions', sortable: false },
]

function onApprove(id: string) {
  emit('approve', id)
}

function onReject(id: string) {
  emit('reject', id)
}
</script>
