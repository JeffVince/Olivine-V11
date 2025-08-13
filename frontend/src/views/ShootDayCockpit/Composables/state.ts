import { reactive } from 'vue'
import { ShootDayCockpitState, Scene, Action } from './Interface'

const state = reactive<ShootDayCockpitState>({
  loading: false,
  error: null,
  scenes: [],
  actions: []
})

export function useShootDayCockpitState() {
  const setLoading = (loading: boolean) => {
    state.loading = loading
  }

  const setError = (error: string | null) => {
    state.error = error
  }

  const setScenes = (scenes: Scene[]) => {
    state.scenes = scenes
  }

  const setActions = (actions: Action[]) => {
    state.actions = actions
  }

  return {
    state,
    setLoading,
    setError,
    setScenes,
    setActions
  }
}
