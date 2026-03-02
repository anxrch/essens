import type { SignedEnvelope, ProfileSnapshot, PostCreateBody, PostDeleteTombstoneBody, ProfileUpdateBody, FollowCreateBody, FollowRemoveBody, DeviceAnnounceBody, DeviceRevokeBody } from './types.js'
import type { DeviceRecord } from './device-registry.js'

function reverseTime(isoDate: string): string {
  const ms = new Date(isoDate).getTime()
  return String(Number.MAX_SAFE_INTEGER - ms).padStart(16, '0')
}

export interface Indexer {
  indexEvent(db: any, envelope: SignedEnvelope): Promise<void>
  rebuildAll(db: any, feed: any): Promise<number>
}

export function createIndexer(): Indexer {
  return {
    async indexEvent(db, envelope) {
      const batch = db.batch()
      const { id, author, seq, createdAt, kind, body } = envelope
      const rt = reverseTime(createdAt)

      // Event lookup
      await batch.put(`event!${id}`, envelope)

      // Author events (keyed by eventId for multi-feed uniqueness)
      await batch.put(
        `author!${author}!${id}`,
        { eventId: id, createdAt, kind },
      )

      if (kind === 'post.create') {
        // Timeline (keyed by eventId for multi-feed uniqueness)
        await batch.put(
          `tl!${rt}!${id}`,
          { eventId: id, author, seq, createdAt, kind },
        )

        // Tags
        const postBody = body as PostCreateBody
        if (postBody.tags) {
          for (const tag of postBody.tags) {
            const normalized = tag.toLowerCase()
            await batch.put(
              `tag!${normalized}!${rt}!${id}`,
              { eventId: id },
            )
          }
        }

        // Reply index
        if (postBody.replyTo) {
          await batch.put(
            `reply!${postBody.replyTo}!${id}`,
            { eventId: id },
          )
        }
      }

      if (kind === 'profile.update') {
        const profileBody = body as ProfileUpdateBody
        const existing = await db.get(`profile!${author}`)
        const prev: ProfileSnapshot = existing?.value ?? {
          author,
          updatedAt: createdAt,
          seq,
        }

        // Only update if this event is newer (use createdAt for multi-feed comparison)
        if (!existing || new Date(createdAt).getTime() > new Date(prev.updatedAt).getTime()) {
          const updated: ProfileSnapshot = {
            author,
            displayName: profileBody.displayName ?? prev.displayName,
            bio: profileBody.bio ?? prev.bio,
            updatedAt: createdAt,
            seq,
          }
          await batch.put(`profile!${author}`, updated)
        }
      }

      if (kind === 'post.delete_tombstone') {
        const tombBody = body as PostDeleteTombstoneBody
        await batch.put(`tomb!${tombBody.target}`, {
          deletedBy: id,
          author,
          seq,
          createdAt,
        })
      }

      if (kind === 'follow.create') {
        const followBody = body as FollowCreateBody
        await batch.put(`follow!${author}!${followBody.target}`, {
          eventId: id,
          since: createdAt,
        })
      }

      if (kind === 'follow.remove') {
        const followBody = body as FollowRemoveBody
        await batch.del(`follow!${author}!${followBody.target}`)
      }

      if (kind === 'device.announce') {
        const deviceBody = body as DeviceAnnounceBody
        const record: DeviceRecord = {
          deviceId: deviceBody.deviceId,
          feedKey: deviceBody.feedKey,
          deviceName: deviceBody.deviceName,
          announcedAt: createdAt,
          revoked: false,
        }
        await batch.put(`device!${author}!${deviceBody.deviceId}`, record)
        await batch.put(`feedkey!${deviceBody.feedKey}`, {
          authorHex: author,
          deviceId: deviceBody.deviceId,
        })
      }

      if (kind === 'device.revoke') {
        const revokeBody = body as DeviceRevokeBody
        const existing = await db.get(`device!${author}!${revokeBody.deviceId}`)
        if (existing && !existing.value.revoked) {
          await batch.put(`device!${author}!${revokeBody.deviceId}`, {
            ...existing.value,
            revoked: true,
            revokedAt: createdAt,
          })
          await batch.del(`feedkey!${revokeBody.feedKey}`)
        }
      }

      await batch.flush()
    },

    async rebuildAll(db, feed) {
      // Clear all existing index entries before rebuilding
      const batch = db.batch()
      for await (const entry of db.createReadStream()) {
        await batch.del(entry.key)
      }
      await batch.flush()

      let count = 0
      for (let i = 0; i < feed.length; i++) {
        const raw = await feed.get(i)
        const envelope = JSON.parse(
          Buffer.isBuffer(raw) ? raw.toString() : raw.toString(),
        ) as SignedEnvelope
        await this.indexEvent(db, envelope)
        count++
      }
      return count
    },
  }
}
