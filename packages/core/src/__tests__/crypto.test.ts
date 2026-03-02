import { describe, it, expect } from 'vitest'
import b4a from 'b4a'
import { generateKeypair, sign, verify } from '../crypto.js'

describe('generateKeypair', () => {
  it('produces 32-byte public key and 64-byte secret key', () => {
    const kp = generateKeypair()
    expect(kp.publicKey.length).toBe(32)
    expect(kp.secretKey.length).toBe(64)
  })

  it('produces different keypairs each time', () => {
    const a = generateKeypair()
    const b = generateKeypair()
    expect(Buffer.compare(a.publicKey, b.publicKey)).not.toBe(0)
  })
})

describe('sign and verify', () => {
  it('round-trips successfully', () => {
    const kp = generateKeypair()
    const message = b4a.from('hello world', 'utf-8')
    const sig = sign(message, kp.secretKey)

    expect(sig).toHaveLength(128) // 64 bytes = 128 hex chars
    expect(verify(message, sig, kp.publicKey)).toBe(true)
  })

  it('rejects wrong message', () => {
    const kp = generateKeypair()
    const message = b4a.from('hello', 'utf-8')
    const sig = sign(message, kp.secretKey)
    const tampered = b4a.from('world', 'utf-8')
    expect(verify(tampered, sig, kp.publicKey)).toBe(false)
  })

  it('rejects wrong public key', () => {
    const kp1 = generateKeypair()
    const kp2 = generateKeypair()
    const message = b4a.from('hello', 'utf-8')
    const sig = sign(message, kp1.secretKey)
    expect(verify(message, sig, kp2.publicKey)).toBe(false)
  })

  it('rejects mutated signature', () => {
    const kp = generateKeypair()
    const message = b4a.from('hello', 'utf-8')
    const sig = sign(message, kp.secretKey)
    // Flip one character
    const mutated = sig.slice(0, -1) + (sig.at(-1) === '0' ? '1' : '0')
    expect(verify(message, mutated, kp.publicKey)).toBe(false)
  })
})
