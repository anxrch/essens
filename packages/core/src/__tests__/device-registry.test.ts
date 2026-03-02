import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { createDeviceRegistry } from '../device-registry.js'
import { createIndexer } from '../indexer.js'
import { createIdentityManager } from '../identity.js'
import { createFeedManager } from '../feed.js'

describe('DeviceRegistry', () => {
  let tmpDir: string
  let db: any
  let corestore: any
  const registry = createDeviceRegistry()

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'essens-devreg-'))
    corestore = new Corestore(path.join(tmpDir, 'cores'))
    await corestore.ready()
    const indexCore = corestore.get({ name: 'index' })
    await indexCore.ready()
    db = new Hyperbee(indexCore, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await db.ready()
  })

  afterEach(async () => {
    await corestore.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty for unknown author', async () => {
    const devices = await registry.getDevices(db, 'a'.repeat(64))
    expect(devices).toHaveLength(0)
  })

  it('finds devices after indexing device.announce events', async () => {
    const identity = createIdentityManager()
    await identity.init(tmpDir)
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const feed = corestore.get({ name: 'test-feed' })
    await feed.ready()
    const author = identity.getAuthorHex()
    const keypair = identity.getKeypair()

    const env = await feedMgr.append(feed, keypair, 'device.announce', {
      deviceId: 'a'.repeat(32),
      feedKey: 'f'.repeat(64),
      deviceName: 'laptop',
    })
    await indexer.indexEvent(db, env)

    const devices = await registry.getDevices(db, author)
    expect(devices).toHaveLength(1)
    expect(devices[0].deviceId).toBe('a'.repeat(32))
    expect(devices[0].feedKey).toBe('f'.repeat(64))
    expect(devices[0].deviceName).toBe('laptop')
    expect(devices[0].revoked).toBe(false)
  })

  it('handles device.revoke correctly', async () => {
    const identity = createIdentityManager()
    await identity.init(tmpDir)
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const feed = corestore.get({ name: 'test-feed' })
    await feed.ready()
    const author = identity.getAuthorHex()
    const keypair = identity.getKeypair()

    // Announce
    const announceEnv = await feedMgr.append(feed, keypair, 'device.announce', {
      deviceId: 'a'.repeat(32),
      feedKey: 'f'.repeat(64),
    })
    await indexer.indexEvent(db, announceEnv)

    // Revoke
    const revokeEnv = await feedMgr.append(feed, keypair, 'device.revoke', {
      deviceId: 'a'.repeat(32),
      feedKey: 'f'.repeat(64),
    })
    await indexer.indexEvent(db, revokeEnv)

    // Non-revoked should be empty
    const devices = await registry.getDevices(db, author)
    expect(devices).toHaveLength(0)

    // All devices includes revoked
    const allDevices = await registry.getAllDevices(db, author)
    expect(allDevices).toHaveLength(1)
    expect(allDevices[0].revoked).toBe(true)
  })

  it('getFeedKeys excludes revoked devices', async () => {
    const identity = createIdentityManager()
    await identity.init(tmpDir)
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const feed = corestore.get({ name: 'test-feed' })
    await feed.ready()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    // Announce two devices
    const env1 = await feedMgr.append(feed, keypair, 'device.announce', {
      deviceId: 'a'.repeat(32),
      feedKey: 'f'.repeat(64),
    })
    await indexer.indexEvent(db, env1)

    const env2 = await feedMgr.append(feed, keypair, 'device.announce', {
      deviceId: 'b'.repeat(32),
      feedKey: 'e'.repeat(64),
    })
    await indexer.indexEvent(db, env2)

    // Revoke first
    const revokeEnv = await feedMgr.append(feed, keypair, 'device.revoke', {
      deviceId: 'a'.repeat(32),
      feedKey: 'f'.repeat(64),
    })
    await indexer.indexEvent(db, revokeEnv)

    const feedKeys = await registry.getFeedKeys(db, author)
    expect(feedKeys).toHaveLength(1)
    expect(feedKeys[0]).toBe('e'.repeat(64))
  })

  it('getDevice returns specific device record', async () => {
    const identity = createIdentityManager()
    await identity.init(tmpDir)
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const feed = corestore.get({ name: 'test-feed' })
    await feed.ready()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    const env = await feedMgr.append(feed, keypair, 'device.announce', {
      deviceId: 'c'.repeat(32),
      feedKey: 'd'.repeat(64),
    })
    await indexer.indexEvent(db, env)

    const device = await registry.getDevice(db, author, 'c'.repeat(32))
    expect(device).not.toBeNull()
    expect(device!.feedKey).toBe('d'.repeat(64))

    const missing = await registry.getDevice(db, author, 'x'.repeat(32))
    expect(missing).toBeNull()
  })
})
