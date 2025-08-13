<template>
  <v-dialog v-model="model" max-width="600">
    <v-card>
      <v-card-title>Manage Team</v-card-title>
      <v-card-text>
        <v-list v-if="members.length">
          <v-list-item v-for="member in members" :key="member.id">
            <v-list-item-title>{{ member.email }}</v-list-item-title>
            <v-list-item-subtitle>
              <v-select
                :items="roles"
                v-model="member.role"
                density="compact"
                hide-details
                @update:modelValue="r => updateRole(member, r)"
              />
            </v-list-item-subtitle>
            <template #append>
              <v-btn icon="mdi-delete" variant="text" @click="remove(member)" />
            </template>
          </v-list-item>
        </v-list>
        <v-divider class="my-4" />
        <v-text-field
          v-model="inviteEmail"
          label="Invite by Email"
          prepend-icon="mdi-email"
          type="email"
        />
        <v-select
          v-model="inviteRole"
          :items="roles"
          label="Role"
          prepend-icon="mdi-account"
        />
        <v-btn class="mt-2" color="primary" @click="invite">Invite</v-btn>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text @click="close">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import type { Project } from '@/stores/projectStore'

const props = defineProps<{ modelValue: boolean; project: Project | null }>()
const emit = defineEmits(['update:modelValue'])

const model = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

const projectStore = useProjectStore()
const members = computed(() => projectStore.members)
const roles = ['ADMIN', 'EDITOR', 'VIEWER']

watch(
  () => model.value,
  async val => {
    if (val && props.project?.id) {
      await projectStore.fetchMembers(props.project.id)
    }
  }
)

function close() {
  model.value = false
}

const inviteEmail = ref('')
const inviteRole = ref('VIEWER')

async function invite() {
  if (!props.project) return
  await projectStore.inviteMember(props.project.id, inviteEmail.value, inviteRole.value)
  inviteEmail.value = ''
  inviteRole.value = 'VIEWER'
}

async function updateRole(member: any, role: string) {
  if (!props.project) return
  await projectStore.updateMemberRole(props.project.id, member.id, role)
}

async function remove(member: any) {
  if (!props.project) return
  await projectStore.removeMember(props.project.id, member.id)
}
</script>
