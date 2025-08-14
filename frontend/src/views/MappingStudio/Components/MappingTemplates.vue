<template>
  <v-row class="mb-6">
    <v-col cols="12">
      <v-card class="glass-card">
        <v-card-title>
          <v-icon class="mr-2">
            mdi-file-document-multiple
          </v-icon>
          Mapping Templates
        </v-card-title>
        <v-card-text>
          <v-row>
            <v-col 
              v-for="template in templates"
              :key="template.id"
              cols="12"
              sm="6"
              md="4"
            >
              <v-card 
                variant="outlined"
                class="template-card glass-card"
                @click="$emit('create-from-template', template)"
              >
                <v-card-text class="text-center pa-4">
                  <v-avatar 
                    :color="template.color"
                    size="48"
                    class="mb-3"
                  >
                    <v-icon
                      color="white"
                      size="24"
                    >
                      {{ template.icon }}
                    </v-icon>
                  </v-avatar>
                  <h3 class="text-h6 mb-1">
                    {{ template.name }}
                  </h3>
                  <p class="text-caption text-medium-emphasis mb-2">
                    {{ template.description }}
                  </p>
                  <v-chip 
                    size="small" 
                    variant="tonal"
                    class="mb-2"
                  >
                    {{ template.type }}
                  </v-chip>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { MappingTemplate } from '@/views/MappingStudio/Composables/types'

// Props
interface Props {
  templates: MappingTemplate[]
}

defineProps<Props>()

// Emits
defineEmits(['create-from-template'])
</script>

<style scoped>
.template-card {
  transition: all 0.2s ease;
  cursor: pointer;
}

.template-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
