<template>
  <v-card class="glass-card">
    <v-tabs v-model="tab" density="compact">
      <v-tab value="details">Details</v-tab>
      <v-tab value="canonical">Canonical</v-tab>
      <v-tab value="references">References</v-tab>
      <v-tab value="provenance">Provenance</v-tab>
      <v-tab value="preview">Preview</v-tab>
    </v-tabs>
    <v-window v-model="tab">
      <v-window-item value="details">
        <v-list density="compact">
          <v-list-item :title="file?.name" subtitle="Name" />
          <v-list-item :title="file?.path" subtitle="Path" />
          <v-list-item :title="String(file?.size || '')" subtitle="Size" />
          <v-list-item :title="file?.mimeType" subtitle="MIME" />
          <v-list-item :title="file?.modified" subtitle="Modified" />
          <v-list-item :title="file?.checksum" subtitle="Checksum" />
        </v-list>
      </v-window-item>
      <v-window-item value="canonical">
        <v-list density="compact">
          <v-list-item>
            <v-list-item-title>Classification</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip
                v-if="file?.classificationStatus"
                :color="classificationColor(file?.classificationStatus)"
                size="small"
                label
                variant="tonal"
              >
                {{ file?.classificationStatus }}
              </v-chip>
              <span v-if="file?.classificationConfidence" class="ml-2 text-medium-emphasis">
                {{ (file?.classificationConfidence * 100).toFixed(0) }}%
              </span>
            </v-list-item-subtitle>
          </v-list-item>
          <v-list-item v-if="file?.canonicalSlot">
            <v-list-item-title>Canonical Slot</v-list-item-title>
            <v-list-item-subtitle>{{ file?.canonicalSlot }}</v-list-item-subtitle>
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
            <iframe :src="file.metadata.previewUrl as string" style="width:100%;height:300px;" />
          </template>
          <template v-else>
            <div
              class="text-wrap"
              style="white-space: pre-wrap; max-height: 300px; overflow:auto;"
            >
              {{ file?.metadata?.preview || file?.extractedText }}
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

const props = defineProps<{ fileId: string | null }>()
const tab = ref('details')

const { data } = useFile(() => props.fileId)
const file = computed(() => data.value)

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


