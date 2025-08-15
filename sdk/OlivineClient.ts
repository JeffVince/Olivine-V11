import { heartbeatCounter, commitCounter, failCounter, queueLatencyHistogram } from './telemetry';

export class OlivineClient {
  recordHeartbeat() {
    heartbeatCounter.inc();
  }

  recordCommit() {
    commitCounter.inc();
  }

  recordFailure() {
    failCounter.inc();
  }

  recordQueueLatency(seconds: number) {
    queueLatencyHistogram.observe(seconds);
  }
}
