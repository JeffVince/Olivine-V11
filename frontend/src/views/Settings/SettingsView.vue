<template>
  <div>
    <!-- Header -->
    <SettingsHeader />
    
    <!-- Tab Navigation -->
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
    
    <!-- Tab Content -->
    <v-window v-model="tab">
      <v-window-item value="profile">
        <ProfileSettings 
          :profile="profile" 
          :name-rules="nameRules" 
          :url-rules="urlRules" 
          @save="handleSaveProfile" 
        />
      </v-window-item>
      
      <v-window-item value="notifications">
        <NotificationSettings 
          :notif="notif" 
          @save="handleSaveNotifications" 
        />
      </v-window-item>
      
      <v-window-item value="project">
        <ProjectSettings 
          :project-options="projectOptions" 
          :name-rules="nameRules" 
          @save="handleSaveProject" 
        />
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { useSettingsLifecycle, tab, profile, notif, projectOptions, nameRules, urlRules } from '@/views/Settings/Composables'
import { saveProfile, saveNotifications, saveProject } from '@/views/Settings/Composables/api'
import { useRoute } from 'vue-router'

// Import components
import SettingsHeader from '@/views/Settings/Components/SettingsHeader.vue'
import ProfileSettings from '@/views/Settings/Components/ProfileSettings.vue'
import NotificationSettings from '@/views/Settings/Components/NotificationSettings.vue'
import ProjectSettings from '@/views/Settings/Components/ProjectSettings.vue'

// Initialize settings lifecycle
useSettingsLifecycle()

const route = useRoute()

// Event handlers
async function handleSaveProfile(profileData: any) {
  await saveProfile(profileData)
}

async function handleSaveNotifications(notifData: any) {
  await saveNotifications(notifData)
}

async function handleSaveProject(projectData: any) {
  await saveProject(route.params.id as string, projectData)
}
</script>

<style scoped>
/* Scoped styles for this component */
</style>