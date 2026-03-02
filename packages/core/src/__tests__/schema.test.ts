import { describe, it, expect } from 'vitest'
import { validateBody } from '../schema.js'

describe('validateBody', () => {
  describe('post.create', () => {
    it('accepts valid post', () => {
      const result = validateBody('post.create', { text: 'hello world' })
      expect(result.success).toBe(true)
    })

    it('accepts post with tags', () => {
      const result = validateBody('post.create', { text: 'hello', tags: ['intro', 'test'] })
      expect(result.success).toBe(true)
    })

    it('accepts post with replyTo', () => {
      const result = validateBody('post.create', { text: 'reply', replyTo: 'abc123' })
      expect(result.success).toBe(true)
    })

    it('rejects empty text', () => {
      const result = validateBody('post.create', { text: '' })
      expect(result.success).toBe(false)
    })

    it('rejects text exceeding 500 characters', () => {
      const result = validateBody('post.create', { text: 'x'.repeat(501) })
      expect(result.success).toBe(false)
    })

    it('accepts text at exactly 500 characters', () => {
      const result = validateBody('post.create', { text: 'x'.repeat(500) })
      expect(result.success).toBe(true)
    })

    it('rejects more than 8 tags', () => {
      const tags = Array.from({ length: 9 }, (_, i) => `tag${i}`)
      const result = validateBody('post.create', { text: 'hello', tags })
      expect(result.success).toBe(false)
    })

    it('rejects tag exceeding 32 characters', () => {
      const result = validateBody('post.create', { text: 'hello', tags: ['x'.repeat(33)] })
      expect(result.success).toBe(false)
    })

    it('rejects missing text field', () => {
      const result = validateBody('post.create', { tags: ['test'] })
      expect(result.success).toBe(false)
    })
  })

  describe('profile.update', () => {
    it('accepts displayName only', () => {
      const result = validateBody('profile.update', { displayName: 'hellel' })
      expect(result.success).toBe(true)
    })

    it('accepts bio only', () => {
      const result = validateBody('profile.update', { bio: 'local-first node' })
      expect(result.success).toBe(true)
    })

    it('accepts both fields', () => {
      const result = validateBody('profile.update', { displayName: 'hellel', bio: 'hello' })
      expect(result.success).toBe(true)
    })

    it('rejects empty object', () => {
      const result = validateBody('profile.update', {})
      expect(result.success).toBe(false)
    })

    it('rejects displayName exceeding 50 characters', () => {
      const result = validateBody('profile.update', { displayName: 'x'.repeat(51) })
      expect(result.success).toBe(false)
    })

    it('rejects bio exceeding 160 characters', () => {
      const result = validateBody('profile.update', { bio: 'x'.repeat(161) })
      expect(result.success).toBe(false)
    })
  })

  describe('post.delete_tombstone', () => {
    it('accepts valid target', () => {
      const result = validateBody('post.delete_tombstone', { target: 'abc123' })
      expect(result.success).toBe(true)
    })

    it('rejects missing target', () => {
      const result = validateBody('post.delete_tombstone', {})
      expect(result.success).toBe(false)
    })

    it('rejects empty target', () => {
      const result = validateBody('post.delete_tombstone', { target: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('follow.create', () => {
    const validTarget = 'a'.repeat(64)

    it('accepts valid 64-char hex target', () => {
      const result = validateBody('follow.create', { target: validTarget })
      expect(result.success).toBe(true)
    })

    it('rejects target shorter than 64 chars', () => {
      const result = validateBody('follow.create', { target: 'a'.repeat(63) })
      expect(result.success).toBe(false)
    })

    it('rejects target longer than 64 chars', () => {
      const result = validateBody('follow.create', { target: 'a'.repeat(65) })
      expect(result.success).toBe(false)
    })

    it('rejects non-hex target', () => {
      const result = validateBody('follow.create', { target: 'g'.repeat(64) })
      expect(result.success).toBe(false)
    })

    it('rejects missing target', () => {
      const result = validateBody('follow.create', {})
      expect(result.success).toBe(false)
    })
  })

  describe('follow.remove', () => {
    const validTarget = 'b'.repeat(64)

    it('accepts valid 64-char hex target', () => {
      const result = validateBody('follow.remove', { target: validTarget })
      expect(result.success).toBe(true)
    })

    it('rejects non-hex target', () => {
      const result = validateBody('follow.remove', { target: 'Z'.repeat(64) })
      expect(result.success).toBe(false)
    })

    it('rejects missing target', () => {
      const result = validateBody('follow.remove', {})
      expect(result.success).toBe(false)
    })
  })

  describe('device.announce', () => {
    const validBody = {
      deviceId: 'a'.repeat(32),
      feedKey: 'b'.repeat(64),
    }

    it('accepts valid announce body', () => {
      const result = validateBody('device.announce', validBody)
      expect(result.success).toBe(true)
    })

    it('accepts with optional deviceName', () => {
      const result = validateBody('device.announce', { ...validBody, deviceName: 'laptop' })
      expect(result.success).toBe(true)
    })

    it('rejects missing deviceId', () => {
      const result = validateBody('device.announce', { feedKey: 'b'.repeat(64) })
      expect(result.success).toBe(false)
    })

    it('rejects missing feedKey', () => {
      const result = validateBody('device.announce', { deviceId: 'a'.repeat(32) })
      expect(result.success).toBe(false)
    })

    it('rejects deviceId wrong length', () => {
      const result = validateBody('device.announce', { deviceId: 'a'.repeat(31), feedKey: 'b'.repeat(64) })
      expect(result.success).toBe(false)
    })

    it('rejects feedKey wrong length', () => {
      const result = validateBody('device.announce', { deviceId: 'a'.repeat(32), feedKey: 'b'.repeat(63) })
      expect(result.success).toBe(false)
    })

    it('rejects non-hex deviceId', () => {
      const result = validateBody('device.announce', { deviceId: 'g'.repeat(32), feedKey: 'b'.repeat(64) })
      expect(result.success).toBe(false)
    })

    it('rejects deviceName exceeding 50 chars', () => {
      const result = validateBody('device.announce', { ...validBody, deviceName: 'x'.repeat(51) })
      expect(result.success).toBe(false)
    })
  })

  describe('device.revoke', () => {
    const validBody = {
      deviceId: 'a'.repeat(32),
      feedKey: 'b'.repeat(64),
    }

    it('accepts valid revoke body', () => {
      const result = validateBody('device.revoke', validBody)
      expect(result.success).toBe(true)
    })

    it('rejects missing deviceId', () => {
      const result = validateBody('device.revoke', { feedKey: 'b'.repeat(64) })
      expect(result.success).toBe(false)
    })

    it('rejects non-hex feedKey', () => {
      const result = validateBody('device.revoke', { deviceId: 'a'.repeat(32), feedKey: 'z'.repeat(64) })
      expect(result.success).toBe(false)
    })
  })

  describe('unknown kind', () => {
    it('rejects unknown event kind', () => {
      const result = validateBody('unknown.kind', { text: 'hello' })
      expect(result.success).toBe(false)
    })
  })
})
