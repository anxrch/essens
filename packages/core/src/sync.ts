import b4a from 'b4a'
import { verifyEnvelope } from './envelope.js'
import type { SignedEnvelope } from './types.js'
import type { Indexer } from './indexer.js'

export interface SyncResult {
  indexed: number
  skipped: number
  errors: number
}

export interface SyncManager {
  syncFeed(db: any, feed: any, authorHex: string, indexer: Indexer): Promise<SyncResult>
  getLastIndexedSeq(db: any, feedKeyHex: string): Promise<number>
  watchFeed(feed: any, feedKeyHex: string, callback: () => void): void
  unwatchFeed(feedKeyHex: string): void
}

export function createSyncManager(): SyncManager {
  const watchers = new Map<string, () => void>()
  const syncing = new Set<string>()

  return {
    async syncFeed(db, feed, authorHex, indexer) {
      const feedKeyHex = b4a.toString(feed.key, 'hex')

      // Prevent concurrent syncs for the same feed
      if (syncing.has(feedKeyHex)) {
        return { indexed: 0, skipped: 0, errors: 0 }
      }
      syncing.add(feedKeyHex)

      let indexed = 0
      let skipped = 0
      let errors = 0

      try {
        const entry = await db.get(`indexed!${feedKeyHex}`)
        const lastSeq = entry?.value?.lastSeq ?? -1

        if (feed.length <= lastSeq + 1) {
          return { indexed: 0, skipped: 0, errors: 0 }
        }

        for (let i = lastSeq + 1; i < feed.length; i++) {
          try {
            const raw = await feed.get(i)
            const envelope = JSON.parse(
              Buffer.isBuffer(raw) ? raw.toString() : raw.toString(),
            ) as SignedEnvelope

            // Verify author matches expected author
            if (envelope.author !== authorHex) {
              errors++
              continue
            }

            // Verify signature and event ID
            if (!verifyEnvelope(envelope)) {
              errors++
              continue
            }

            await indexer.indexEvent(db, envelope)
            indexed++
          } catch {
            errors++
          }
        }

        await db.put(`indexed!${feedKeyHex}`, { lastSeq: feed.length - 1 })
      } finally {
        syncing.delete(feedKeyHex)
      }

      return { indexed, skipped, errors }
    },

    async getLastIndexedSeq(db, feedKeyHex) {
      const entry = await db.get(`indexed!${feedKeyHex}`)
      return entry?.value?.lastSeq ?? -1
    },

    watchFeed(feed, feedKeyHex, callback) {
      this.unwatchFeed(feedKeyHex)
      const handler = () => callback()
      feed.on('append', handler)
      watchers.set(feedKeyHex, () => feed.removeListener('append', handler))
    },

    unwatchFeed(feedKeyHex) {
      const cleanup = watchers.get(feedKeyHex)
      if (cleanup) {
        cleanup()
        watchers.delete(feedKeyHex)
      }
    },
  }
}
