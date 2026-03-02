import { describe, it, expect } from 'vitest'
import sodium from 'sodium-universal'
import b4a from 'b4a'
import { generateKeypair, sign, verify, encryptSecretWithKey, decryptSecretWithKey } from '../crypto.js'

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

describe('encryptSecretWithKey / decryptSecretWithKey', () => {
  function randomKey(): Buffer {
    const key = b4a.alloc(sodium.crypto_secretbox_KEYBYTES)
    sodium.randombytes_buf(key)
    return key
  }

  it('round-trips successfully', () => {
    const key = randomKey()
    const secret = b4a.from('top-secret-data-here!', 'utf-8')
    const encrypted = encryptSecretWithKey(secret, key)
    const decrypted = decryptSecretWithKey(encrypted, key)
    expect(Buffer.compare(decrypted, secret)).toBe(0)
  })

  it('rejects wrong key', () => {
    const key1 = randomKey()
    const key2 = randomKey()
    const secret = b4a.from('secret', 'utf-8')
    const encrypted = encryptSecretWithKey(secret, key1)
    expect(() => decryptSecretWithKey(encrypted, key2)).toThrow('wrong key')
  })

  it('includes version byte 0x01', () => {
    const key = randomKey()
    const secret = b4a.from('test', 'utf-8')
    const encrypted = encryptSecretWithKey(secret, key)
    const packed = b4a.from(encrypted, 'base64')
    expect(packed[0]).toBe(0x01)
  })

  it('rejects unsupported version', () => {
    const key = randomKey()
    const secret = b4a.from('test', 'utf-8')
    const encrypted = encryptSecretWithKey(secret, key)
    const packed = b4a.from(encrypted, 'base64')
    packed[0] = 0xFF
    const tampered = b4a.toString(packed, 'base64')
    expect(() => decryptSecretWithKey(tampered, key)).toThrow('Unsupported encryption format')
  })
})
