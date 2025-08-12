# Olivine

A unified, versioned knowledge layer for creative production.

## Overview

Olivine is a sophisticated knowledge management system designed specifically for creative production workflows. It provides a unified layer that connects various storage providers (Dropbox, Google Drive, Supabase) with a powerful knowledge graph implementation using Neo4j, enabling intelligent organization, versioning, and retrieval of creative assets.

## Architecture

Olivine implements four core ontologies:

1. **File Ontology** - Represents the storage truth layer
2. **Content Ontology** - Represents the creative reality layer
3. **Ops Ontology** - Represents the business logic layer
4. **Provenance Ontology** - Represents the audit trail layer

The system uses an event-driven architecture with Redis as the message broker, PostgreSQL for relational data storage, and Neo4j for the knowledge graph.

## Prerequisites

- Node.js (v18 or higher)
- Docker
- Docker Compose
- Yarn or npm
- Git

## Project Structure

```
Olivine-V11/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── graphql/
│   │   │   └── resolvers/
│   │   ├── migrations/
│   │   ├── utils/
│   │   ├── config/
│   │   └── tests/
│   │       ├── unit/
│   │       ├── integration/
│   │       ├── e2e/
│   │       └── performance/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   ├── file-explorer/
│   │   │   ├── content-viewer/
│   │   │   └── shared/
│   │   ├── composables/
│   │   ├── stores/
│   │   ├── views/
│   │   ├── router/
│   │   ├── assets/
│   │   └── tests/
│   │       ├── unit/
│   │       └── integration/
├── infrastructure/
│   ├── docker/
│   │   ├── development/
│   │   └── production/
│   ├── k8s/
│   │   ├── base/
│   │   └── overlays/
│   │       ├── development/
│   │       ├── staging/
│   │       └── production/
├── docs/
│   ├── api/
│   ├── deployment/
│   └── troubleshooting/
├── docker-compose.yml
└── Makefile
```

## Development Setup

1. Clone the repository
2. Run `make setup` to initialize the development environment
3. Run `make start` to start all services

## Available Make Commands

- `make setup` - Set up the development environment
- `make start` - Start all development services
- `make stop` - Stop all development services
- `make restart` - Restart all development services
- `make status` - Check status of development services
- `make logs` - View logs for all services
- `make test` - Run all test suites
- `make clean` - Clean up development environment
- `make build` - Build all services
- `make install` - Install all dependencies

## Services

- **Neo4j** - Knowledge graph database (http://localhost:7474)
- **PostgreSQL** - Relational database (localhost:5432)
- **Redis** - Cache and message broker (localhost:6379)
- **Backend** - Node.js API service (http://localhost:8080)
- **Frontend** - Vue.js web application (http://localhost:3000)

## Environment Variables

Both backend and frontend have `.env.example` files that should be copied to `.env` and configured with appropriate values.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## Testing

Run `make test` to execute all test suites, or run individual tests in the backend and frontend directories.

## License

MIT License