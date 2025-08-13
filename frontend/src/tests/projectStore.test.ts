import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from '../stores/projectStore'
import { useOrganizationStore } from '../stores/organizationStore'
import { apolloClient } from '@/graphql/client'

vi.mock('@/graphql/client', () => ({
  apolloClient: {
    query: vi.fn(),
    mutate: vi.fn(),
  },
}))

describe('projectStore actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const org = useOrganizationStore()
    org.setOrganization({ id: 'org1', name: 'Org 1' })
    vi.resetAllMocks()
  })

  it('creates a project and updates state', async () => {
    (apolloClient.mutate as jest.Mock).mockResolvedValue({
      data: { createProject: { id: '1', name: 'Test', status: 'ACTIVE' } },
    })
    const store = useProjectStore()
    await store.createProject({ name: 'Test' })
    expect(store.projects.length).toBe(1)
    expect(store.projects[0].name).toBe('Test')
    expect(store.error).toBeNull()
  })

  it('archives a project', async () => {
    const store = useProjectStore()
    store.projects = [{ id: '1', name: 'Test', status: 'active' }]
    ;(apolloClient.mutate as jest.Mock).mockResolvedValue({
      data: { updateProject: { id: '1', name: 'Test', status: 'archived' } },
    })
    await store.archiveProject('1')
    expect(store.projects[0].status).toBe('archived')
  })

  it('sets error on delete failure', async () => {
    const store = useProjectStore()
    store.projects = [{ id: '1', name: 'Test', status: 'active' }]
    ;(apolloClient.mutate as jest.Mock).mockRejectedValue(new Error('fail'))
    await expect(store.deleteProject('1')).rejects.toThrow('fail')
    expect(store.error).toBe('fail')
    expect(store.projects.length).toBe(1)
  })
})
