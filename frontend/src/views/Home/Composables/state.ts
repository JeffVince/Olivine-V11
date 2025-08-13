import { reactive } from 'vue'
import { HomeState } from './Interface'

const state = reactive<HomeState>({
  loading: false,
  error: null
})

export function useHomeState() {
  const setLoading = (loading: boolean) => {
    state.loading = loading
  }

  const setError = (error: string | null) => {
    state.error = error
  }

  return {
    state,
    setLoading,
    setError
  }
}
