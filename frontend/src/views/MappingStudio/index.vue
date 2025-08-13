<template>
  <div>
    <!-- Header -->
    <Header @create-mapping="showCreateDialog = true" />
    
    <!-- Mapping Templates -->
    <MappingTemplates 
      :templates="mappingTemplates" 
      @create-from-template="createFromTemplate" 
    />
    
    <!-- Mappings -->
    <v-row>
      <v-col cols="12">
        <v-card class="glass-card">
          <v-card-title class="d-flex align-center justify-space-between">
            <div>
              <v-icon class="mr-2">
                mdi-map
              </v-icon>
              Mappings
            </div>
            <div class="d-flex align-center">
              <span class="text-body-2 mr-4">
                {{ activeMappingsCount }} active, {{ inactiveMappingsCount }} inactive
              </span>
              <v-btn-toggle
                v-model="viewMode"
                mandatory
              >
                <v-btn
                  value="grid"
                  size="small"
                >
                  <v-icon>mdi-view-grid</v-icon>
                </v-btn>
                <v-btn
                  value="list"
                  size="small"
                >
                  <v-icon>mdi-view-list</v-icon>
                </v-btn>
              </v-btn-toggle>
            </div>
          </v-card-title>

          <!-- Grid View -->
          <MappingGrid
            v-if="viewMode === 'grid'"
            :mappings="mappings"
            :get-mapping-color="getMappingColor"
            :get-mapping-icon="getMappingIcon"
            :format-date="formatDate"
            @edit="editMapping"
            @test="testMapping"
            @toggle-status="toggleMappingStatus"
            @duplicate="duplicateMapping"
            @delete="deleteMapping"
          />

          <!-- List View -->
          <MappingList
            v-else
            :mappings="mappings"
            :get-mapping-color="getMappingColor"
            :get-mapping-icon="getMappingIcon"
            :format-date="formatDate"
            @edit="editMapping"
            @test="testMapping"
            @toggle-status="toggleMappingStatus"
            @duplicate="duplicateMapping"
            @delete="deleteMapping"
          />
        </v-card>
      </v-col>
    </v-row>

    <!-- Create Mapping Dialog -->
    <CreateMappingDialog
      v-model="showCreateDialog"
      :mapping="newMapping"
      :creating="creating"
      @save="createMapping"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useState, useActions } from '@/views/MappingStudio/Composables'
import Header from '@/views/MappingStudio/Components/Header.vue'
import MappingTemplates from '@/views/MappingStudio/Components/MappingTemplates.vue'
import MappingGrid from '@/views/MappingStudio/Components/MappingGrid.vue'
import MappingList from '@/views/MappingStudio/Components/MappingList.vue'
import CreateMappingDialog from '@/views/MappingStudio/Components/CreateMappingDialog.vue'

// Use composables
const { 
  mappings, 
  mappingTemplates, 
  newMapping, 
  showCreateDialog, 
  creating, 
  viewMode, 
  activeMappingsCount, 
  inactiveMappingsCount 
} = useState()

const { 
  getMappingColor, 
  getMappingIcon, 
  formatDate, 
  createMapping, 
  createFromTemplate, 
  editMapping, 
  testMapping, 
  duplicateMapping, 
  toggleMappingStatus, 
  deleteMapping, 
  initializeMappings 
} = useActions()

// Load mappings on mount
onMounted(() => {
  initializeMappings()
})
</script>

<style scoped>
/* Scoped styles have been moved to individual components */
</style>