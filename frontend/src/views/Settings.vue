<template>
  <div>
    <h2>Settings</h2>
    <v-tabs
      v-model="tab"
      density="compact"
      class="mb-4"
    >
      <v-tab value="profile">
        Profile
      </v-tab>
      <v-tab value="notifications">
        Notifications
      </v-tab>
      <v-tab value="project">
        Project
      </v-tab>
    </v-tabs>
    <v-window v-model="tab">
      <v-window-item value="profile">
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
      </v-window-item>
      <v-window-item value="notifications">
        <v-form
          ref="notifForm"
          @submit.prevent="saveNotifications"
        >
          <v-card class="glass-card pa-4 mb-4">
          <v-switch
            v-model="notif.email"
            label="Email"
          />
          <v-switch
            v-model="notif.sms"
            label="SMS"
          />
          <v-switch
            v-model="notif.inApp"
            label="In-App"
          />
          <v-btn
            type="submit"
            color="primary"
          >
            Save
          </v-btn>
          </v-card>
        </v-form>
      </v-window-item>
      <v-window-item value="project">
        <v-form
          ref="projectForm"
          @submit.prevent="saveProject"
        >
          <v-card class="glass-card pa-4 mb-4">
          <v-text-field
            v-model="projectOptions.name"
            label="Project Name"
            :rules="nameRules"
            required
          />
          <v-combobox
            v-model="projectOptions.templates"
            label="Templates"
            multiple
            chips
            hide-selected
          />
          <v-switch
            v-model="projectOptions.autoApprove"
            label="Auto-approve tasks"
          />
          <v-btn
            type="submit"
            color="primary"
          >
            Save
          </v-btn>
          </v-card>
        </v-form>
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useProjectStore } from '@/stores/projectStore'

const tab = ref('profile')

const auth = useAuthStore()
const notifications = useNotificationStore()
const projectStore = useProjectStore()
const route = useRoute()

const profileForm = ref()
const profile = ref({
  name: auth.user?.name || '',
  avatar: auth.user?.avatar || '',
})

const notifForm = ref()
const notif = ref({ ...auth.notificationPrefs })

const projectForm = ref()
const projectOptions = ref({
  name: '',
  templates: [] as string[],
  autoApprove: false,
})

const nameRules = [(v: string) => !!v || 'Name is required']
const urlRules = [
  (v: string) => !v || /^https?:\/\//.test(v) || 'Must be a valid URL',
]

onMounted(async () => {
  if (!projectStore.projects.length) await projectStore.fetchProjects()
  const project = projectStore.projects.find(p => p.id === (route.params.id as string))
  if (project) {
    projectOptions.value.name = project.name
    projectOptions.value.templates = project.settings?.templates || []
    projectOptions.value.autoApprove = project.settings?.autoApprove || false
  }
})

async function saveProfile() {
  const { valid } = await profileForm.value.validate()
  if (!valid) return
  try {
    await auth.updateProfile(profile.value)
    notifications.add('success', 'Profile updated')
  } catch (e) {
    notifications.add('error', 'Failed to update profile')
  }
}

async function saveNotifications() {
  try {
    await auth.updateNotificationPrefs(notif.value)
    notifications.add('success', 'Notification preferences saved')
  } catch (e) {
    notifications.add('error', 'Failed to save notifications')
  }
}

async function saveProject() {
  const { valid } = await projectForm.value.validate()
  if (!valid) return
  try {
    await projectStore.updateProjectOptions(route.params.id as string, {
      name: projectOptions.value.name,
      templates: projectOptions.value.templates,
      autoApprove: projectOptions.value.autoApprove,
    })
    notifications.add('success', 'Project settings saved')
  } catch (e) {
    notifications.add('error', 'Failed to save project settings')
  }
}
</script>

