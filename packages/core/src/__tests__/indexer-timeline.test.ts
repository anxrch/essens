import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import b4a from 'b4a'
import { createEssensStore } from '../store.js'
import { createFeedManager } from '../feed.js'
import { createIndexer } from '../indexer.js'
import { createTimelineQuery } from '../timeline.js'
import { generateKeypair } from '../crypto.js'

describe('Indexer + Timeline', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-index-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('indexes posts and queries timeline in reverse-chronological order', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const e0 = await feedMgr.append(feed, kp, 'post.create', { text: 'first post' })
    await indexer.indexEvent(db, e0)

    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 5))

    const e1 = await feedMgr.append(feed, kp, 'post.create', { text: 'second post' })
    await indexer.indexEvent(db, e1)

    const entries = await timeline.getRecent(db)
    expect(entries).toHaveLength(2)
    // Reverse-time ordering: most recent first
    expect(entries[0].eventId).toBe(e1.id)
    expect(entries[1].eventId).toBe(e0.id)

    await store.close()
  })

  it('looks up events by ID', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const e0 = await feedMgr.append(feed, kp, 'post.create', { text: 'hello' })
    await indexer.indexEvent(db, e0)

    const found = await timeline.getEvent(db, e0.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(e0.id)
    expect((found!.body as any).text).toBe('hello')

    const notFound = await timeline.getEvent(db, 'nonexistent')
    expect(notFound).toBeNull()

    await store.close()
  })

  it('indexes and queries profile snapshots', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const author = (await feedMgr.append(feed, kp, 'profile.update', { displayName: 'alice' }))
    await indexer.indexEvent(db, author)

    const profile1 = await timeline.getProfile(db, author.author)
    expect(profile1).not.toBeNull()
    expect(profile1!.displayName).toBe('alice')
    expect(profile1!.bio).toBeUndefined()

    const update2 = await feedMgr.append(feed, kp, 'profile.update', { bio: 'hello world' })
    await indexer.indexEvent(db, update2)

    const profile2 = await timeline.getProfile(db, author.author)
    expect(profile2!.displayName).toBe('alice')
    expect(profile2!.bio).toBe('hello world')

    await store.close()
  })

  it('handles tombstones', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const post = await feedMgr.append(feed, kp, 'post.create', { text: 'to delete' })
    await indexer.indexEvent(db, post)

    expect(await timeline.isTombstoned(db, post.id)).toBe(false)

    const tombstone = await feedMgr.append(feed, kp, 'post.delete_tombstone', { target: post.id })
    await indexer.indexEvent(db, tombstone)

    expect(await timeline.isTombstoned(db, post.id)).toBe(true)

    await store.close()
  })

  it('getRecentFiltered excludes tombstoned posts', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const p1 = await feedMgr.append(feed, kp, 'post.create', { text: 'keep' })
    await indexer.indexEvent(db, p1)

    await new Promise(r => setTimeout(r, 5))

    const p2 = await feedMgr.append(feed, kp, 'post.create', { text: 'delete me' })
    await indexer.indexEvent(db, p2)

    await new Promise(r => setTimeout(r, 5))

    const p3 = await feedMgr.append(feed, kp, 'post.create', { text: 'also keep' })
    await indexer.indexEvent(db, p3)

    const tomb = await feedMgr.append(feed, kp, 'post.delete_tombstone', { target: p2.id })
    await indexer.indexEvent(db, tomb)

    const filtered = await timeline.getRecentFiltered(db)
    expect(filtered).toHaveLength(2)
    expect(filtered[0].eventId).toBe(p3.id)
    expect(filtered[1].eventId).toBe(p1.id)

    await store.close()
  })

  it('rebuildAll replays feed into indexes', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const p1 = await feedMgr.append(feed, kp, 'post.create', { text: 'first' })
    const p2 = await feedMgr.append(feed, kp, 'post.create', { text: 'second' })
    const prof = await feedMgr.append(feed, kp, 'profile.update', { displayName: 'bob' })

    // Rebuild from feed (without individual indexEvent calls)
    const count = await indexer.rebuildAll(db, feed)
    expect(count).toBe(3)

    // Verify all indexes work
    const entries = await timeline.getRecent(db)
    expect(entries).toHaveLength(2) // Only post.create entries in timeline

    const profile = await timeline.getProfile(db, prof.author)
    expect(profile!.displayName).toBe('bob')

    const event = await timeline.getEvent(db, p1.id)
    expect(event).not.toBeNull()

    await store.close()
  })

  it('stores visibility in timeline index', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const pub = await feedMgr.append(feed, kp, 'post.create', { text: 'public post', visibility: 'public' })
    await indexer.indexEvent(db, pub)

    await new Promise(r => setTimeout(r, 5))

    const priv = await feedMgr.append(feed, kp, 'post.create', { text: 'private post', visibility: 'private' })
    await indexer.indexEvent(db, priv)

    const entries = await timeline.getRecent(db)
    expect(entries).toHaveLength(2)
    expect(entries[0].visibility).toBe('private')
    expect(entries[1].visibility).toBe('public')

    await store.close()
  })

  it('defaults visibility to public for posts without visibility field', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const post = await feedMgr.append(feed, kp, 'post.create', { text: 'no visibility set' })
    await indexer.indexEvent(db, post)

    const entries = await timeline.getRecent(db)
    expect(entries).toHaveLength(1)
    expect(entries[0].visibility).toBe('public')

    await store.close()
  })

  it('getRecentFiltered hides private posts from non-followers', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kpAuthor = generateKeypair()
    const kpViewer = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const authorHex = b4a.toString(kpAuthor.publicKey, 'hex')
    const viewerHex = b4a.toString(kpViewer.publicKey, 'hex')

    const pub = await feedMgr.append(feed, kpAuthor, 'post.create', { text: 'public' })
    await indexer.indexEvent(db, pub)

    await new Promise(r => setTimeout(r, 5))

    const priv = await feedMgr.append(feed, kpAuthor, 'post.create', { text: 'private', visibility: 'private' })
    await indexer.indexEvent(db, priv)

    // Non-follower should only see public
    const filtered = await timeline.getRecentFiltered(db, 50, {
      currentAuthor: viewerHex,
      followingSet: new Set(),
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].eventId).toBe(pub.id)

    await store.close()
  })

  it('getRecentFiltered shows private posts to followers', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kpAuthor = generateKeypair()
    const kpViewer = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const authorHex = b4a.toString(kpAuthor.publicKey, 'hex')
    const viewerHex = b4a.toString(kpViewer.publicKey, 'hex')

    const pub = await feedMgr.append(feed, kpAuthor, 'post.create', { text: 'public' })
    await indexer.indexEvent(db, pub)

    await new Promise(r => setTimeout(r, 5))

    const priv = await feedMgr.append(feed, kpAuthor, 'post.create', { text: 'private', visibility: 'private' })
    await indexer.indexEvent(db, priv)

    // Follower should see both
    const filtered = await timeline.getRecentFiltered(db, 50, {
      currentAuthor: viewerHex,
      followingSet: new Set([authorHex]),
    })
    expect(filtered).toHaveLength(2)

    await store.close()
  })

  it('getRecentFiltered shows private posts to the author themselves', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const authorHex = b4a.toString(kp.publicKey, 'hex')

    const pub = await feedMgr.append(feed, kp, 'post.create', { text: 'public' })
    await indexer.indexEvent(db, pub)

    await new Promise(r => setTimeout(r, 5))

    const priv = await feedMgr.append(feed, kp, 'post.create', { text: 'private', visibility: 'private' })
    await indexer.indexEvent(db, priv)

    // Author should see own private posts
    const filtered = await timeline.getRecentFiltered(db, 50, {
      currentAuthor: authorHex,
      followingSet: new Set(),
    })
    expect(filtered).toHaveLength(2)

    await store.close()
  })

  it('getAuthorPosts returns only post.create events for a specific author', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const authorHex = b4a.toString(kp.publicKey, 'hex')

    const p1 = await feedMgr.append(feed, kp, 'post.create', { text: 'first' })
    await indexer.indexEvent(db, p1)

    const prof = await feedMgr.append(feed, kp, 'profile.update', { displayName: 'alice' })
    await indexer.indexEvent(db, prof)

    const p2 = await feedMgr.append(feed, kp, 'post.create', { text: 'second' })
    await indexer.indexEvent(db, p2)

    const posts = await timeline.getAuthorPosts(db, authorHex)
    expect(posts).toHaveLength(2)
    // Should only be post.create events
    for (const post of posts) {
      expect(post.kind).toBe('post.create')
      expect(post.author).toBe(authorHex)
    }

    await store.close()
  })

  it('getAuthorPosts filters private posts for non-followers', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kpAuthor = generateKeypair()
    const kpViewer = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const authorHex = b4a.toString(kpAuthor.publicKey, 'hex')
    const viewerHex = b4a.toString(kpViewer.publicKey, 'hex')

    const pub = await feedMgr.append(feed, kpAuthor, 'post.create', { text: 'public' })
    await indexer.indexEvent(db, pub)

    const priv = await feedMgr.append(feed, kpAuthor, 'post.create', { text: 'private', visibility: 'private' })
    await indexer.indexEvent(db, priv)

    // Non-follower: only public
    const nonFollower = await timeline.getAuthorPosts(db, authorHex, 50, {
      currentAuthor: viewerHex,
      followingSet: new Set(),
    })
    expect(nonFollower).toHaveLength(1)
    expect(nonFollower[0].eventId).toBe(pub.id)

    // Follower: both
    const follower = await timeline.getAuthorPosts(db, authorHex, 50, {
      currentAuthor: viewerHex,
      followingSet: new Set([authorHex]),
    })
    expect(follower).toHaveLength(2)

    // Author themselves: both
    const self = await timeline.getAuthorPosts(db, authorHex, 50, {
      currentAuthor: authorHex,
      followingSet: new Set(),
    })
    expect(self).toHaveLength(2)

    await store.close()
  })

  it('getAuthorPosts excludes tombstoned posts', async () => {
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()
    const kp = generateKeypair()
    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    const authorHex = b4a.toString(kp.publicKey, 'hex')

    const p1 = await feedMgr.append(feed, kp, 'post.create', { text: 'keep' })
    await indexer.indexEvent(db, p1)

    const p2 = await feedMgr.append(feed, kp, 'post.create', { text: 'delete me' })
    await indexer.indexEvent(db, p2)

    const tomb = await feedMgr.append(feed, kp, 'post.delete_tombstone', { target: p2.id })
    await indexer.indexEvent(db, tomb)

    const posts = await timeline.getAuthorPosts(db, authorHex)
    expect(posts).toHaveLength(1)
    expect(posts[0].eventId).toBe(p1.id)

    await store.close()
  })
})
