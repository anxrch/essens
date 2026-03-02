import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createIdentityManager } from '../identity.js'

describe('IdentityManager', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-identity-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('creates a new identity on first init', async () => {
    const mgr = createIdentityManager()
    await mgr.init(tmpDir)

    const kp = mgr.getKeypair()
    expect(kp.publicKey.length).toBe(32)
    expect(kp.secretKey.length).toBe(64)

    const author = mgr.getAuthorHex()
    expect(author).toHaveLength(64)
    expect(/^[0-9a-f]{64}$/.test(author)).toBe(true)
  })

  it('persists and loads the same identity', async () => {
    const mgr1 = createIdentityManager()
    await mgr1.init(tmpDir)
    const author1 = mgr1.getAuthorHex()

    const mgr2 = createIdentityManager()
    await mgr2.init(tmpDir)
    const author2 = mgr2.getAuthorHex()

    expect(author1).toBe(author2)
  })

  it('creates identity.json file', async () => {
    const mgr = createIdentityManager()
    await mgr.init(tmpDir)

    const filePath = path.join(tmpDir, 'identity.json')
    const stat = await fs.stat(filePath)
    expect(stat.isFile()).toBe(true)

    const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'))
    expect(raw.publicKey).toHaveLength(64)
    expect(raw.secretKey).toHaveLength(128)
  })

  it('throws if not initialized', () => {
    const mgr = createIdentityManager()
    expect(() => mgr.getKeypair()).toThrow('Identity not initialized')
    expect(() => mgr.getAuthorHex()).toThrow('Identity not initialized')
    expect(() => mgr.getDeviceId()).toThrow('Identity not initialized')
  })

  it('generates and persists a stable deviceId', async () => {
    const mgr1 = createIdentityManager()
    await mgr1.init(tmpDir)
    const deviceId1 = mgr1.getDeviceId()

    expect(deviceId1).toHaveLength(32)
    expect(/^[0-9a-f]{32}$/.test(deviceId1)).toBe(true)

    // Reload — same deviceId
    const mgr2 = createIdentityManager()
    await mgr2.init(tmpDir)
    expect(mgr2.getDeviceId()).toBe(deviceId1)
  })

  it('export and import identity via passphrase', async () => {
    const mgr1 = createIdentityManager()
    await mgr1.init(tmpDir)
    const author1 = mgr1.getAuthorHex()

    const encrypted = mgr1.exportIdentity('my-secret-passphrase')
    expect(typeof encrypted).toBe('string')
    expect(encrypted.length).toBeGreaterThan(0)

    // Import on a different storage path
    const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-import-'))
    try {
      const mgr2 = createIdentityManager()
      await mgr2.importIdentity(tmpDir2, encrypted, 'my-secret-passphrase')

      // Init to load deviceId (importIdentity doesn't init deviceId)
      await mgr2.init(tmpDir2)
      const author2 = mgr2.getAuthorHex()

      expect(author2).toBe(author1)

      // Device ID should be different (new device)
      expect(mgr2.getDeviceId()).not.toBe(mgr1.getDeviceId())
    } finally {
      await fs.rm(tmpDir2, { recursive: true, force: true })
    }
  })

  it('rejects wrong passphrase on import', async () => {
    const mgr = createIdentityManager()
    await mgr.init(tmpDir)
    const encrypted = mgr.exportIdentity('correct-pass')

    const tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-import-'))
    try {
      const mgr2 = createIdentityManager()
      await expect(
        mgr2.importIdentity(tmpDir2, encrypted, 'wrong-pass'),
      ).rejects.toThrow('Decryption failed')
    } finally {
      await fs.rm(tmpDir2, { recursive: true, force: true })
    }
  })
})
