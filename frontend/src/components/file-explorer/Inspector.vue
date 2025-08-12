<template>
  <v-card>
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
        <v-card-text>Canonical mapping coming soon</v-card-text>
      </v-window-item>
      <v-window-item value="references">
        <v-card-text>References coming soon</v-card-text>
      </v-window-item>
      <v-window-item value="provenance">
        <v-card-text>Provenance coming soon</v-card-text>
      </v-window-item>
      <v-window-item value="preview">
        <v-card-text>Preview coming soon</v-card-text>
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
</script>


