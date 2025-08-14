<template>
  <div>
    <v-row class="mb-4">
      <v-col
        cols="12"
        md="8"
      >
        <h1 class="text-h4 font-weight-bold">
          Projects
        </h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Manage your production projects and connect storage sources
        </p>
      </v-col>
      <v-col
        cols="12"
        md="4"
        class="text-right"
      >
        <v-btn 
          color="primary" 
          size="large"
          prepend-icon="mdi-plus"
          class="liquid-button"
          @click="showCreateDialog = true"
        >
          New Project
        </v-btn>
      </v-col>
    </v-row>

    <!-- Projects Grid -->
    <v-row v-if="projects.length > 0">
      <v-col 
        v-for="project in projects" 
        :key="project.id"
        cols="12" 
        md="6" 
        lg="4"
      >
        <v-card 
          class="project-card glass-card" 
          hover
          @click="openProject(project.id)"
        >
          <v-card-title class="d-flex align-center">
            <v-icon
              class="mr-2"
              color="primary"
            >
              mdi-folder-multiple
            </v-icon>
            {{ project.name }}
          </v-card-title>
          
          <v-card-text>
            <div class="mb-2">
              <v-chip 
                :color="getStatusColor(project.status)" 
                size="small"
                variant="tonal"
              >
                {{ project.status }}
              </v-chip>
            </div>
            
            <div class="text-caption text-medium-emphasis mb-2">
              Last activity: {{ project.lastActivity ? formatDate(project.lastActivity) : 'N/A' }}
            </div>
            
            <!-- Integration Status -->
            <div class="d-flex flex-wrap gap-1">
              <v-chip 
                v-for="integration in project.integrations" 
                :key="integration.type"
                size="x-small"
                :color="integration.connected ? 'success' : 'warning'"
                variant="outlined"
              >
                <v-icon
                  start
                  size="x-small"
                >
                  {{ getIntegrationIcon(integration.type) }}
                </v-icon>
                {{ integration.type }}
              </v-chip>
            </div>
          </v-card-text>
          
          <v-card-actions>
            <v-btn 
              variant="text" 
              color="primary"
              @click.stop="openProject(project.id)"
            >
              Open Project
            </v-btn>
            <v-spacer />
            <v-menu>
              <template #activator="{ props }">
                <v-btn 
                  icon="mdi-dots-vertical" 
                  variant="text" 
                  size="small"
                  v-bind="props"
                  @click.stop
                />
              </template>
              <v-list>
                <v-list-item @click="editProject(project)">
                  <v-list-item-title>
                    <v-icon start>
                      mdi-pencil
                    </v-icon>
                    Edit
                  </v-list-item-title>
                </v-list-item>
                <v-list-item @click="archiveProject(project)">
                  <v-list-item-title>
                    <v-icon start>
                      mdi-archive
                    </v-icon>
                    Archive
                  </v-list-item-title>
                </v-list-item>
                <v-divider />
                <v-list-item
                  class="text-error"
                  @click="deleteProject(project)"
                >
                  <v-list-item-title>
                    <v-icon start>
                      mdi-delete
                    </v-icon>
                    Delete
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-row v-else>
      <v-col cols="12">
        <v-card
          class="text-center pa-8 glass-card"
        >
          <v-icon
            size="64"
            color="grey-lighten-1"
            class="mb-4"
          >
            mdi-folder-plus
          </v-icon>
          <h3 class="text-h6 mb-2">
            No Projects Yet
          </h3>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Create your first project to get started with Olivine
          </p>
          <v-btn 
            color="primary" 
            size="large"
            prepend-icon="mdi-plus"
            @click="showCreateDialog = true"
          >
            Create Project
          </v-btn>
        </v-card>
      </v-col>
    </v-row>

    <!-- Create Project Dialog -->
    <CreateProjectDialog
      v-model="showCreateDialog"
      :project="newProject"
      @save="createProject"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog
      v-model="showDeleteDialogRef"
      max-width="500px"
    >
      <v-card>
        <v-card-title>
          <span class="text-h5">Confirm Delete</span>
        </v-card-title>
        <v-card-text>
          Are you sure you want to delete this project? This action cannot be undone.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="blue-darken-1"
            variant="text"
            @click="showDeleteDialogRef = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="red-darken-1"
            variant="text"
            @click="confirmDelete"
          >
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useProjectStore } from '@/stores/projectStore'

// Import composables
// Some variables from composables are imported but not used
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {
  projects,
  showCreateDialog,
  showDeleteDialog,
  openProject,
  editProject,
  archiveProject,
  deleteProject,
  confirmDelete,
  newProject,
  createProject,
  getStatusColor,
  formatDate,
  getIntegrationIcon
} from '@/views/Projects/Composables'

// Import components
import CreateProjectDialog from '@/views/Projects/Components/CreateProjectDialog.vue'

const projectStore = useProjectStore()
// const notificationStore = useNotificationStore() // Commented out as it's not currently used

// Load projects on mount
onMounted(() => {
  projectStore.fetchProjects()
})
</script>

<style scoped>
.project-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.project-card:hover {
  transform: translateY(-2px);
}

.liquid-button {
  background: linear-gradient(45deg, #2196F3, #21CBF3);
  border: none;
  color: white;
  padding: 10px 20px;
  text-align: center;
  text-decoration: none;
  display: inline-block;
}
</style>
