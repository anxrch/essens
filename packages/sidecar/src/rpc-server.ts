import type {
  IdentityManager,
  EssensStore,
  FeedManager,
  Indexer,
  TimelineQuery,
  FollowsQuery,
  SyncManager,
  NetworkManager,
  DeviceRegistry,
  DeviceDiscovery,
  EventKind,
  EventBody,
} from '@essens/core'

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string }
}

type MethodHandler = (params: Record<string, unknown>) => Promise<unknown>

export interface RpcDeps {
  identity: IdentityManager
  store: EssensStore
  feedManager: FeedManager
  indexer: Indexer
  timeline: TimelineQuery
  follows: FollowsQuery
  sync: SyncManager
  network: NetworkManager
  deviceRegistry: DeviceRegistry
  deviceDiscovery: DeviceDiscovery
  storagePath: string
}

export function createRpcServer(deps: RpcDeps) {
  const methods = new Map<string, MethodHandler>()
  const startTime = Date.now()

  // --- identity ---
  methods.set('identity.get', async () => {
    const author = deps.identity.getAuthorHex()
    const db = deps.store.getIndexDb()
    const profile = await deps.timeline.getProfile(db, author)
    return {
      author,
      displayName: profile?.displayName,
      bio: profile?.bio,
    }
  })

  methods.set('identity.export', async (params) => {
    const passphrase = params.passphrase as string
    if (!passphrase || passphrase.length < 1) {
      throw new Error('Passphrase is required')
    }
    const encrypted = deps.identity.exportIdentity(passphrase)
    return { encrypted }
  })

  methods.set('identity.import', async (params) => {
    const encrypted = params.encrypted as string
    const passphrase = params.passphrase as string
    if (!encrypted || !passphrase) {
      throw new Error('Both encrypted and passphrase are required')
    }
    await deps.identity.importIdentity(deps.storagePath, encrypted, passphrase)
    return { success: true, requiresRestart: true }
  })

  // --- feed ---
  methods.set('feed.append', async (params) => {
    const kind = params.kind as EventKind
    const body = params.body as EventBody
    const feed = deps.store.getPrimaryFeed()
    const keypair = deps.identity.getKeypair()
    const envelope = await deps.feedManager.append(feed, keypair, kind, body)
    const db = deps.store.getIndexDb()
    await deps.indexer.indexEvent(db, envelope)
    return envelope
  })

  methods.set('feed.get', async (params) => {
    const seq = params.seq as number
    const feed = deps.store.getPrimaryFeed()
    return deps.feedManager.get(feed, seq)
  })

  methods.set('feed.length', async () => {
    const feed = deps.store.getPrimaryFeed()
    return { length: feed.length }
  })

  methods.set('feed.validate', async () => {
    const feed = deps.store.getPrimaryFeed()
    return deps.feedManager.validateAll(feed)
  })

  // --- timeline ---
  methods.set('timeline.recent', async (params) => {
    const limit = (params.limit as number) ?? 50
    const db = deps.store.getIndexDb()
    return deps.timeline.getRecentFiltered(db, limit)
  })

  methods.set('timeline.event', async (params) => {
    const eventId = params.eventId as string
    const db = deps.store.getIndexDb()
    return deps.timeline.getEvent(db, eventId)
  })

  // --- profile ---
  methods.set('profile.get', async (params) => {
    const author = (params.author as string) ?? deps.identity.getAuthorHex()
    const db = deps.store.getIndexDb()
    return deps.timeline.getProfile(db, author)
  })

  // --- index ---
  methods.set('index.rebuild', async () => {
    const feed = deps.store.getPrimaryFeed()
    const db = deps.store.getIndexDb()
    const count = await deps.indexer.rebuildAll(db, feed)
    return { count }
  })

  // --- system ---
  methods.set('system.ping', async () => {
    return { pong: true, uptime: Date.now() - startTime }
  })

  methods.set('system.shutdown', async () => {
    await deps.network.stop()
    await deps.store.close()
    process.exit(0)
  })

  // --- device ---
  methods.set('device.current', async () => {
    const deviceId = deps.identity.getDeviceId()
    const feedKey = deps.store.getPrimaryFeedKeyHex()
    const author = deps.identity.getAuthorHex()
    return { deviceId, feedKey, author }
  })

  methods.set('device.list', async (params) => {
    const author = (params.author as string) ?? deps.identity.getAuthorHex()
    const db = deps.store.getIndexDb()
    return deps.deviceRegistry.getAllDevices(db, author)
  })

  methods.set('device.announce', async (params) => {
    const deviceName = params.deviceName as string | undefined
    const deviceId = deps.identity.getDeviceId()
    const feedKey = deps.store.getPrimaryFeedKeyHex()
    const feed = deps.store.getPrimaryFeed()
    const keypair = deps.identity.getKeypair()
    const db = deps.store.getIndexDb()

    const envelope = await deps.feedManager.append(feed, keypair, 'device.announce', {
      deviceId,
      feedKey,
      deviceName,
    })
    await deps.indexer.indexEvent(db, envelope)
    return envelope
  })

  methods.set('device.revoke', async (params) => {
    const deviceId = params.deviceId as string
    const feedKey = params.feedKey as string
    if (!deviceId || !feedKey) {
      throw new Error('deviceId and feedKey are required')
    }

    const feed = deps.store.getPrimaryFeed()
    const keypair = deps.identity.getKeypair()
    const db = deps.store.getIndexDb()

    const envelope = await deps.feedManager.append(feed, keypair, 'device.revoke', {
      deviceId,
      feedKey,
    })
    await deps.indexer.indexEvent(db, envelope)
    return envelope
  })

  // --- follow ---
  methods.set('follow.create', async (params) => {
    const target = params.target as string
    if (!target || target.length !== 64 || !/^[0-9a-f]+$/.test(target)) {
      throw new Error('Invalid target: must be a 64-char hex public key')
    }
    const author = deps.identity.getAuthorHex()
    if (target === author) {
      throw new Error('Cannot follow yourself')
    }
    const db = deps.store.getIndexDb()
    if (await deps.follows.isFollowing(db, author, target)) {
      throw new Error('Already following this author')
    }

    const feed = deps.store.getPrimaryFeed()
    const keypair = deps.identity.getKeypair()
    const envelope = await deps.feedManager.append(feed, keypair, 'follow.create', { target })
    await deps.indexer.indexEvent(db, envelope)

    // Start multi-device discovery for the followed author
    await deps.deviceDiscovery.startDiscovery(target)

    return envelope
  })

  methods.set('follow.remove', async (params) => {
    const target = params.target as string
    if (!target || target.length !== 64 || !/^[0-9a-f]+$/.test(target)) {
      throw new Error('Invalid target: must be a 64-char hex public key')
    }

    const feed = deps.store.getPrimaryFeed()
    const keypair = deps.identity.getKeypair()
    const db = deps.store.getIndexDb()
    const envelope = await deps.feedManager.append(feed, keypair, 'follow.remove', { target })
    await deps.indexer.indexEvent(db, envelope)

    // Stop discovery for this author
    deps.deviceDiscovery.stopDiscovery(target)

    return envelope
  })

  methods.set('follow.list', async () => {
    const author = deps.identity.getAuthorHex()
    const db = deps.store.getIndexDb()
    return deps.follows.getFollowing(db, author)
  })

  // --- network ---
  methods.set('network.status', async () => {
    return deps.network.getStatus()
  })

  methods.set('network.peers', async () => {
    return deps.network.getConnectedPeers()
  })

  return {
    async handle(request: JsonRpcRequest): Promise<JsonRpcResponse> {
      const handler = methods.get(request.method)
      if (!handler) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32601, message: `Method not found: ${request.method}` },
        }
      }
      try {
        const result = await handler(request.params ?? {})
        return { jsonrpc: '2.0', id: request.id, result }
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32000,
            message: err instanceof Error ? err.message : 'Unknown error',
          },
        }
      }
    },
  }
}
