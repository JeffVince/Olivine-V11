<template>
  <div>
    <v-row class="mb-4">
      <v-col cols="12" md="8">
        <h1 class="text-h4 font-weight-bold">Projects</h1>
        <p class="text-subtitle-1 text-medium-emphasis">
          Manage your production projects and connect storage sources
        </p>
      </v-col>
      <v-col cols="12" md="4" class="text-right">
        <v-btn 
          color="primary" 
          size="large"
          prepend-icon="mdi-plus"
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
          class="project-card" 
          hover
          @click="openProject(project.id)"
        >
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-folder-multiple</v-icon>
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
              Last activity: {{ formatDate(project.lastActivity) }}
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
                <v-icon start size="x-small">{{ getIntegrationIcon(integration.type) }}</v-icon>
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
              <template v-slot:activator="{ props }">
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
                    <v-icon start>mdi-pencil</v-icon>
                    Edit
                  </v-list-item-title>
                </v-list-item>
                <v-list-item @click="archiveProject(project)">
                  <v-list-item-title>
                    <v-icon start>mdi-archive</v-icon>
                    Archive
                  </v-list-item-title>
                </v-list-item>
                <v-divider />
                <v-list-item @click="deleteProject(project)" class="text-error">
                  <v-list-item-title>
                    <v-icon start>mdi-delete</v-icon>
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
    <v-card v-else class="text-center pa-8">
      <v-icon size="64" color="grey-lighten-1" class="mb-4">mdi-folder-plus</v-icon>
      <h3 class="text-h6 mb-2">No Projects Yet</h3>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Create your first project to get started with Olivine
      </p>
      <v-btn 
        color="primary" 
        size="large"
        prepend-icon="mdi-plus"
        @click="showCreateDialog = true"
      >
        Create Your First Project
      </v-btn>
    </v-card>

    <!-- Create Project Dialog -->
    <v-dialog v-model="showCreateDialog" max-width="600">
      <v-card>
        <v-card-title>
          <span class="text-h5">Create New Project</span>
        </v-card-title>
        
        <v-card-text>
          <v-form ref="createForm" v-model="formValid">
            <v-text-field
              v-model="newProject.name"
              label="Project Name"
              :rules="nameRules"
              required
              prepend-icon="mdi-folder"
            />
            
            <v-text-field
              v-model="newProject.company"
              label="Company (Optional)"
              prepend-icon="mdi-domain"
            />
            
            <v-select
              v-model="newProject.timezone"
              :items="timezones"
              label="Timezone"
              prepend-icon="mdi-clock"
              required
            />
            
            <v-divider class="my-4" />
            
            <h4 class="text-subtitle-1 mb-3">Connect Storage Source</h4>
            
            <v-radio-group v-model="newProject.storageType">
              <v-radio
                label="Google Drive"
                value="googledrive"
              >
                <template v-slot:label>
                  <div class="d-flex align-center">
                    <v-icon class="mr-2">mdi-google-drive</v-icon>
                    Google Drive
                  </div>
                </template>
              </v-radio>
              <v-radio
                label="Dropbox"
                value="dropbox"
              >
                <template v-slot:label>
                  <div class="d-flex align-center">
                    <v-icon class="mr-2">mdi-dropbox</v-icon>
                    Dropbox
                  </div>
                </template>
              </v-radio>
            </v-radio-group>
            
            <v-select
              v-if="newProject.referenceProjectId"
              v-model="newProject.referenceProjectId"
              :items="projects"
              item-title="name"
              item-value="id"
              label="Reference Project (Optional)"
              hint="Import naming conventions and templates from an existing project"
              persistent-hint
              prepend-icon="mdi-content-copy"
            />
          </v-form>
        </v-card-text>
        
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showCreateDialog = false">
            Cancel
          </v-btn>
          <v-btn 
            color="primary" 
            :disabled="!formValid"
            :loading="creating"
            @click="createProject"
          >
            Create Project
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="showDeleteDialog" max-width="400">
      <v-card>
        <v-card-title class="text-h6">
          Delete Project
        </v-card-title>
        <v-card-text>
          <p>Are you sure you want to delete <strong>{{ projectToDelete?.name }}</strong>?</p>
          <p class="text-error">This action cannot be undone.</p>
          
          <v-text-field
            v-model="deleteConfirmation"
            :label="`Type '${projectToDelete?.name}' to confirm`"
            variant="outlined"
            class="mt-4"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showDeleteDialog = false">
            Cancel
          </v-btn>
          <v-btn 
            color="error" 
            :disabled="deleteConfirmation !== projectToDelete?.name"
            :loading="deleting"
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useNotificationStore } from '@/stores/notificationStore'

interface Project {
  id: string
  name: string
  company?: string
  status: 'active' | 'syncing' | 'error' | 'archived'
  lastActivity: string
  integrations: Array<{
    type: 'dropbox' | 'googledrive' | 'frameio'
    connected: boolean
  }>
}

interface NewProject {
  name: string
  company: string
  timezone: string
  storageType: 'dropbox' | 'googledrive'
  referenceProjectId?: string
}

const router = useRouter()
const projectStore = useProjectStore()
const notificationStore = useNotificationStore()

// State
const projects = computed(() => projectStore.projects)
const showCreateDialog = ref(false)
const showDeleteDialog = ref(false)
const formValid = ref(false)
const creating = ref(false)
const deleting = ref(false)
const projectToDelete = ref<Project | null>(null)
const deleteConfirmation = ref('')

// Form data
const newProject = ref<NewProject>({
  name: '',
  company: '',
  timezone: 'America/Los_Angeles',
  storageType: 'dropbox'
})

// Validation rules
const nameRules = [
  (v: string) => !!v || 'Project name is required',
  (v: string) => v.length >= 3 || 'Project name must be at least 3 characters'
]

const timezones = [
  'America/Los_Angeles',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo'
]

// Methods
function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'active': return 'success'
    case 'syncing': return 'warning'
    case 'error': return 'error'
    case 'archived': return 'grey'
    default: return 'primary'
  }
}

function getIntegrationIcon(type: string) {
  switch (type) {
    case 'dropbox': return 'mdi-dropbox'
    case 'googledrive': return 'mdi-google-drive'
    case 'frameio': return 'mdi-play-box'
    default: return 'mdi-link'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString()
}

function openProject(id: string) {
  projectStore.setProject(id)
  router.push({ name: 'ProjectHome', params: { id } })
}

async function editProject(project: Project) {
  const newName = prompt('Enter new project name', project.name)
  if (!newName || newName === project.name) return
  try {
    await projectStore.editProject(project.id, newName)
    notificationStore.add('success', `${project.name} renamed to ${newName}`)
  } catch {
    notificationStore.add('error', 'Failed to update project')
  }
}

async function archiveProject(project: Project) {
  try {
    await projectStore.archiveProject(project.id)
    notificationStore.add('success', `${project.name} archived successfully`)
  } catch {
    notificationStore.add('error', 'Failed to archive project')
  }
}

function deleteProject(project: Project) {
  projectToDelete.value = project
  deleteConfirmation.value = ''
  showDeleteDialog.value = true
}

async function confirmDelete() {
  if (!projectToDelete.value) return

  deleting.value = true
  try {
    await projectStore.deleteProject(projectToDelete.value.id)
    notificationStore.add('success', `${projectToDelete.value.name} deleted successfully`)
    showDeleteDialog.value = false
  } catch {
    notificationStore.add('error', 'Failed to delete project')
  } finally {
    deleting.value = false
  }
}

async function createProject() {
  creating.value = true
  try {
    const project = await projectStore.createProject({
      name: newProject.value.name,
      description: newProject.value.company,
      settings: {
        timezone: newProject.value.timezone,
        storageType: newProject.value.storageType,
        referenceProjectId: newProject.value.referenceProjectId || undefined
      }
    })
    showCreateDialog.value = false
    notificationStore.add('success', `Project ${project.name} created successfully`)
    openProject(project.id)
  } catch {
    notificationStore.add('error', 'Failed to create project')
  } finally {
    creating.value = false
  }
}

// Load projects on mount
onMounted(() => {
  projectStore.fetchProjects()
})
</script>

<style scoped>
.project-card {
  cursor: pointer;
  transition: transform 0.2s ease-in-out;
}

.project-card:hover {
  transform: translateY(-2px);
}

.gap-1 {
  gap: 4px;
}
</style>


