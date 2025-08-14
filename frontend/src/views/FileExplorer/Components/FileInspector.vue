<template>
  <v-card
    v-if="selectedFile"
    class="glass-card"
  >
    <v-card-title>
      <v-icon class="mr-2">
        mdi-information
      </v-icon>
      Inspector
    </v-card-title>
    
    <v-card-text>
      <h4 class="text-subtitle-2 mb-2">
        {{ selectedFile.name }}
      </h4>
      <v-list density="compact">
        <v-list-item>
          <v-list-item-title>Size</v-list-item-title>
          <v-list-item-subtitle>{{ formatFileSize(selectedFile.size || 0) }}</v-list-item-subtitle>
        </v-list-item>
        <v-list-item>
          <v-list-item-title>Updated</v-list-item-title>
          <v-list-item-subtitle>{{ formatDate((selectedFile as any).updatedAt || '') }}</v-list-item-subtitle>
        </v-list-item>
        <v-list-item>
          <v-list-item-title>Path</v-list-item-title>
          <v-list-item-subtitle class="text-wrap">
            {{ selectedFile.path }}
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item>
          <v-list-item-title>MIME</v-list-item-title>
          <v-list-item-subtitle class="text-wrap">
            {{ selectedFile.mimeType }}
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item v-if="selectedFile.metadata?.preview || selectedFile.extractedText">
          <v-list-item-title>Preview</v-list-item-title>
          <v-list-item-subtitle
            class="text-wrap"
            style="white-space: pre-wrap; max-height: 240px; overflow: auto;"
          >
            {{ selectedFile.metadata?.preview || selectedFile.extractedText }}
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item>
          <v-list-item-title>Classification</v-list-item-title>
          <v-list-item-subtitle>
            <v-chip
              :color="classificationColor(selectedFile.classificationStatus)"
              size="small"
              label
              variant="tonal"
            >
              {{ selectedFile.classificationStatus }}
            </v-chip>
            <span
              v-if="selectedFile.classificationConfidence"
              class="ml-2 text-medium-emphasis"
            >
              {{ (selectedFile.classificationConfidence * 100).toFixed(0) }}%
            </span>
          </v-list-item-subtitle>
        </v-list-item>
        <v-list-item v-if="selectedFile.canonicalSlot">
          <v-list-item-title>Canonical Slot</v-list-item-title>
          <v-list-item-subtitle>{{ selectedFile.canonicalSlot }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
      <div class="mt-4 d-flex gap-2">
        <v-btn
          color="primary"
          prepend-icon="mdi-refresh"
          :loading="actionLoading"
          @click="triggerReprocess"
        >
          Reprocess
        </v-btn>
        <v-btn
          color="secondary"
          prepend-icon="mdi-tag"
          @click="setShowClassify(true)"
        >
          Classify
        </v-btn>
        <v-btn
          v-if="selectedFile.metadata?.downloadUrl"
          :href="selectedFile.metadata.downloadUrl"
          target="_blank"
          prepend-icon="mdi-download"
        >
          Download
        </v-btn>
        <v-btn
          v-if="selectedFile.metadata?.previewUrl"
          :href="selectedFile.metadata.previewUrl"
          target="_blank"
          prepend-icon="mdi-open-in-new"
        >
          Open Preview
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
  
  <!-- Empty Inspector State -->
  <v-card
    v-else
    class="text-center pa-8 glass-card"
  >
    <v-icon
      size="48"
      color="grey-lighten-1"
    >
      mdi-cursor-default-click
    </v-icon>
    <p class="text-medium-emphasis mt-2">
      Select a file to view details
    </p>
    <v-divider class="my-4" />
    <div class="text-left">
      <div class="text-subtitle-2 mb-2">
        Facets
      </div>
      <v-list density="compact">
        <v-list-subheader>Classification</v-list-subheader>
        <v-list-item
          v-for="s in classificationOptions"
          :key="s.value"
          @click="applyClassificationFilter(s.value)"
        >
          <template #prepend>
            <v-icon size="x-small">
              mdi-tag
            </v-icon>
          </template>
          <v-list-item-title>{{ s.label }}</v-list-item-title>
        </v-list-item>
        <v-divider class="my-2" />
        <v-list-subheader>MIME Type</v-list-subheader>
        <v-list-item
          v-for="m in mimeOptions"
          :key="m.value"
          @click="applyMimeFilter(m.value)"
        >
          <template #prepend>
            <v-icon size="x-small">
              {{ mimeIcon(m.value) }}
            </v-icon>
          </template>
          <v-list-item-title>{{ m.label }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { FileItem, ClassificationOption, MimeOption } from '../Composables/Interface'
import { useFileExplorerUtils } from '../Composables/utils'

interface Props {
  selectedFile: FileItem | null
  actionLoading: boolean
  showClassify: boolean
  classificationOptions: ClassificationOption[]
  mimeOptions: MimeOption[]
}

interface Emits {
  (e: 'triggerReprocess'): void
  (e: 'showClassify', value: boolean): void
  (e: 'applyClassificationFilter', status: string): void
  (e: 'applyMimeFilter', mime: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { formatFileSize, formatDate, classificationColor, mimeIcon } = useFileExplorerUtils()

function triggerReprocess() {
  emit('triggerReprocess')
}

function setShowClassify(value: boolean) {
  emit('showClassify', value)
}

function applyClassificationFilter(status: string) {
  emit('applyClassificationFilter', status)
}

function applyMimeFilter(mime: string) {
  emit('applyMimeFilter', mime)
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
