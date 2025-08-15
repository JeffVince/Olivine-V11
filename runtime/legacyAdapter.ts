export interface RuntimeManifest {
  /** Unique name for the handler */
  name: string;
  /** Optional description */
  description?: string;
}

export type LegacyQueueHandler<T = unknown> = (payload: T) => Promise<void>;

export interface RuntimeHandler<T = unknown> {
  manifest: RuntimeManifest;
  handler: (payload: T) => Promise<void>;
}

/**
 * Convert an existing queue handler into a RuntimeHandler
 * compatible with manifest-based registration.
 */
export function legacyAdapter<T>(
  manifest: RuntimeManifest,
  handler: LegacyQueueHandler<T>
): RuntimeHandler<T> {
  return {
    manifest,
    handler: async (payload: T) => {
      await handler(payload);
    }
  };
}
