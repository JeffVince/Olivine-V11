import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import AgentConsole from '../AgentConsoleView.vue'

// Create a mock Apollo client
const mockApolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
    },
    query: {
      fetchPolicy: 'no-cache',
    },
  },
})

describe('AgentConsole', () => {
  it('should render', () => {
    const wrapper = mount(AgentConsole, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
          }),
        ],
        provide: {
          apolloClient: mockApolloClient
        }
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
