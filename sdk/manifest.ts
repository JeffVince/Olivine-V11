import { JobEnvelope } from '../runtime/worker'

export interface Schema<T> {
  parse(data: unknown): T
}

export interface HandlerDefinition<I, O> {
  queue: string
  input: Schema<I>
  output: Schema<O>
  handler: (payload: I) => Promise<O>
}

/**
 * Validates manifest definitions for queues and I/O schemas.
 */
export function loadManifest(defs: HandlerDefinition<any, any>[]): Map<string, HandlerDefinition<any, any>> {
  const map = new Map<string, HandlerDefinition<any, any>>()
  for (const def of defs) {
    if (!def.queue) throw new Error('Queue name is required')
    if (map.has(def.queue)) throw new Error(`Duplicate queue: ${def.queue}`)
    if (!def.input || !def.output) throw new Error(`I/O schemas required for queue ${def.queue}`)
    map.set(def.queue, def)
  }
  return map
}

export async function executeFromManifest(
  manifest: Map<string, HandlerDefinition<any, any>>,
  job: JobEnvelope
): Promise<unknown> {
  const def = manifest.get(job.queue)
  if (!def) throw new Error(`Unknown queue: ${job.queue}`)
  const input = def.input.parse(job.payload)
  const result = await def.handler(input)
  def.output.parse(result)
  return result
}
