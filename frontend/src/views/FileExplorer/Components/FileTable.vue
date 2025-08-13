<template>
  <v-data-table
    :headers="fileHeaders"
    :items="filteredFiles"
    :loading="loading"
    density="compact"
    class="elevation-1"
    @click:row="onFileSelect"
  >
    <template #item.name="{ item }">
      <div class="d-flex align-center">
        <v-icon size="small" class="mr-2">
          {{ mimeIcon(item.mimeType) }}
        </v-icon>
        <span>{{ item.name }}</span>
      </div>
    </template>
    
    <template #item.mimeType="{ item }">
      <v-chip
        v-if="item.mimeType"
        size="x-small"
        variant="tonal"
      >
        {{ item.mimeType }}
      </v-chip>
    </template>
    
    <template #item.size="{ item }">
      {{ formatFileSize(item.size || 0) }}
    </template>
    
    <template #item.updatedAt="{ item }">
      {{ formatDate(item.updatedAt || '') }}
    </template>
    
    <template #item.actions="{ item }">
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            icon
            variant="text"
            size="small"
            v-bind="props"
          >
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>
        <v-list density="compact">
          <v-list-item @click="promptRename(item, renameFile)">
            <template #prepend>
              <v-icon>mdi-pencil</v-icon>
            </template>
            <v-list-item-title>Rename</v-list-item-title>
          </v-list-item>
          <v-list-item @click="promptMove(item, moveFile)">
            <template #prepend>
              <v-icon>mdi-folder-move</v-icon>
            </template>
            <v-list-item-title>Move</v-list-item-title>
          </v-list-item>
          <v-list-item @click="downloadFile(item.id)">
            <template #prepend>
              <v-icon>mdi-download</v-icon>
            </template>
            <v-list-item-title>Download</v-list-item-title>
          </v-list-item>
          <v-list-item @click="openInProvider(item.id)">
            <template #prepend>
              <v-icon>mdi-open-in-new</v-icon>
            </template>
            <v-list-item-title>Open in Provider</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </template>
  </v-data-table>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { FileItem } from '../Composables/Interface'
import { useFileExplorerUtils } from '../Composables/utils'
import { useFileExplorerData } from '../Composables/data'

interface Props {
  filteredFiles: FileItem[]
  loading: boolean
  renameFile: any
  moveFile: any
  downloadFile: any
  openInProvider: any
}

interface Emits {
  (e: 'fileSelect', file: FileItem): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { fileHeaders, formatFileSize, formatDate, mimeIcon } = useFileExplorerUtils()

function onFileSelect(event: Event, { item }: { item: FileItem }) {
  emit('fileSelect', item)
}

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
