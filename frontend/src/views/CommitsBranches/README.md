# Commits & Branches View

This view displays commit history and branch information for the current organization.

## Structure

```
CommitsBranches/
├── Components/
│   ├── CommitTimeline.vue
│   └── BranchList.vue
├── Composables/
│   ├── Interface.ts
│   ├── state.ts
│   └── index.ts
├── README.md
└── index.vue
```

## Components

### CommitTimeline.vue
Displays a list of commits with their messages and creation dates.

### BranchList.vue
Shows available branches as chips, with the active branch highlighted.

## Composables

### Interface.ts
Defines TypeScript interfaces for Commit and Branch objects.

### state.ts
Manages the view's state including loading status and errors.

## Main Orchestrator

### index.vue
The main component that imports and orchestrates the child components and composables.
