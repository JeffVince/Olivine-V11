# CI/CD Pipeline Implementation
## Automated Testing, Building, and Deployment with GitHub Actions

### 1. Pipeline Architecture

#### 1.1 Workflow Structure

**GitHub Actions Workflow Configuration**
```yaml
# .github/workflows/ci-cd.yml
name: Blueprint CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  workflow_dispatch:

env:
  NODE_VERSION: 18.x
  DOCKER_REGISTRY: ghcr.io
  DOCKER_IMAGE_BACKEND: blueprint/backend
  DOCKER_IMAGE_FRONTEND: blueprint/frontend

jobs:
  test:
    name: Run Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'yarn'
          cache-dependency-path: |
            backend/yarn.lock
            frontend/yarn.lock

      - name: Start test databases
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30

      - name: Install backend dependencies
        run: |
          cd backend
          yarn install --frozen-lockfile

      - name: Install frontend dependencies
        run: |
          cd frontend
          yarn install --frozen-lockfile

      - name: Run unit tests
        run: |
          cd backend
          yarn test:unit
          cd ../frontend
          yarn test:unit

      - name: Run integration tests
        run: |
          cd backend
          yarn test:integration

      - name: Run end-to-end tests
        run: |
          cd frontend
          yarn test:e2e

      - name: Run security tests
        run: |
          cd backend
          yarn test:security

      - name: Run performance tests
        run: |
          cd backend
          yarn test:performance

      - name: Stop test databases
        run: |
          docker-compose -f docker-compose.test.yml down

  build:
    name: Build Docker Images
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.DOCKER_REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for backend
        id: meta-backend
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.DOCKER_REGISTRY }}/${{ github.repository_owner }}/${{ env.DOCKER_IMAGE_BACKEND }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-,format=short
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Extract metadata for frontend
        id: meta-frontend
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.DOCKER_REGISTRY }}/${{ github.repository_owner }}/${{ env.DOCKER_IMAGE_FRONTEND }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-,format=short
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push backend image
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta-backend.outputs.tags }}
          labels: ${{ steps.meta-backend.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Build and push frontend image
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta-frontend.outputs.tags }}
          labels: ${{ steps.meta-frontend.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to staging environment
        run: |
          echo "Deploying to staging environment"
          # Deployment commands would go here
          # This might involve updating Kubernetes with new image tags
          # or triggering a deployment script

  deploy-production:
    name: Deploy to Production
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to production environment
        run: |
          echo "Deploying to production environment"
          # Deployment commands would go here
          # This might involve updating Kubernetes with new image tags
          # or triggering a deployment script

      - name: Run database migrations
        run: |
          echo "Running database migrations"
          # Migration commands would go here

      - name: Health check
        run: |
          echo "Performing health check"
          # Health check commands would go here
```

### 2. Testing Pipeline

#### 2.1 Unit Testing Workflow

**Unit Test GitHub Actions Job**
```yaml
# .github/workflows/unit-tests.yml
name: Unit Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  unit-test:
    name: Run Unit Tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
        database: [neo4j, postgres]
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'yarn'

      - name: Start test database
        run: |
          if [ "${{ matrix.database }}" == "neo4j" ]; then
            docker run -d --name neo4j-test -p 7687:7687 -p 7474:7474 neo4j:5.10
          else
            docker run -d --name postgres-test -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:15
          fi
          sleep 30

      - name: Install dependencies
        run: |
          cd backend
          yarn install --frozen-lockfile

      - name: Run unit tests
        run: |
          cd backend
          yarn test:unit

      - name: Generate coverage report
        run: |
          cd backend
          yarn test:coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
```

#### 2.2 Integration Testing Workflow

**Integration Test GitHub Actions Job**
```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  integration-test:
    name: Run Integration Tests
    runs-on: ubuntu-latest
    services:
      neo4j:
        image: neo4j:5.10
        ports:
          - 7687:7687
          - 7474:7474
        options: >-
          --health-cmd "cypher-shell -u neo4j -p neo4j 'RETURN 1'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      postgres:
        image: postgres:15
        ports:
          - 5432:5432
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: blueprint_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'yarn'

      - name: Install dependencies
        run: |
          cd backend
          yarn install --frozen-lockfile

      - name: Run database setup scripts
        run: |
          cd backend
          yarn migrate:test

      - name: Run integration tests
        run: |
          cd backend
          yarn test:integration

      - name: Run API integration tests
        run: |
          cd backend
          yarn test:api
```

#### 2.3 End-to-End Testing Workflow

**E2E Test GitHub Actions Job**
```yaml
# .github/workflows/e2e-tests.yml
name: End-to-End Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  e2e-test:
    name: Run E2E Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'yarn'

      - name: Install frontend dependencies
        run: |
          cd frontend
          yarn install --frozen-lockfile

      - name: Install Playwright browsers
        run: |
          cd frontend
          npx playwright install --with-deps

      - name: Start backend service
        run: |
          cd backend
          yarn start:test &
          sleep 30

      - name: Run E2E tests
        run: |
          cd frontend
          yarn test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: frontend/playwright-report/
          retention-days: 30
```

### 3. Build Pipeline

#### 3.1 Docker Build Configuration

**Backend Dockerfile**
```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on lock file
COPY package.json yarn.lock ./
RUN yarn config set cache-folder /tmp/.yarn-cache
RUN yarn install --frozen-lockfile --production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN yarn build

# Production image, copy all the files and run the application
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 --ingroup nodejs nodejs

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy health check script
COPY --from=builder --chown=nodejs:nodejs /app/scripts/healthcheck.js ./scripts/healthcheck.js

# Set user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node ./scripts/healthcheck.js

# Start the application
CMD ["node", "dist/server.js"]
```

**Frontend Dockerfile**
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on lock file
COPY package.json yarn.lock ./
RUN yarn config set cache-folder /tmp/.yarn-cache
RUN yarn install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN yarn build

# Production image
FROM nginx:alpine AS runner

# Copy built application to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### 3.2 Multi-Stage Build Scripts

**Build Script Implementation**
```bash
#!/bin/bash

# build.sh - Multi-stage build script

# Configuration
REGISTRY=${DOCKER_REGISTRY:-ghcr.io}
REPOSITORY_OWNER=${GITHUB_REPOSITORY_OWNER:-olivine}
BACKEND_IMAGE_NAME=${DOCKER_IMAGE_BACKEND:-blueprint/backend}
FRONTEND_IMAGE_NAME=${DOCKER_IMAGE_FRONTEND:-blueprint/frontend}
TAG=${IMAGE_TAG:-latest}

# Build backend image
echo "Building backend image..."
docker build -t $REGISTRY/$REPOSITORY_OWNER/$BACKEND_IMAGE_NAME:$TAG ./backend

# Build frontend image
echo "Building frontend image..."
docker build -t $REGISTRY/$REPOSITORY_OWNER/$FRONTEND_IMAGE_NAME:$TAG ./frontend

echo "Build completed successfully"
```

### 4. Deployment Pipeline

#### 4.1 Kubernetes Deployment Scripts

**Helm Chart Deployment Script**
```bash
#!/bin/bash

# deploy.sh - Kubernetes deployment script

# Configuration
NAMESPACE=${K8S_NAMESPACE:-blueprint}
RELEASE_NAME=${HELM_RELEASE_NAME:-blueprint}
CHART_PATH=${HELM_CHART_PATH:-./k8s/helm/blueprint}
VALUES_FILE=${HELM_VALUES_FILE:-./k8s/helm/blueprint/values.yaml}

# Function to deploy to Kubernetes
deploy_to_k8s() {
    local environment=$1
    local tag=$2
    
    echo "Deploying to $environment environment with tag $tag..."
    
    # Update image tags in values file
    sed -i "s/tag: latest/tag: $tag/g" $VALUES_FILE
    
    # Deploy using Helm
    helm upgrade --install \
        --namespace $NAMESPACE \
        --create-namespace \
        --values $VALUES_FILE \
        $RELEASE_NAME $CHART_PATH
    
    echo "Deployment to $environment completed"
}

# Function to rollback deployment
rollback_deployment() {
    local revision=$1
    
    echo "Rolling back to revision $revision..."
    helm rollback $RELEASE_NAME $revision --namespace $NAMESPACE
    
    echo "Rollback completed"
}

# Parse command line arguments
if [ "$1" == "rollback" ]; then
    rollback_deployment $2
else
    deploy_to_k8s $1 $2
fi
```

#### 4.2 Database Migration Deployment

**Migration Deployment Script**
```bash
#!/bin/bash

# migrate.sh - Database migration deployment script

# Configuration
BACKEND_SERVICE=${BACKEND_SERVICE:-blueprint-backend}
NAMESPACE=${K8S_NAMESPACE:-blueprint}

# Function to run migrations
run_migrations() {
    local environment=$1
    
    echo "Running database migrations in $environment environment..."
    
    # Create a job to run migrations
    kubectl run migration-job \
        --image=$REGISTRY/$REPOSITORY_OWNER/$BACKEND_IMAGE_NAME:$TAG \
        --namespace=$NAMESPACE \
        --restart=Never \
        --env="NODE_ENV=$environment" \
        --command -- yarn migrate
    
    # Wait for job completion
    kubectl wait --for=condition=complete --timeout=60s job/migration-job --namespace=$NAMESPACE
    
    # Check job status
    local job_status=$(kubectl get job migration-job --namespace=$NAMESPACE -o jsonpath='{.status.conditions[?(@.type=="Complete")].status}')
    
    if [ "$job_status" == "True" ]; then
        echo "Migrations completed successfully"
        kubectl delete job migration-job --namespace=$NAMESPACE
        return 0
    else
        echo "Migrations failed"
        kubectl logs job/migration-job --namespace=$NAMESPACE
        kubectl delete job migration-job --namespace=$NAMESPACE
        return 1
    fi
}

# Run migrations
run_migrations $1
```

### 5. Monitoring and Quality Gates

#### 5.1 Code Quality Checks

**ESLint and Prettier GitHub Actions Job**
```yaml
# .github/workflows/code-quality.yml
name: Code Quality

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  code-quality:
    name: Check Code Quality
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x
          cache: 'yarn'

      - name: Install dependencies
        run: |
          cd backend
          yarn install --frozen-lockfile
          cd ../frontend
          yarn install --frozen-lockfile

      - name: Run ESLint on backend
        run: |
          cd backend
          yarn lint

      - name: Run ESLint on frontend
        run: |
          cd frontend
          yarn lint

      - name: Check Prettier formatting
        run: |
          cd backend
          yarn format:check
          cd ../frontend
          yarn format:check

      - name: Run TypeScript compilation check
        run: |
          cd backend
          yarn build:check
          cd ../frontend
          yarn build:check
```

#### 5.2 Security Scanning

**Security Scanning GitHub Actions Job**
```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday at 2 AM

jobs:
  security-scan:
    name: Run Security Scans
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          command: test
          args: --all-projects

      - name: Run OWASP ZAP scan
        run: |
          echo "Running OWASP ZAP security scan"
          # Implementation would depend on specific setup

      - name: Check for secrets in code
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 5.3 Performance Testing

**Performance Testing GitHub Actions Job**
```yaml
# .github/workflows/performance-test.yml
name: Performance Test

on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM

jobs:
  performance-test:
    name: Run Performance Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18.x

      - name: Install dependencies
        run: |
          cd backend
          yarn install --frozen-lockfile

      - name: Run performance tests
        run: |
          cd backend
          yarn test:performance

      - name: Store performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: backend/performance-results/
```

### 6. Environment Configuration

#### 6.1 Staging Environment Setup

**Staging Deployment Values**
```yaml
# k8s/helm/blueprint/values-staging.yaml
# Staging environment configuration

# Backend configuration
backend:
  image:
    repository: ghcr.io/olivine/blueprint/backend
    tag: staging-latest
    pullPolicy: Always
  
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "200m"
  
  env:
    NODE_ENV: staging
    LOG_LEVEL: debug

# Frontend configuration
frontend:
  image:
    repository: ghcr.io/olivine/blueprint/frontend
    tag: staging-latest
    pullPolicy: Always
  
  resources:
    requests:
      memory: "128Mi"
      cpu: "50m"
    limits:
      memory: "256Mi"
      cpu: "100m"

# Database configuration
neo4j:
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
  
  persistence:
    enabled: true
    size: 10Gi

postgres:
  resources:
    requests:
      memory: "256Mi"
      cpu: "200m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  
  persistence:
    enabled: true
    size: 5Gi

redis:
  resources:
    requests:
      memory: "128Mi"
      cpu: "100m"
    limits:
      memory: "256Mi"
      cpu: "200m"
```

#### 6.2 Production Environment Setup

**Production Deployment Values**
```yaml
# k8s/helm/blueprint/values-production.yaml
# Production environment configuration

# Backend configuration
backend:
  image:
    repository: ghcr.io/olivine/blueprint/backend
    tag: latest
    pullPolicy: Always
  
  replicas: 3
  
  resources:
    requests:
      memory: "512Mi"
      cpu: "200m"
    limits:
      memory: "1Gi"
      cpu: "500m"
  
  env:
    NODE_ENV: production
    LOG_LEVEL: info

  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80

# Frontend configuration
frontend:
  image:
    repository: ghcr.io/olivine/blueprint/frontend
    tag: latest
    pullPolicy: Always
  
  replicas: 3
  
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "200m"

  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 10
    targetCPUUtilizationPercentage: 80

# Database configuration
neo4j:
  resources:
    requests:
      memory: "4Gi"
      cpu: "2000m"
    limits:
      memory: "8Gi"
      cpu: "4000m"
  
  persistence:
    enabled: true
    size: 100Gi

postgres:
  resources:
    requests:
      memory: "1Gi"
      cpu: "500m"
    limits:
      memory: "2Gi"
      cpu: "1000m"
  
  persistence:
    enabled: true
    size: 50Gi

redis:
  resources:
    requests:
      memory: "512Mi"
      cpu: "200m"
    limits:
      memory: "1Gi"
      cpu: "500m"

# Ingress configuration
ingress:
  enabled: true
  hosts:
    - host: blueprint.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: blueprint-tls
      hosts:
        - blueprint.example.com
```

This CI/CD pipeline implementation provides a comprehensive automated workflow for testing, building, and deploying the Blueprint system. It includes multi-stage builds, environment-specific configurations, quality gates, security scanning, and performance testing to ensure reliable and secure deployments.
