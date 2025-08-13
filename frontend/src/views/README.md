# Views Structure Guide

This document outlines the structure and organization of the Vue views in the application, along with guidelines for building new features following established patterns.

## Directory Structure

```
views/
├── Integrations/
│   ├── Components/
│   ├── Composables/
│   └── index.vue
├── [Other view directories following similar patterns]
├── README.md (this file)
└── router/
    └── index.ts
```

## Feature Structure Pattern

Each feature should follow a consistent modular structure:

```
FeatureName/
├── Components/
│   ├── FeatureHeader.vue
│   ├── FeatureCard.vue
│   └── [Other UI components]
├── Composables/
│   ├── api.ts
│   ├── constants.ts
│   ├── data.ts
│   ├── graphql.ts
│   ├── index.ts
│   ├── Interface.ts
│   ├── state.ts
│   └── utils.ts
├── Stores/ (if needed)
│   └── [Pinia stores]
├── Tests/ (if needed)
│   └── [Component and unit tests]
├── README.md (feature-specific documentation)
└── index.vue (Main orchestrator component)
```

## Component Architecture Guidelines

### Main Orchestrator Component
- Should be named `index.vue`
- Imports and orchestrates all child components
- Manages overall state and communication between components
- Should have minimal template logic

### UI Components
- Each component should be focused on a single responsibility
- Use scoped styles to prevent CSS conflicts
- Pass data via props and emit events for communication
- Use TypeScript interfaces for prop validation

## Composables Pattern

All business logic should be encapsulated in composable functions following the Vue 3 Composition API:

- **state.ts**: Reactive state variables and computed properties
- **graphql.ts**: GraphQL queries and mutations using Apollo
- **api.ts**: REST API calls and integration methods
- **data.ts**: Data processing and transformation functions
- **utils.ts**: Utility functions and helpers
- **constants.ts**: Constant values and configuration
- **Interface.ts**: TypeScript interfaces and types
- **index.ts**: Barrel export file that re-exports all composables

## Styling Guidelines

- Use scoped CSS within components rather than global stylesheets
- Follow the existing design system and component library patterns
- Use CSS variables for consistent theming
- Prefer utility classes when available

## Data Flow Principles

1. Main component imports all necessary composables
2. Child components receive data via props
3. Child components emit events for user interactions
4. Composables handle all business logic, API calls, and state management
5. GraphQL and REST API calls are encapsulated in dedicated files

## Best Practices

- Each component should be self-contained with its own template, script, and styles
- Use TypeScript for type safety across all components
- Composables should follow the single responsibility principle
- Scoped CSS prevents style leakage between components
- Vue 3 Composition API patterns should be used consistently
- Document complex features with a README.md file

## Adding New Features

1. Create a new directory in the views folder with the feature name
2. Follow the structure pattern outlined above
3. Implement the main orchestrator component (`index.vue`)
4. Create modular components in the Components directory
5. Implement business logic in the Composables directory
6. Add routing in `router/index.ts`
7. Document the feature with a README.md file

This structure makes features more maintainable, testable, and scalable while following Vue 3 best practices.
