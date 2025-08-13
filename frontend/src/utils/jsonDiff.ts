export interface DiffEntry {
  path: string
  a?: unknown
  b?: unknown
}

export function diffJson(a: unknown, b: unknown, basePath = ''): DiffEntry[] {
  const diffs: DiffEntry[] = []
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    if (a !== b) diffs.push({ path: basePath || '/', a, b })
    return diffs
  }
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    const nextPath = basePath ? `${basePath}.${key}` : key
    if (!(key in a)) {
      diffs.push({ path: nextPath, a: undefined, b: (b as Record<string, unknown>)[key] })
      continue
    }
    if (!(key in b)) {
      diffs.push({ path: nextPath, a: (a as Record<string, unknown>)[key], b: undefined })
      continue
    }
    diffs.push(...diffJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], nextPath))
  }
  return diffs
}


