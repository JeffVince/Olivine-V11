# Cluster-Centric System Rollout Guide

## Overview

This guide provides step-by-step instructions for deploying the cluster-centric knowledge representation system in Olivine-V11. The rollout transforms the system from file-centric to cluster-centric processing with enhanced multi-agent orchestration.

## Pre-Rollout Checklist

### Infrastructure Requirements
- [ ] Neo4j 4.4+ with APOC plugin
- [ ] PostgreSQL 13+ with RLS support
- [ ] Redis for queue management
- [ ] Node.js 18+ runtime environment

### Database Preparation
- [ ] Neo4j database backup completed
- [ ] PostgreSQL database backup completed
- [ ] Migration scripts validated in staging
- [ ] Rollback procedures documented

### Service Dependencies
- [ ] Queue service operational
- [ ] File storage providers accessible
- [ ] Taxonomy service available
- [ ] Event bus infrastructure ready

## Rollout Phases

### Phase 1: Database Migration (30 minutes)

#### Step 1.1: Apply PostgreSQL Migrations
```bash
# Navigate to backend directory
cd /path/to/olivine-v11/backend

# Run staging table migrations
psql -d olivine_v11 -f migrations/001_cluster_staging_tables.sql

# Verify tables created
psql -d olivine_v11 -c "\dt"
```

#### Step 1.2: Apply Neo4j Constraints
```bash
# Apply Neo4j constraints and indexes
cypher-shell -f migrations/001_cluster_neo4j_constraints.cypher

# Verify constraints
cypher-shell -c "SHOW CONSTRAINTS"
```

#### Step 1.3: Validate Migration
```bash
# Run validation script
npm run validate-cluster-migration
```

### Phase 2: Service Initialization (15 minutes)

#### Step 2.1: Deploy Enhanced Services
```bash
# Build and deploy enhanced agents
npm run build

# Initialize cluster services
npm run deploy:cluster-services
```

#### Step 2.2: Configure Agent Registry
```bash
# Enable cluster mode
export CLUSTER_MODE=true
export RUN_MIGRATIONS=false  # Already completed in Phase 1

# Initialize agent registry
npm run init:agents
```

### Phase 3: Agent Orchestration (20 minutes)

#### Step 3.1: Start Enhanced Agents
```bash
# Start cluster-aware file steward agent
npm run start:enhanced-file-steward

# Start agent orchestrator
npm run start:orchestrator

# Start cross-layer enforcement service
npm run start:cross-layer-enforcement
```

#### Step 3.2: Verify Agent Health
```bash
# Check agent status
curl http://localhost:3000/api/agents/health

# Verify orchestrator workflows
curl http://localhost:3000/api/orchestrator/workflows
```

### Phase 4: Data Migration (45 minutes)

#### Step 4.1: Migrate Existing Files to Clusters
```bash
# Run cluster migration for existing files
npm run migrate:files-to-clusters

# Monitor migration progress
npm run monitor:cluster-migration
```

#### Step 4.2: Validate Cross-Layer Links
```bash
# Run cross-layer validation
npm run validate:cross-layer-links

# Repair any broken relationships
npm run repair:cross-layer-links
```

### Phase 5: Validation & Testing (30 minutes)

#### Step 5.1: End-to-End Testing
```bash
# Run integration tests
npm run test:cluster-integration

# Run performance tests
npm run test:cluster-performance
```

#### Step 5.2: Smoke Testing
```bash
# Test file ingestion pipeline
npm run test:file-ingestion

# Test multi-slot classification
npm run test:multi-slot-classification

# Test event-driven orchestration
npm run test:orchestration
```

## Monitoring & Observability

### Key Metrics to Monitor

#### Performance Metrics
- **Cluster Creation Time**: Target < 500ms per file
- **Cross-Layer Link Validation**: Target < 2s per validation cycle
- **Agent Orchestration Latency**: Target < 100ms per workflow step
- **Queue Processing Rate**: Target > 100 jobs/minute

#### Health Metrics
- **Agent Uptime**: Target 99.9%
- **Database Connection Pool**: Monitor active/idle connections
- **Memory Usage**: Monitor for memory leaks in long-running agents
- **Error Rates**: Target < 0.1% for critical operations

### Monitoring Setup
```bash
# Start monitoring dashboard
npm run start:monitoring

# Configure alerts
npm run configure:alerts

# Set up log aggregation
npm run setup:logging
```

## Rollback Procedures

### Emergency Rollback (< 5 minutes)
```bash
# Stop all enhanced agents
npm run stop:enhanced-agents

# Revert to legacy file steward
export CLUSTER_MODE=false
npm run start:legacy-agents

# Disable cluster features in UI
npm run disable:cluster-ui
```

### Full Rollback (30 minutes)
```bash
# Stop all services
npm run stop:all-services

# Restore database backups
pg_restore -d olivine_v11 backup_pre_cluster.sql
neo4j-admin restore --from=backup_pre_cluster

# Restart legacy system
npm run start:legacy-system
```

## Post-Rollout Tasks

### Immediate (First 24 hours)
- [ ] Monitor system performance metrics
- [ ] Validate all file ingestion workflows
- [ ] Check cross-layer relationship integrity
- [ ] Verify agent orchestration functionality

### Short-term (First week)
- [ ] Analyze cluster creation patterns
- [ ] Optimize extraction job queuing
- [ ] Fine-tune cross-layer validation rules
- [ ] Update documentation based on observations

### Long-term (First month)
- [ ] Performance optimization based on usage patterns
- [ ] Expand multi-slot classification rules
- [ ] Enhance cross-layer relationship types
- [ ] Plan next phase enhancements

## Troubleshooting

### Common Issues

#### Cluster Creation Failures
**Symptoms**: Files ingested but no clusters created
**Diagnosis**: Check enhanced file steward agent logs
**Resolution**: 
```bash
# Restart enhanced file steward
npm run restart:enhanced-file-steward

# Manually trigger cluster creation
npm run trigger:cluster-creation --file-id=<file_id>
```

#### Cross-Layer Validation Errors
**Symptoms**: Validation reports high violation counts
**Diagnosis**: Check cross-layer enforcement service logs
**Resolution**:
```bash
# Run manual validation with detailed output
npm run validate:cross-layer-links --verbose

# Apply automatic repairs
npm run repair:cross-layer-links --auto-fix
```

#### Agent Orchestration Failures
**Symptoms**: Workflows stuck in pending state
**Diagnosis**: Check orchestrator service logs and queue status
**Resolution**:
```bash
# Clear stuck workflows
npm run clear:stuck-workflows

# Restart orchestrator
npm run restart:orchestrator
```

### Log Locations
- **Enhanced File Steward**: `/var/log/olivine/enhanced-file-steward.log`
- **Agent Orchestrator**: `/var/log/olivine/orchestrator.log`
- **Cross-Layer Enforcement**: `/var/log/olivine/cross-layer.log`
- **Database Migrations**: `/var/log/olivine/migrations.log`

### Support Contacts
- **System Architecture**: [architecture-team@olivine.com]
- **Database Issues**: [database-team@olivine.com]
- **Agent Development**: [agents-team@olivine.com]
- **Emergency Escalation**: [on-call@olivine.com]

## Success Criteria

### Technical Success Metrics
- [ ] All existing files successfully migrated to cluster representation
- [ ] Multi-slot classification accuracy > 95%
- [ ] Cross-layer relationship coverage > 90%
- [ ] Agent orchestration success rate > 99%
- [ ] System performance within 10% of pre-rollout benchmarks

### Business Success Metrics
- [ ] File processing throughput maintained or improved
- [ ] Knowledge graph query performance improved by 20%
- [ ] Cross-layer insights available in UI
- [ ] User workflow disruption < 1%

## Conclusion

The cluster-centric rollout represents a fundamental shift in Olivine's knowledge representation architecture. This guide ensures a systematic, monitored deployment with clear rollback procedures and success criteria.

For questions or issues during rollout, refer to the troubleshooting section or contact the appropriate support team.
