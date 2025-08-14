<template>
  <v-form
    ref="profileForm"
    @submit.prevent="saveProfile"
  >
    <v-card class="glass-card pa-4 mb-4">
      <v-text-field
        v-model="localProfile.name"
        label="Name"
        :rules="nameRules"
        required
      />
      <v-text-field
        v-model="localProfile.avatar"
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
import { ref, watch } from 'vue'
import type { Profile } from '../Composables/Interface'

// Props
const props = defineProps<{
  profile: Profile
  nameRules: Array<(v: string) => boolean | string>
  urlRules: Array<(v: string) => boolean | string>
}>()

// Emits
const emit = defineEmits(['update:profile', 'save'])

// Create a local copy of the prop
const localProfile = ref<Profile>({ ...props.profile })

// Form reference
const profileForm = ref()

// Methods
async function saveProfile() {
  const { valid } = await profileForm.value.validate()
  if (!valid) return
  emit('save', localProfile.value)
  emit('update:profile', localProfile.value)
}

// Watch for prop changes and update local copy
watch(() => props.profile, () => {
  localProfile.value = { ...props.profile }
})
</script>

<style scoped>
/* Scoped styles for this component */
</style>
