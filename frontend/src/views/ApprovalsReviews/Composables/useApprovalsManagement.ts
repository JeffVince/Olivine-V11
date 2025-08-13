import { ref, computed } from 'vue'
import { useApprovals } from '@/composables/useApprovals'

export interface ApprovalItem {
  id: string
  type: string
  status: string
  createdAt: string
  orgId: string
}

export function useApprovalsManagement() {
  const { items, loading, approve, reject, refetch } = useApprovals()
  
  // Reactive references
  const searchQuery = ref('')
  const statusFilter = ref<string | null>(null)
  const typeFilter = ref<string | null>(null)
  
  // Computed properties
  const filteredItems = computed(() => {
    return items.value.filter(item => {
      const matchesSearch = searchQuery.value 
        ? item.type.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
          item.status.toLowerCase().includes(searchQuery.value.toLowerCase())
        : true
        
      const matchesStatus = statusFilter.value 
        ? item.status === statusFilter.value
        : true
        
      const matchesType = typeFilter.value 
        ? item.type === typeFilter.value
        : true
        
      return matchesSearch && matchesStatus && matchesType
    })
  })
  
  // Methods
  async function handleApprove(id: string) {
    const item = items.value.find(i => i.id === id)
    if (item) {
      await approve({ orgId: item.orgId, id })
      await refetch()
    }
  }
  
  async function handleReject(id: string) {
    const item = items.value.find(i => i.id === id)
    if (item) {
      await reject({ orgId: item.orgId, id })
      await refetch()
    }
  }
  
  return {
    // State
    items,
    loading,
    searchQuery,
    statusFilter,
    typeFilter,
    
    // Computed
    filteredItems,
    
    // Methods
    handleApprove,
    handleReject,
    refetch
  }
}
