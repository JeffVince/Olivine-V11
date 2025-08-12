import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core';
import { DefaultApolloClient } from '@vue/apollo-composable';
import vuetify from './plugins/vuetify'

import App from './App.vue';
import router from './router';

// Create Pinia instance
const pinia = createPinia();

// Create Apollo Client
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:8080/graphql'
});

const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache()
});

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
