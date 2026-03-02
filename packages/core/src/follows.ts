export interface FollowEntry {
  author: string
  target: string
  since: string
  eventId: string
}

export interface FollowsQuery {
  getFollowing(db: any, author: string): Promise<FollowEntry[]>
  isFollowing(db: any, author: string, target: string): Promise<boolean>
}

export function createFollowsQuery(): FollowsQuery {
  return {
    async getFollowing(db, author) {
      const entries: FollowEntry[] = []
      const prefix = `follow!${author}!`
      const stream = db.createReadStream({
        gte: prefix,
        lt: prefix.slice(0, -1) + '"',
      })
      for await (const entry of stream) {
        const key = entry.key as string
        const target = key.slice(prefix.length)
        const val = entry.value as { eventId: string; since: string }
        entries.push({
          author,
          target,
          since: val.since,
          eventId: val.eventId,
        })
      }
      return entries
    },

    async isFollowing(db, author, target) {
      const entry = await db.get(`follow!${author}!${target}`)
      return entry !== null
    },
  }
}
