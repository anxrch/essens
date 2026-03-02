import { describe, it, expect } from 'vitest'
import { stableStringify, computeEventId, canonicalUnsignedBytes } from '../canonical.js'
import type { UnsignedEnvelope } from '../types.js'

describe('stableStringify', () => {
  it('sorts keys lexicographically', () => {
    const result = stableStringify({ z: 1, a: 2, m: 3 })
    expect(result).toBe('{"a":2,"m":3,"z":1}')
  })

  it('handles nested objects with stable ordering', () => {
    const result = stableStringify({ b: { z: 1, a: 2 }, a: 1 })
    expect(result).toBe('{"a":1,"b":{"a":2,"z":1}}')
  })

  it('handles arrays preserving element order', () => {
    const result = stableStringify({ items: [3, 1, 2] })
    expect(result).toBe('{"items":[3,1,2]}')
  })

  it('handles null values', () => {
    expect(stableStringify(null)).toBe('null')
    expect(stableStringify({ a: null })).toBe('{"a":null}')
  })

  it('omits undefined values', () => {
    expect(stableStringify({ a: 1, b: undefined, c: 3 })).toBe('{"a":1,"c":3}')
  })

  it('handles strings with special characters', () => {
    const result = stableStringify({ text: 'hello "world"\nnewline' })
    expect(result).toBe('{"text":"hello \\"world\\"\\nnewline"}')
  })

  it('handles empty objects and arrays', () => {
    expect(stableStringify({})).toBe('{}')
    expect(stableStringify([])).toBe('[]')
  })

  it('is deterministic across multiple calls', () => {
    const obj = { kind: 'post.create', body: { text: 'hi', tags: ['a', 'b'] }, seq: 0 }
    const a = stableStringify(obj)
    const b = stableStringify(obj)
    expect(a).toBe(b)
  })

  it('handles booleans', () => {
    expect(stableStringify(true)).toBe('true')
    expect(stableStringify(false)).toBe('false')
    expect(stableStringify({ value: true })).toBe('{"value":true}')
  })
})

describe('canonicalUnsignedBytes', () => {
  it('produces a buffer from an envelope', () => {
    const envelope: UnsignedEnvelope = {
      author: 'abcdef',
      seq: 0,
      prev: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      kind: 'post.create',
      body: { text: 'hello' },
    }
    const buf = canonicalUnsignedBytes(envelope)
    expect(Buffer.isBuffer(buf) || buf instanceof Uint8Array).toBe(true)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    const envelope: UnsignedEnvelope = {
      author: 'abcdef',
      seq: 0,
      prev: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      kind: 'post.create',
      body: { text: 'hello', tags: ['test'] },
    }
    const a = canonicalUnsignedBytes(envelope)
    const b = canonicalUnsignedBytes(envelope)
    expect(Buffer.compare(a, b)).toBe(0)
  })
})

describe('computeEventId', () => {
  it('produces a 64-character hex string', () => {
    const envelope: UnsignedEnvelope = {
      author: 'a'.repeat(64),
      seq: 0,
      prev: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      kind: 'post.create',
      body: { text: 'hello' },
    }
    const id = computeEventId(envelope.author, envelope.seq, envelope)
    expect(id).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(id)).toBe(true)
  })

  it('is deterministic', () => {
    const envelope: UnsignedEnvelope = {
      author: 'a'.repeat(64),
      seq: 0,
      prev: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      kind: 'post.create',
      body: { text: 'hello' },
    }
    const a = computeEventId(envelope.author, envelope.seq, envelope)
    const b = computeEventId(envelope.author, envelope.seq, envelope)
    expect(a).toBe(b)
  })

  it('produces different ids for different seq numbers', () => {
    const base: UnsignedEnvelope = {
      author: 'a'.repeat(64),
      seq: 0,
      prev: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      kind: 'post.create',
      body: { text: 'hello' },
    }
    const id0 = computeEventId(base.author, 0, base)
    const id1 = computeEventId(base.author, 1, { ...base, seq: 1 })
    expect(id0).not.toBe(id1)
  })

  it('produces different ids for different body content', () => {
    const a: UnsignedEnvelope = {
      author: 'a'.repeat(64),
      seq: 0,
      prev: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      kind: 'post.create',
      body: { text: 'hello' },
    }
    const b: UnsignedEnvelope = {
      ...a,
      body: { text: 'world' },
    }
    expect(computeEventId(a.author, a.seq, a)).not.toBe(computeEventId(b.author, b.seq, b))
  })
})
