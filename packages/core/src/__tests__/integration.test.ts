import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import b4a from 'b4a'
import {
  createIdentityManager,
  createEssensStore,
  createFeedManager,
  createIndexer,
  createTimelineQuery,
  createFollowsQuery,
  createSyncManager,
  verifyEnvelope,
} from '../index.js'

describe('Integration: Full Phase 1 lifecycle', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-integration-'))
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('complete lifecycle: identity → posts → profile → tombstone → restart → rebuild', async () => {
    // --- 1. Initialize identity ---
    const identity = createIdentityManager()
    await identity.init(tmpDir)
    const author = identity.getAuthorHex()
    expect(author).toHaveLength(64)

    // --- 2. Initialize store ---
    const store = createEssensStore()
    await store.init(tmpDir)
    const feed = store.getPrimaryFeed()
    const db = store.getIndexDb()

    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const timeline = createTimelineQuery()

    // --- 3. Append 10 posts ---
    const postIds: string[] = []
    for (let i = 0; i < 10; i++) {
      const envelope = await feedMgr.append(feed, identity.getKeypair(), 'post.create', {
        text: `Post number ${i}`,
        tags: i % 3 === 0 ? ['tagged'] : undefined,
      })
      await indexer.indexEvent(db, envelope)
      postIds.push(envelope.id)

      // All envelopes should verify
      expect(verifyEnvelope(envelope)).toBe(true)

      if (i < 9) await new Promise(r => setTimeout(r, 2))
    }

    expect(feed.length).toBe(10)

    // --- 4. Append 2 profile updates ---
    const prof1 = await feedMgr.append(feed, identity.getKeypair(), 'profile.update', {
      displayName: 'hellel',
    })
    await indexer.indexEvent(db, prof1)

    const prof2 = await feedMgr.append(feed, identity.getKeypair(), 'profile.update', {
      bio: 'local-first microblogger',
    })
    await indexer.indexEvent(db, prof2)

    expect(feed.length).toBe(12)

    // --- 5. Verify profile merge ---
    const profile = await timeline.getProfile(db, author)
    expect(profile).not.toBeNull()
    expect(profile!.displayName).toBe('hellel')
    expect(profile!.bio).toBe('local-first microblogger')

    // --- 6. Append 1 tombstone ---
    const tombTarget = postIds[5]
    const tombstone = await feedMgr.append(feed, identity.getKeypair(), 'post.delete_tombstone', {
      target: tombTarget,
    })
    await indexer.indexEvent(db, tombstone)

    expect(feed.length).toBe(13)
    expect(await timeline.isTombstoned(db, tombTarget)).toBe(true)
    expect(await timeline.isTombstoned(db, postIds[0])).toBe(false)

    // --- 7. Query timeline ---
    const allEntries = await timeline.getRecent(db, 100)
    expect(allEntries).toHaveLength(10) // Only post.create events in timeline

    const filtered = await timeline.getRecentFiltered(db, 100)
    expect(filtered).toHaveLength(9) // One tombstoned

    // Check reverse-chronological order
    for (let i = 0; i < filtered.length - 1; i++) {
      expect(new Date(filtered[i].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(filtered[i + 1].createdAt).getTime())
    }

    // --- 8. Event lookup ---
    const lookedUp = await timeline.getEvent(db, postIds[0])
    expect(lookedUp).not.toBeNull()
    expect(lookedUp!.kind).toBe('post.create')

    // --- 9. Close store ---
    await store.close()

    // --- 10. Reopen and verify persistence ---
    const identity2 = createIdentityManager()
    await identity2.init(tmpDir)
    expect(identity2.getAuthorHex()).toBe(author)

    const store2 = createEssensStore()
    await store2.init(tmpDir)
    const feed2 = store2.getPrimaryFeed()
    const db2 = store2.getIndexDb()

    expect(feed2.length).toBe(13)

    // --- 11. Rebuild indexes from scratch ---
    const indexer2 = createIndexer()
    const timeline2 = createTimelineQuery()

    const count = await indexer2.rebuildAll(db2, feed2)
    expect(count).toBe(13)

    // --- 12. Verify rebuilt indexes match ---
    const rebuiltEntries = await timeline2.getRecentFiltered(db2, 100)
    expect(rebuiltEntries).toHaveLength(9)

    const rebuiltProfile = await timeline2.getProfile(db2, author)
    expect(rebuiltProfile!.displayName).toBe('hellel')
    expect(rebuiltProfile!.bio).toBe('local-first microblogger')

    expect(await timeline2.isTombstoned(db2, tombTarget)).toBe(true)

    // --- 13. Validate all feed events ---
    const feedMgr2 = createFeedManager()
    const validation = await feedMgr2.validateAll(feed2)
    expect(validation.valid).toBe(13)
    expect(validation.invalid).toBe(0)

    await store2.close()
  })

  it('follow/unfollow lifecycle with sync', async () => {
    // --- 1. Set up two users ---
    const tmpDirA = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-integ-a-'))
    const tmpDirB = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-integ-b-'))

    const identityA = createIdentityManager()
    const identityB = createIdentityManager()
    await identityA.init(tmpDirA)
    await identityB.init(tmpDirB)

    const storeA = createEssensStore()
    const storeB = createEssensStore()
    await storeA.init(tmpDirA)
    await storeB.init(tmpDirB)

    const feedMgr = createFeedManager()
    const indexer = createIndexer()
    const follows = createFollowsQuery()
    const sync = createSyncManager()
    const timeline = createTimelineQuery()

    const feedA = storeA.getPrimaryFeed()
    const dbA = storeA.getIndexDb()
    const authorA = identityA.getAuthorHex()
    const keypairA = identityA.getKeypair()

    const feedB = storeB.getPrimaryFeed()
    const dbB = storeB.getIndexDb()
    const authorB = identityB.getAuthorHex()
    const keypairB = identityB.getKeypair()

    // --- 2. User A creates posts ---
    await feedMgr.append(feedA, keypairA, 'post.create', { text: 'Hello from A' })
    await feedMgr.append(feedA, keypairA, 'post.create', { text: 'Second post from A' })

    // --- 3. User B follows User A ---
    const targetA = 'a'.repeat(64) // Simulated target (not real key)
    const followEnv = await feedMgr.append(feedB, keypairB, 'follow.create', { target: targetA })
    await indexer.indexEvent(dbB, followEnv)

    // Verify follow is in index
    const followingB = await follows.getFollowing(dbB, authorB)
    expect(followingB).toHaveLength(1)
    expect(followingB[0].target).toBe(targetA)
    expect(await follows.isFollowing(dbB, authorB, targetA)).toBe(true)

    // --- 4. User B unfollows User A ---
    const unfollowEnv = await feedMgr.append(feedB, keypairB, 'follow.remove', { target: targetA })
    await indexer.indexEvent(dbB, unfollowEnv)

    const followingAfter = await follows.getFollowing(dbB, authorB)
    expect(followingAfter).toHaveLength(0)
    expect(await follows.isFollowing(dbB, authorB, targetA)).toBe(false)

    // --- 5. Verify follow events are in feed but not in timeline ---
    expect(feedB.length).toBe(2) // follow.create + follow.remove
    const timelineB = await timeline.getRecent(dbB, 100)
    expect(timelineB).toHaveLength(0) // Follow events don't appear in timeline

    // --- 6. Verify local sync works ---
    const syncResult = await sync.syncFeed(dbA, feedA, authorA, indexer)
    expect(syncResult.indexed).toBe(2)
    const timelineA = await timeline.getRecentFiltered(dbA, 100)
    expect(timelineA).toHaveLength(2)

    // --- 7. Cleanup ---
    await storeA.close()
    await storeB.close()
    await fs.rm(tmpDirA, { recursive: true, force: true })
    await fs.rm(tmpDirB, { recursive: true, force: true })
  })
})
