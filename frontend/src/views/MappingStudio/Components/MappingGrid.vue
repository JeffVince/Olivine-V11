<template>
  <v-row>
    <v-col 
      v-for="mapping in mappings"
      :key="mapping.id"
      cols="12"
      md="6"
      lg="4"
    >
      <v-card 
        class="mapping-card glass-card"
        :class="{ 'border-success': mapping.status === 'active' }"
      >
        <v-card-title class="d-flex align-center">
          <v-avatar
            :color="getMappingColor(mapping.type)"
            size="36"
            class="mr-3"
          >
            <v-icon
              color="white"
              size="18"
            >
              {{ getMappingIcon(mapping.type) }}
            </v-icon>
          </v-avatar>
          <span class="text-truncate">{{ mapping.name }}</span>
          <v-spacer />
          <v-chip 
            :color="mapping.status === 'active' ? 'success' : 'grey'"
            size="small"
            variant="tonal"
          >
            {{ mapping.status }}
          </v-chip>
        </v-card-title>
        
        <v-card-text>
          <p class="text-medium-emphasis text-caption mb-3">
            {{ mapping.description }}
          </p>
          
          <div class="d-flex align-center text-caption mb-2">
            <v-icon
              size="small"
              class="mr-2"
            >
              mdi-format-list-bulleted
            </v-icon>
            <span>{{ mapping.fieldCount }} fields</span>
            <v-icon
              size="small"
              class="mx-2"
            >
              mdi-arrow-right
            </v-icon>
            <span>{{ mapping.transformCount }} transforms</span>
          </div>
          
          <div
            v-if="mapping.lastRun"
            class="d-flex align-center text-caption"
          >
            <v-icon
              size="small"
              class="mr-2"
            >
              mdi-clock-outline
            </v-icon>
            <span>Last run: {{ formatDate(mapping.lastRun) }}</span>
          </div>
        </v-card-text>
        
        <v-card-actions>
          <v-btn 
            size="small" 
            variant="text"
            @click="$emit('edit', mapping)"
          >
            <v-icon
              size="small"
              class="mr-1"
            >
              mdi-pencil
            </v-icon>
            Edit
          </v-btn>
          <v-btn 
            size="small" 
            variant="text"
            @click="$emit('test', mapping)"
          >
            <v-icon
              size="small"
              class="mr-1"
            >
              mdi-test-tube
            </v-icon>
            Test
          </v-btn>
          <v-spacer />
          <v-btn 
            size="small" 
            variant="text"
            @click="$emit('toggle-status', mapping)"
          >
            <v-icon
              size="small"
              class="mr-1"
            >
              {{ mapping.status === 'active' ? 'mdi-pause' : 'mdi-play' }}
            </v-icon>
            {{ mapping.status === 'active' ? 'Pause' : 'Activate' }}
          </v-btn>
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
              <v-list-item @click="$emit('duplicate', mapping)">
                <template #prepend>
                  <v-icon>mdi-content-copy</v-icon>
                </template>
                <v-list-item-title>Duplicate</v-list-item-title>
              </v-list-item>
              <v-list-item
                class="text-error"
                @click="$emit('delete', mapping)"
              >
                <template #prepend>
                  <v-icon>mdi-delete</v-icon>
                </template>
                <v-list-item-title>Delete</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </v-card-actions>
      </v-card>
    </v-col>
  </v-row>
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

// Emits
defineEmits(['edit', 'test', 'toggle-status', 'duplicate', 'delete'])
</script>

<style scoped>
.mapping-card {
  transition: all 0.2s ease;
}

.mapping-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.border-success {
  border: 1px solid rgb(var(--v-theme-success)) !important;
}
</style>
