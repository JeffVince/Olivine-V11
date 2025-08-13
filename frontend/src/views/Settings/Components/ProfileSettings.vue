<template>
  <v-form
    ref="profileForm"
    @submit.prevent="saveProfile"
  >
    <v-card class="glass-card pa-4 mb-4">
      <v-text-field
        v-model="profile.name"
        label="Name"
        :rules="nameRules"
        required
      />
      <v-text-field
        v-model="profile.avatar"
        label="Avatar URL"
        :rules="urlRules"
      />
      <v-btn
        type="submit"
        color="primary"
      >
        Save
      </v-btn>
    </v-card>
  </v-form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { Profile } from '../Composables/Interface'

// Props
const props = defineProps<{
  profile: Profile
  nameRules: Array<(v: string) => boolean | string>
  urlRules: Array<(v: string) => boolean | string>
}>()

// Emits
const emit = defineEmits(['save'])

// Form reference
const profileForm = ref()

// Methods
async function saveProfile() {
  const { valid } = await profileForm.value.validate()
  if (!valid) return
  emit('save', props.profile)
}
</script>

<style scoped>
/* Scoped styles for this component */
</style>
