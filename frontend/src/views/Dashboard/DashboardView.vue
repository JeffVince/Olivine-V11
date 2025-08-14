<template>
  <div>
    <v-row>
      <v-col cols="12">
        <v-card class="glass-card">
          <DashboardHeader @create-project="console.log('Create project clicked')" />
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
import { useDashboard } from './Composables/useDashboard'

// Import components
import DashboardHeader from './Components/DashboardHeader.vue'
import QuickActions from './Components/QuickActions.vue'
import SystemStatus from './Components/SystemStatus.vue'

const { dashboardMessage } = useDashboard()
</script>
