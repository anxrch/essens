import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import b4a from 'b4a'
import { createEssensStore } from '../store.js'
import { createFeedManager } from '../feed.js'
import { createIdentityManager } from '../identity.js'
import { createIndexer } from '../indexer.js'
import { createSyncManager } from '../sync.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('SyncManager', () => {
  let tmpDir: string
  let store: ReturnType<typeof createEssensStore>
  let identity: ReturnType<typeof createIdentityManager>
  let feedManager: ReturnType<typeof createFeedManager>
  let indexer: ReturnType<typeof createIndexer>
  let sync: ReturnType<typeof createSyncManager>

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'essens-sync-'))
    store = createEssensStore()
    identity = createIdentityManager()
    feedManager = createFeedManager()
    indexer = createIndexer()
    sync = createSyncManager()
    await identity.init(tmpDir)
    await store.init(tmpDir)
  })

  afterEach(async () => {
    await store.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('syncs all events on first call', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    await feedManager.append(feed, keypair, 'post.create', { text: 'post 1' })
    await feedManager.append(feed, keypair, 'post.create', { text: 'post 2' })
    await feedManager.append(feed, keypair, 'post.create', { text: 'post 3' })

    const result = await sync.syncFeed(db, feed, author, indexer)
    expect(result.indexed).toBe(3)
    expect(result.errors).toBe(0)

    // Verify events are in the index (author prefix scan)
    const authorEntries: any[] = []
    for await (const entry of db.createReadStream({
      gte: `author!${author}!`,
      lt: `author!${author}"`,
    })) {
      authorEntries.push(entry)
    }
    expect(authorEntries).toHaveLength(3)
  })

  it('only syncs new events on subsequent calls', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    await feedManager.append(feed, keypair, 'post.create', { text: 'post 1' })
    await feedManager.append(feed, keypair, 'post.create', { text: 'post 2' })

    const result1 = await sync.syncFeed(db, feed, author, indexer)
    expect(result1.indexed).toBe(2)

    await feedManager.append(feed, keypair, 'post.create', { text: 'post 3' })

    const result2 = await sync.syncFeed(db, feed, author, indexer)
    expect(result2.indexed).toBe(1)
  })

  it('returns zero when no new events', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    await feedManager.append(feed, keypair, 'post.create', { text: 'post 1' })
    await sync.syncFeed(db, feed, author, indexer)

    const result = await sync.syncFeed(db, feed, author, indexer)
    expect(result.indexed).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('tracks lastIndexedSeq correctly per feed key', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()
    const feedKeyHex = b4a.toString(feed.key, 'hex')

    expect(await sync.getLastIndexedSeq(db, feedKeyHex)).toBe(-1)

    await feedManager.append(feed, keypair, 'post.create', { text: 'post 1' })
    await feedManager.append(feed, keypair, 'post.create', { text: 'post 2' })
    await sync.syncFeed(db, feed, author, indexer)

    expect(await sync.getLastIndexedSeq(db, feedKeyHex)).toBe(1)
  })

  it('prevents concurrent syncs for the same feed', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    await feedManager.append(feed, keypair, 'post.create', { text: 'post 1' })

    // Run two syncs concurrently
    const [result1, result2] = await Promise.all([
      sync.syncFeed(db, feed, author, indexer),
      sync.syncFeed(db, feed, author, indexer),
    ])

    // One should have indexed, the other skipped
    expect(result1.indexed + result2.indexed).toBe(1)
  })
})
