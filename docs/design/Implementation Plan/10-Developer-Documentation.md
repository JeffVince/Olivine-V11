# Olivine Developer Documentation
## Complete Setup Guide: From Empty Repository to Working Application

### What This Document Covers

This guide will walk you through setting up the Olivine development environment from scratch. We'll explain:
- **Why** each technology choice was made
- **What** each folder and file does
- **How** to set up your development environment step-by-step
- **Where** to find specific functionality in the codebase

### Project Architecture Overview

**Olivine uses a modern, scalable architecture:**
- **Backend:** Node.js + TypeScript for type safety and developer experience
- **Database:** Neo4j (knowledge graph) + PostgreSQL (relational data) + Redis (queues)
- **Frontend:** Vue 3 with Composition API for reactive, maintainable UI
- **Integration:** GraphQL API + Supabase for real-time features
- **Deployment:** Docker containers orchestrated with Kubernetes

### 1. Project Structure and Organization

#### 1.1 Repository Layout

**Why This Structure:** We separate backend and frontend into distinct services to enable independent scaling, deployment, and development. Each folder has a specific purpose that makes the codebase maintainable as it grows.

**Backend Service Structure**
*This is where all server-side logic lives - APIs, database connections, file processing, and AI agents.*
```
backend/
├── src/
│   ├── agents/                 # AI agents implementation
│   │   │                       # These are the "brains" of Olivine - autonomous services
│   │   │                       # that process files, classify content, and track changes
│   │   ├── FileStewardAgent.ts      # Manages file lifecycle and content extraction
│   │   ├── TaxonomyClassificationAgent.ts  # Auto-classifies files using custom taxonomies
│   │   └── ContentAnalysisAgent.ts         # Extracts metadata and analyzes content
│   ├── handlers/              # Event handlers for storage providers
│   │   │                      # These respond to external events (file changes, webhooks)
│   │   │                      # and trigger appropriate agent actions
│   │   ├── DropboxWebhookHandler.ts    # Handles Dropbox webhook events for real-time sync
│   │   ├── GoogleDriveHandler.ts       # Manages Google Drive API interactions
│   │   └── SupabaseStorageHandler.ts   # Processes Supabase storage events
│   ├── services/              # Core services
│   │   │                      # Fundamental building blocks that other components use
│   │   │                      # Each service handles one specific domain
│   │   ├── Neo4jService.ts         # Knowledge graph database operations
│   │   ├── QueueService.ts         # Background job processing with Redis
│   │   ├── AuthService.ts          # JWT authentication and user management
│   │   └── TenantService.ts        # Multi-tenant data isolation
│   ├── models/                # Data models and interfaces
│   │   ├── File.ts
│   │   ├── Content.ts
│   │   ├── Commit.ts
│   │   └── Version.ts
│   ├── graphql/               # GraphQL schema and resolvers
│   │   ├── schema.ts
│   │   ├── resolvers/
│   │   │   ├── fileResolvers.ts
│   │   │   ├── contentResolvers.ts
│   │   │   ├── commitResolvers.ts
│   │   │   └── versionResolvers.ts
│   ├── migrations/            # Database migration scripts
│   │   ├── neo4j/
│   │   └── postgres/
│   ├── utils/                 # Utility functions
│   │   ├── crypto.ts
│   │   ├── validation.ts
│   │   └── normalization.ts
│   ├── config/                # Configuration files
│   │   ├── database.ts
│   │   ├── auth.ts
│   │   └── providers.ts
│   └── server.ts              # Main server entry point
├── tests/                     # Test files
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
├── scripts/                   # Deployment and utility scripts
│   ├── migrate-neo4j.ts
│   ├── migrate-postgres.ts
│   └── healthcheck.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

**Frontend Application Structure**
```
frontend/
├── src/
│   ├── components/            # Vue components
│   │   ├── layout/
│   │   ├── file-explorer/
│   │   ├── content-viewer/
│   │   └── shared/
│   ├── composables/           # Vue composables
│   │   ├── useFileService.ts
│   │   ├── useContentService.ts
│   │   └── useAuthService.ts
│   ├── stores/                # Pinia stores
│   │   ├── authStore.ts
│   │   ├── organizationStore.ts
│   │   └── sourceStore.ts
│   ├── graphql/               # GraphQL queries and mutations
│   │   ├── queries/
│   │   ├── mutations/
│   │   └── subscriptions/
│   ├── services/              # Frontend services
│   │   ├── apiService.ts
│   │   └── websocketService.ts
│   ├── assets/                # Static assets
│   │   ├── styles/
│   │   ├── images/
│   │   └── fonts/
│   ├── router/                # Vue Router configuration
│   └── main.ts                # Application entry point
├── tests/                     # Frontend tests
│   ├── unit/
│   └── e2e/
├── public/                   # Static files
├── Dockerfile
├── docker-compose.yml
├── package.json
└── vite.config.ts
```

#### 1.2 Module Dependencies

**Core Backend Dependencies**
```json
{
  "dependencies": {
    "@apollo/server": "^4.9.0",
    "graphql": "^16.7.0",
    "neo4j-driver": "^5.10.0",
    "pg": "^8.11.0",
    "redis": "^4.6.0",
    "express": "^4.18.0",
    "cors": "^2.8.0",
    "helmet": "^7.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.0",
    "uuid": "^9.0.0",
    "axios": "^1.4.0",
    "bullmq": "^4.0.0",
    "dotenv": "^16.3.0",
    "winston": "^3.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.4.0",
    "@types/express": "^4.17.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.6.0",
    "ts-jest": "^29.1.0",
    "typescript": "^5.1.0",
    "nodemon": "^3.0.0",
    "supertest": "^6.3.0"
  }
}
```

### 2. Step-by-Step Setup Guide

#### 2.1 From Empty Repository to Working Application

**Step 1: Create Project Structure**

*Why we do this first:* A well-organized folder structure makes the codebase maintainable and helps developers understand where different components belong.

```bash
# Create the main project directory
mkdir olivine && cd olivine

# Initialize git repository
git init

# Create the complete folder structure
mkdir -p backend/src/{agents,handlers,services,models,graphql/resolvers,migrations/{neo4j,postgres},utils,config,tests/{unit,integration,e2e,performance},scripts}
mkdir -p frontend/src/{components/{layout,file-explorer,content-viewer,shared},composables,stores,views,router,assets,tests}
mkdir -p docker/{development,production}
mkdir -p k8s/{base,overlays/{development,staging,production}}
mkdir -p docs/{api,deployment,troubleshooting}

# Create essential configuration files
touch backend/{package.json,tsconfig.json,Dockerfile,.env.example}
touch frontend/{package.json,tsconfig.json,vite.config.ts,Dockerfile}
touch docker-compose.yml Makefile README.md .gitignore
```

**Step 2: Set Up Package.json Files**

*Why we need separate package.json files:* Backend and frontend have different dependencies and build processes. Separating them allows independent deployment and scaling.

```bash
# Backend package.json
cd backend
npm init -y

# Install production dependencies
npm install express apollo-server-express graphql neo4j-driver pg redis jsonwebtoken bcryptjs cors helmet winston dotenv axios multer uuid

# Install development dependencies
npm install -D @types/node @types/express @types/pg @types/jsonwebtoken @types/bcryptjs @types/cors @types/multer @types/uuid typescript nodemon ts-node jest @types/jest ts-jest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser

# Frontend package.json
cd ../frontend
npm init -y

# Install production dependencies
npm install vue vue-router pinia vuetify @apollo/client @vue/apollo-composable @supabase/supabase-js axios graphql

# Install development dependencies
npm install -D @vitejs/plugin-vue vite typescript @vue/tsconfig vitest @vue/test-utils jsdom eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Step 3: Create Docker Development Environment**

*Why Docker:* Docker ensures all developers have identical development environments, eliminating "works on my machine" issues.

```yaml
# docker-compose.yml - This sets up all required services locally
version: '3.8'
services:
  neo4j:
    image: neo4j:5.10
    environment:
      NEO4J_AUTH: neo4j/password
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: olivine
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  neo4j_data:
  postgres_data:
  redis_data:
```

**Step 4: Create Makefile for Common Tasks**

*Why a Makefile:* Standardizes common development tasks and provides easy-to-remember commands for complex operations.

```makefile
# Makefile - Common development tasks
.PHONY: help setup start stop test clean

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## Set up the development environment
	@echo "Setting up Olivine development environment..."
	docker-compose up -d
	@echo "Waiting for databases to be ready..."
	sleep 30
	cd backend && npm install
	cd frontend && npm install
	@echo "Running initial migrations..."
	cd backend && npm run migrate
	@echo "Setup complete! Run 'make start' to begin development."

start: ## Start all development services
	docker-compose up -d
	cd backend && npm run dev &
	cd frontend && npm run dev &
	@echo "Olivine is running!"
	@echo "Backend: http://localhost:4000"
	@echo "Frontend: http://localhost:3000"
	@echo "Neo4j Browser: http://localhost:7474"

stop: ## Stop all services
	docker-compose down
	pkill -f "npm run dev" || true

test: ## Run all tests
	cd backend && npm test
	cd frontend && npm test

clean: ## Clean up everything
	docker-compose down -v
	docker system prune -f
	cd backend && rm -rf node_modules
	cd frontend && rm -rf node_modules
```

#### 2.2 Prerequisites

**Required Software Versions**

*Why these specific versions:* These are the minimum versions that support all the features Olivine requires. Using older versions may cause compatibility issues.
- Node.js >= 18.0.0
- Docker >= 24.0.0
- Docker Compose >= 2.20.0
- Neo4j Desktop or Neo4j Aura account (for development)
- PostgreSQL >= 15.0
- Redis >= 7.0
- Yarn >= 1.22.0

#### 2.2 Environment Configuration

**Environment Variables (.env)**
```bash
# Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
POSTGRES_URI=postgresql://postgres:password@localhost:5432/olivine
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=24h

# Dropbox Integration
DROPBOX_APP_KEY=your-dropbox-app-key
DROPBOX_APP_SECRET=your-dropbox-app-secret
DROPBOX_WEBHOOK_SECRET=your-dropbox-webhook-secret

# Google Drive Integration
GOOGLE_DRIVE_CLIENT_ID=your-google-drive-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-google-drive-client-secret

# Supabase Integration
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-key
SUPABASE_JWT_SECRET=your-supabase-jwt-secret

# Application Configuration
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
```

#### 2.3 Development Setup Script

**Setup Development Environment**
```bash
#!/bin/bash

# setup-dev.sh - Setup development environment

echo "Setting up Blueprint development environment..."

# Check prerequisites
if ! command -v node &> /dev/null; then
    echo "Node.js is required but not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "Docker is required but not installed. Please install Docker"
    exit 1
fi

if ! command -v yarn &> /dev/null; then
    echo "Yarn is required but not installed. Please install Yarn"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.template .env
    echo "Please update the .env file with your actual configuration values"
fi

# Start development services
echo "Starting development services with Docker Compose..."
docker-compose up -d neo4j postgres redis

# Wait for services to be ready
echo "Waiting for services to initialize..."
sleep 30

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
yarn install
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
yarn install
cd ..

# Run database migrations
echo "Running database migrations..."
yarn migrate

echo "Development environment setup complete!"
echo "Start the backend with: cd backend && yarn dev"
echo "Start the frontend with: cd frontend && yarn dev"
```

### 3. Coding Standards and Practices

#### 3.1 TypeScript Guidelines

**TypeScript Configuration (tsconfig.json)**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "removeComments": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 3.2 Code Quality Tools

**ESLint Configuration**
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "@typescript-eslint",
    "jest"
  ],
  "env": {
    "node": true,
    "jest": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-assertions": "error",
    "@typescript-eslint/array-type": "error",
    "jest/expect-expect": "off"
  }
}
```

**Prettier Configuration**
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### 4. API Documentation

#### 4.1 GraphQL Schema Reference

**Core Types**
```graphql
type File {
  id: ID!
  orgId: ID!
  sourceId: ID!
  path: String!
  name: String!
  size: Int!
  mimeType: String!
  checksum: String!
  createdAt: DateTime!
  modified: DateTime!
  metadata: JSON
  current: Boolean!
  deleted: Boolean!
  content: Content
  versions: [Version!]!
}

type Content {
  id: ID!
  orgId: ID!
  contentKey: String!
  title: String!
  description: String
  format: String!
  status: String!
  createdAt: DateTime!
  updatedAt: DateTime!
  metadata: JSON
  file: File
  versions: [Version!]!
}

type Commit {
  id: ID!
  orgId: ID!
  message: String!
  author: String!
  authorType: String!
  createdAt: DateTime!
  parentCommit: Commit
  actions: [Action!]!
  versions: [Version!]!
}

type Version {
  id: ID!
  orgId: ID!
  entityId: ID!
  entityType: String!
  contentHash: String!
  createdAt: DateTime!
  commit: Commit!
  properties: JSON!
  previousVersion: Version
  nextVersion: Version
}

type Action {
  id: ID!
  orgId: ID!
  commitId: ID!
  actionType: String!
  tool: String!
  entityType: String!
  entityId: ID!
  inputs: JSON!
  outputs: JSON!
  status: String!
  errorMessage: String
  createdAt: DateTime!
}
```

**Queries**
```graphql
type Query {
  files(filter: FileFilter): [File!]!
  file(orgId: ID!, id: ID!): File
  contents(filter: ContentFilter): [Content!]!
  content(orgId: ID!, id: ID!): Content
  commits(filter: CommitFilter): [Commit!]!
  commit(orgId: ID!, id: ID!): Commit
  versions(filter: VersionFilter): [Version!]!
  version(orgId: ID!, id: ID!): Version
  organizations: [Organization!]!
  organization(id: ID!): Organization
}
```

**Mutations**
```graphql
type Mutation {
  createFile(input: CreateFileInput!): File!
  updateFile(input: UpdateFileInput!): File!
  deleteFile(input: DeleteFileInput!): Boolean!
  createContent(input: CreateContentInput!): Content!
  updateContent(input: UpdateContentInput!): Content!
  deleteContent(input: DeleteContentInput!): Boolean!
  createCommit(input: CreateCommitInput!): Commit!
  createBranch(input: CreateBranchInput!): Branch!
  mergeBranch(input: MergeBranchInput!): Commit!
}
```

**Subscriptions**
```graphql
type Subscription {
  fileCreated(orgId: ID!): File!
  fileUpdated(orgId: ID!): File!
  fileDeleted(orgId: ID!): File!
  contentCreated(orgId: ID!): Content!
  contentUpdated(orgId: ID!): Content!
  contentDeleted(orgId: ID!): Content!
  commitCreated(orgId: ID!): Commit!
}
```

### 5. Database Schema Documentation

#### 5.1 Neo4j Schema

**File Ontology Nodes and Relationships**
```cypher
// File nodes
CREATE CONSTRAINT file_path_org_id IF NOT EXISTS FOR (f:File) REQUIRE (f.path, f.org_id) IS NODE KEY;
CREATE INDEX file_source_id FOR (f:File) ON (f.source_id);
CREATE INDEX file_modified FOR (f:File) ON (f.modified);

// Content nodes
CREATE CONSTRAINT content_key_org_id IF NOT EXISTS FOR (c:Content) REQUIRE (c.content_key, c.org_id) IS NODE KEY;
CREATE INDEX content_status FOR (c:Content) ON (c.status);
CREATE INDEX content_updated_at FOR (c:Content) ON (c.updated_at);

// Commit nodes
CREATE CONSTRAINT commit_id IF NOT EXISTS FOR (c:Commit) REQUIRE c.id IS UNIQUE;
CREATE INDEX commit_created_at FOR (c:Commit) ON (c.created_at);
CREATE INDEX commit_org_id FOR (c:Commit) ON (c.org_id);

// Version nodes
CREATE CONSTRAINT version_id IF NOT EXISTS FOR (v:Version) REQUIRE v.id IS UNIQUE;
CREATE INDEX version_entity_id FOR (v:Version) ON (v.entity_id);
CREATE INDEX version_created_at FOR (v:Version) ON (v.created_at);
CREATE INDEX version_org_id FOR (v:Version) ON (v.org_id);

// Action nodes
CREATE CONSTRAINT action_id IF NOT EXISTS FOR (a:Action) REQUIRE a.id IS UNIQUE;
CREATE INDEX action_commit_id FOR (a:Action) ON (a.commit_id);
CREATE INDEX action_org_id FOR (a:Action) ON (a.org_id);
```

#### 5.2 PostgreSQL Schema

**Core Tables**
```sql
-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sources table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    config JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dropbox events table
CREATE TABLE dropbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    source_id UUID NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    cursor VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files table
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    source_id UUID NOT NULL,
    path VARCHAR(1000) NOT NULL,
    name VARCHAR(255) NOT NULL,
    size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    checksum VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted BOOLEAN DEFAULT FALSE,
    current BOOLEAN DEFAULT TRUE
);

-- RLS Policies
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE dropbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation_policy ON organizations
    FOR ALL TO blueprint_user
    USING (id IN (SELECT org_id FROM user_organizations WHERE user_id = current_user_id()));

CREATE POLICY source_isolation_policy ON sources
    FOR ALL TO blueprint_user
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = current_user_id()));

CREATE POLICY dropbox_events_isolation_policy ON dropbox_events
    FOR ALL TO blueprint_user
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = current_user_id()));

CREATE POLICY files_isolation_policy ON files
    FOR ALL TO blueprint_user
    USING (org_id IN (SELECT org_id FROM user_organizations WHERE user_id = current_user_id()));
```

### 6. Testing Documentation

#### 6.1 Test Structure Guidelines

**Unit Test Organization**
```
tests/unit/
├── agents/
│   ├── FileStewardAgent.test.ts
│   ├── TaxonomyClassificationAgent.test.ts
│   └── ContentAnalysisAgent.test.ts
├── handlers/
│   ├── DropboxWebhookHandler.test.ts
│   ├── GoogleDriveHandler.test.ts
│   └── SupabaseStorageHandler.test.ts
├── services/
│   ├── Neo4jService.test.ts
│   ├── QueueService.test.ts
│   └── TenantService.test.ts
└── utils/
    ├── crypto.test.ts
    ├── validation.test.ts
    └── normalization.test.ts
```

#### 6.2 Test Execution Commands

**Running Tests**
```bash
# Run all unit tests
yarn test:unit

# Run specific test file
yarn test:unit -- agents/FileStewardAgent.test.ts

# Run integration tests
yarn test:integration

# Run end-to-end tests
yarn test:e2e

# Run security tests
yarn test:security

# Run performance tests
yarn test:performance

# Run all tests with coverage
yarn test:coverage
```

### 7. Deployment Documentation

#### 7.1 Deployment Process

**Production Deployment Steps**
1. Ensure all tests pass in CI pipeline
2. Build Docker images with latest code
3. Push images to container registry
4. Update Kubernetes deployment with new image tags
5. Run database migrations if needed
6. Monitor deployment health and logs

#### 7.2 Environment-Specific Configuration

**Production Environment Variables**
```bash
# Database Configuration
NEO4J_URI=bolt://blueprint-neo4j:7687
NEO4J_USER=${NEO4J_USER}
NEO4J_PASSWORD=${NEO4J_PASSWORD}
POSTGRES_URI=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@blueprint-postgres:5432/blueprint
REDIS_URL=redis://blueprint-redis:6379

# Authentication
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h

# Storage Provider Integration
DROPBOX_APP_KEY=${DROPBOX_APP_KEY}
DROPBOX_APP_SECRET=${DROPBOX_APP_SECRET}
DROPBOX_WEBHOOK_SECRET=${DROPBOX_WEBHOOK_SECRET}
GOOGLE_DRIVE_CLIENT_ID=${GOOGLE_DRIVE_CLIENT_ID}
GOOGLE_DRIVE_CLIENT_SECRET=${GOOGLE_DRIVE_CLIENT_SECRET}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_KEY}

# Application Configuration
{{ ... }}
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://blueprint.example.com
```

This developer documentation provides a comprehensive guide for setting up, developing, and maintaining the Blueprint system. It covers project structure, development environment setup, coding standards, API documentation, database schema, testing guidelines, and deployment processes.
