import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'
import { authorDiscoveryTopic } from './crypto.js'

export interface NetworkStatus {
  running: boolean
  peerCount: number
  trackedAuthors: string[]
}

export interface PeerInfo {
  remotePublicKey: string
}

export interface NetworkManager {
  start(corestore: any, authorHex: string): Promise<void>
  stop(): Promise<void>
  followAuthor(authorHex: string): Promise<void>
  unfollowAuthor(authorHex: string): Promise<void>
  joinFeed(feedKeyHex: string): Promise<void>
  leaveFeed(feedKeyHex: string): Promise<void>
  getStatus(): NetworkStatus
  getConnectedPeers(): PeerInfo[]
  on(event: string, handler: (...args: any[]) => void): void
}

export function createNetworkManager(opts?: { bootstrap?: any[] }): NetworkManager {
  let swarm: any = null
  let corestore: any = null
  const trackedAuthors = new Map<string, { topic: Buffer }>()
  const trackedFeeds = new Map<string, { feed: any; topic: Buffer }>()
  const listeners = new Map<string, Array<(...args: any[]) => void>>()

  function emit(event: string, ...args: any[]) {
    for (const handler of listeners.get(event) ?? []) {
      try { handler(...args) } catch { /* ignore listener errors */ }
    }
  }

  return {
    async start(store, authorHex) {
      corestore = store
      swarm = new Hyperswarm(opts?.bootstrap ? { bootstrap: opts.bootstrap } : undefined)

      swarm.on('connection', (stream: any, info: any) => {
        corestore.replicate(stream)
        emit('peer-connected', info)
        stream.on('close', () => emit('peer-disconnected', info))
        stream.on('error', () => {}) // prevent unhandled error crashes
      })

      // Announce own primary feed
      const primaryFeed = corestore.get({ name: 'primary-feed' })
      await primaryFeed.ready()
      swarm.join(primaryFeed.discoveryKey, { server: true, client: true })

      // Join own author discovery topic so other devices / followers can find us
      const ownTopic = authorDiscoveryTopic(authorHex)
      swarm.join(ownTopic, { server: true, client: true })

      await swarm.flush()
    },

    async stop() {
      if (swarm) {
        await swarm.destroy()
        swarm = null
      }
    },

    async followAuthor(authorHex) {
      if (!corestore || !swarm) throw new Error('Network not started')
      if (trackedAuthors.has(authorHex)) return

      // Join the author's discovery topic (deterministic from Ed25519 pubkey)
      const topic = authorDiscoveryTopic(authorHex)
      swarm.join(topic, { server: true, client: true })
      await swarm.flush()
      trackedAuthors.set(authorHex, { topic })
    },

    async unfollowAuthor(authorHex) {
      const entry = trackedAuthors.get(authorHex)
      if (entry && swarm) {
        await swarm.leave(entry.topic)
        trackedAuthors.delete(authorHex)
      }
    },

    async joinFeed(feedKeyHex) {
      if (!corestore || !swarm) throw new Error('Network not started')
      if (trackedFeeds.has(feedKeyHex)) return

      const key = b4a.from(feedKeyHex, 'hex')
      const feed = corestore.get({ key })
      await feed.ready()
      const topic = feed.discoveryKey
      swarm.join(topic, { server: true, client: true })
      await swarm.flush()
      trackedFeeds.set(feedKeyHex, { feed, topic })
    },

    async leaveFeed(feedKeyHex) {
      const entry = trackedFeeds.get(feedKeyHex)
      if (entry && swarm) {
        await swarm.leave(entry.topic)
        trackedFeeds.delete(feedKeyHex)
      }
    },

    getStatus() {
      return {
        running: swarm !== null,
        peerCount: swarm ? swarm.connections.size : 0,
        trackedAuthors: Array.from(trackedAuthors.keys()),
      }
    },

    getConnectedPeers() {
      if (!swarm) return []
      const peers: PeerInfo[] = []
      for (const conn of swarm.connections) {
        if (conn.remotePublicKey) {
          peers.push({
            remotePublicKey: b4a.toString(conn.remotePublicKey, 'hex'),
          })
        }
      }
      return peers
    },

    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event)!.push(handler)
    },
  }
}
