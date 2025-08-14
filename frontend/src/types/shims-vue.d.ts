// TypeScript Vue Plugin (Volar) support for Vue 3
declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Vue 3 Type Declarations
declare module 'vue' {
  export * from '@vue/runtime-dom';
  
  // Composition API
  export const ref: typeof import('@vue/reactivity').ref;
  export const computed: typeof import('@vue/reactivity').computed;
  export const reactive: typeof import('@vue/reactivity').reactive;
  export const watch: typeof import('@vue/runtime-core').watch;
  export const onMounted: typeof import('@vue/runtime-core').onMounted;
  
  // Other commonly used Vue exports
  export const defineComponent: typeof import('@vue/runtime-core').defineComponent;
  export const nextTick: typeof import('@vue/runtime-core').nextTick;
  
  interface ComponentCustomProperties {
    $t: (key: string, values?: Record<string, any>) => string;
  }
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $t: (key: string, values?: Record<string, any>) => string;
  }
  
  // Export all types from @vue/runtime-core
  export * from '@vue/runtime-core';
}
