import sodium from 'sodium-universal'
import b4a from 'b4a'
import type { UnsignedEnvelope, EventId, AuthorHex } from './types.js'

/**
 * Recursively produce a canonical JSON string with stable key ordering.
 * Keys are sorted lexicographically at every nesting level.
 * No insignificant whitespace. Undefined values are omitted.
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']'
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).sort()
    const pairs: string[] = []
    for (const k of keys) {
      const v = obj[k]
      if (v === undefined) continue
      pairs.push(JSON.stringify(k) + ':' + stableStringify(v))
    }
    return '{' + pairs.join(',') + '}'
  }
  return JSON.stringify(value)
}

/**
 * Compute canonical bytes of an unsigned envelope for signing.
 */
export function canonicalUnsignedBytes(envelope: UnsignedEnvelope): Buffer {
  return b4a.from(stableStringify(envelope), 'utf-8')
}

/**
 * Compute event ID: blake2b-256(author + ':' + seq + ':' + canonicalUnsignedBytes)
 */
export function computeEventId(
  author: AuthorHex,
  seq: number,
  envelope: UnsignedEnvelope,
): EventId {
  const canonical = b4a.from(stableStringify(envelope), 'utf-8')
  const preimage = b4a.from(`${author}:${seq}:`, 'utf-8')
  const input = b4a.concat([preimage, canonical])
  const out = b4a.alloc(32)
  sodium.crypto_generichash(out, input)
  return b4a.toString(out, 'hex')
}
