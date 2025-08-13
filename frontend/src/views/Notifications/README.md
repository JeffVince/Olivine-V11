# Notifications View

This directory contains the modular implementation of the Notifications view following the project's architectural patterns.

## Structure

```
Notifications/
├── Components/
│   ├── NotificationsHeader.vue
│   └── NotificationsList.vue
├── Composables/
│   ├── index.ts
│   ├── Interface.ts
│   └── state.ts
├── README.md
└── index.vue (Main orchestrator component)
```

## Components

### NotificationsHeader.vue
Displays the header section with title and description for the Notifications view.

### NotificationsList.vue
Displays the list of notifications with actions to open, remove, or clear notifications.

## Composables

### state.ts
Contains:
- `useNotificationsState()`: Provides reactive state for notifications
- `useNotificationsActions()`: Provides methods for notification actions (open, remove, clear, formatDate)
- `useNotificationsLifecycle()`: Lifecycle management (currently empty but available for future use)

### Interface.ts
TypeScript interfaces for:
- `NotificationsState`: State structure
- `NotificationActions`: Available actions

## Data Flow

1. The main orchestrator component (`index.vue`) imports child components and composables
2. State is managed through the `useNotificationsState()` composable
3. Actions are handled through the `useNotificationsActions()` composable
4. Child components receive data via props and emit events for user interactions
5. The main component handles all event communication between child components

## Styling

All components use scoped CSS to prevent style leakage. Common styles are defined in the project's global SCSS files.
