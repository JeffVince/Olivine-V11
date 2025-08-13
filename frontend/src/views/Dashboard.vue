<template>
  <div>
    <v-row>
      <v-col cols="12">
        <v-card class="glass-card">
          <v-card-title>
            <v-icon left>
              mdi-view-dashboard
            </v-icon>
            Dashboard
          </v-card-title>
          <v-card-text>
            <p>Welcome to Olivine! Your creative production knowledge layer is ready.</p>
            
            <v-row class="mt-4">
              <v-col
                cols="12"
                md="6"
              >
                <v-card variant="outlined" class="glass-card">
                  <v-card-title>Quick Actions</v-card-title>
                  <v-card-text>
                    <v-btn 
                      color="primary" 
                      class="mr-2 mb-2"
                      @click="navigateToFileExplorer"
                    >
                      <v-icon left>
                        mdi-folder
                      </v-icon>
                      File Explorer
                    </v-btn>
                    <v-btn 
                      color="secondary" 
                      class="mr-2 mb-2"
                      @click="navigateToIntegrations"
                    >
                      <v-icon left>
                        mdi-puzzle
                      </v-icon>
                      Integrations
                    </v-btn>
                  </v-card-text>
                </v-card>
              </v-col>
              
              <v-col
                cols="12"
                md="6"
              >
                <v-card variant="outlined" class="glass-card">
                  <v-card-title>System Status</v-card-title>
                  <v-card-text>
                    <v-chip
                      color="success"
                      class="mr-2"
                    >
                      <v-icon left>
                        mdi-check
                      </v-icon>
                      Frontend Connected
                    </v-chip>
                    <v-chip color="success">
                      <v-icon left>
                        mdi-check
                      </v-icon>
                      Backend Online
                    </v-chip>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'

const router = useRouter()
const projectStore = useProjectStore()

const navigateToFileExplorer = () => {
  console.log('Navigating to File Explorer')
  if (projectStore.currentProjectId) {
    router.push(`/projects/${projectStore.currentProjectId}/files`)
  } else {
    router.push('/projects')
  }
}

const navigateToIntegrations = () => {
  console.log('Navigating to Integrations')
  if (projectStore.currentProjectId) {
    router.push(`/projects/${projectStore.currentProjectId}/integrations`)
  } else {
    router.push('/projects')
  }
}
</script>
