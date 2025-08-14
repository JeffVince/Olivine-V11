<template>
  <v-data-table
    :headers="headers"
    :items="mappings"
    item-value="id"
    class="glass-card"
  >
    <template #item.type="{ item }">
      <v-chip
        :color="getMappingColor(item.type)"
        size="small"
        variant="tonal"
      >
        <v-icon
          start
          size="small"
        >
          {{ getMappingIcon(item.type) }}
        </v-icon>
        {{ item.type }}
      </v-chip>
    </template>
    
    <template #item.status="{ item }">
      <v-chip
        :color="item.status === 'active' ? 'success' : 'grey'"
        size="small"
        variant="tonal"
      >
        {{ item.status }}
      </v-chip>
    </template>
    
    <template #item.lastRun="{ item }">
      {{ item.lastRun ? formatDate(item.lastRun) : 'Never' }}
    </template>
    
    <template #item.actions="{ item }">
      <v-btn 
        size="small" 
        variant="text" 
        icon="mdi-pencil"
        @click="$emit('edit', item)"
      />
      <v-btn 
        size="small" 
        variant="text" 
        icon="mdi-test-tube"
        @click="$emit('test', item)"
      />
      <v-btn 
        size="small" 
        variant="text" 
        :icon="item.status === 'active' ? 'mdi-pause' : 'mdi-play'"
        @click="$emit('toggle-status', item)"
      />
      <v-menu>
        <template #activator="{ props }">
          <v-btn 
            size="small" 
            variant="text"
            icon="mdi-dots-vertical"
            v-bind="props"
          />
        </template>
        <v-list density="compact">
          <v-list-item @click="$emit('duplicate', item)">
            <template #prepend>
              <v-icon>mdi-content-copy</v-icon>
            </template>
            <v-list-item-title>Duplicate</v-list-item-title>
          </v-list-item>
          <v-list-item
            class="text-error"
            @click="$emit('delete', item)"
          >
            <template #prepend>
              <v-icon>mdi-delete</v-icon>
            </template>
            <v-list-item-title>Delete</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import type { Mapping } from '@/views/MappingStudio/Composables/types'

// Props
interface Props {
  mappings: Mapping[]
  getMappingColor: (type: string) => string
  getMappingIcon: (type: string) => string
  formatDate: (dateString: string) => string
}

defineProps<Props>()

// Table headers
const headers = [
  { title: 'Name', key: 'name', sortable: true },
  { title: 'Type', key: 'type', sortable: true },
  { title: 'Status', key: 'status', sortable: true },
  { title: 'Fields', key: 'fieldCount', sortable: true },
  { title: 'Transforms', key: 'transformCount', sortable: true },
  { title: 'Last Run', key: 'lastRun', sortable: true },
  { title: 'Actions', key: 'actions', sortable: false }
]

// Emits
defineEmits(['edit', 'test', 'toggle-status', 'duplicate', 'delete'])
</script>

<style scoped>
/* Scoped styles for this component */
</style>
