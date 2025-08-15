import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();

collectDefaultMetrics({ register: registry });

export const heartbeatCounter = new Counter({
  name: 'olivine_heartbeats_total',
  help: 'Total number of heartbeats received',
  registers: [registry],
});

export const commitCounter = new Counter({
  name: 'olivine_commits_total',
  help: 'Total number of commits processed',
  registers: [registry],
});

export const failCounter = new Counter({
  name: 'olivine_failures_total',
  help: 'Total number of failed operations',
  registers: [registry],
});

export const queueLatencyHistogram = new Histogram({
  name: 'olivine_queue_latency_seconds',
  help: 'Time spent in task queue in seconds',
  buckets: [0.1, 0.5, 1, 5, 10],
  registers: [registry],
});

export function metrics() {
  return registry.metrics();
}
