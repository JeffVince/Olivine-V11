export interface Commit {
  id: string
  message: string
  createdAt: string
}

export interface Branch {
  id: string
  name: string
  description: string
  active: boolean
  baseCommitId: string
}

export interface CommitsBranchesState {
  loading: boolean
  error: string | null
}
