# SDK Client

The SDK provides a lightweight client for interacting with the Olivine API. It
bundles submodules for different services and automatically injects
authentication headers and retry logic for transient authorization and rate
limit failures.

## Usage

```ts
import { Client } from '../sdk/client';

const client = new Client({
  baseUrl: 'https://api.example.com',
  token: 'my-token',
});

await client.queue.heartbeat('job-id');
await client.queue.commit('job-id', { result: 'ok' });
await client.queue.fail('job-id', 'ErrorKind', 'Something went wrong');
```

## Submodules

- **graph** – generic access to graph endpoints
- **storage** – helper for storage endpoints
- **queue** – job management helpers
- **provenance** – provenance information endpoints

## Queue API

### `heartbeat(jobId)`
Sends a heartbeat for a job.

### `commit(jobId, outputs, artifacts?, graphChanges?)`
Commits a job's outputs and optional artifacts or graph updates.

### `fail(jobId, kind, message)`
Marks a job as failed with error information.

All requests automatically include the `Authorization` header and retry with an
exponential backoff for `401`, `403`, and `429` responses.
