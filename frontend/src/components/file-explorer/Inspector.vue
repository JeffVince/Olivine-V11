<template>
  <v-card class="glass-card">
    <v-tabs
      v-model="tab"
      density="compact"
    >
      <v-tab value="details">
        Details
      </v-tab>
      <v-tab value="canonical">
        Canonical
      </v-tab>
      <v-tab value="references">
        References
      </v-tab>
      <v-tab value="provenance">
        Provenance
      </v-tab>
      <v-tab value="preview">
        Preview
      </v-tab>
    </v-tabs>
    <v-window v-model="tab">
      <v-window-item value="details">
        <v-list density="compact">
          <v-list-item
            :title="fileData?.name"
            subtitle="Name"
          />
          <v-list-item
            :title="fileData?.path"
            subtitle="Path"
          />
          <v-list-item
            :title="String(fileData?.size || '')"
            subtitle="Size"
          />
          <v-list-item
            :title="fileData?.mimeType"
            subtitle="MIME"
          />
          <v-list-item
            :title="fileData?.modified"
            subtitle="Modified"
          />
          <v-list-item
            :title="fileData?.checksum"
            subtitle="Checksum"
          />
        </v-list>
      </v-window-item>
      <v-window-item value="canonical">
        <v-list density="compact">
          <v-list-item>
            <v-list-item-title>Classification</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip
                v-if="fileData?.classificationStatus"
                :color="classificationColor(fileData?.classificationStatus)"
                size="small"
                label
                variant="tonal"
              >
                {{ fileData?.classificationStatus }}
              </v-chip>
              <span
                v-if="fileData?.classificationConfidence"
                class="ml-2 text-medium-emphasis"
              >
                {{ (fileData?.classificationConfidence * 100).toFixed(0) }}%
              </span>
            </v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="fileData?.canonicalSlot">
            <v-list-item-title>Canonical Slot</v-list-item-title>
            <v-list-item-subtitle>{{ fileData?.canonicalSlot }}</v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-window-item>
      <v-window-item value="references">
        <v-card-text>References coming soon</v-card-text>
      </v-window-item>
      <v-window-item value="provenance">
        <v-card-text>Provenance coming soon</v-card-text>
      </v-window-item>
      <v-window-item value="preview">
        <v-card-text>
          <template v-if="file?.metadata?.previewUrl">
            <iframe
              :src="fileData?.metadata?.previewUrl as string"
              style="width:100%;height:300px;"
            />
          </template>
          <template v-else>
            <div
              class="text-wrap"
              style="white-space: pre-wrap; max-height: 300px; overflow:auto;"
            >
              {{ fileData?.metadata?.preview || fileData?.extractedText }}
            </div>
          </template>
        </v-card-text>
      </v-window-item>
    </v-window>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useFile } from '@/composables/useFile'
import type { FileItem } from '@/types/file'

defineOptions({
  name: 'FileInspector'
})

const props = defineProps<{ file: FileItem }>()
const tab = ref('details')

const { data } = useFile(() => props.file.id)
const fileData = computed(() => data.value)

function classificationColor(status?: string) {
  switch ((status || '').toUpperCase()) {
    case 'CLASSIFIED':
      return 'green'
    case 'MANUAL_REVIEW':
      return 'orange'
    case 'FAILED':
      return 'red'
    default:
      return 'grey'
  }
}
</script>
