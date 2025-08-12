# Deployment and Infrastructure Implementation
## Docker, Kubernetes, and CI/CD Pipeline Configuration

### 1. Containerization Strategy

#### 1.1 Docker Implementation

**Multi-Stage Dockerfile for Backend Services**
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN yarn build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built files from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/yarn.lock ./yarn.lock

# Install production dependencies only
RUN yarn install --frozen-lockfile --production

# Expose port
EXPOSE 4000

# Set user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "dist/server.js"]
```

**Dockerfile for Frontend Application**
```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build for production
RUN yarn build

# Production stage
FROM nginx:alpine AS production

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

#### 1.2 Docker Compose Configuration

**Development Environment Docker Compose**
```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5-enterprise
    container_name: blueprint-neo4j
    environment:
      - NEO4J_AUTH=neo4j/password
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
    ports:
      - "7474:7474"  # HTTP browser
      - "7687:7687"  # Bolt protocol
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - ./neo4j/plugins:/plugins

  postgres:
    image: supabase/postgres:15.1.0
    container_name: blueprint-postgres
    environment:
      - POSTGRES_DB=blueprint
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_PORT=5432
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    container_name: blueprint-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: blueprint-backend
    environment:
      - NODE_ENV=development
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=password
      - POSTGRES_URI=postgresql://postgres:password@postgres:5432/blueprint
      - REDIS_URL=redis://redis:6379
    ports:
      - "4000:4000"
    depends_on:
      - neo4j
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: blueprint-frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  neo4j_data:
  neo4j_logs:
  postgres_data:
  redis_data:
```

**Production Environment Docker Compose**
```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5-enterprise
    container_name: blueprint-neo4j-prod
    environment:
      - NEO4J_AUTH=${NEO4J_USER}/${NEO4J_PASSWORD}
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_ACCEPT_LICENSE_AGREEMENT=yes
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - /var/lib/neo4j/data:/data
      - /var/lib/neo4j/logs:/logs
      - /var/lib/neo4j/plugins:/plugins
    restart: unless-stopped

  postgres:
    image: supabase/postgres:15.1.0
    container_name: blueprint-postgres-prod
    environment:
      - POSTGRES_DB=blueprint
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_PORT=5432
    ports:
      - "5432:5432"
    volumes:
      - /var/lib/postgresql/data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: blueprint-redis-prod
    ports:
      - "6379:6379"
    volumes:
      - /var/lib/redis/data:/data
    restart: unless-stopped

  backend:
    image: ${DOCKER_REGISTRY}/blueprint-backend:${IMAGE_TAG}
    container_name: blueprint-backend-prod
    environment:
      - NODE_ENV=production
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=${NEO4J_USER}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - POSTGRES_URI=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/blueprint
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - DROPBOX_APP_KEY=${DROPBOX_APP_KEY}
      - DROPBOX_APP_SECRET=${DROPBOX_APP_SECRET}
      - GOOGLE_DRIVE_CLIENT_ID=${GOOGLE_DRIVE_CLIENT_ID}
      - GOOGLE_DRIVE_CLIENT_SECRET=${GOOGLE_DRIVE_CLIENT_SECRET}
    ports:
      - "4000:4000"
    depends_on:
      - neo4j
      - postgres
      - redis
    restart: unless-stopped

  frontend:
    image: ${DOCKER_REGISTRY}/blueprint-frontend:${IMAGE_TAG}
    container_name: blueprint-frontend-prod
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    container_name: blueprint-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - /var/log/nginx:/var/log/nginx
    depends_on:
      - frontend
    restart: unless-stopped
```

### 2. Kubernetes Deployment Configuration

#### 2.1 Helm Chart Structure

**Chart.yaml**
```yaml
apiVersion: v2
name: blueprint
description: A unified, versioned knowledge layer for creative production
type: application
version: 1.0.0
appVersion: "1.0.0"
```

**values.yaml**
```yaml
# Default values for blueprint application

# Global configuration
global:
  imageRegistry: ""
  imageTag: "latest"
  neo4j:
    user: "neo4j"
    password: "password"
  postgres:
    user: "postgres"
    password: "password"
    database: "blueprint"

# Neo4j configuration
neo4j:
  enabled: true
  image:
    repository: neo4j
    tag: 5-enterprise
    pullPolicy: IfNotPresent
  auth:
    enabled: true
  resources:
    requests:
      memory: "2Gi"
      cpu: "1"
    limits:
      memory: "4Gi"
      cpu: "2"
  persistence:
    enabled: true
    size: 50Gi
  plugins:
    - apoc
    - graph-data-science

# PostgreSQL configuration
postgres:
  enabled: true
  image:
    repository: supabase/postgres
    tag: 15.1.0
    pullPolicy: IfNotPresent
  resources:
    requests:
      memory: "512Mi"
      cpu: "0.5"
    limits:
      memory: "1Gi"
      cpu: "1"
  persistence:
    enabled: true
    size: 20Gi

# Redis configuration
redis:
  enabled: true
  image:
    repository: redis
    tag: 7-alpine
    pullPolicy: IfNotPresent
  resources:
    requests:
      memory: "128Mi"
      cpu: "0.1"
    limits:
      memory: "256Mi"
      cpu: "0.5"
  persistence:
    enabled: true
    size: 5Gi

# Backend service configuration
backend:
  enabled: true
  image:
    repository: blueprint-backend
    pullPolicy: IfNotPresent
  replicas: 3
  service:
    type: ClusterIP
    port: 4000
  resources:
    requests:
      memory: "512Mi"
      cpu: "0.5"
    limits:
      memory: "1Gi"
      cpu: "1"
  env:
    NODE_ENV: production
  secrets:
    jwtSecret: ""
    dropboxAppKey: ""
    dropboxAppSecret: ""
    googleDriveClientId: ""
    googleDriveClientSecret: ""

# Frontend service configuration
frontend:
  enabled: true
  image:
    repository: blueprint-frontend
    pullPolicy: IfNotPresent
  replicas: 3
  service:
    type: ClusterIP
    port: 80
  resources:
    requests:
      memory: "128Mi"
      cpu: "0.1"
    limits:
      memory: "256Mi"
      cpu: "0.5"

# Ingress configuration
ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
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

#### 2.2 Kubernetes Manifests

**Neo4j Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blueprint-neo4j
  labels:
    app: blueprint-neo4j
spec:
  replicas: 1
  selector:
    matchLabels:
      app: blueprint-neo4j
  template:
    metadata:
      labels:
        app: blueprint-neo4j
    spec:
      containers:
      - name: neo4j
        image: neo4j:5-enterprise
        ports:
        - containerPort: 7474
        - containerPort: 7687
        env:
        - name: NEO4J_AUTH
          value: neo4j/password
        - name: NEO4J_PLUGINS
          value: '["apoc", "graph-data-science"]'
        - name: NEO4J_ACCEPT_LICENSE_AGREEMENT
          value: "yes"
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        volumeMounts:
        - name: neo4j-data
          mountPath: /data
        - name: neo4j-plugins
          mountPath: /plugins
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "wget -q --spider http://localhost:7474"
          initialDelaySeconds: 120
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "wget -q --spider http://localhost:7474"
          initialDelaySeconds: 60
          periodSeconds: 5
      volumes:
      - name: neo4j-data
        persistentVolumeClaim:
          claimName: neo4j-pvc
      - name: neo4j-plugins
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: blueprint-neo4j
spec:
  selector:
    app: blueprint-neo4j
  ports:
  - name: browser
    port: 7474
    targetPort: 7474
  - name: bolt
    port: 7687
    targetPort: 7687
  type: ClusterIP
```

**Backend Service Deployment**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blueprint-backend
  labels:
    app: blueprint-backend
spec:
  replicas: {{ .Values.backend.replicas }}
  selector:
    matchLabels:
      app: blueprint-backend
  template:
    metadata:
      labels:
        app: blueprint-backend
    spec:
      containers:
      - name: backend
        image: "{{ .Values.global.imageRegistry }}/{{ .Values.backend.image.repository }}:{{ .Values.global.imageTag }}"
        ports:
        - containerPort: {{ .Values.backend.service.port }}
        env:
        - name: NODE_ENV
          value: {{ .Values.backend.env.NODE_ENV | quote }}
        - name: NEO4J_URI
          value: "bolt://blueprint-neo4j:7687"
        - name: NEO4J_USER
          value: {{ .Values.global.neo4j.user | quote }}
        - name: NEO4J_PASSWORD
          valueFrom:
            secretKeyRef:
              name: blueprint-secrets
              key: neo4j-password
        - name: POSTGRES_URI
          value: "postgresql://{{ .Values.global.postgres.user }}:{{ .Values.global.postgres.password }}@blueprint-postgres:5432/{{ .Values.global.postgres.database }}"
        - name: REDIS_URL
          value: "redis://blueprint-redis:6379"
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: blueprint-secrets
              key: jwt-secret
        resources:
          requests:
            memory: {{ .Values.backend.resources.requests.memory }}
            cpu: {{ .Values.backend.resources.requests.cpu }}
          limits:
            memory: {{ .Values.backend.resources.limits.memory }}
            cpu: {{ .Values.backend.resources.limits.cpu }}
        livenessProbe:
          httpGet:
            path: /health
            port: {{ .Values.backend.service.port }}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: {{ .Values.backend.service.port }}
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: blueprint-backend
spec:
  selector:
    app: blueprint-backend
  ports:
  - port: {{ .Values.backend.service.port }}
    targetPort: {{ .Values.backend.service.port }}
  type: {{ .Values.backend.service.type }}
```

### 3. CI/CD Pipeline Implementation

#### 3.1 GitHub Actions Workflow

**Main CI/CD Pipeline**
```yaml
name: Blueprint CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  DOCKER_REGISTRY: ghcr.io
  IMAGE_TAG: ${{ github.sha }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'yarn'
        cache-dependency-path: backend/yarn.lock
    
    - name: Install dependencies
      run: yarn install --frozen-lockfile
    
    - name: Run unit tests
      run: yarn test:unit
    
    - name: Run integration tests
      run: yarn test:integration
      env:
        NEO4J_TEST_URI: bolt://localhost:7687
        NEO4J_TEST_USER: neo4j
        NEO4J_TEST_PASSWORD: password
    
    - name: Run security tests
      run: yarn test:security

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Login to GitHub Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.DOCKER_REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Build and push backend image
      uses: docker/build-push-action@v4
      with:
        context: ./backend
        push: true
        tags: ${{ env.DOCKER_REGISTRY }}/${{ github.repository_owner }}/blueprint-backend:${{ env.IMAGE_TAG }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
    
    - name: Build and push frontend image
      uses: docker/build-push-action@v4
      with:
        context: ./frontend
        push: true
        tags: ${{ env.DOCKER_REGISTRY }}/${{ github.repository_owner }}/blueprint-frontend:${{ env.IMAGE_TAG }}
        cache-from: type=gha
        cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Kubernetes
      run: |
        # Set up kubectl with cluster credentials
        echo "${{ secrets.KUBECONFIG }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
        
        # Update deployment with new image tag
        helm upgrade blueprint ./helm \
          --set global.imageTag=${{ env.IMAGE_TAG }} \
          --set global.imageRegistry=${{ env.DOCKER_REGISTRY }} \
          --install
        
        # Wait for deployment to complete
        kubectl rollout status deployment/blueprint-backend
        kubectl rollout status deployment/blueprint-frontend
```

#### 3.2 Deployment Scripts

**Helm Deployment Script**
```bash
#!/bin/bash

# deploy.sh - Deploy Blueprint application using Helm

set -e

# Configuration
NAMESPACE=${NAMESPACE:-blueprint}
RELEASE_NAME=${RELEASE_NAME:-blueprint}
CHART_PATH=${CHART_PATH:-./helm}
VALUES_FILE=${VALUES_FILE:-./helm/values.yaml}

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE || true

# Deploy or upgrade the Helm release
helm upgrade $RELEASE_NAME $CHART_PATH \
  --namespace $NAMESPACE \
  --values $VALUES_FILE \
  --set global.imageTag=$(git rev-parse HEAD) \
  --set global.imageRegistry=$DOCKER_REGISTRY \
  --install \
  --wait

echo "Deployment completed successfully!"
```

**Database Migration Script**
```bash
#!/bin/bash

# migrate.sh - Run database migrations

set -e

echo "Running Neo4j schema migrations..."

# Apply Neo4j constraints and indexes
node ./scripts/migrate-neo4j.js

echo "Running PostgreSQL schema migrations..."

# Apply PostgreSQL schema changes
yarn migrate:postgres

echo "Database migrations completed!"
```

### 4. Monitoring and Observability

#### 4.1 Health Check Implementation

**Backend Health Check**
```javascript
// healthcheck.js
const neo4j = require('neo4j-driver');
const { Client } = require('pg');

async function checkNeo4jHealth() {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  try {
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    return true;
  } catch (error) {
    console.error('Neo4j health check failed:', error);
    return false;
  } finally {
    await driver.close();
  }
}

async function checkPostgresHealth() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URI
  });
  
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
    return false;
  } finally {
    await client.end();
  }
}

async function checkRedisHealth() {
  const redis = require('redis');
  const client = redis.createClient({ url: process.env.REDIS_URL });
  
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis health check failed:', error);
    return false;
  } finally {
    await client.disconnect();
  }
}

async function performHealthCheck() {
  const checks = [
    { name: 'Neo4j', check: checkNeo4jHealth },
    { name: 'PostgreSQL', check: checkPostgresHealth },
    { name: 'Redis', check: checkRedisHealth }
  ];
  
  const results = await Promise.all(
    checks.map(async ({ name, check }) => {
      try {
        const healthy = await check();
        return { name, healthy, error: healthy ? null : 'Health check failed' };
      } catch (error) {
        return { name, healthy: false, error: error.message };
      }
    })
  );
  
  const allHealthy = results.every(result => result.healthy);
  
  if (allHealthy) {
    console.log('All services healthy');
    process.exit(0);
  } else {
    console.error('Some services unhealthy:', results);
    process.exit(1);
  }
}

performHealthCheck();
```

#### 4.2 Monitoring Configuration

**Prometheus Metrics Endpoint**
```typescript
import express from 'express';
import client from 'prom-client';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'blueprint-backend'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const fileProcessingDuration = new client.Histogram({
  name: 'blueprint_file_processing_duration_seconds',
  help: 'Duration of file processing operations',
  labelNames: ['operation', 'provider']
});

const classificationAccuracy = new client.Gauge({
  name: 'blueprint_classification_accuracy',
  help: 'Accuracy of file classification',
  labelNames: ['org_id']
});

const tenantIsolationViolations = new client.Counter({
  name: 'blueprint_tenant_isolation_violations_total',
  help: 'Number of tenant isolation violations detected',
  labelNames: ['org_id']
});

// Register metrics
register.registerMetric(fileProcessingDuration);
register.registerMetric(classificationAccuracy);
register.registerMetric(tenantIsolationViolations);

const app = express();

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

export {
  fileProcessingDuration,
  classificationAccuracy,
  tenantIsolationViolations
};
```

This deployment and infrastructure implementation provides a comprehensive containerization strategy with Docker and Kubernetes configurations, CI/CD pipeline using GitHub Actions, and monitoring setup for observability. The system is designed for scalability, security, and maintainability in production environments.
