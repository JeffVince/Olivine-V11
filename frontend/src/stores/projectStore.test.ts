import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProjectStore } from './projectStore'
import { useOrganizationStore } from './organizationStore'
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
    ;(apolloClient.mutate as any).mockResolvedValue({
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
    store.projects = [{ id: '1', name: 'Test', status: 'ACTIVE' }]
    ;(apolloClient.mutate as any).mockResolvedValue({
      data: { updateProject: { id: '1', name: 'Test', status: 'ARCHIVED' } },
    })
    await store.archiveProject('1')
    expect(store.projects[0].status).toBe('ARCHIVED')
  })

  it('sets error on delete failure', async () => {
    const store = useProjectStore()
    store.projects = [{ id: '1', name: 'Test', status: 'ACTIVE' }]
    ;(apolloClient.mutate as any).mockRejectedValue(new Error('fail'))
    await expect(store.deleteProject('1')).rejects.toThrow('fail')
    expect(store.error).toBe('fail')
    expect(store.projects.length).toBe(1)
  })

  it('fetches project members', async () => {
    const store = useProjectStore()
    ;(apolloClient.query as any).mockResolvedValue({
      data: { projectMembers: [{ id: 'm1', email: 'a@test.com', role: 'VIEWER' }] },
    })
    await store.fetchMembers('p1')
    expect(store.members.length).toBe(1)
    expect(store.members[0].email).toBe('a@test.com')
  })

  it('invites a new member', async () => {
    const store = useProjectStore()
    ;(apolloClient.mutate as any).mockResolvedValue({
      data: { inviteProjectMember: { id: 'm2', email: 'b@test.com', role: 'EDITOR' } },
    })
    await store.inviteMember('p1', 'b@test.com', 'EDITOR')
    expect(store.members[0].email).toBe('b@test.com')
  })

  it('updates member role', async () => {
    const store = useProjectStore()
    store.members = [{ id: 'm1', email: 'a@test.com', role: 'VIEWER' }]
    ;(apolloClient.mutate as any).mockResolvedValue({
      data: { updateProjectMemberRole: { id: 'm1', email: 'a@test.com', role: 'ADMIN' } },
    })
    await store.updateMemberRole('p1', 'm1', 'ADMIN')
    expect(store.members[0].role).toBe('ADMIN')
  })

  it('removes a member', async () => {
    const store = useProjectStore()
    store.members = [
      { id: 'm1', email: 'a@test.com', role: 'ADMIN' },
      { id: 'm2', email: 'b@test.com', role: 'VIEWER' },
    ]
    ;(apolloClient.mutate as any).mockResolvedValue({ data: { removeProjectMember: true } })
    await store.removeMember('p1', 'm1')
    expect(store.members.length).toBe(1)
    expect(store.members[0].id).toBe('m2')
  })
})
