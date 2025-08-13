import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AgentConsole from '../index.vue'

describe('AgentConsole', () => {
  it('should render', () => {
    const wrapper = mount(AgentConsole)
    expect(wrapper.exists()).toBe(true)
  })
})
