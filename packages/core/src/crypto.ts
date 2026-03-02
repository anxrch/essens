import sodium from 'sodium-universal'
import b4a from 'b4a'
import type { Keypair, SignatureHex } from './types.js'

export function generateKeypair(): Keypair {
  const publicKey = b4a.alloc(sodium.crypto_sign_PUBLICKEYBYTES)
  const secretKey = b4a.alloc(sodium.crypto_sign_SECRETKEYBYTES)
  sodium.crypto_sign_keypair(publicKey, secretKey)
  return { publicKey, secretKey }
}

export function sign(message: Buffer, secretKey: Buffer): SignatureHex {
  const sig = b4a.alloc(sodium.crypto_sign_BYTES)
  sodium.crypto_sign_detached(sig, message, secretKey)
  return b4a.toString(sig, 'hex')
}

export function verify(
  message: Buffer,
  signature: SignatureHex,
  publicKey: Buffer,
): boolean {
  const sigBuf = b4a.from(signature, 'hex')
  return sodium.crypto_sign_verify_detached(sigBuf, message, publicKey)
}

/**
 * Encrypt a secret key with a passphrase using Argon2id + XSalsa20-Poly1305.
 * Returns a base64 string containing salt + nonce + ciphertext.
 */
export function encryptSecret(secretKey: Buffer, passphrase: string): string {
  const salt = b4a.alloc(sodium.crypto_pwhash_SALTBYTES)
  sodium.randombytes_buf(salt)

  const derivedKey = b4a.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.crypto_pwhash(
    derivedKey,
    b4a.from(passphrase, 'utf-8'),
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )

  const nonce = b4a.alloc(sodium.crypto_secretbox_NONCEBYTES)
  sodium.randombytes_buf(nonce)

  const ciphertext = b4a.alloc(secretKey.length + sodium.crypto_secretbox_MACBYTES)
  sodium.crypto_secretbox_easy(ciphertext, secretKey, nonce, derivedKey)

  // Pack: salt (16) + nonce (24) + ciphertext (64 + 16 = 80)
  const packed = b4a.concat([salt, nonce, ciphertext])
  return b4a.toString(packed, 'base64')
}

/**
 * Decrypt a secret key encrypted with encryptSecret.
 * Throws if the passphrase is wrong.
 */
export function decryptSecret(encrypted: string, passphrase: string): Buffer {
  const packed = b4a.from(encrypted, 'base64')

  const saltLen = sodium.crypto_pwhash_SALTBYTES         // 16
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES    // 24

  const salt = packed.subarray(0, saltLen)
  const nonce = packed.subarray(saltLen, saltLen + nonceLen)
  const ciphertext = packed.subarray(saltLen + nonceLen)

  const derivedKey = b4a.alloc(sodium.crypto_secretbox_KEYBYTES)
  sodium.crypto_pwhash(
    derivedKey,
    b4a.from(passphrase, 'utf-8'),
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  )

  const plaintext = b4a.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES)
  const ok = sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, derivedKey)
  if (!ok) {
    throw new Error('Decryption failed: wrong passphrase')
  }

  return plaintext
}

/**
 * Encrypt a secret with a raw 32-byte key (no passphrase derivation).
 * Format: version(1) + nonce(24) + ciphertext → base64
 */
export function encryptSecretWithKey(secret: Buffer, key: Buffer): string {
  const VERSION = 0x01
  const nonce = b4a.alloc(sodium.crypto_secretbox_NONCEBYTES)
  sodium.randombytes_buf(nonce)

  const ciphertext = b4a.alloc(secret.length + sodium.crypto_secretbox_MACBYTES)
  sodium.crypto_secretbox_easy(ciphertext, secret, nonce, key)

  const versionBuf = b4a.alloc(1)
  versionBuf[0] = VERSION
  const packed = b4a.concat([versionBuf, nonce, ciphertext])
  return b4a.toString(packed, 'base64')
}

/**
 * Decrypt a secret encrypted with encryptSecretWithKey.
 * Throws if the key is wrong or data is corrupted.
 */
export function decryptSecretWithKey(encrypted: string, key: Buffer): Buffer {
  const packed = b4a.from(encrypted, 'base64')

  const version = packed[0]
  if (version !== 0x01) {
    throw new Error('Unsupported encryption format')
  }

  const nonceLen = sodium.crypto_secretbox_NONCEBYTES // 24
  const nonce = packed.subarray(1, 1 + nonceLen)
  const ciphertext = packed.subarray(1 + nonceLen)

  const plaintext = b4a.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES)
  const ok = sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, key)
  if (!ok) {
    throw new Error('Decryption failed: wrong key')
  }

  return plaintext
}

/**
 * Derive a 32-byte discovery topic for an author's Ed25519 public key.
 * Used as a DHT rendezvous point so devices and followers can find each other.
 */
export function authorDiscoveryTopic(authorHex: string): Buffer {
  const input = b4a.from(`essens:author:${authorHex}`, 'utf-8')
  const out = b4a.alloc(sodium.crypto_generichash_BYTES) // 32 bytes
  sodium.crypto_generichash(out, input)
  return out
}
