import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { DefaultApolloClient } from '@vue/apollo-composable';
import { apolloClient } from '@/graphql/client'
import vuetify from './plugins/vuetify'

import App from './App.vue';
import router from './router';

// Create Pinia instance
const pinia = createPinia();

// Apollo client configured with HTTP + WS split link

// Create the Vue app
const app = createApp(App);

// Use Pinia for state management
app.use(pinia);

// Provide Apollo Client to the app
app.provide(DefaultApolloClient, apolloClient);

// Use router
app.use(router);

// Use Vuetify
app.use(vuetify);

// Mount the app
app.mount('#app');
