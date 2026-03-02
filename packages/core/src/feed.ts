import { createSignedEnvelope, verifyEnvelope } from './envelope.js'
import type { SignedEnvelope, EventId, Keypair, EventKind, EventBody } from './types.js'

export interface FeedManager {
  append(
    feed: any,
    keypair: Keypair,
    kind: EventKind,
    body: EventBody,
  ): Promise<SignedEnvelope>

  get(feed: any, seq: number): Promise<SignedEnvelope>

  getRange(feed: any, start: number, end: number): Promise<SignedEnvelope[]>

  validateAll(feed: any): Promise<{ valid: number; invalid: number }>
}

export function createFeedManager(): FeedManager {
  let lastEventId: EventId | null = null

  return {
    async append(feed, keypair, kind, body) {
      const seq = feed.length

      let prev: EventId | null = null
      if (seq > 0) {
        if (lastEventId) {
          prev = lastEventId
        } else {
          const prevRaw = await feed.get(seq - 1)
          const prevEnvelope = JSON.parse(
            Buffer.isBuffer(prevRaw) ? prevRaw.toString() : prevRaw.toString(),
          ) as SignedEnvelope
          prev = prevEnvelope.id
        }
      }

      const envelope = createSignedEnvelope({ keypair, seq, prev, kind, body })

      if (!verifyEnvelope(envelope)) {
        throw new Error('Self-verification failed on newly created envelope')
      }

      await feed.append(Buffer.from(JSON.stringify(envelope)))
      lastEventId = envelope.id

      return envelope
    },

    async get(feed, seq) {
      const raw = await feed.get(seq)
      return JSON.parse(
        Buffer.isBuffer(raw) ? raw.toString() : raw.toString(),
      ) as SignedEnvelope
    },

    async getRange(feed, start, end) {
      const results: SignedEnvelope[] = []
      const actualEnd = Math.min(end, feed.length)
      for (let i = start; i < actualEnd; i++) {
        results.push(await this.get(feed, i))
      }
      return results
    },

    async validateAll(feed) {
      let valid = 0
      let invalid = 0
      for (let i = 0; i < feed.length; i++) {
        const envelope = await this.get(feed, i)
        if (verifyEnvelope(envelope)) {
          valid++
        } else {
          invalid++
        }
      }
      return { valid, invalid }
    },
  }
}
