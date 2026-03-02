import type { SignedEnvelope, TimelineEntry, ProfileSnapshot, EventId, EventKind } from './types.js'

export interface TimelineQuery {
  getRecent(db: any, limit?: number): Promise<TimelineEntry[]>
  getEvent(db: any, eventId: EventId): Promise<SignedEnvelope | null>
  getProfile(db: any, author: string): Promise<ProfileSnapshot | null>
  isTombstoned(db: any, eventId: EventId): Promise<boolean>
  getRecentFiltered(db: any, limit?: number): Promise<TimelineEntry[]>
}

export function createTimelineQuery(): TimelineQuery {
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
        }
        entries.push({
          key: entry.key as string,
          eventId: val.eventId,
          author: val.author,
          seq: val.seq,
          createdAt: val.createdAt,
          kind: val.kind,
        })
      }
      return entries
    },

    async getRecentFiltered(db, limit = 50) {
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
        }
        const tombstoned = await this.isTombstoned(db, val.eventId)
        if (!tombstoned) {
          entries.push({
            key: entry.key as string,
            eventId: val.eventId,
            author: val.author,
            seq: val.seq,
            createdAt: val.createdAt,
            kind: val.kind,
          })
        }
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
