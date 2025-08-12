# **7. Ops & Observability**

This section defines the operational requirements, service level objectives (SLOs), monitoring, alerting, and observability infrastructure necessary to maintain a production-ready unified knowledge graph system. The system must provide comprehensive telemetry, automated backpressure mechanisms, reliable backup strategies, and actionable alerting to ensure high availability and performance.

## **7.1 Service Level Objectives (SLOs)**

### **7.1.1 Ingestion Pipeline SLOs**

* **File Ingestion Latency:** 95% of file ingestion events (from Dropbox/Google Drive webhook to Neo4j commit) complete within 30 seconds
* **Classification Accuracy:** 90% of files automatically classified into correct CanonicalSlots with confidence ≥ 0.8
* **Ingestion Throughput:** System processes at least 1000 files/hour during peak periods
* **Ingestion Availability:** 99.5% uptime for the ingestion pipeline (excluding planned maintenance)

### **7.1.2 Graph Database SLOs**

* **Query Response Time:** 95% of graph queries complete within 500ms
* **Write Transaction Latency:** 95% of Provenance Write Path transactions complete within 200ms
* **Graph Availability:** 99.9% uptime for Neo4j cluster
* **Data Consistency:** 100% of commits maintain ACID properties and provenance integrity

### **7.1.3 Agent System SLOs**

* **Agent Job Success Rate:** 95% of LangGraph agent jobs complete successfully
* **Agent Response Time:** 90% of agent workflows complete within 60 seconds
* **Agent Queue Depth:** Agent job queues maintain <100 pending jobs during normal operation
* **Agent Availability:** 99% uptime for critical agents (File Steward, Ontology Curator)

### **7.1.4 API Gateway SLOs**

* **API Response Time:** 95% of API requests complete within 1 second
* **API Availability:** 99.9% uptime for the Graph Gateway
* **Authentication Latency:** 95% of ABAC authorization checks complete within 100ms
* **Rate Limiting Accuracy:** 100% enforcement of tenant-specific rate limits

## **7.2 Metrics and Telemetry**

### **7.2.1 Core System Metrics**

**Ingestion Metrics:**
* `ingestion_events_total{source, org_id, event_type}` - Counter of ingestion events by source and type
* `ingestion_latency_seconds{source, org_id}` - Histogram of end-to-end ingestion latency
* `classification_accuracy{org_id, rule_id}` - Gauge of classification confidence scores
* `file_processing_errors_total{source, org_id, error_type}` - Counter of processing failures

**Graph Database Metrics:**
* `neo4j_query_duration_seconds{query_type, org_id}` - Histogram of query execution times
* `neo4j_transaction_duration_seconds{transaction_type, org_id}` - Histogram of transaction latency
* `neo4j_active_connections{org_id}` - Gauge of active database connections
* `neo4j_memory_usage_bytes` - Gauge of JVM heap and off-heap memory usage
* `provenance_write_path_duration_seconds{org_id}` - Histogram of atomic write transaction times

**Agent System Metrics:**
* `agent_job_duration_seconds{agent_type, org_id, status}` - Histogram of agent job execution times
* `agent_job_queue_depth{agent_type, org_id}` - Gauge of pending jobs in agent queues
* `agent_job_success_rate{agent_type, org_id}` - Gauge of successful job completion rate
* `agent_error_total{agent_type, org_id, error_code}` - Counter of agent execution errors

**API Gateway Metrics:**
* `api_request_duration_seconds{method, endpoint, org_id, status_code}` - Histogram of API response times
* `api_requests_total{method, endpoint, org_id, status_code}` - Counter of API requests
* `abac_authorization_duration_seconds{org_id, resource_type}` - Histogram of authorization check times
* `rate_limit_exceeded_total{org_id, endpoint}` - Counter of rate limit violations

### **7.2.2 Business Logic Metrics**

**Content and Ops Metrics:**
* `commit_creation_rate{org_id, branch}` - Gauge of commit creation frequency
* `entity_version_count{org_id, entity_type}` - Gauge of versioned entities in the system
* `edge_fact_operations_total{org_id, edge_type, operation}` - Counter of EdgeFact create/update/close operations
* `taxonomy_rule_matches_total{org_id, rule_id, slot_key}` - Counter of successful taxonomy rule applications

**Multi-tenancy Metrics:**
* `tenant_storage_usage_bytes{org_id}` - Gauge of storage consumption per organization
* `tenant_api_usage_total{org_id, endpoint}` - Counter of API usage per tenant
* `tenant_active_users{org_id}` - Gauge of active users per organization
* `cross_tenant_isolation_violations_total` - Counter of tenant boundary violations (should always be 0)

### **7.2.3 Infrastructure Metrics**

**Resource Utilization:**
* `cpu_usage_percent{service, instance}` - Gauge of CPU utilization across services
* `memory_usage_bytes{service, instance}` - Gauge of memory consumption
* `disk_usage_bytes{service, instance, mount_point}` - Gauge of disk space utilization
* `network_io_bytes_total{service, instance, direction}` - Counter of network traffic

**External Dependencies:**
* `external_api_duration_seconds{provider, endpoint}` - Histogram of external API call latency (Dropbox, Google Drive, Vault)
* `external_api_errors_total{provider, endpoint, error_code}` - Counter of external API failures
* `webhook_processing_duration_seconds{provider, org_id}` - Histogram of webhook processing times

## **7.3 Backpressure and Load Management**

### **7.3.1 Ingestion Backpressure**

**Queue-based Backpressure:**
* Implement exponential backoff for failed ingestion attempts with maximum retry limits
* Use Redis-backed job queues with configurable concurrency limits per organization
* Apply circuit breaker patterns for external API calls (Dropbox, Google Drive) with automatic recovery

**Rate Limiting:**
* Enforce per-tenant ingestion rate limits: 100 files/minute for standard tier, 500 files/minute for premium
* Implement sliding window rate limiting with burst allowances for batch uploads
* Provide backpressure signals to client applications when approaching rate limits

**Resource-based Throttling:**
* Monitor Neo4j connection pool utilization and throttle writes when >80% capacity
* Implement memory-based backpressure when JVM heap usage exceeds 75%
* Use adaptive batching for bulk operations based on current system load

### **7.3.2 Agent System Backpressure**

**Job Queue Management:**
* Maintain separate priority queues for different agent types with configurable worker pools
* Implement job deduplication to prevent redundant processing of identical tasks
* Use dead letter queues for failed jobs with manual intervention workflows

**Resource Allocation:**
* Dynamically scale agent workers based on queue depth and processing latency
* Implement CPU and memory limits per agent instance with automatic restart on resource exhaustion
* Use container orchestration (Kubernetes) for automatic scaling and resource management

### **7.3.3 API Gateway Backpressure**

**Request Throttling:**
* Implement token bucket rate limiting per organization with different tiers
* Use adaptive rate limiting that adjusts based on downstream service health
* Provide HTTP 429 responses with Retry-After headers for rate-limited requests

**Circuit Breaker Implementation:**
* Monitor downstream service health and implement circuit breakers for Neo4j and agent services
* Use half-open states for gradual recovery from circuit breaker trips
* Implement fallback responses for non-critical read operations during outages

## **7.4 Backup and Disaster Recovery**

### **7.4.1 Neo4j Backup Strategy**

**Automated Backups:**
* Perform full Neo4j database backups daily at 2 AM UTC with 30-day retention
* Implement incremental transaction log backups every 15 minutes during business hours
* Store backups in geographically distributed object storage (S3, GCS) with encryption at rest

**Backup Validation:**
* Automated backup integrity checks using Neo4j consistency checker
* Monthly disaster recovery drills with full database restoration testing
* Backup restoration time objective (RTO) of 4 hours, recovery point objective (RPO) of 15 minutes

**Cross-region Replication:**
* Maintain read-only Neo4j replicas in secondary regions for disaster recovery
* Implement automated failover procedures with DNS-based traffic routing
* Use Neo4j Causal Clustering for high availability and automatic leader election

### **7.4.2 Relational Database Backup**

**Supabase/PostgreSQL Backups:**
* Leverage Supabase automated daily backups with point-in-time recovery capability
* Implement custom backup scripts for critical configuration tables
* Maintain separate backups of user authentication data and tenant configuration

**Data Synchronization:**
* Ensure backup consistency between Neo4j and PostgreSQL using transaction coordination
* Implement backup verification by comparing graph and relational data checksums
* Use logical replication for real-time backup synchronization

### **7.4.3 Configuration and Secrets Backup**

**Infrastructure as Code:**
* Store all infrastructure configuration in version-controlled repositories
* Use Terraform/CloudFormation for reproducible infrastructure deployment
* Maintain separate configuration repositories for different environments (dev, staging, prod)

**Secrets Management:**
* Backup Vault/KMS key material to secure offline storage with split-key recovery
* Implement secrets rotation procedures with automated backup of rotated credentials
* Use hardware security modules (HSMs) for critical cryptographic key protection

## **7.5 Alerting and Incident Response**

### **7.5.1 Critical Alerts**

**System Health Alerts:**
* **Neo4j Cluster Down:** Immediate PagerDuty alert when any Neo4j instance becomes unavailable
* **Ingestion Pipeline Failure:** Alert when ingestion latency exceeds SLO thresholds for >5 minutes
* **Data Consistency Violation:** Immediate alert for any provenance integrity failures or cross-tenant data leaks
* **Backup Failure:** Alert when automated backups fail or backup validation checks fail

**Performance Alerts:**
* **Query Performance Degradation:** Alert when 95th percentile query latency exceeds 1 second for >10 minutes
* **Agent Queue Overflow:** Alert when agent job queues exceed 500 pending jobs
* **API Gateway Overload:** Alert when API response times exceed SLO thresholds
* **Resource Exhaustion:** Alert when CPU >90% or memory >85% for >15 minutes

### **7.5.2 Warning Alerts**

**Capacity Planning:**
* **Storage Growth:** Warning when Neo4j or PostgreSQL storage usage exceeds 80% capacity
* **Connection Pool Utilization:** Warning when database connection pools exceed 70% utilization
* **Rate Limit Approaching:** Warning when tenants approach 80% of their rate limits

**Operational Alerts:**
* **External API Degradation:** Warning when external API (Dropbox, Google Drive) error rates exceed 5%
* **Classification Accuracy Drop:** Warning when file classification confidence drops below 0.7
* **Backup Age:** Warning when backups are older than 25 hours

### **7.5.3 Incident Response Procedures**

**Escalation Matrix:**
* **Severity 1 (Critical):** Data loss, security breach, complete system outage - Immediate PagerDuty escalation
* **Severity 2 (High):** Performance degradation affecting >50% of users - 30-minute response time
* **Severity 3 (Medium):** Feature degradation affecting <50% of users - 2-hour response time
* **Severity 4 (Low):** Minor issues, cosmetic problems - Next business day response

**Runbook Automation:**
* Automated incident detection and initial response procedures
* Self-healing mechanisms for common failure scenarios (service restarts, connection pool resets)
* Automated rollback procedures for failed deployments

**Post-Incident Review:**
* Mandatory post-mortem for all Severity 1 and 2 incidents
* Root cause analysis with corrective action tracking
* Incident metrics reporting and trend analysis for continuous improvement

## **7.6 Observability Implementation**

### **7.6.1 Distributed Tracing**

**OpenTelemetry Integration:**
* Implement distributed tracing across all services using OpenTelemetry standards
* Trace ingestion workflows from webhook receipt through Neo4j commit completion
* Correlate traces across agent workflows, API requests, and database operations

**Trace Sampling:**
* Use adaptive sampling to balance observability with performance overhead
* Implement 100% sampling for error conditions and critical business workflows
* Use tail-based sampling for complex multi-service transactions

### **7.6.2 Structured Logging**

**Log Standardization:**
* Implement structured JSON logging across all services with consistent field naming
* Include correlation IDs, tenant context, and trace information in all log entries
* Use log levels appropriately: ERROR for actionable issues, WARN for degraded conditions, INFO for business events

**Log Aggregation:**
* Centralize logs using ELK stack (Elasticsearch, Logstash, Kibana) or equivalent
* Implement log retention policies: 90 days for ERROR/WARN, 30 days for INFO, 7 days for DEBUG
* Use log-based alerting for critical error patterns and security events

### **7.6.3 Metrics Collection and Visualization**

**Prometheus and Grafana:**
* Deploy Prometheus for metrics collection with appropriate retention policies
* Create comprehensive Grafana dashboards for system health, business metrics, and SLO tracking
* Implement alerting rules in Prometheus AlertManager with proper routing and escalation

**Custom Dashboards:**
* **System Overview:** High-level health indicators, SLO compliance, and alert status
* **Ingestion Pipeline:** File processing rates, classification accuracy, and error rates
* **Graph Database:** Query performance, transaction volumes, and resource utilization
* **Agent System:** Job processing metrics, queue depths, and success rates
* **Multi-tenancy:** Per-tenant resource usage, API consumption, and isolation metrics

---

This comprehensive Ops & Observability framework ensures the unified knowledge graph system maintains high availability, performance, and reliability while providing the visibility necessary for proactive operational management and rapid incident response.
