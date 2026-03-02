import { describe, it, expect } from 'vitest'
import b4a from 'b4a'
import { generateKeypair } from '../crypto.js'
import { createSignedEnvelope, verifyEnvelope } from '../envelope.js'
import type { SignedEnvelope } from '../types.js'

describe('createSignedEnvelope', () => {
  it('creates a valid post.create envelope', () => {
    const kp = generateKeypair()
    const envelope = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'hello world' },
    })

    expect(envelope.id).toHaveLength(64)
    expect(envelope.author).toBe(b4a.toString(kp.publicKey, 'hex'))
    expect(envelope.seq).toBe(0)
    expect(envelope.prev).toBeNull()
    expect(envelope.kind).toBe('post.create')
    expect(envelope.sig).toHaveLength(128)
    expect(envelope.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('creates a valid profile.update envelope', () => {
    const kp = generateKeypair()
    const envelope = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'profile.update',
      body: { displayName: 'hellel', bio: 'local-first' },
    })

    expect(envelope.kind).toBe('profile.update')
    expect(verifyEnvelope(envelope)).toBe(true)
  })

  it('throws on invalid body', () => {
    const kp = generateKeypair()
    expect(() => createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: '' } as any,
    })).toThrow('Invalid body')
  })

  it('throws on unknown kind', () => {
    const kp = generateKeypair()
    expect(() => createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'unknown.kind' as any,
      body: { text: 'hello' },
    })).toThrow('Invalid body')
  })
})

describe('verifyEnvelope', () => {
  it('verifies a correctly signed envelope', () => {
    const kp = generateKeypair()
    const envelope = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'hello world' },
    })
    expect(verifyEnvelope(envelope)).toBe(true)
  })

  it('rejects tampered body', () => {
    const kp = generateKeypair()
    const envelope = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'hello world' },
    })
    const tampered: SignedEnvelope = {
      ...envelope,
      body: { text: 'tampered' },
    }
    expect(verifyEnvelope(tampered)).toBe(false)
  })

  it('rejects wrong author', () => {
    const kp = generateKeypair()
    const kp2 = generateKeypair()
    const envelope = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'hello world' },
    })
    const tampered: SignedEnvelope = {
      ...envelope,
      author: b4a.toString(kp2.publicKey, 'hex'),
    }
    expect(verifyEnvelope(tampered)).toBe(false)
  })

  it('rejects wrong seq', () => {
    const kp = generateKeypair()
    const envelope = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'hello' },
    })
    const tampered: SignedEnvelope = { ...envelope, seq: 1 }
    expect(verifyEnvelope(tampered)).toBe(false)
  })

  it('rejects mutated signature', () => {
    const kp = generateKeypair()
    const envelope = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'hello' },
    })
    const tampered: SignedEnvelope = {
      ...envelope,
      sig: envelope.sig.slice(0, -1) + (envelope.sig.at(-1) === '0' ? '1' : '0'),
    }
    expect(verifyEnvelope(tampered)).toBe(false)
  })

  it('verifies envelope with prev link', () => {
    const kp = generateKeypair()
    const first = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'first' },
    })
    const second = createSignedEnvelope({
      keypair: kp,
      seq: 1,
      prev: first.id,
      kind: 'post.create',
      body: { text: 'second' },
    })
    expect(verifyEnvelope(second)).toBe(true)
    expect(second.prev).toBe(first.id)
  })

  it('verifies tombstone envelope', () => {
    const kp = generateKeypair()
    const post = createSignedEnvelope({
      keypair: kp,
      seq: 0,
      prev: null,
      kind: 'post.create',
      body: { text: 'to be deleted' },
    })
    const tombstone = createSignedEnvelope({
      keypair: kp,
      seq: 1,
      prev: post.id,
      kind: 'post.delete_tombstone',
      body: { target: post.id },
    })
    expect(verifyEnvelope(tombstone)).toBe(true)
  })
})
