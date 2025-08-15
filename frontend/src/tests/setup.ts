import { vi } from 'vitest'
import { ref } from 'vue'
import { config } from '@vue/test-utils'

// Mock all CSS and SCSS files before importing Vuetify
vi.mock('*.css', () => ({}))
vi.mock('*.scss', () => ({}))

// Mock specific Vuetify CSS files that are causing issues
vi.mock('vuetify/lib/components/VCode/VCode.css', () => ({}))
vi.mock('vuetify/lib/components/VDataTable/VDataTable.css', () => ({}))

// Import Vuetify after mocking CSS files
import { createVuetify } from 'vuetify'

// Configure Vuetify with minimal components to avoid CSS issues
const vuetify = createVuetify({
  components: {},
  directives: {},
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Configure Vue Test Utils
config.global.plugins = [vuetify]
config.global.mocks = {
  $t: (tKey: string) => tKey
}

config.global.provide = {}

// Mock apollo client
const mockApolloClient = {
  query: vi.fn(),
  mutate: vi.fn(),
  writeQuery: vi.fn(),
  writeFragment: vi.fn(),
}

vi.mock('@/graphql/client', () => ({
  apolloClient: mockApolloClient,
  provideApolloClient: (client: any) => client,
}))

// Mock useQuery, useMutation, and useSubscription from @vue/apollo-composable
const mockOnResult = vi.fn();
vi.mock('@vue/apollo-composable', async () => {
  const actual: any = await vi.importActual('@vue/apollo-composable');
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      result: ref(null),
      loading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
      onResult: mockOnResult,
    })),
    useMutation: vi.fn(() => [
      vi.fn().mockResolvedValue({ data: {} }),
      { loading: ref(false), error: ref(null) }
    ]),
    useSubscription: vi.fn(() => ({
      onResult: mockOnResult,
    })),
  };
});
