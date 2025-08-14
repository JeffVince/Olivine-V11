<template>
  <v-container fluid>
    <v-row>
      <v-col
        v-for="file in filteredFiles"
        :key="file.id"
        cols="12"
        sm="6"
        md="4"
        lg="3"
      >
        <v-card
          :class="{ 'border-primary': selectedFile?.id === file.id }"
          class="file-card"
          @click="emit('fileSelect', file)"
        >
          <v-card-text class="pa-3">
            <div class="d-flex align-center mb-2">
              <v-icon
                size="x-large"
                class="mr-3"
              >
                {{ mimeIcon(file.mimeType) }}
              </v-icon>
              <div>
                <div class="text-subtitle-2 text-truncate">
                  {{ file.name }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatFileSize(file.size || 0) }}
                </div>
              </div>
            </div>
            
            <div class="d-flex justify-space-between align-center mt-2">
              <v-chip
                v-if="file.classificationStatus"
                :color="classificationColor(file.classificationStatus)"
                size="x-small"
                label
                variant="tonal"
              >
                {{ file.classificationStatus }}
              </v-chip>
              <v-spacer />
              <v-menu>
                <template #activator="{ props: menuProps }">
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    v-bind="menuProps"
                  >
                    <v-icon>mdi-dots-vertical</v-icon>
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item @click="promptRename(file, renameFile)">
                    <template #prepend>
                      <v-icon>mdi-pencil</v-icon>
                    </template>
                    <v-list-item-title>Rename</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="promptMove(file, moveFile)">
                    <template #prepend>
                      <v-icon>mdi-folder-move</v-icon>
                    </template>
                    <v-list-item-title>Move</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { FileItem } from '../Composables/Interface'
import { useFileExplorerUtils } from '../Composables/utils'

interface Emits {
  (e: 'fileSelect', file: FileItem): void
}

const emit = defineEmits<Emits>()
const { formatFileSize, classificationColor, mimeIcon } = useFileExplorerUtils()

function promptRename(file: FileItem, renameFile: (id: string, name: string) => Promise<void>) {
  const name = window.prompt('Rename file', file.name)
  if (name && name !== file.name) {
    renameFile(file.id, name)
  }
}

function promptMove(file: FileItem, moveFile: (id: string, path: string) => Promise<void>) {
  const path = window.prompt('Move file to path', file.path)
  if (path && path !== file.path) {
    moveFile(file.id, path)
  }
}
</script>

<style scoped>
.file-card {
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.border-primary {
  border: 2px solid rgb(var(--v-theme-primary));
}
</style>
