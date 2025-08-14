import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import CallSheetComposer from '../CallSheetComposerView.vue'

describe('CallSheetComposer', () => {
  it('renders correctly', () => {
    const wrapper = mount(CallSheetComposer, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
          }),
        ],
      },
    })
    
    expect(wrapper.exists()).toBe(true)
    expect(wrapper.find('h2').text()).toBe('Call Sheet Composer')
  })

  // Add more tests as the component becomes more complex
})
