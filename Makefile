# Olivine Development Makefile
# Standardized commands for common development tasks

# Default target
.PHONY: help
help:
	@echo "Olivine Development Commands"
	@echo "============================"
	@echo "setup        - Set up the development environment"
	@echo "start        - Start all development services"
	@echo "start-infra  - Start only infrastructure services (neo4j, postgres, redis)"
	@echo "start-dev    - Start services in development mode (skip builds)"
	@echo "stop         - Stop all development services"
	@echo "restart      - Restart all development services"
	@echo "status       - Check status of development services"
	@echo "logs         - View logs for all services"
	@echo "logs-backend - View logs for backend service only"
	@echo "logs-frontend- View logs for frontend service only"
	@echo "test         - Run all test suites"
	@echo "test-backend - Run backend tests only"
	@echo "test-frontend- Run frontend tests only"
	@echo "clean        - Clean up development environment"
	@echo "build        - Build all services"
	@echo "build-backend- Build backend only"
	@echo "build-frontend- Build frontend only"
	@echo "install      - Install all dependencies"
	@echo "check        - Check for common issues"
	@echo "fix-deps     - Fix missing dependencies"

# Setup the development environment
.PHONY: setup
setup:
	@echo "Setting up Olivine development environment..."
	@echo "Starting Docker services..."
	docker-compose up -d neo4j postgres redis
	@echo "Waiting for databases to be ready..."
	@echo "Neo4j: Waiting for HTTP interface to be available..."
	until docker-compose exec neo4j wget --quiet --tries=1 --spider http://localhost:7474 2>&1 | grep -q "200 OK"; do \
		echo "Neo4j: Still waiting..."; \
		sleep 5; \
	done
	@echo "PostgreSQL: Waiting for database to be ready..."
	until docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do \
		echo "PostgreSQL: Still waiting..."; \
		sleep 5; \
	done
	@echo "Redis: Waiting for service to be ready..."
	until docker-compose exec redis redis-cli ping > /dev/null 2>&1; do \
		echo "Redis: Still waiting..."; \
		sleep 5; \
	done
	@echo "Installing backend dependencies..."
	cd backend && npm install
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Running initial database migrations..."
	# Add migration commands here when ready
	@echo "Development environment setup complete!"
	@echo "Access URLs:"
	@echo "- Neo4j Browser: http://localhost:7474"
	@echo "- Backend API: http://localhost:8080"
	@echo "- Frontend App: http://localhost:3000"

# Start infrastructure services only (useful when backend/frontend have build issues)
.PHONY: start-infra
start-infra:
	@echo "Starting infrastructure services..."
	docker-compose up -d neo4j postgres redis
	@echo "Infrastructure services started successfully!"
	@echo "Access URLs:"
	@echo "- Neo4j Browser: http://localhost:7474"
	@echo "- PostgreSQL: localhost:5432"
	@echo "- Redis: localhost:6379"

# Start services in development mode (skip builds if they fail)
.PHONY: start-dev
start-dev:
	@echo "Starting services in development mode..."
	@echo "First, ensuring infrastructure is running..."
	docker-compose up -d neo4j postgres redis
	@echo "Infrastructure ready. You can now:"
	@echo "1. Run 'cd backend && npm run dev' for backend development"
	@echo "2. Run 'cd frontend && npm run dev' for frontend development"
	@echo "3. Or fix build issues and run 'make start' for full deployment"

# Start all development services
.PHONY: start
start:
	@echo "Starting all Olivine development services..."
	@echo "Note: This will build all services. If builds fail, use 'make start-infra' instead."
	docker-compose up -d
	@echo "Services started successfully!"
	@echo "Access URLs:"
	@echo "- Neo4j Browser: http://localhost:7474"
	@echo "- Backend API: http://localhost:8080"
	@echo "- Frontend App: http://localhost:3000"

# Stop all development services
.PHONY: stop
stop:
	@echo "Stopping all Olivine development services..."
	docker-compose stop
	@echo "Services stopped successfully!"

# Restart all development services
.PHONY: restart
restart:
	@echo "Restarting all Olivine development services..."
	docker-compose restart
	@echo "Services restarted successfully!"

# Check status of development services
.PHONY: status
status:
	@echo "Checking Olivine development services status..."
	docker-compose ps

# View logs for all services
.PHONY: logs
logs:
	@echo "Viewing Olivine development services logs..."
	docker-compose logs -f

# View logs for backend service only
.PHONY: logs-backend
logs-backend:
	@echo "Viewing backend service logs..."
	docker-compose logs -f backend

# View logs for frontend service only
.PHONY: logs-frontend
logs-frontend:
	@echo "Viewing frontend service logs..."
	docker-compose logs -f frontend

# Run all test suites
.PHONY: test
test:
	@echo "Running all Olivine test suites..."
	@echo "Running backend tests..."
	cd backend && npm run test
	@echo "Running frontend tests..."
	cd frontend && npm run test

# Run backend tests only
.PHONY: test-backend
test-backend:
	@echo "Running backend tests..."
	cd backend && npm run test

# Run frontend tests only
.PHONY: test-frontend
test-frontend:
	@echo "Running frontend tests..."
	cd frontend && npm run test

# Clean up development environment
.PHONY: clean
clean:
	@echo "Cleaning up Olivine development environment..."
	docker-compose down -v
	rm -rf backend/node_modules
	rm -rf frontend/node_modules
	rm -rf backend/dist
	rm -rf frontend/dist
	@echo "Development environment cleaned successfully!"

# Build all services
.PHONY: build
build:
	@echo "Building all Olivine services..."
	cd backend && npm run build
	cd frontend && npm run build
	@echo "Services built successfully!"

# Build backend only
.PHONY: build-backend
build-backend:
	@echo "Building backend service..."
	cd backend && npm run build
	@echo "Backend built successfully!"

# Build frontend only
.PHONY: build-frontend
build-frontend:
	@echo "Building frontend service..."
	cd frontend && npm run build
	@echo "Frontend built successfully!"

# Install all dependencies
.PHONY: install
install:
	@echo "Installing all Olivine dependencies..."
	cd backend && npm install
	cd frontend && npm install
	@echo "Dependencies installed successfully!"

# Check for common issues
.PHONY: check
check:
	@echo "Checking for common issues..."
	@echo "Checking if Docker is running..."
	@docker --version || echo "ERROR: Docker is not installed or running"
	@docker-compose --version || echo "ERROR: Docker Compose is not installed"
	@echo "Checking if node_modules exist..."
	@test -d backend/node_modules || echo "WARNING: backend/node_modules missing - run 'make install'"
	@test -d frontend/node_modules || echo "WARNING: frontend/node_modules missing - run 'make install'"
	@echo "Checking TypeScript compilation..."
	@cd backend && npx tsc --noEmit --skipLibCheck || echo "ERROR: Backend has TypeScript errors"
	@cd frontend && npx vue-tsc --noEmit --skipLibCheck || echo "ERROR: Frontend has TypeScript errors"
	@echo "Check complete!"

# Fix missing dependencies (adds commonly missing packages)
.PHONY: fix-deps
fix-deps:
	@echo "Fixing missing dependencies..."
	@echo "Installing missing backend dependencies..."
	cd backend && npm install @apollo/server graphql-ws ws
	@echo "Installing missing dev dependencies..."
	cd backend && npm install --save-dev @types/cors @types/express @types/jsonwebtoken @types/multer @types/uuid @types/ws
	@echo "Installing frontend missing dependencies..."
	cd frontend && npm install --save-dev @types/apollo__client || echo "Frontend deps already installed"
	@echo "Dependencies fixed! Try building again with 'make build-backend'"