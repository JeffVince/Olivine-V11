<template>
  <v-card class="glass-card">
    <v-card-text>
      <div v-if="callSheet">
        <h3>{{ callSheet.title }}</h3>
        <p>Date: {{ callSheet.date }}</p>
        <p>Location: {{ callSheet.location }}</p>
        <p>Cast: {{ callSheet.cast.join(', ') }}</p>
        <p>Crew: {{ callSheet.crew.join(', ') }}</p>
        <p>Scenes: {{ callSheet.scenes.join(', ') }}</p>
        <p>Notes: {{ callSheet.notes }}</p>
      </div>
      <div v-else>
        <p>Preview and actions will be wired to generation API.</p>
      </div>
    </v-card-text>
    <v-card-actions>
      <v-btn
        color="primary"
        :loading="loading"
        :disabled="!callSheet"
        @click="onSaveDraft"
      >
        Save Draft PDF
      </v-btn>
      <v-btn
        color="success"
        :loading="loading"
        :disabled="!callSheet"
        @click="onPublish"
      >
        Publish Final
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { CallSheet } from '../Composables/useCallSheetManagement'

defineProps<{
  callSheet: CallSheet | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'save-draft'): void
  (e: 'publish'): void
}>()

function onSaveDraft() {
  emit('save-draft')
}

function onPublish() {
  emit('publish')
}
</script>
