import { ref, Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notificationStore'
import { FileItem } from './Interface'

export function useFileExplorerActions(
  selectedFile: Ref<FileItem | null>,
  items: Ref<FileItem[]>,
  variables: Ref<any>,
  refetch: () => void,
  triggerReprocessMutate: any,
  classifyMutate: any,
  triggerFullSync: any
) {
  const route = useRoute()
  const router = useRouter()
  const notificationStore = useNotificationStore()
  
  const actionLoading = ref(false)
  const showClassify = ref(false)
  const canonicalSlots = ref<Array<{ key: string }>>([])
  
  async function triggerReprocess() {
    if (!selectedFile.value) return
    actionLoading.value = true
    try {
      await triggerReprocessMutate({ fileId: selectedFile.value.id, orgId: (items.value[0] && items.value[0].orgId) || '' })
      notificationStore.add('success', 'Reprocessing triggered')
    } catch (e: any) {
      notificationStore.add('error', e.message || 'Failed to trigger reprocessing')
    } finally {
      actionLoading.value = false
    }
  }
  
  async function submitClassification(form: any) {
    if (!selectedFile.value) return
    actionLoading.value = true
    try {
      await classifyMutate({
        input: {
          fileId: selectedFile.value.id,
          orgId: (items.value[0] && items.value[0].orgId) || variables.value.filter.orgId,
          canonicalSlot: form.value.canonicalSlot,
          confidence: form.value.confidence,
        },
      })
      notificationStore.add('success', 'File classified')
      showClassify.value = false
      refetch()
    } catch (e: any) {
      notificationStore.add('error', e.message || 'Failed to classify file')
    } finally {
      actionLoading.value = false
    }
  }
  
  async function triggerSync() {
    // Implementation would go here
  }
  
  function openMappingStudio() {
    const projectId = route.params.id as string
    router.push({ name: 'MappingStudio', params: { id: projectId } })
  }
  
  async function promptRename(file: FileItem, renameFile: any) {
    const name = window.prompt('Rename file', file.name)
    if (name && name !== file.name) {
      try {
        await renameFile(file.id, name)
        notificationStore.add('success', 'File renamed')
      } catch (e: any) {
        notificationStore.add('error', e.message || 'Rename failed')
      }
    }
  }
  
  async function promptMove(file: FileItem, moveFile: any) {
    const path = window.prompt('Move file to path', file.path)
    if (path && path !== file.path) {
      try {
        await moveFile(file.id, path)
        notificationStore.add('success', 'File moved')
      } catch (e: any) {
        notificationStore.add('error', e.message || 'Move failed')
      }
    }
  }
  
  return {
    actionLoading,
    showClassify,
    canonicalSlots,
    triggerReprocess,
    submitClassification,
    triggerSync,
    openMappingStudio,
    promptRename,
    promptMove
  }
}
