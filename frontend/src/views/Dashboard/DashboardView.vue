<template>
  <div>
    <v-row>
      <v-col cols="12">
        <v-card class="glass-card">
          <Header />
          <v-card-text>
            <p>{{ dashboardMessage }}</p>
            
            <v-row class="mt-4">
              <v-col
                cols="12"
                md="6"
              >
                <QuickActions />
              </v-col>
              
              <v-col
                cols="12"
                md="6"
              >
                <SystemStatus />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
// Import composables
import { dashboardMessage } from '@/views/Dashboard/Composables'

// Import components
import Header from '@/views/Dashboard/Components/Header.vue'
import QuickActions from '@/views/Dashboard/Components/QuickActions.vue'
import SystemStatus from '@/views/Dashboard/Components/SystemStatus.vue'
</script>
