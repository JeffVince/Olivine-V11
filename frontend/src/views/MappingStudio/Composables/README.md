# MappingStudio Composables

This directory contains the Vue composables for the MappingStudio view, organized by concern:

## Composable Structure

- `types.ts` - TypeScript interfaces and types used throughout the MappingStudio view
- `state.ts` - Reactive state management using Vue's Composition API refs and computed properties
- `actions.ts` - Business logic functions for mapping operations (create, edit, delete, etc.)
- `index.ts` - Barrel file that exports all composables for easy importing

This structure follows the separation of concerns principle, keeping state management, business logic, and type definitions separate and organized.
