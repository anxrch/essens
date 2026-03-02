import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createEssensStore } from '../store.js'
import { createFeedManager } from '../feed.js'
import { createIdentityManager } from '../identity.js'
import { createIndexer } from '../indexer.js'
import { createFollowsQuery } from '../follows.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('follows', () => {
  let tmpDir: string
  let store: ReturnType<typeof createEssensStore>
  let identity: ReturnType<typeof createIdentityManager>
  let feedManager: ReturnType<typeof createFeedManager>
  let indexer: ReturnType<typeof createIndexer>
  let follows: ReturnType<typeof createFollowsQuery>

  const targetA = 'a'.repeat(64)
  const targetB = 'b'.repeat(64)

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'essens-follows-'))
    store = createEssensStore()
    identity = createIdentityManager()
    feedManager = createFeedManager()
    indexer = createIndexer()
    follows = createFollowsQuery()
    await identity.init(tmpDir)
    await store.init(tmpDir)
  })

  afterEach(async () => {
    await store.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty list when no follows', async () => {
    const db = store.getIndexDb()
    const author = identity.getAuthorHex()
    const result = await follows.getFollowing(db, author)
    expect(result).toEqual([])
  })

  it('indexes follow.create and queries following', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    const env = await feedManager.append(feed, keypair, 'follow.create', { target: targetA })
    await indexer.indexEvent(db, env)

    const result = await follows.getFollowing(db, author)
    expect(result).toHaveLength(1)
    expect(result[0].target).toBe(targetA)
    expect(result[0].author).toBe(author)
    expect(result[0].eventId).toBe(env.id)
  })

  it('isFollowing returns true for followed target', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    await indexer.indexEvent(db, await feedManager.append(feed, keypair, 'follow.create', { target: targetA }))

    expect(await follows.isFollowing(db, author, targetA)).toBe(true)
    expect(await follows.isFollowing(db, author, targetB)).toBe(false)
  })

  it('tracks multiple follows', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    await indexer.indexEvent(db, await feedManager.append(feed, keypair, 'follow.create', { target: targetA }))
    await indexer.indexEvent(db, await feedManager.append(feed, keypair, 'follow.create', { target: targetB }))

    const result = await follows.getFollowing(db, author)
    expect(result).toHaveLength(2)
    const targets = result.map(e => e.target).sort()
    expect(targets).toEqual([targetA, targetB])
  })

  it('follow.remove deletes the follow entry', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()
    const author = identity.getAuthorHex()

    await indexer.indexEvent(db, await feedManager.append(feed, keypair, 'follow.create', { target: targetA }))
    await indexer.indexEvent(db, await feedManager.append(feed, keypair, 'follow.create', { target: targetB }))
    await indexer.indexEvent(db, await feedManager.append(feed, keypair, 'follow.remove', { target: targetA }))

    const result = await follows.getFollowing(db, author)
    expect(result).toHaveLength(1)
    expect(result[0].target).toBe(targetB)
    expect(await follows.isFollowing(db, author, targetA)).toBe(false)
    expect(await follows.isFollowing(db, author, targetB)).toBe(true)
  })

  it('follow events do not appear in timeline index', async () => {
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const keypair = identity.getKeypair()

    await indexer.indexEvent(db, await feedManager.append(feed, keypair, 'follow.create', { target: targetA }))

    // Check no tl! entries exist
    const tlEntries: any[] = []
    const stream = db.createReadStream({ gte: 'tl!', lt: 'tl"' })
    for await (const entry of stream) {
      tlEntries.push(entry)
    }
    expect(tlEntries).toHaveLength(0)
  })
})
