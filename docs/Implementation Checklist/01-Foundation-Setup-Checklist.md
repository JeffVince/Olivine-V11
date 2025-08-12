# Olivine Foundation Setup Checklist
## Phase 1: Project Infrastructure and Environment Setup

### Prerequisites Verification

* [X] **Development Environment Setup:** Ensure all required software is installed and configured correctly.

  * [X] **Node.js Installation:** Install Node.js >= 18.0.0 and verify with `node --version`. Ensure npm is also available and up-to-date.
  * [X] **Docker Setup:** Install Docker >= 24.0.0 and Docker Compose >= 2.20.0. Verify with `docker --version` and `docker-compose --version`. Ensure Docker daemon is running.
  * [X] **Database Tools:** Install Neo4j Desktop or create Neo4j Aura account for development. Install PostgreSQL >= 15.0 client tools. Install Redis >= 7.0 or ensure access to Redis instance.
  * [X] **Package Manager:** Install Yarn >= 1.22.0 globally with `npm install -g yarn`. Verify installation with `yarn --version`.
  * [X] **Git Configuration:** Ensure Git is installed and configured with user name and email. Set up SSH keys for repository access if needed.

### Project Structure Creation

* [X] **Repository Initialization:** Create the main project structure and initialize version control.

  * [X] **Main Directory:** Create main project directory `mkdir olivine && cd olivine`. Initialize Git repository with `git init`.
  * [X] **Backend Structure:** Create backend folder structure:
    ```bash
    mkdir -p backend/src/{agents,handlers,services,models,graphql/resolvers,migrations/{neo4j,postgres},utils,config,tests/{unit,integration,e2e,performance},scripts}
    ```
  * [X] **Frontend Structure:** Create frontend folder structure:
    ```bash
    mkdir -p frontend/src/{components/{layout,file-explorer,content-viewer,shared},composables,stores,views,router,assets,tests}
    ```
  * [X] **Infrastructure Directories:** Create deployment and documentation folders:
    ```bash
    mkdir -p docker/{development,production} k8s/{base,overlays/{development,staging,production}} docs/{api,deployment,troubleshooting}
    ```
  * [X] **Configuration Files:** Create essential configuration files:
    ```bash
    touch backend/{package.json,tsconfig.json,Dockerfile,.env.example}
    touch frontend/{package.json,tsconfig.json,vite.config.ts,Dockerfile}
    touch docker-compose.yml Makefile README.md .gitignore
    ```

### Package Configuration

* [X] **Backend Package Setup:** Configure Node.js backend with all required dependencies.

  * [X] **Package.json Creation:** Navigate to backend directory and run `npm init -y`. Update package.json with proper name "olivine-backend", description, and scripts.
  * [X] **Production Dependencies:** Install core backend dependencies:
    ```bash
    npm install express apollo-server-express graphql neo4j-driver pg redis jsonwebtoken bcryptjs cors helmet winston dotenv axios multer uuid
    ```
  * [X] **Development Dependencies:** Install development and testing tools:
    ```bash
    npm install -D @types/node @types/express @types/pg @types/jsonwebtoken @types/bcryptjs @types/cors @types/multer @types/uuid typescript nodemon ts-node jest @types/jest ts-jest eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
    ```
  * [X] **TypeScript Configuration:** Create tsconfig.json with proper compiler options for Node.js backend, including strict mode, ES2020 target, and proper module resolution.
  * [X] **Scripts Configuration:** Add npm scripts for development (`dev`), build (`build`), test (`test`), and migration (`migrate`) commands.

* [X] **Frontend Package Setup:** Configure Vue.js frontend with modern tooling.

  * [X] **Package.json Creation:** Navigate to frontend directory and run `npm init -y`. Update with proper name "olivine-frontend" and Vue-specific configuration.
  * [X] **Production Dependencies:** Install Vue 3 ecosystem and integration libraries:
    ```bash
    npm install vue vue-router pinia vuetify @apollo/client @vue/apollo-composable @supabase/supabase-js axios graphql
    ```
  * [X] **Development Dependencies:** Install Vite build tools and testing framework:
    ```bash
    npm install -D @vitejs/plugin-vue vite typescript @vue/tsconfig vitest @vue/test-utils jsdom eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
    ```
  * [X] **Vite Configuration:** Create vite.config.ts with Vue plugin, proxy configuration for backend API, and proper build settings.
  * [X] **TypeScript Configuration:** Create tsconfig.json with Vue-specific settings, including proper module resolution and strict type checking.

### Docker Development Environment

* [X] **Docker Compose Configuration:** Set up local development environment with all required services.

  * [X] **Neo4j Service:** Configure Neo4j container with:
    - Image: neo4j:5.10
    - Authentication: neo4j/password
    - Plugins: APOC enabled
    - Ports: 7474 (HTTP), 7687 (Bolt)
    - Volume: neo4j_data for persistence
  * [X] **PostgreSQL Service:** Configure PostgreSQL container with:
    - Image: postgres:15
    - Database: olivine
    - User/Password: postgres/password
    - Port: 5432
    - Volume: postgres_data for persistence
  * [X] **Redis Service:** Configure Redis container with:
    - Image: redis:7-alpine
    - Port: 6379
    - Volume: redis_data for persistence
  * [X] **Network Configuration:** Ensure all services can communicate and are accessible from host machine.
  * [X] **Volume Management:** Define named volumes for data persistence across container restarts.

### Development Tools Setup

* [X] **Makefile Creation:** Create standardized development commands for common tasks.

  * [X] **Help Command:** Implement `make help` that displays all available commands with descriptions.
  * [X] **Setup Command:** Create `make setup` that:
    - Starts Docker services
    - Waits for databases to be ready
    - Installs dependencies for both backend and frontend
    - Runs initial database migrations
    - Provides success message with next steps
  * [X] **Start Command:** Create `make start` that starts all development services and displays access URLs.
  * [X] **Stop Command:** Create `make stop` that gracefully shuts down all services.
  * [X] **Test Command:** Create `make test` that runs all test suites.
  * [X] **Clean Command:** Create `make clean` that removes all containers, volumes, and node_modules.

* [X] **Environment Configuration:** Set up environment variables and configuration management.

  * [X] **Backend .env.example:** Create comprehensive example with all required variables:
    - Database connections (Neo4j, PostgreSQL, Redis)
    - JWT configuration
    - Storage provider credentials (Dropbox, Google Drive)
    - Supabase integration
    - Application settings
  * [X] **Frontend .env.example:** Create frontend environment variables:
    - API endpoints
    - Supabase configuration
    - OAuth client IDs
  * [X] **Documentation:** Add comments explaining each environment variable and where to obtain values.
  * [X] **Security Notes:** Include warnings about keeping secrets secure and not committing actual .env files.

### Git Configuration

* [X] **Repository Setup:** Configure version control and collaboration settings.

  * [X] **Gitignore Configuration:** Create comprehensive .gitignore covering:
    - Node.js (node_modules, npm-debug.log)
    - Environment files (.env, .env.local)
    - Build outputs (dist/, build/)
    - IDE files (.vscode/, .idea/)
    - OS files (.DS_Store, Thumbs.db)
    - Docker volumes and logs
  * [X] **Initial Commit:** Stage all configuration files and create initial commit with message "Initial project setup".
  * [X] **Branch Strategy:** Set up main branch protection and development branch if using Git Flow.
  * [X] **README Creation:** Create comprehensive README.md with:
    - Project description and goals
    - Quick start guide
    - Development setup instructions
    - Contributing guidelines
    - License information

### Verification and Testing

* [X] **Environment Verification:** Ensure all components are working correctly.

  * [X] **Docker Services:** Run `make setup` and verify all services start without errors. Check service logs for any warnings.
  * [X] **Database Connections:** Test connections to Neo4j (http://localhost:7474), PostgreSQL, and Redis using appropriate clients.
  * [X] **Dependency Installation:** Verify all npm packages installed correctly without conflicts or security vulnerabilities.
  * [X] **Build Process:** Test that both backend and frontend can build successfully with `npm run build`.
  * [X] **Development Servers:** Start development servers and verify they run without errors on expected ports.

* [X] **Documentation Verification:** Ensure all setup documentation is accurate and complete.

  * [X] **README Accuracy:** Verify all commands in README work as documented.
  * [X] **Environment Examples:** Test that .env.example files contain all necessary variables.
  * [X] **Makefile Commands:** Test all Makefile commands work correctly and provide helpful output.
  * [X] **Troubleshooting Guide:** Create basic troubleshooting section for common setup issues.

### Next Steps Preparation

* [X] **Development Readiness:** Prepare for next phase of implementation.

  * [X] **Code Quality Tools:** Verify ESLint and TypeScript configurations are working.
  * [X] **Testing Framework:** Ensure Jest (backend) and Vitest (frontend) are properly configured.
  * [X] **Hot Reload:** Verify development servers support hot reload for efficient development.
  * [X] **Team Onboarding:** Test that a new developer can follow the setup instructions successfully.
  * [X] **Phase 2 Prerequisites:** Confirm all requirements for database schema implementation are met.
