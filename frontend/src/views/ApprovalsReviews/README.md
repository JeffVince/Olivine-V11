# Approvals & Reviews

This feature allows users to view and manage approvals and reviews within a project.

## Structure

- `index.vue` - Main component that orchestrates the feature
- `Components/` - UI components
- `Composables/` - Business logic and state management
- `Tests/` - Unit and integration tests

## Components

- Main data table for viewing approvals
- Action buttons for approving/rejecting items

## Composables

- `useApprovals` - Handles data fetching and mutation for approvals

## Dependencies

- `useApprovals` composable from `@/composables/useApprovals`
- Vuetify components (v-data-table, v-card, v-btn)

## Functionality

- View list of pending approvals
- Approve or reject individual items
- Automatic refetch after actions
