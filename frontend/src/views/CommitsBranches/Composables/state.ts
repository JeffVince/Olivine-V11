import { ref, reactive } from 'vue'
import { CommitsBranchesState } from './Interface'

const state = reactive<CommitsBranchesState>({
  loading: false,
  error: null
})

export function useCommitsBranchesState() {
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
