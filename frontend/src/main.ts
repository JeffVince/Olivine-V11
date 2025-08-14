import { createApp, h, provide } from 'vue';
import { createPinia } from 'pinia';
import { DefaultApolloClient } from '@vue/apollo-composable';
import { apolloClient } from './graphql/client';
import vuetify from './plugins/vuetify';
import App from './App.vue';
import router from './router';

// Create Pinia instance
const pinia = createPinia();

// Create the Vue app with Apollo Client provided in setup
const app = createApp({
  setup() {
    // Provide Apollo Client to the entire app
    provide(DefaultApolloClient, apolloClient);
    
    // Return the render function
    return () => h(App);
  },
});

// Use plugins
app.use(pinia);
app.use(router);
app.use(vuetify);

// Global error handler
app.config.errorHandler = (err: unknown, instance, info) => {
  console.error('Vue error:', err);
  console.error('Error in component:', instance?.$options?.name || 'Unknown');
  console.error('Error info:', info);
};

// Mount the app
app.mount('#app');

console.log('Apollo Client initialized:', !!apolloClient);
