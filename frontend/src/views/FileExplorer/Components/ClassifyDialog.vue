<template>
  <v-dialog
    v-model="showDialog"
    max-width="500"
  >
    <v-card class="glass-card">
      <v-card-title>
        <v-icon class="mr-2">
          mdi-tag
        </v-icon>
        Classify File
      </v-card-title>
      <v-card-text>
        <v-select
          v-model="localForm.canonicalSlot"
          :items="canonicalSlots"
          item-title="key"
          item-value="key"
          label="Canonical Slot"
        />
        <v-slider
          v-model="localForm.confidence"
          min="0"
          max="1"
          step="0.01"
          label="Confidence"
          class="mt-4"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="closeDialog"
        >
          Cancel
        </v-btn>
        <v-btn
          color="primary"
          :loading="actionLoading"
          @click="submitClassification"
        >
          Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  modelValue: boolean
  actionLoading: boolean
  canonicalSlots: Array<{ key: string }>
  form: {
    canonicalSlot: string
    confidence: number
  }
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'submitClassification'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showDialog = ref(props.modelValue)
const localForm = ref({ ...props.form })

watch(() => props.modelValue, (value) => {
  showDialog.value = value
})

watch(showDialog, (value) => {
  emit('update:modelValue', value)
})

watch(() => props.form, (newForm) => {
  localForm.value = { ...newForm }
}, { deep: true })

function closeDialog() {
  showDialog.value = false
}

function submitClassification() {
  emit('submitClassification')
}
</script>

<style scoped>
/* Add scoped styles here if needed */
</style>
