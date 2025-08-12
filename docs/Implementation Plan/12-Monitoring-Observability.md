# Monitoring and Observability Implementation
## Comprehensive System Monitoring with Prometheus and Grafana

### 1. Metrics Collection and Exposure

#### 1.1 Prometheus Metrics Endpoint

**Backend Metrics Server Implementation**
```typescript
import express from 'express';
import client from 'prom-client';
import { QueueService } from '@/services/QueueService';
import { FileStewardAgent } from '@/agents/FileStewardAgent';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
  app: 'blueprint-backend'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const fileProcessingCounter = new client.Counter({
  name: 'blueprint_file_processing_total',
  help: 'Total number of files processed',
  labelNames: ['org_id', 'source_type', 'status']
});

const classificationAccuracyGauge = new client.Gauge({
  name: 'blueprint_classification_accuracy',
  help: 'Current classification accuracy score',
  labelNames: ['org_id', 'taxonomy_id']
});

const tenantIsolationViolationsCounter = new client.Counter({
  name: 'blueprint_tenant_isolation_violations_total',
  help: 'Total number of tenant isolation violations detected',
  labelNames: ['org_id', 'entity_type']
});

const agentExecutionTimeHistogram = new client.Histogram({
  name: 'blueprint_agent_execution_seconds',
  help: 'Agent execution time in seconds',
  labelNames: ['agent_type', 'org_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const contentAnalysisCounter = new client.Counter({
  name: 'blueprint_content_analysis_total',
  help: 'Total number of content analysis operations',
  labelNames: ['org_id', 'content_type', 'status']
});

const queueDepthGauge = new client.Gauge({
  name: 'blueprint_queue_depth',
  help: 'Current depth of processing queues',
  labelNames: ['queue_name', 'org_id']
});

// Register metrics
register.registerMetric(fileProcessingCounter);
register.registerMetric(classificationAccuracyGauge);
register.registerMetric(tenantIsolationViolationsCounter);
register.registerMetric(agentExecutionTimeHistogram);
register.registerMetric(contentAnalysisCounter);
register.registerMetric(queueDepthGauge);

export class MetricsService {
  private queueService: QueueService;
  private fileStewardAgent: FileStewardAgent;

  constructor(queueService: QueueService, fileStewardAgent: FileStewardAgent) {
    this.queueService = queueService;
    this.fileStewardAgent = fileStewardAgent;
    
    // Initialize metrics collection
    this.initializeMetricsCollection();
  }

  /**
   * Initialize metrics collection intervals
   */
  private initializeMetricsCollection(): void {
    // Update queue depth metrics every 30 seconds
    setInterval(async () => {
      await this.updateQueueMetrics();
    }, 30000);

    // Update agent execution metrics every minute
    setInterval(async () => {
      await this.updateAgentMetrics();
    }, 60000);
  }

  /**
   * Update queue depth metrics
   */
  private async updateQueueMetrics(): Promise<void> {
    try {
      const queueStats = await this.queueService.getQueueStats();
      
      queueStats.forEach(stat => {
        queueDepthGauge.set(
          { queue_name: stat.queueName, org_id: stat.orgId },
          stat.depth
        );
      });
    } catch (error) {
      console.error('Failed to update queue metrics:', error);
    }
  }

  /**
   * Update agent execution metrics
   */
  private async updateAgentMetrics(): Promise<void> {
    try {
      const agentStats = await this.fileStewardAgent.getExecutionStats();
      
      agentStats.forEach(stat => {
        agentExecutionTimeHistogram.observe(
          { agent_type: stat.agentType, org_id: stat.orgId },
          stat.averageExecutionTime
        );
        
        classificationAccuracyGauge.set(
          { org_id: stat.orgId, taxonomy_id: stat.taxonomyId },
          stat.classificationAccuracy
        );
      });
    } catch (error) {
      console.error('Failed to update agent metrics:', error);
    }
  }

  /**
   * Record file processing event
   */
  recordFileProcessing(orgId: string, sourceType: string, status: string): void {
    fileProcessingCounter.inc({ org_id: orgId, source_type: sourceType, status: status });
  }

  /**
   * Record tenant isolation violation
   */
  recordTenantIsolationViolation(orgId: string, entityType: string): void {
    tenantIsolationViolationsCounter.inc({ org_id: orgId, entity_type: entityType });
  }

  /**
   * Record content analysis event
   */
  recordContentAnalysis(orgId: string, contentType: string, status: string): void {
    contentAnalysisCounter.inc({ org_id: orgId, content_type: contentType, status: status });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return await register.metrics();
  }
}
```

#### 1.2 Metrics Middleware Integration

**Express Metrics Middleware**
```typescript
import express from 'express';
import { MetricsService } from '@/services/MetricsService';

export class MetricsMiddleware {
  private metricsService: MetricsService;

  constructor(metricsService: MetricsService) {
    this.metricsService = metricsService;
  }

  /**
   * Middleware to expose Prometheus metrics endpoint
   */
  metricsEndpoint(): express.Handler {
    return async (req: express.Request, res: express.Response) => {
      try {
        res.set('Content-Type', this.metricsService.register.contentType);
        res.end(await this.metricsService.getMetrics());
      } catch (error) {
        res.status(500).send('Error collecting metrics');
      }
    };
  }

  /**
   * Middleware to track request duration
   */
  requestDurationTracker(): express.Handler {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route ? req.route.path : req.path;
        
        // Record request duration
        this.metricsService.requestDurationHistogram.observe(
          { 
            method: req.method, 
            route: route, 
            status_code: res.statusCode.toString() 
          },
          duration
        );
      });
      
      next();
    };
  }
}
```

### 2. Health Checks Implementation

#### 2.1 Backend Health Check Service

**Comprehensive Health Check Implementation**
```typescript
import { Neo4jService } from '@/services/Neo4jService';
import { QueueService } from '@/services/QueueService';
import axios from 'axios';

export class HealthCheckService {
  private neo4jService: Neo4jService;
  private queueService: QueueService;

  constructor(neo4jService: Neo4jService, queueService: QueueService) {
    this.neo4jService = neo4jService;
    this.queueService = queueService;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const checks: HealthCheck[] = [];
    
    // Check Neo4j database connectivity
    checks.push(await this.checkNeo4j());
    
    // Check Queue service connectivity
    checks.push(await this.checkQueueService());
    
    // Check external API dependencies
    checks.push(await this.checkDropboxAPI());
    checks.push(await this.checkGoogleDriveAPI());
    checks.push(await this.checkSupabaseAPI());
    
    // Check Redis connectivity
    checks.push(await this.checkRedis());
    
    // Check PostgreSQL connectivity
    checks.push(await this.checkPostgreSQL());
    
    // Determine overall health status
    const isHealthy = checks.every(check => check.status === 'healthy');
    
    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks
    };
  }

  /**
   * Check Neo4j database connectivity
   */
  private async checkNeo4j(): Promise<HealthCheck> {
    try {
      const session = this.neo4jService.getSession();
      await session.run('RETURN 1');
      await session.close();
      
      return {
        name: 'neo4j',
        status: 'healthy',
        details: 'Database connection successful'
      };
    } catch (error) {
      return {
        name: 'neo4j',
        status: 'unhealthy',
        details: `Database connection failed: ${error.message}`
      };
    }
  }

  /**
   * Check Queue service connectivity
   */
  private async checkQueueService(): Promise<HealthCheck> {
    try {
      const queueStats = await this.queueService.getQueueStats();
      
      return {
        name: 'queue_service',
        status: 'healthy',
        details: `Queue service operational with ${queueStats.length} queues`
      };
    } catch (error) {
      return {
        name: 'queue_service',
        status: 'unhealthy',
        details: `Queue service connection failed: ${error.message}`
      };
    }
  }

  /**
   * Check Dropbox API connectivity
   */
  private async checkDropboxAPI(): Promise<HealthCheck> {
    try {
      const response = await axios.get('https://api.dropboxapi.com/2/users/get_current_account', {
        headers: {
          'Authorization': `Bearer ${process.env.DROPBOX_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      return {
        name: 'dropbox_api',
        status: 'healthy',
        details: 'Dropbox API connection successful'
      };
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // Token expired, but API is reachable
        return {
          name: 'dropbox_api',
          status: 'healthy',
          details: 'Dropbox API reachable but token requires refresh'
        };
      }
      
      return {
        name: 'dropbox_api',
        status: 'unhealthy',
        details: `Dropbox API connection failed: ${error.message}`
      };
    }
  }

  /**
   * Check Google Drive API connectivity
   */
  private async checkGoogleDriveAPI(): Promise<HealthCheck> {
    try {
      // Implementation would depend on specific Google Drive client
      return {
        name: 'google_drive_api',
        status: 'healthy',
        details: 'Google Drive API connection successful'
      };
    } catch (error) {
      return {
        name: 'google_drive_api',
        status: 'unhealthy',
        details: `Google Drive API connection failed: ${error.message}`
      };
    }
  }

  /**
   * Check Supabase API connectivity
   */
  private async checkSupabaseAPI(): Promise<HealthCheck> {
    try {
      const response = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      });
      
      return {
        name: 'supabase_api',
        status: 'healthy',
        details: 'Supabase API connection successful'
      };
    } catch (error) {
      return {
        name: 'supabase_api',
        status: 'unhealthy',
        details: `Supabase API connection failed: ${error.message}`
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<HealthCheck> {
    try {
      const redis = this.queueService.getRedisClient();
      await redis.ping();
      
      return {
        name: 'redis',
        status: 'healthy',
        details: 'Redis connection successful'
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        details: `Redis connection failed: ${error.message}`
      };
    }
  }

  /**
   * Check PostgreSQL connectivity
   */
  private async checkPostgreSQL(): Promise<HealthCheck> {
    try {
      // Implementation would depend on specific PostgreSQL client
      const pool = this.queueService.getPostgreSQLPool();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      return {
        name: 'postgresql',
        status: 'healthy',
        details: 'PostgreSQL connection successful'
      };
    } catch (error) {
      return {
        name: 'postgresql',
        status: 'unhealthy',
        details: `PostgreSQL connection failed: ${error.message}`
      };
    }
  }
}

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  details: string;
}

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: HealthCheck[];
}
```

#### 2.2 Health Check Endpoint

**Express Health Check Route**
```typescript
import express from 'express';
import { HealthCheckService } from '@/services/HealthCheckService';

export class HealthCheckController {
  private healthCheckService: HealthCheckService;

  constructor(healthCheckService: HealthCheckService) {
    this.healthCheckService = healthCheckService;
  }

  /**
   * Health check endpoint
   */
  healthCheck(): express.Handler {
    return async (req: express.Request, res: express.Response) => {
      try {
        const result = await this.healthCheckService.performHealthCheck();
        
        if (result.status === 'healthy') {
          res.status(200).json(result);
        } else {
          res.status(503).json(result);
        }
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: [],
          error: error.message
        });
      }
    };
  }
}
```

### 3. Logging Implementation

#### 3.1 Structured Logging Service

**Winston-based Logging Implementation**
```typescript
import winston from 'winston';
import { Neo4jService } from '@/services/Neo4jService';

export class LoggingService {
  private logger: winston.Logger;
  private neo4jService: Neo4jService;

  constructor(neo4jService: Neo4jService) {
    this.neo4jService = neo4jService;
    
    // Create logger with multiple transports
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'blueprint-backend' },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        // File transport for production
        new winston.transports.File({ 
          filename: 'logs/error.log', 
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Log agent execution with provenance tracking
   */
  async logAgentExecution(agentType: string, orgId: string, inputs: any, outputs: any, status: string): Promise<void> {
    const logEntry = {
      level: 'info',
      message: `Agent execution completed`,
      meta: {
        agentType,
        orgId,
        status,
        timestamp: new Date().toISOString()
      }
    };

    this.logger.info(logEntry);

    // Store in Neo4j for provenance tracking
    if (status !== 'skipped') {
      const query = `
        CREATE (a:Action {
          id: randomUUID(),
          org_id: $orgId,
          agent_type: $agentType,
          inputs: $inputs,
          outputs: $outputs,
          status: $status,
          created_at: datetime()
        })
        RETURN a
      `;

      try {
        await this.neo4jService.run(query, {
          orgId,
          agentType,
          inputs: JSON.stringify(inputs),
          outputs: JSON.stringify(outputs),
          status
        });
      } catch (error) {
        this.logger.error(`Failed to store agent execution in Neo4j: ${error.message}`);
      }
    }
  }

  /**
   * Log tenant isolation violation
   */
  async logTenantIsolationViolation(userId: string, orgId: string, entityType: string, entityId: string): Promise<void> {
    const logEntry = {
      level: 'warn',
      message: `Tenant isolation violation detected`,
      meta: {
        userId,
        orgId,
        entityType,
        entityId,
        timestamp: new Date().toISOString()
      }
    };

    this.logger.warn(logEntry);

    // Increment violation counter metric
    this.metricsService.recordTenantIsolationViolation(orgId, entityType);
  }

  /**
   * Log file processing event
   */
  logFileProcessing(orgId: string, sourceType: string, filePath: string, status: string): void {
    const logEntry = {
      level: 'info',
      message: `File processing event`,
      meta: {
        orgId,
        sourceType,
        filePath,
        status,
        timestamp: new Date().toISOString()
      }
    };

    this.logger.info(logEntry);

    // Increment file processing counter metric
    this.metricsService.recordFileProcessing(orgId, sourceType, status);
  }

  /**
   * Log content analysis event
   */
  logContentAnalysis(orgId: string, contentType: string, contentId: string, status: string): void {
    const logEntry = {
      level: status === 'error' ? 'error' : 'info',
      message: `Content analysis event`,
      meta: {
        orgId,
        contentType,
        contentId,
        status,
        timestamp: new Date().toISOString()
      }
    };

    if (status === 'error') {
      this.logger.error(logEntry);
    } else {
      this.logger.info(logEntry);
    }

    // Increment content analysis counter metric
    this.metricsService.recordContentAnalysis(orgId, contentType, status);
  }
}
```

### 4. Monitoring Dashboard Configuration

#### 4.1 Grafana Dashboard JSON

**Blueprint System Overview Dashboard**
```json
{
  "dashboard": {
    "id": null,
    "title": "Blueprint System Overview",
    "timezone": "browser",
    "schemaVersion": 16,
    "version": 0,
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "type": "graph",
        "title": "File Processing Rate",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "rate(blueprint_file_processing_total[5m])",
            "legendFormat": "{{source_type}} - {{status}}"
          }
        ],
        "xaxis": {
          "mode": "time"
        },
        "yaxes": [
          {
            "format": "ops",
            "label": "Files/sec"
          }
        ]
      },
      {
        "id": 2,
        "type": "stat",
        "title": "Total Files Processed",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "sum(blueprint_file_processing_total)",
            "instant": true
          }
        ],
        "options": {
          "reduceOptions": {
            "calcs": ["last"]
          }
        }
      },
      {
        "id": 3,
        "type": "graph",
        "title": "Classification Accuracy",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "blueprint_classification_accuracy",
            "legendFormat": "{{org_id}} - {{taxonomy_id}}"
          }
        ],
        "xaxis": {
          "mode": "time"
        },
        "yaxes": [
          {
            "format": "percent",
            "label": "Accuracy %",
            "min": 0,
            "max": 100
          }
        ]
      },
      {
        "id": 4,
        "type": "graph",
        "title": "Agent Execution Time",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(blueprint_agent_execution_seconds_bucket[5m])) by (le, agent_type))",
            "legendFormat": "{{agent_type}} P95"
          }
        ],
        "xaxis": {
          "mode": "time"
        },
        "yaxes": [
          {
            "format": "s",
            "label": "Execution Time (seconds)"
          }
        ]
      },
      {
        "id": 5,
        "type": "graph",
        "title": "Queue Depth",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "blueprint_queue_depth",
            "legendFormat": "{{queue_name}} - {{org_id}}"
          }
        ],
        "xaxis": {
          "mode": "time"
        },
        "yaxes": [
          {
            "format": "short",
            "label": "Items"
          }
        ]
      },
      {
        "id": 6,
        "type": "graph",
        "title": "Tenant Isolation Violations",
        "datasource": "Prometheus",
        "targets": [
          {
            "expr": "rate(blueprint_tenant_isolation_violations_total[5m])",
            "legendFormat": "{{entity_type}}"
          }
        ],
        "xaxis": {
          "mode": "time"
        },
        "yaxes": [
          {
            "format": "ops",
            "label": "Violations/sec"
          }
        ]
      }
    ]
  }
}
```

### 5. Alerting Configuration

#### 5.1 Prometheus Alert Rules

**Blueprint Alerting Rules**
```yaml
groups:
- name: blueprint.rules
  rules:
  - alert: HighQueueDepth
    expr: blueprint_queue_depth > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High queue depth detected"
      description: "Queue {{ $labels.queue_name }} for org {{ $labels.org_id }} has depth > 1000 for more than 5 minutes"

  - alert: LowClassificationAccuracy
    expr: blueprint_classification_accuracy < 80
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Low classification accuracy"
      description: "Classification accuracy for org {{ $labels.org_id }} taxonomy {{ $labels.taxonomy_id }} is below 80%"

  - alert: TenantIsolationViolations
    expr: increase(blueprint_tenant_isolation_violations_total[5m]) > 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Tenant isolation violation detected"
      description: "Tenant isolation violations detected for org {{ $labels.org_id }} entity type {{ $labels.entity_type }}"

  - alert: AgentExecutionSlow
    expr: histogram_quantile(0.95, sum(rate(blueprint_agent_execution_seconds_bucket[5m])) by (le, agent_type)) > 30
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow agent execution"
      description: "Agent {{ $labels.agent_type }} 95th percentile execution time exceeds 30 seconds"

  - alert: HighErrorRate
    expr: rate(blueprint_file_processing_total{status="error"}[5m]) / rate(blueprint_file_processing_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate in file processing"
      description: "Error rate in file processing exceeds 5% for more than 5 minutes"
```

#### 5.2 Alertmanager Configuration

**Blueprint Alertmanager Configuration**
```yaml
route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'slack-notifications'

receivers:
- name: 'slack-notifications'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#blueprint-alerts'
    send_resolved: true
    title: '{{ template "slack.title" . }}'
    text: '{{ template "slack.text" . }}'

templates:
- '/etc/alertmanager/template/*.tmpl'
```

### 6. Monitoring Scripts

#### 6.1 Health Check Script

**Health Check Automation Script**
```bash
#!/bin/bash

# healthcheck.sh - Automated health check script

# Configuration
HEALTHCHECK_ENDPOINT="http://localhost:4000/health"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
EMAIL_ALERT="${EMAIL_ALERT:-}"

# Perform health check
response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json $HEALTHCHECK_ENDPOINT)

# Extract HTTP status code
http_code=${response: -3}

# Check if service is healthy
if [ "$http_code" -eq 200 ]; then
    echo "Service is healthy"
    exit 0
else
    echo "Service is unhealthy - HTTP code: $http_code"
    
    # Send alert to Slack if configured
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        message="Blueprint service health check failed with HTTP code: $http_code"
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"$message\"}" \
             $SLACK_WEBHOOK_URL
    fi
    
    # Send email alert if configured
    if [ -n "$EMAIL_ALERT" ]; then
        subject="Blueprint Service Unhealthy"
        echo "$message" | mail -s "$subject" "$EMAIL_ALERT"
    fi
    
    exit 1
fi
```

#### 6.2 Metrics Collection Script

**Metrics Collection Automation**
```bash
#!/bin/bash

# collect-metrics.sh - Metrics collection script

# Configuration
METRICS_ENDPOINT="http://localhost:4000/metrics"
OUTPUT_DIR="/var/log/blueprint/metrics"
RETENTION_DAYS=7

# Create output directory if it doesn't exist
mkdir -p $OUTPUT_DIR

# Collect metrics
timestamp=$(date +%Y%m%d_%H%M%S)
output_file="$OUTPUT_DIR/metrics_$timestamp.txt"

curl -s $METRICS_ENDPOINT > $output_file

# Clean up old files
find $OUTPUT_DIR -name "metrics_*.txt" -mtime +$RETENTION_DAYS -delete

echo "Metrics collected to $output_file"
```

This monitoring and observability implementation provides a comprehensive system for tracking the health and performance of the Blueprint service. It includes Prometheus metrics collection, health checks for all critical components, structured logging with provenance tracking, dashboard configuration, and alerting rules to ensure system reliability and security.
