Jeff — here’s a **ready‑to‑import Grafana dashboard seed** wired to the SLOs/metrics you outlined (ingest latency, classification backlog, agent success, queue/backpressure, Neo4j health, rule hit‑rates, and backups/DR). It assumes Prometheus for metrics and Loki for logs, mapped to generic metric families that fit the Olivine V10 architecture (Neo4j + Sync Worker + Agents) you documented.

Paste this JSON into Grafana (Dashboards → Import) and bind the two data sources when prompted.

```json
{
  "__inputs": [
    {
      "name": "DS_PROMETHEUS",
      "label": "Prometheus",
      "description": "",
      "type": "datasource",
      "pluginId": "prometheus",
      "pluginName": "Prometheus"
    },
    {
      "name": "DS_LOKI",
      "label": "Loki",
      "description": "",
      "type": "datasource",
      "pluginId": "loki",
      "pluginName": "Loki"
    }
  ],
  "__requires": [
    { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "10.4.0" },
    { "type": "panel", "id": "timeseries", "name": "Time series", "version": "" },
    { "type": "panel", "id": "stat", "name": "Stat", "version": "" },
    { "type": "panel", "id": "bargauge", "name": "Bar Gauge", "version": "" },
    { "type": "panel", "id": "heatmap", "name": "Heatmap", "version": "" },
    { "type": "panel", "id": "logs", "name": "Logs", "version": "" },
    { "type": "panel", "id": "row", "name": "Row", "version": "" }
  ],
  "uid": "olivine-ops-v10-seed",
  "title": "Olivine V10 — Ops & Observability",
  "tags": ["olivine","ops","slo"],
  "timezone": "browser",
  "schemaVersion": 39,
  "version": 1,
  "refresh": "30s",
  "style": "dark",
  "time": { "from": "now-24h", "to": "now" },
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": "-- Grafana --",
        "enable": true,
        "hide": false,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "templating": {
    "list": [
      {
        "name": "env",
        "label": "Env",
        "type": "query",
        "hide": 0,
        "datasource": "${DS_PROMETHEUS}",
        "query": { "query": "label_values(olv_commits_total, env)", "refId": "EnvVar" },
        "refresh": 1,
        "includeAll": true,
        "multi": true,
        "current": { "selected": true, "text": ["All"], "value": ["$__all"] }
      },
      {
        "name": "project",
        "label": "Project",
        "type": "query",
        "hide": 0,
        "datasource": "${DS_PROMETHEUS}",
        "query": { "query": "label_values(olv_commits_total, project)", "refId": "ProjVar" },
        "refresh": 1,
        "includeAll": true,
        "multi": true,
        "current": { "selected": true, "text": ["All"], "value": ["$__all"] }
      }
    ]
  },
  "panels": [
    {
      "id": 1,
      "type": "row",
      "title": "SLOs",
      "gridPos": { "h": 1, "w": 24, "x": 0, "y": 0 },
      "collapsed": false
    },
    {
      "id": 2,
      "type": "timeseries",
      "title": "Ingest P95 latency (s) — storage event → File node",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "histogram_quantile(0.95, sum(rate(olv_ingest_latency_seconds_bucket{stage=\"storage_event_to_file_node\", env=~\"$env\", project=~\"$project\"}[$__rate_interval])) by (le))"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "red", "value": 30 }
            ]
          }
        },
        "overrides": []
      },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" }, "tooltip": { "mode": "single" } },
      "gridPos": { "h": 8, "w": 10, "x": 0, "y": 1 }
    },
    {
      "id": 3,
      "type": "stat",
      "title": "Ingest SLO burn (× error budget)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "clamp_min((sum(rate(olv_ingest_latency_seconds_bucket{stage=\"storage_event_to_file_node\",le=\"+Inf\",env=~\"$env\",project=~\"$project\"}[$__rate_interval])) - sum(rate(olv_ingest_latency_seconds_bucket{stage=\"storage_event_to_file_node\",le=\"30\",env=~\"$env\",project=~\"$project\"}[$__rate_interval]))) / sum(rate(olv_ingest_latency_seconds_count{stage=\"storage_event_to_file_node\",env=~\"$env\",project=~\"$project\"}[$__rate_interval])), 0) / 0.001"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "none",
          "decimals": 2,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 1 },
              { "color": "red", "value": 2 }
            ]
          }
        },
        "overrides": []
      },
      "options": { "colorMode": "value", "graphMode": "area", "justifyMode": "center", "reduceOptions": { "calcs": ["lastNotNull"], "values": false } },
      "gridPos": { "h": 8, "w": 5, "x": 10, "y": 1 }
    },
    {
      "id": 4,
      "type": "stat",
      "title": "Classification backlog (pending < 100)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "max(olv_classification_backlog{env=~\"$env\",project=~\"$project\"})" }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "none",
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 80 },
              { "color": "red", "value": 100 }
            ]
          }
        },
        "overrides": []
      },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"], "values": false }, "orientation": "auto" },
      "gridPos": { "h": 8, "w": 4, "x": 15, "y": 1 }
    },
    {
      "id": 5,
      "type": "stat",
      "title": "Agent job success (%) > 99",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "100 * sum(rate(olv_agent_jobs_total{status=\"success\",env=~\"$env\",project=~\"$project\"}[$__rate_interval])) / sum(rate(olv_agent_jobs_total{env=~\"$env\",project=~\"$project\"}[$__rate_interval]))"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "decimals": 2,
          "thresholds": {
            "mode": "absolute",
            "steps": [
              { "color": "red", "value": null },
              { "color": "yellow", "value": 99 },
              { "color": "green", "value": 99.5 }
            ]
          }
        },
        "overrides": []
      },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"], "values": false } },
      "gridPos": { "h": 8, "w": 5, "x": 19, "y": 1 }
    },

    { "id": 6, "type": "row", "title": "Flow & Throughput", "gridPos": { "h": 1, "w": 24, "x": 0, "y": 9 }, "collapsed": false },
    {
      "id": 7,
      "type": "timeseries",
      "title": "Ingest throughput (events/sec)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum(rate(olv_storage_events_total{env=~\"$env\",project=~\"$project\"}[$__rate_interval]))" }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "legend": { "displayMode": "hidden" }, "tooltip": { "mode": "single" } },
      "gridPos": { "h": 7, "w": 8, "x": 0, "y": 10 }
    },
    {
      "id": 8,
      "type": "timeseries",
      "title": "Commits/sec",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum(rate(olv_commits_total{env=~\"$env\",project=~\"$project\"}[$__rate_interval]))" }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "legend": { "displayMode": "hidden" }, "tooltip": { "mode": "single" } },
      "gridPos": { "h": 7, "w": 8, "x": 8, "y": 10 }
    },
    {
      "id": 9,
      "type": "timeseries",
      "title": "Action failures/sec",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum(rate(olv_actions_total{status!=\"success\",env=~\"$env\",project=~\"$project\"}[$__rate_interval]))" }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "legend": { "displayMode": "hidden" }, "tooltip": { "mode": "single" } },
      "gridPos": { "h": 7, "w": 8, "x": 16, "y": 10 }
    },

    { "id": 10, "type": "row", "title": "Queues & Backpressure", "gridPos": { "h": 1, "w": 24, "x": 0, "y": 17 }, "collapsed": false },
    {
      "id": 11,
      "type": "timeseries",
      "title": "Queue depth by queue",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum by (queue) (olv_queue_depth{env=~\"$env\",project=~\"$project\"})" }
      ],
      "fieldConfig": { "defaults": { "unit": "none" }, "overrides": [] },
      "options": { "legend": { "displayMode": "table", "placement": "bottom" }, "tooltip": { "mode": "single" } },
      "gridPos": { "h": 7, "w": 12, "x": 0, "y": 18 }
    },
    {
      "id": 12,
      "type": "bargauge",
      "title": "Circuit breakers open (sum by service)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum by (service) (circuit_breaker_open{env=~\"$env\",project=~\"$project\"})" }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "none",
          "thresholds": { "mode": "absolute", "steps": [ { "color": "green", "value": null }, { "color": "red", "value": 1 } ] }
        },
        "overrides": []
      },
      "options": { "displayMode": "lcd" },
      "gridPos": { "h": 7, "w": 6, "x": 12, "y": 18 }
    },
    {
      "id": 13,
      "type": "stat",
      "title": "DLQ size (messages)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [ { "refId": "A", "expr": "sum(olv_dlq_depth{env=~\"$env\",project=~\"$project\"})" } ],
      "fieldConfig": { "defaults": { "unit": "none" }, "overrides": [] },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "gridPos": { "h": 7, "w": 6, "x": 18, "y": 18 }
    },
    {
      "id": 14,
      "type": "timeseries",
      "title": "DLQ inflow rate/sec",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum(rate(olv_dlq_messages_total{env=~\"$env\",project=~\"$project\"}[$__rate_interval]))" }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "legend": { "displayMode": "hidden" } },
      "gridPos": { "h": 7, "w": 24, "x": 0, "y": 25 }
    },

    { "id": 15, "type": "row", "title": "Neo4j", "gridPos": { "h": 1, "w": 24, "x": 0, "y": 32 }, "collapsed": false },
    {
      "id": 16,
      "type": "timeseries",
      "title": "Neo4j tx P95 latency (ms)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "1000 * histogram_quantile(0.95, sum(rate(neo4j_tx_latency_seconds_bucket{env=~\"$env\",project=~\"$project\"}[$__rate_interval])) by (le))" }
      ],
      "fieldConfig": { "defaults": { "unit": "ms" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 7, "w": 8, "x": 0, "y": 33 }
    },
    {
      "id": 17,
      "type": "timeseries",
      "title": "Neo4j tx errors/sec",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum(rate(neo4j_tx_errors_total{env=~\"$env\",project=~\"$project\"}[$__rate_interval]))" }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "legend": { "displayMode": "hidden" } },
      "gridPos": { "h": 7, "w": 8, "x": 8, "y": 33 }
    },
    {
      "id": 18,
      "type": "stat",
      "title": "Neo4j BOLT sessions (avg)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "avg(neo4j_bolt_sessions{env=~\"$env\",project=~\"$project\"})" }
      ],
      "fieldConfig": { "defaults": { "unit": "none" }, "overrides": [] },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "gridPos": { "h": 7, "w": 8, "x": 16, "y": 33 }
    },

    { "id": 19, "type": "row", "title": "Taxonomy & ML", "gridPos": { "h": 1, "w": 24, "x": 0, "y": 40 }, "collapsed": false },
    {
      "id": 20,
      "type": "bargauge",
      "title": "Rule hit‑rate (top 10 rules) — hits/sec",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "topk(10, sum by (rule) (rate(olv_rule_hits_total{env=~\"$env\",project=~\"$project\"}[$__rate_interval])))" }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "displayMode": "gradient" },
      "gridPos": { "h": 8, "w": 10, "x": 0, "y": 41 }
    },
    {
      "id": 21,
      "type": "timeseries",
      "title": "Classification review task backlog",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "olivine_classification_pending{env=~\"$env\",project=~\"$project\"}" }
      ],
      "fieldConfig": { "defaults": { "unit": "none" }, "overrides": [] },
      "options": { "legend": { "calcs": ["lastNotNull"], "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 14, "x": 10, "y": 41 }
    },

    { "id": 22, "type": "row", "title": "Backups & DR", "gridPos": { "h": 1, "w": 24, "x": 0, "y": 49 }, "collapsed": false },
    {
      "id": 23,
      "type": "stat",
      "title": "Neo4j backup age (hours)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "(time() - max(olv_backup_last_success_timestamp_seconds{env=~\"$env\",project=~\"$project\"})) / 3600" }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "h",
          "thresholds": { "mode": "absolute", "steps": [ { "color": "green", "value": null }, { "color": "yellow", "value": 26 }, { "color": "red", "value": 30 } ] }
        },
        "overrides": []
      },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "gridPos": { "h": 6, "w": 6, "x": 0, "y": 50 }
    },
    {
      "id": 24,
      "type": "stat",
      "title": "WAL shipping lag (s)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [ { "refId": "A", "expr": "max(olv_wal_shipping_lag_seconds{env=~\"$env\",project=~\"$project\"})" } ],
      "fieldConfig": {
        "defaults": {
          "unit": "s",
          "thresholds": { "mode": "absolute", "steps": [ { "color": "green", "value": null }, { "color": "yellow", "value": 60 }, { "color": "red", "value": 300 } ] }
        },
        "overrides": []
      },
      "gridPos": { "h": 6, "w": 6, "x": 6, "y": 50 }
    },
    {
      "id": 25,
      "type": "stat",
      "title": "Materialized graph export age (hours)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "(time() - max(olv_graph_export_last_success_ts_seconds{env=~\"$env\",project=~\"$project\"})) / 3600" }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "h",
          "thresholds": { "mode": "absolute", "steps": [ { "color": "green", "value": null }, { "color": "yellow", "value": 24 }, { "color": "red", "value": 48 } ] }
        },
        "overrides": []
      },
      "gridPos": { "h": 6, "w": 6, "x": 12, "y": 50 }
    },
    {
      "id": 26,
      "type": "stat",
      "title": "Cold store size (GB)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        { "refId": "A", "expr": "sum(olv_cold_store_bytes{env=~\"$env\",project=~\"$project\"}) / 1e9" }
      ],
      "fieldConfig": { "defaults": { "unit": "decbits" }, "overrides": [] },
      "options": { "reduceOptions": { "calcs": ["lastNotNull"] } },
      "gridPos": { "h": 6, "w": 6, "x": 18, "y": 50 }
    },

    { "id": 27, "type": "row", "title": "Logs (DLQ & Errors)", "gridPos": { "h": 1, "w": 24, "x": 0, "y": 56 }, "collapsed": false },
    {
      "id": 28,
      "type": "logs",
      "title": "Recent warnings/errors (env/project filter applies)",
      "datasource": { "type": "loki", "uid": "${DS_LOKI}" },
      "targets": [
        {
          "refId": "A",
          "expr": "{env=~\"$env\",project=~\"$project\",level=~\"warn|error\"} |= \"DLQ\" or {env=~\"$env\",project=~\"$project\",level=~\"warn|error\"}"
        }
      ],
      "gridPos": { "h": 10, "w": 24, "x": 0, "y": 57 },
      "options": {
        "showTime": true,
        "showLabels": true,
        "wrapLogMessage": true,
        "sortOrder": "Descending"
      }
    }
  ]
}
```

Quick notes so you can wire this in cleanly:

* **Data sources:** On import, select your Prometheus and Loki instances.
* **Metric families (rename if you already have them):**

  * `olv_ingest_latency_seconds_bucket/count` (histogram for storage\_event→File node stage)
  * `olv_classification_backlog` (gauge)
  * `olv_agent_jobs_total{status=success|failure}` (counter)
  * `olv_storage_events_total`, `olv_commits_total`, `olv_actions_total{status}` (counters)
  * `olv_queue_depth{queue=...}`, `circuit_breaker_open{service=...}`, `olv_dlq_depth`, `olv_dlq_messages_total`
  * `neo4j_tx_latency_seconds_bucket`, `neo4j_tx_errors_total`, `neo4j_bolt_sessions`
  * `olv_rule_hits_total{rule=...}`, `olv_ml_confidence_bucket` (histogram)
  * `olv_backup_last_success_timestamp_seconds`, `olv_wal_shipping_lag_seconds`, `olv_graph_export_last_success_ts_seconds`, `olv_cold_store_bytes`
* **SLO wiring:**

  * The latency chart highlights the **30s** target, and the **burn** stat divides the “bad‑over‑threshold rate” by the 0.001 error budget (99.9% objective).
  * Backlog stat has a red threshold at **100** pending.
  * Agent success goes red below **99%**.

If you want this split into per‑service repeated rows (e.g., Sync Worker, Classifier, Orchestrator), I can add a `$service` template and repeaters so you can flip between them without duplicating panels.

Would you like me to also spit out Prometheus recording rules to back these panels (P95, SLO bad/good rates, etc.) so you’re not recomputing heavy queries at query‑time?
