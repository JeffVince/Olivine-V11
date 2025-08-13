# Agent Console

The Agent Console is a Vue component that provides a dashboard for managing and monitoring AI agents and automation workflows.

## Structure

- `index.vue` - Main component orchestrator
- `Components/` - Subcomponents directory
- `Composables/` - Composable functions directory
- `Tests/` - Unit and integration tests directory

## Features

- View and manage AI agents
- Monitor agent status and statistics
- Create new agents
- View job queues and logs
- Start/stop agents
- Duplicate and delete agents

## Dependencies

- `useAgentJobs` composable for job management
- `useAgentHealth` composable for health monitoring
- `useNotificationStore` for user notifications
- `useOrganizationStore` for organization context

## Usage

The Agent Console is accessible through the main navigation menu under the "Agents" section for each project.
