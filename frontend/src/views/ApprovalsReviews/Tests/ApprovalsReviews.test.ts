import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import ApprovalsReviews from '../index.vue'

describe('ApprovalsReviews', () => {
  it('renders correctly', () => {
    const wrapper = mount(ApprovalsReviews, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
          }),
        ],
      },
    })
    
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('h2').text()).toBe('Approvals & Reviews')
  })

  // Add more tests as the component becomes more complex
})
