<template>
  <v-dialog v-model="model" max-width="600" persistent>
    <v-card>
      <v-card-title>
        {{ isEditing ? 'Edit Agent' : 'Create New Agent' }}
      </v-card-title>
      <v-card-text>
        <v-form ref="form" v-model="valid">
          <v-text-field
            v-model="localAgent.name"
            label="Agent Name"
            :rules="[requiredRule]"
            required
          />
          <v-textarea
            v-model="localAgent.description"
            label="Description"
            rows="3"
          />
          <v-select
            v-model="localAgent.type"
            :items="agentTypes"
            label="Agent Type"
            :rules="[requiredRule]"
            required
          />
          <v-switch
            v-model="localAgent.status"
            :label="`Status: ${localAgent.status === 'active' ? 'Active' : 'Inactive'}`"
            true-value="active"
            false-value="inactive"
          />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-btn @click="closeDialog">Cancel</v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!valid"
          @click="saveAgent"
        >
          {{ isEditing ? 'Update' : 'Create' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Agent } from '../Composables/Interface'

interface Props {
  modelValue: boolean
  agent: Agent | null
  saving: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'save', agent: Agent): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const form = ref()
const valid = ref(false)

const localAgent = ref<Agent>({
  id: '',
  name: '',
  description: '',
  type: 'file-processor',
  status: 'inactive',
  tasksCompleted: 0,
  tasksRunning: 0,
  uptime: '0h 0m',
  created: new Date().toISOString(),
})

const isEditing = computed(() => !!props.agent?.id)

const agentTypes = [
  { title: 'File Processor', value: 'file-processor' },
  { title: 'Data Sync', value: 'data-sync' },
  { title: 'Notification', value: 'notification' },
  { title: 'Backup', value: 'backup' },
  { title: 'Analytics', value: 'analytics' },
]

const requiredRule = (v: string) => !!v || 'This field is required'

watch(() => props.agent, (newAgent) => {
  if (newAgent) {
    localAgent.value = { ...newAgent }
  } else {
    localAgent.value = {
      id: '',
      name: '',
      description: '',
      type: 'file-processor',
      status: 'inactive',
      tasksCompleted: 0,
      tasksRunning: 0,
      uptime: '0h 0m',
      created: new Date().toISOString(),
    }
  }
}, { immediate: true })

const model = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

function closeDialog() {
  emit('update:modelValue', false)
}

function saveAgent() {
  if (form.value.validate()) {
    emit('save', localAgent.value)
  }
}
</script>
