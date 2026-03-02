import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import b4a from 'b4a'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import { createIdentityManager } from '../identity.js'
import { createFeedManager } from '../feed.js'
import { createIndexer } from '../indexer.js'
import { createTimelineQuery } from '../timeline.js'
import { createDeviceRegistry } from '../device-registry.js'
import { createSyncManager } from '../sync.js'

describe('Multi-device: same identity, two feeds', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-multidev-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('two devices with same identity produce mergeable timeline', async () => {
    // --- 1. Create identity on Device A ---
    const dirA = path.join(tmpDir, 'device-a')
    const dirB = path.join(tmpDir, 'device-b')
    const dirFollower = path.join(tmpDir, 'follower')
    await fs.mkdir(dirA, { recursive: true })
    await fs.mkdir(dirB, { recursive: true })
    await fs.mkdir(dirFollower, { recursive: true })

    const identityA = createIdentityManager()
    await identityA.init(dirA)
    const author = identityA.getAuthorHex()
    const keypair = identityA.getKeypair()
    const deviceIdA = identityA.getDeviceId()

    // --- 2. Export and import identity to Device B ---
    const encrypted = identityA.exportIdentity('test-pass')
    const identityB = createIdentityManager()
    await identityB.importIdentity(dirB, encrypted, 'test-pass')
    await identityB.init(dirB) // This generates a new deviceId
    const deviceIdB = identityB.getDeviceId()

    // Same author, different device IDs
    expect(identityB.getAuthorHex()).toBe(author)
    expect(deviceIdB).not.toBe(deviceIdA)

    // --- 3. Set up two separate corestores (simulating two devices) ---
    const corestoreA = new Corestore(path.join(dirA, 'cores'))
    await corestoreA.ready()
    const feedA = corestoreA.get({ name: 'primary-feed' })
    await feedA.ready()
    const feedAKeyHex = b4a.toString(feedA.key, 'hex')

    const corestoreB = new Corestore(path.join(dirB, 'cores'))
    await corestoreB.ready()
    const feedB = corestoreB.get({ name: 'primary-feed' })
    await feedB.ready()
    const feedBKeyHex = b4a.toString(feedB.key, 'hex')

    // Feed keys are different (different corestores)
    expect(feedAKeyHex).not.toBe(feedBKeyHex)

    // --- 4. Each device announces itself ---
    const feedMgr = createFeedManager()

    const announceA = await feedMgr.append(feedA, keypair, 'device.announce', {
      deviceId: deviceIdA,
      feedKey: feedAKeyHex,
      deviceName: 'laptop',
    })

    const announceB = await feedMgr.append(feedB, keypair, 'device.announce', {
      deviceId: deviceIdB,
      feedKey: feedBKeyHex,
      deviceName: 'phone',
    })

    // --- 5. Each device creates posts ---
    const postA1 = await feedMgr.append(feedA, keypair, 'post.create', { text: 'Hello from laptop' })
    await new Promise(r => setTimeout(r, 5))
    const postB1 = await feedMgr.append(feedB, keypair, 'post.create', { text: 'Hello from phone' })
    await new Promise(r => setTimeout(r, 5))
    const postA2 = await feedMgr.append(feedA, keypair, 'post.create', { text: 'Laptop post 2' })
    await new Promise(r => setTimeout(r, 5))
    const postB2 = await feedMgr.append(feedB, keypair, 'post.create', { text: 'Phone post 2' })

    // --- 6. Follower sets up a shared index and indexes both feeds ---
    const corestoreFollower = new Corestore(path.join(dirFollower, 'cores'))
    await corestoreFollower.ready()
    const indexCore = corestoreFollower.get({ name: 'index' })
    await indexCore.ready()
    const db = new Hyperbee(indexCore, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await db.ready()

    const indexer = createIndexer()

    // Index all events from feedA
    await indexer.indexEvent(db, announceA)
    await indexer.indexEvent(db, postA1)
    await indexer.indexEvent(db, postA2)

    // Index all events from feedB
    await indexer.indexEvent(db, announceB)
    await indexer.indexEvent(db, postB1)
    await indexer.indexEvent(db, postB2)

    // --- 7. Verify device registry ---
    const registry = createDeviceRegistry()
    const devices = await registry.getDevices(db, author)
    expect(devices).toHaveLength(2)

    const deviceNames = devices.map(d => d.deviceName).sort()
    expect(deviceNames).toEqual(['laptop', 'phone'])

    const feedKeys = await registry.getFeedKeys(db, author)
    expect(feedKeys).toHaveLength(2)
    expect(feedKeys).toContain(feedAKeyHex)
    expect(feedKeys).toContain(feedBKeyHex)

    // --- 8. Verify merged timeline ---
    const timeline = createTimelineQuery()
    const entries = await timeline.getRecent(db, 100)

    // 4 posts from both devices, merged by reverse-chronological order
    expect(entries).toHaveLength(4)

    // All events have the same author
    for (const entry of entries) {
      expect(entry.author).toBe(author)
    }

    // Most recent first (postB2 > postA2 > postB1 > postA1)
    expect(entries[0].eventId).toBe(postB2.id)
    expect(entries[1].eventId).toBe(postA2.id)
    expect(entries[2].eventId).toBe(postB1.id)
    expect(entries[3].eventId).toBe(postA1.id)

    // --- 9. Verify filtered timeline works ---
    const filtered = await timeline.getRecentFiltered(db, 100)
    expect(filtered).toHaveLength(4) // No tombstones

    // --- 10. Verify no key collisions (each eventId is unique) ---
    const eventIds = new Set(entries.map(e => e.eventId))
    expect(eventIds.size).toBe(4)

    // Cleanup
    await corestoreA.close()
    await corestoreB.close()
    await corestoreFollower.close()
  })

  it('device revocation excludes revoked feed from getFeedKeys', async () => {
    const dirA = path.join(tmpDir, 'dev-a')
    await fs.mkdir(dirA)

    const identity = createIdentityManager()
    await identity.init(dirA)
    const author = identity.getAuthorHex()
    const keypair = identity.getKeypair()

    const corestore = new Corestore(path.join(dirA, 'cores'))
    await corestore.ready()
    const indexCore = corestore.get({ name: 'index' })
    await indexCore.ready()
    const db = new Hyperbee(indexCore, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await db.ready()

    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const registry = createDeviceRegistry()
    const feed = corestore.get({ name: 'primary-feed' })
    await feed.ready()

    // Announce two devices
    const env1 = await feedMgr.append(feed, keypair, 'device.announce', {
      deviceId: 'a'.repeat(32),
      feedKey: 'f'.repeat(64),
      deviceName: 'laptop',
    })
    await indexer.indexEvent(db, env1)

    const env2 = await feedMgr.append(feed, keypair, 'device.announce', {
      deviceId: 'b'.repeat(32),
      feedKey: 'e'.repeat(64),
      deviceName: 'phone',
    })
    await indexer.indexEvent(db, env2)

    expect(await registry.getFeedKeys(db, author)).toHaveLength(2)

    // Revoke the phone
    const revokeEnv = await feedMgr.append(feed, keypair, 'device.revoke', {
      deviceId: 'b'.repeat(32),
      feedKey: 'e'.repeat(64),
    })
    await indexer.indexEvent(db, revokeEnv)

    const feedKeys = await registry.getFeedKeys(db, author)
    expect(feedKeys).toHaveLength(1)
    expect(feedKeys[0]).toBe('f'.repeat(64))

    const allDevices = await registry.getAllDevices(db, author)
    expect(allDevices).toHaveLength(2)
    const phone = allDevices.find(d => d.deviceId === 'b'.repeat(32))
    expect(phone!.revoked).toBe(true)

    await corestore.close()
  })

  it('sync manager tracks progress per feed key', async () => {
    const dirA = path.join(tmpDir, 'sync-a')
    await fs.mkdir(dirA)

    const identity = createIdentityManager()
    await identity.init(dirA)
    const author = identity.getAuthorHex()
    const keypair = identity.getKeypair()

    const corestore = new Corestore(path.join(dirA, 'cores'))
    await corestore.ready()
    const indexCore = corestore.get({ name: 'index' })
    await indexCore.ready()
    const db = new Hyperbee(indexCore, { keyEncoding: 'utf-8', valueEncoding: 'json' })
    await db.ready()

    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const sync = createSyncManager()

    // Create two feeds
    const feedA = corestore.get({ name: 'feed-a' })
    await feedA.ready()
    const feedB = corestore.get({ name: 'feed-b' })
    await feedB.ready()

    const feedAKey = b4a.toString(feedA.key, 'hex')
    const feedBKey = b4a.toString(feedB.key, 'hex')

    // Write to feed A
    await feedMgr.append(feedA, keypair, 'post.create', { text: 'From A' })
    await feedMgr.append(feedA, keypair, 'post.create', { text: 'From A again' })

    // Write to feed B
    await feedMgr.append(feedB, keypair, 'post.create', { text: 'From B' })

    // Sync feed A
    const resultA = await sync.syncFeed(db, feedA, author, indexer)
    expect(resultA.indexed).toBe(2)

    // Sync feed B
    const resultB = await sync.syncFeed(db, feedB, author, indexer)
    expect(resultB.indexed).toBe(1)

    // Progress is tracked independently
    expect(await sync.getLastIndexedSeq(db, feedAKey)).toBe(1)
    expect(await sync.getLastIndexedSeq(db, feedBKey)).toBe(0)

    // Re-sync is no-op
    const resultA2 = await sync.syncFeed(db, feedA, author, indexer)
    expect(resultA2.indexed).toBe(0)

    await corestore.close()
  })

  it('identity export/import roundtrip preserves signing capability', async () => {
    const dirA = path.join(tmpDir, 'export-a')
    const dirB = path.join(tmpDir, 'export-b')
    await fs.mkdir(dirA)
    await fs.mkdir(dirB)

    // Create identity A
    const idA = createIdentityManager()
    await idA.init(dirA)
    const authorA = idA.getAuthorHex()

    // Export and import to B
    const encrypted = idA.exportIdentity('mypass')
    const idB = createIdentityManager()
    await idB.importIdentity(dirB, encrypted, 'mypass')
    await idB.init(dirB)

    // Both have same author
    expect(idB.getAuthorHex()).toBe(authorA)

    // Both can sign and the signatures are valid
    const feedMgr = createFeedManager()
    const corestoreA = new Corestore(path.join(dirA, 'cores'))
    await corestoreA.ready()
    const feedA = corestoreA.get({ name: 'primary' })
    await feedA.ready()

    const corestoreB = new Corestore(path.join(dirB, 'cores'))
    await corestoreB.ready()
    const feedB = corestoreB.get({ name: 'primary' })
    await feedB.ready()

    const envA = await feedMgr.append(feedA, idA.getKeypair(), 'post.create', { text: 'From A' })
    const envB = await feedMgr.append(feedB, idB.getKeypair(), 'post.create', { text: 'From B' })

    // Both envelopes have the same author
    expect(envA.author).toBe(authorA)
    expect(envB.author).toBe(authorA)

    // Different device IDs
    expect(idA.getDeviceId()).not.toBe(idB.getDeviceId())

    await corestoreA.close()
    await corestoreB.close()
  })
})
