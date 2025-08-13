export interface HomeState {
  loading: boolean
  error: string | null
}

export interface WelcomeContent {
  title: string
  description: string
  version: string
}
