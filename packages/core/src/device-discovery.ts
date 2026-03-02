import b4a from 'b4a'
import type { SignedEnvelope } from './types.js'
import type { DeviceRegistry } from './device-registry.js'
import type { NetworkManager } from './network.js'
import type { SyncManager } from './sync.js'
import type { Indexer } from './indexer.js'

export interface DeviceDiscoveryDeps {
  db: any
  corestore: any
  network: NetworkManager
  sync: SyncManager
  indexer: Indexer
  deviceRegistry: DeviceRegistry
}

export interface DeviceDiscovery {
  /**
   * Start discovering and syncing all feeds for a given author.
   * Loads known feedKeys from the index, joins each feed,
   * and watches for new device.announce events.
   */
  startDiscovery(authorHex: string): Promise<void>

  /**
   * Stop watching all feeds for a given author.
   */
  stopDiscovery(authorHex: string): void

  /**
   * Handle a newly discovered feed for an author.
   * Joins the feed on the network, syncs it, and watches for new events.
   */
  onFeedDiscovered(authorHex: string, feedKeyHex: string): Promise<void>

  /**
   * Get all author hex strings currently being discovered.
   */
  getDiscoveredAuthors(): string[]
}

export function createDeviceDiscovery(deps: DeviceDiscoveryDeps): DeviceDiscovery {
  const { db, corestore, network, sync, indexer, deviceRegistry } = deps

  // Track which feeds we are already watching per author
  const authorFeeds = new Map<string, Set<string>>()

  async function syncAndWatch(authorHex: string, feedKeyHex: string) {
    const key = b4a.from(feedKeyHex, 'hex')
    const feed = corestore.get({ key })
    await feed.ready()

    // Sync existing events
    await sync.syncFeed(db, feed, authorHex, indexer)

    // Watch for new events — on each append, sync and check for new device.announce
    sync.watchFeed(feed, feedKeyHex, async () => {
      const result = await sync.syncFeed(db, feed, authorHex, indexer)
      if (result.indexed > 0) {
        // Check if new device.announce events introduced new feeds
        await discoverNewFeeds(authorHex)
      }
    })
  }

  async function discoverNewFeeds(authorHex: string) {
    const known = authorFeeds.get(authorHex)
    if (!known) return

    const allFeedKeys = await deviceRegistry.getFeedKeys(db, authorHex)
    for (const fk of allFeedKeys) {
      if (!known.has(fk)) {
        known.add(fk)
        await network.joinFeed(fk)
        await syncAndWatch(authorHex, fk)
      }
    }
  }

  return {
    async startDiscovery(authorHex) {
      if (authorFeeds.has(authorHex)) return

      const feedSet = new Set<string>()
      authorFeeds.set(authorHex, feedSet)

      // Join the author topic on the DHT
      await network.followAuthor(authorHex)

      // Load known feed keys from the index
      const knownFeedKeys = await deviceRegistry.getFeedKeys(db, authorHex)
      for (const fk of knownFeedKeys) {
        feedSet.add(fk)
        await network.joinFeed(fk)
        await syncAndWatch(authorHex, fk)
      }
    },

    stopDiscovery(authorHex) {
      const feedSet = authorFeeds.get(authorHex)
      if (!feedSet) return

      for (const fk of feedSet) {
        sync.unwatchFeed(fk)
        // Note: we don't leaveFeed here to avoid disrupting in-flight replication
      }
      authorFeeds.delete(authorHex)
      // Unfollow the author topic
      network.unfollowAuthor(authorHex).catch(() => {})
    },

    async onFeedDiscovered(authorHex, feedKeyHex) {
      let feedSet = authorFeeds.get(authorHex)
      if (!feedSet) {
        feedSet = new Set()
        authorFeeds.set(authorHex, feedSet)
      }
      if (feedSet.has(feedKeyHex)) return

      feedSet.add(feedKeyHex)
      await network.joinFeed(feedKeyHex)
      await syncAndWatch(authorHex, feedKeyHex)
    },

    getDiscoveredAuthors() {
      return Array.from(authorFeeds.keys())
    },
  }
}
