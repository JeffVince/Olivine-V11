# Shoot-Day Cockpit View

This view serves as the main dashboard for shoot-day operations, displaying scenes and actions.

## Structure

```
ShootDayCockpit/
├── Components/
│   ├── ScenesTable.vue
│   └── ActionsCard.vue
├── Composables/
│   ├── Interface.ts
│   ├── state.ts
│   └── index.ts
├── README.md
└── index.vue
```

## Components

### ScenesTable.vue
Displays the scenes table with scene information.

### ActionsCard.vue
Displays available actions such as generating call sheets.

## Composables

### Interface.ts
Defines TypeScript interfaces for shoot-day cockpit data structures.

### state.ts
Manages the view's state including loading status, errors, scenes, and actions.

## Main Orchestrator

### index.vue
The main component that imports and orchestrates the child components and composables.
