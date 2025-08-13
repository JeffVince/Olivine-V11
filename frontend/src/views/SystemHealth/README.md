# System Health View

This view displays the system health status including service pings, queue depth, and sync backlog information.

## Structure

```
SystemHealth/
├── Components/
│   └── SystemHealthCard.vue
├── Composables/
│   ├── Interface.ts
│   ├── state.ts
│   └── index.ts
├── README.md
└── index.vue
```

## Components

### SystemHealthCard.vue
Displays the system health information in a card format.

## Composables

### Interface.ts
Defines TypeScript interfaces for system health data structures.

### state.ts
Manages the view's state including loading status, errors, and health data.

## Main Orchestrator

### index.vue
The main component that imports and orchestrates the child components and composables.
