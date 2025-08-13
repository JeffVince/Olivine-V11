# Integrations Component Structure

This document outlines the structure and organization of the Integrations feature, which has been refactored into a modular component architecture following Vue 3 Composition API best practices.

## Directory Structure

```
Integrations/
├── Components/
│   ├── Header.vue
│   ├── IntegrationCard.vue
│   ├── AvailableIntegrations.vue
│   ├── AddIntegrationDialog.vue
│   ├── ConfigureIntegrationDialog.vue
│   └── LogsDialog.vue
├── Composables/
│   ├── api.ts
│   ├── constants.ts
│   ├── data.ts
│   ├── graphql.ts
│   ├── index.ts
│   ├── Interface.ts
│   ├── state.ts
│   └── utils.ts
└── index.vue (Orchestrator)
```

## Component Architecture

### Main Orchestrator
- **index.vue**: The main component that imports and orchestrates all child components. It manages the overall state and handles communication between components.

### UI Components
- **Header.vue**: Displays the page header with title and "Add Integration" button.
- **IntegrationCard.vue**: Renders individual integration cards with status, statistics, and action buttons.
- **AvailableIntegrations.vue**: Shows a list of available integrations that can be added.
- **AddIntegrationDialog.vue**: Modal dialog for adding new integrations.
- **ConfigureIntegrationDialog.vue**: Modal dialog for configuring integration settings.
- **LogsDialog.vue**: Modal dialog for viewing integration logs.

## Composables Pattern

The business logic has been separated into composable functions following the Vue 3 Composition API pattern:

- **state.ts**: Reactive state variables and computed properties
- **graphql.ts**: GraphQL queries and mutations using Apollo
- **api.ts**: REST API calls and integration methods
- **data.ts**: Data processing and transformation functions
- **utils.ts**: Utility functions and helpers
- **constants.ts**: Constant values and configuration
- **Interface.ts**: TypeScript interfaces and types
- **index.ts**: Barrel export file that re-exports all composables

## Styling

CSS has been colocated within each component using scoped styles rather than a global stylesheet. This improves maintainability and prevents style conflicts.

## Data Flow

1. The main `index.vue` component imports all composables and manages the overall state
2. Child components receive data via props and emit events for user interactions
3. Composables handle all business logic, API calls, and state management
4. GraphQL and REST API calls are encapsulated in the `graphql.ts` and `api.ts` files respectively

## Best Practices

- Each component is self-contained with its own template, script, and styles
- TypeScript interfaces ensure type safety across components
- Composables follow the single responsibility principle
- Scoped CSS prevents style leakage between components
- Vue 3 Composition API patterns are used consistently

This structure makes the Integrations feature more maintainable, testable, and scalable.
