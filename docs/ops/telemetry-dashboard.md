# Telemetry Dashboard

This Grafana dashboard provides visibility into the Olivine runtime by exposing Prometheus metrics exported by `OlivineClient`.

## Panels

### Heartbeats
- **Query:** `rate(olivine_heartbeats_total[5m])`
- Shows the rate of heartbeats over the last five minutes.

### Commits
- **Query:** `rate(olivine_commits_total[5m])`
- Tracks commit throughput.

### Failures
- **Query:** `rate(olivine_failures_total[5m])`
- Monitors the rate of failed operations.

### Queue Latency
- **Query:** `histogram_quantile(0.95, sum(rate(olivine_queue_latency_seconds_bucket[5m])) by (le))`
- Displays the 95th percentile of queue processing latency.

Each panel should include legends and alerts to highlight sustained drops in heartbeats, spikes in failures, or increasing latency.
