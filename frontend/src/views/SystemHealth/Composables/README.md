# SystemHealth Composables

This directory contains composable functions for the System Health view following the Vue 3 Composition API pattern.

## Files

### Interface.ts
Defines TypeScript interfaces for data structures used in the view:
- SystemHealthData interface
- ServiceStatus interface
- SystemHealthState interface

### state.ts
Manages the reactive state for the System Health view:
- Loading status
- Error handling
- Health data

### index.ts
Barrel export file that re-exports all composables for easier imports.
