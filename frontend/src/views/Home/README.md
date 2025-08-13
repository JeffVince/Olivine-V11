# Home View

This view serves as the main landing page for the Olivine application.

## Structure

```
Home/
├── Components/
│   └── WelcomeCard.vue
├── Composables/
│   ├── Interface.ts
│   ├── state.ts
│   └── index.ts
├── README.md
└── index.vue
```

## Components

### WelcomeCard.vue
Displays the welcome message and application description.

## Composables

### Interface.ts
Defines TypeScript interfaces for home view data structures.

### state.ts
Manages the view's state including loading status and errors.

## Main Orchestrator

### index.vue
The main component that imports and orchestrates the child components and composables.
