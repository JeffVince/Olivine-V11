# Settings View

This document describes the modular structure of the Settings view.

## Directory Structure

```
Settings/
├── Components/
│   ├── SettingsHeader.vue
│   ├── ProfileSettings.vue
│   ├── NotificationSettings.vue
│   └── ProjectSettings.vue
├── Composables/
│   ├── api.ts
│   ├── index.ts
│   └── Interface.ts
├── README.md (this file)
└── index.vue (Main orchestrator component)
```

## Component Architecture

### Main Orchestrator Component
- **index.vue**: Imports and orchestrates all child components, manages overall state

### UI Components
- **SettingsHeader.vue**: Displays the header section with title and description
- **ProfileSettings.vue**: Handles profile settings form (name, avatar)
- **NotificationSettings.vue**: Handles notification preferences (email, SMS, in-app)
- **ProjectSettings.vue**: Handles project-specific settings (name, templates, auto-approve)

### Composables
- **api.ts**: Contains all API calls for saving settings
- **Interface.ts**: TypeScript interfaces for settings data structures
- **index.ts**: Barrel export file that re-exports all composables

## Data Flow

1. Main component imports all necessary composables
2. State is managed in the composables
3. Child components receive data via props
4. Child components emit events for user interactions
5. API calls are encapsulated in the api.ts composable

## Styling

- Each component has its own scoped CSS
- Uses the existing design system and component library patterns
