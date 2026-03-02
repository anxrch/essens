import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createEssensStore } from '../store.js'
import { createFeedManager } from '../feed.js'
import { generateKeypair } from '../crypto.js'
import { verifyEnvelope } from '../envelope.js'

describe('EssensStore', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-store-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('initializes and provides feed and indexDb', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)

    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()

    expect(feed).toBeDefined()
    expect(db).toBeDefined()
    expect(feed.length).toBe(0)

    await store.close()
  })

  it('throws if accessed before init', () => {
    const store = createEssensStore()
    expect(() => store.getPrimaryFeed()).toThrow('Store not initialized')
    expect(() => store.getIndexDb()).toThrow('Store not initialized')
  })

  it('persists data across close and reopen', async () => {
    const kp = generateKeypair()
    const feedMgr = createFeedManager()

    const store1 = createEssensStore()
    await store1.init(tmpDir)
    const feed1 = store1.getPrimaryFeed()

    await feedMgr.append(feed1, kp, 'post.create', { text: 'hello' })
    await feedMgr.append(feed1, kp, 'post.create', { text: 'world' })

    expect(feed1.length).toBe(2)
    await store1.close()

    const store2 = createEssensStore()
    await store2.init(tmpDir)
    const feed2 = store2.getPrimaryFeed()

    expect(feed2.length).toBe(2)
    await store2.close()
  })
})

describe('FeedManager', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-feed-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('appends events with correct seq and prev chain', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()

    const e0 = await feedMgr.append(feed, kp, 'post.create', { text: 'first' })
    expect(e0.seq).toBe(0)
    expect(e0.prev).toBeNull()

    const e1 = await feedMgr.append(feed, kp, 'post.create', { text: 'second' })
    expect(e1.seq).toBe(1)
    expect(e1.prev).toBe(e0.id)

    const e2 = await feedMgr.append(feed, kp, 'post.create', { text: 'third' })
    expect(e2.seq).toBe(2)
    expect(e2.prev).toBe(e1.id)

    await store.close()
  })

  it('reads back appended events correctly', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()

    await feedMgr.append(feed, kp, 'post.create', { text: 'hello' })
    await feedMgr.append(feed, kp, 'profile.update', { displayName: 'test' })

    const read0 = await feedMgr.get(feed, 0)
    expect(read0.kind).toBe('post.create')
    expect((read0.body as any).text).toBe('hello')

    const read1 = await feedMgr.get(feed, 1)
    expect(read1.kind).toBe('profile.update')
    expect((read1.body as any).displayName).toBe('test')

    await store.close()
  })

  it('getRange returns correct slice', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()

    for (let i = 0; i < 5; i++) {
      await feedMgr.append(feed, kp, 'post.create', { text: `post ${i}` })
    }

    const range = await feedMgr.getRange(feed, 1, 4)
    expect(range).toHaveLength(3)
    expect(range[0].seq).toBe(1)
    expect(range[2].seq).toBe(3)

    await store.close()
  })

  it('validateAll passes for valid feed', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()

    for (let i = 0; i < 3; i++) {
      await feedMgr.append(feed, kp, 'post.create', { text: `post ${i}` })
    }

    const result = await feedMgr.validateAll(feed)
    expect(result.valid).toBe(3)
    expect(result.invalid).toBe(0)

    await store.close()
  })

  it('all appended events pass verifyEnvelope', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()

    const e0 = await feedMgr.append(feed, kp, 'post.create', { text: 'hello' })
    const e1 = await feedMgr.append(feed, kp, 'post.create', { text: 'world' })

    expect(verifyEnvelope(e0)).toBe(true)
    expect(verifyEnvelope(e1)).toBe(true)

    await store.close()
  })
})
