import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useProjectStore, Project } from '../stores/projectStore'
import { useOrganizationStore } from '../stores/organizationStore'
import { useAuthStore } from '../stores/authStore'
import { apolloClient } from '@/graphql/client'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();

// Use vitest's global stubbing
vi.stubGlobal('localStorage', localStorageMock);

vi.mock('@/graphql/client', () => ({
  apolloClient: {
    query: vi.fn(),
    mutate: vi.fn(),
  },
}))

describe('projectStore actions', () => {
  beforeEach(() => {
    // Create and set active Pinia instance
    const pinia = createPinia()
    setActivePinia(pinia)
    
    const org = useOrganizationStore()
    org.setOrganization({ id: 'org1', name: 'Org 1' })
    const auth = useAuthStore()
    auth.user = { id: 'user1', email: 'test@example.com', roles: ['user'] }
    vi.resetAllMocks()
  })

  it('creates a project and updates state', async () => {
    (apolloClient.mutate as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { createProject: { id: '1', title: 'Test', status: 'development', settings: {}, metadata: {}, createdAt: '', updatedAt: '' } },
    })
    const store = useProjectStore()
    await store.createProject({ title: 'Test', type: 'feature_film', status: 'development' })
    expect(store.projects.value.length).toBe(1)
    expect(store.projects.value[0].title).toBe('Test')
    expect(store.error).toBeNull()
  })

  it('archives a project', async () => {
    const store = useProjectStore()
    store.projects.value = [{ id: '1', title: 'Test', status: 'development', orgId: 'org1' } as Project]
    (apolloClient.mutate as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { updateProject: { id: '1', name: 'Test', status: 'archived', description: null, settings: {} } },
    })
    await store.archiveProject('1')
    expect(store.projects.value[0].status).toBe('archived')
  })

  it('sets error on delete failure', async () => {
    const store = useProjectStore()
    store.projects.value = [{ id: '1', title: 'Test', status: 'development', orgId: 'org1' } as Project]
    (apolloClient.mutate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'))
    await expect(store.deleteProject('1')).rejects.toThrow('fail')
    expect(store.error).toBe('fail')
    expect(store.projects.value.length).toBe(1)
  })
})
