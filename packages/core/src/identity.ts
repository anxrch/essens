import fs from 'node:fs/promises'
import path from 'node:path'
import sodium from 'sodium-universal'
import b4a from 'b4a'
import { generateKeypair, encryptSecret, decryptSecret } from './crypto.js'
import type { Keypair, AuthorHex, DeviceId } from './types.js'

const KEYPAIR_FILENAME = 'identity.json'
const DEVICE_FILENAME = 'device.json'

export interface IdentityManager {
  init(storagePath: string): Promise<void>
  getKeypair(): Keypair
  getAuthorHex(): AuthorHex
  getDeviceId(): DeviceId
  exportIdentity(passphrase: string): string
  importIdentity(storagePath: string, encrypted: string, passphrase: string): Promise<void>
}

export function createIdentityManager(): IdentityManager {
  let keypair: Keypair | null = null
  let deviceId: DeviceId | null = null

  return {
    async init(storagePath: string) {
      // Load or generate keypair
      const filePath = path.join(storagePath, KEYPAIR_FILENAME)
      try {
        const raw = await fs.readFile(filePath, 'utf-8')
        const json = JSON.parse(raw)
        keypair = {
          publicKey: b4a.from(json.publicKey, 'hex'),
          secretKey: b4a.from(json.secretKey, 'hex'),
        }
      } catch {
        keypair = generateKeypair()
        await fs.mkdir(storagePath, { recursive: true })
        await fs.writeFile(filePath, JSON.stringify({
          publicKey: b4a.toString(keypair.publicKey, 'hex'),
          secretKey: b4a.toString(keypair.secretKey, 'hex'),
        }, null, 2))
      }

      // Load or generate device ID
      const deviceFilePath = path.join(storagePath, DEVICE_FILENAME)
      try {
        const raw = await fs.readFile(deviceFilePath, 'utf-8')
        deviceId = JSON.parse(raw).deviceId
      } catch {
        const idBuf = b4a.alloc(16)
        sodium.randombytes_buf(idBuf)
        deviceId = b4a.toString(idBuf, 'hex')
        await fs.mkdir(storagePath, { recursive: true })
        await fs.writeFile(deviceFilePath, JSON.stringify({ deviceId }, null, 2))
      }
    },

    getKeypair(): Keypair {
      if (!keypair) throw new Error('Identity not initialized')
      return keypair
    },

    getAuthorHex(): AuthorHex {
      if (!keypair) throw new Error('Identity not initialized')
      return b4a.toString(keypair.publicKey, 'hex')
    },

    getDeviceId(): DeviceId {
      if (!deviceId) throw new Error('Identity not initialized')
      return deviceId
    },

    exportIdentity(passphrase: string): string {
      if (!keypair) throw new Error('Identity not initialized')
      // Concatenate publicKey (32) + secretKey (64) = 96 bytes
      const combined = b4a.concat([keypair.publicKey, keypair.secretKey])
      return encryptSecret(combined, passphrase)
    },

    async importIdentity(storagePath: string, encrypted: string, passphrase: string) {
      const combined = decryptSecret(encrypted, passphrase)
      const publicKey = combined.subarray(0, sodium.crypto_sign_PUBLICKEYBYTES)
      const secretKey = combined.subarray(sodium.crypto_sign_PUBLICKEYBYTES)

      keypair = { publicKey, secretKey }

      await fs.mkdir(storagePath, { recursive: true })
      await fs.writeFile(
        path.join(storagePath, KEYPAIR_FILENAME),
        JSON.stringify({
          publicKey: b4a.toString(publicKey, 'hex'),
          secretKey: b4a.toString(secretKey, 'hex'),
        }, null, 2),
      )
    },
  }
}
