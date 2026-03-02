import type { SignedEnvelope, TimelineEntry, ProfileSnapshot, EventId, EventKind, Visibility } from './types.js'

export interface VisibilityFilter {
  currentAuthor?: string
  followingSet?: Set<string>
}

export interface TimelineQuery {
  getRecent(db: any, limit?: number): Promise<TimelineEntry[]>
  getEvent(db: any, eventId: EventId): Promise<SignedEnvelope | null>
  getProfile(db: any, author: string): Promise<ProfileSnapshot | null>
  isTombstoned(db: any, eventId: EventId): Promise<boolean>
  getRecentFiltered(db: any, limit?: number, filter?: VisibilityFilter): Promise<TimelineEntry[]>
  getAuthorPosts(db: any, authorHex: string, limit?: number, filter?: VisibilityFilter): Promise<TimelineEntry[]>
}

export function createTimelineQuery(): TimelineQuery {
  function canSeePrivate(postAuthor: string, filter?: VisibilityFilter): boolean {
    if (!filter) return true // no filter = show all (solo mode)
    if (filter.currentAuthor === postAuthor) return true // own posts
    if (filter.followingSet?.has(postAuthor)) return true // following
    return false
  }

  return {
    async getRecent(db, limit = 50) {
      const entries: TimelineEntry[] = []
      const stream = db.createReadStream({
        gte: 'tl!',
        lt: 'tl"',
        limit,
      })
      for await (const entry of stream) {
        const val = entry.value as {
          eventId: string
          author: string
          seq: number
          createdAt: string
          kind: EventKind
          visibility?: Visibility
        }
        entries.push({
          key: entry.key as string,
          eventId: val.eventId,
          author: val.author,
          seq: val.seq,
          createdAt: val.createdAt,
          kind: val.kind,
          visibility: val.visibility ?? 'public',
        })
      }
      return entries
    },

    async getRecentFiltered(db, limit = 50, filter?) {
      const entries: TimelineEntry[] = []
      const stream = db.createReadStream({
        gte: 'tl!',
        lt: 'tl"',
      })
      for await (const entry of stream) {
        const val = entry.value as {
          eventId: string
          author: string
          seq: number
          createdAt: string
          kind: EventKind
          visibility?: Visibility
        }
        const tombstoned = await this.isTombstoned(db, val.eventId)
        if (tombstoned) continue

        const visibility = val.visibility ?? 'public'
        if (visibility === 'private' && !canSeePrivate(val.author, filter)) continue

        entries.push({
          key: entry.key as string,
          eventId: val.eventId,
          author: val.author,
          seq: val.seq,
          createdAt: val.createdAt,
          kind: val.kind,
          visibility,
        })
        if (entries.length >= limit) break
      }
      return entries
    },

    async getAuthorPosts(db, authorHex, limit = 50, filter?) {
      const entries: TimelineEntry[] = []
      const prefix = `author!${authorHex}!`
      const stream = db.createReadStream({
        gte: prefix,
        lt: prefix.slice(0, -1) + '"',
      })
      for await (const entry of stream) {
        const val = entry.value as {
          eventId: string
          createdAt: string
          kind: EventKind
          visibility?: Visibility
        }

        // Only include post.create events
        if (val.kind !== 'post.create') continue

        // Check tombstone
        const tombstoned = await this.isTombstoned(db, val.eventId)
        if (tombstoned) continue

        // Visibility filter
        const visibility = val.visibility ?? 'public'
        if (visibility === 'private' && !canSeePrivate(authorHex, filter)) continue

        entries.push({
          key: entry.key as string,
          eventId: val.eventId,
          author: authorHex,
          seq: 0, // author index doesn't store seq
          createdAt: val.createdAt,
          kind: val.kind,
          visibility,
        })
        if (entries.length >= limit) break
      }
      return entries
    },

    async getEvent(db, eventId) {
      const entry = await db.get(`event!${eventId}`)
      return (entry?.value as SignedEnvelope) ?? null
    },

    async getProfile(db, author) {
      const entry = await db.get(`profile!${author}`)
      return (entry?.value as ProfileSnapshot) ?? null
    },

    async isTombstoned(db, eventId) {
      const entry = await db.get(`tomb!${eventId}`)
      return entry !== null
    },
  }
}
