# Olivine Development Makefile
# Standardized commands for common development tasks

# Default target
.PHONY: help
help:
	@echo "Olivine Development Commands"
	@echo "============================"
	@echo "setup     - Set up the development environment"
	@echo "start     - Start all development services"
	@echo "stop      - Stop all development services"
	@echo "restart   - Restart all development services"
	@echo "status    - Check status of development services"
	@echo "logs      - View logs for all services"
	@echo "test      - Run all test suites"
	@echo "clean     - Clean up development environment"
	@echo "build     - Build all services"
	@echo "install   - Install all dependencies"

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

# Start all development services
.PHONY: start
start:
	@echo "Starting all Olivine development services..."
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

# Run all test suites
.PHONY: test
test:
	@echo "Running all Olivine test suites..."
	@echo "Running backend tests..."
	cd backend && npm run test
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

# Install all dependencies
.PHONY: install
install:
	@echo "Installing all Olivine dependencies..."
	cd backend && npm install
	cd frontend && npm install
	@echo "Dependencies installed successfully!"