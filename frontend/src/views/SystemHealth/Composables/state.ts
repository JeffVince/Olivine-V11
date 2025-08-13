import { ref, reactive } from 'vue'
import { SystemHealthState, SystemHealthData } from './Interface'

const state = reactive<SystemHealthState>({
  loading: false,
  error: null,
  healthData: null
})

export function useSystemHealthState() {
  const setLoading = (loading: boolean) => {
    state.loading = loading
  }

  const setError = (error: string | null) => {
    state.error = error
  }

  const setHealthData = (data: SystemHealthData | null) => {
    state.healthData = data
  }

  return {
    state,
    setLoading,
    setError,
    setHealthData
  }
}
