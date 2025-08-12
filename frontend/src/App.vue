<template>
  <v-app>
    <AppHeader @toggle-drawer="drawer = !drawer" />
    <AppSidebar v-model:open="drawer" />
    <PageContainer>
      <router-view />
    </PageContainer>
  </v-app>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@components/layout/AppHeader.vue'
import AppSidebar from '@components/layout/AppSidebar.vue'
import PageContainer from '@components/layout/PageContainer.vue'

const drawer = ref(true)
</script>

<style>
/* Global styles for Olivine */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  min-height: 100vh;
}
</style>
