<template>
  <v-list density="compact">
    <v-list-item
      v-for="file in filteredFiles"
      :key="file.id"
      :class="{ 'v-list-item--active': selectedFile?.id === file.id }"
      @click="$emit('fileSelect', file)"
    >
      <template #prepend>
        <v-icon size="small">
          {{ mimeIcon(file.mimeType) }}
        </v-icon>
      </template>
      
      <v-list-item-title>{{ file.name }}</v-list-item-title>
      <v-list-item-subtitle>
        {{ formatFileSize(file.size || 0) }} • {{ formatDate(file.updatedAt || '') }}
      </v-list-item-subtitle>
      
      <template #append>
        <v-chip
          v-if="file.classificationStatus"
          :color="classificationColor(file.classificationStatus)"
          size="x-small"
          label
          variant="tonal"
        >
          {{ file.classificationStatus }}
        </v-chip>
        <v-menu>
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              size="small"
              v-bind="props"
              @click.stop
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
      </template>
    </v-list-item>
  </v-list>
</template>

<script setup lang="ts">
import { FileItem } from '../Composables/Interface'
import { useFileExplorerUtils } from '../Composables/utils'

interface Props {
  filteredFiles: FileItem[]
  selectedFile: FileItem | null
  renameFile: any
  moveFile: any
}

interface Emits {
  (e: 'fileSelect', file: FileItem): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { formatFileSize, formatDate, classificationColor, mimeIcon } = useFileExplorerUtils()

function promptRename(file: FileItem, renameFile: any) {
  const name = window.prompt('Rename file', file.name)
  if (name && name !== file.name) {
    renameFile(file.id, name)
  }
}

function promptMove(file: FileItem, moveFile: any) {
  const path = window.prompt('Move file to path', file.path)
  if (path && path !== file.path) {
    moveFile(file.id, path)
  }
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
