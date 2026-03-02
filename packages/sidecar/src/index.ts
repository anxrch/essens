import { createInterface } from 'node:readline'
import {
  createIdentityManager,
  createEssensStore,
  createFeedManager,
  createIndexer,
  createTimelineQuery,
  createFollowsQuery,
  createSyncManager,
  createNetworkManager,
  createDeviceRegistry,
  createDeviceDiscovery,
} from '@essens/core'
import { createRpcServer } from './rpc-server.js'
import type { JsonRpcRequest } from './rpc-server.js'

async function main() {
  const storagePath = process.argv[2] || './essens-data'

  const identity = createIdentityManager()
  const store = createEssensStore()
  const feedManager = createFeedManager()
  const indexer = createIndexer()
  const timeline = createTimelineQuery()
  const follows = createFollowsQuery()
  const sync = createSyncManager()
  const network = createNetworkManager()
  const deviceRegistry = createDeviceRegistry()

  await identity.init(storagePath)
  await store.init(storagePath)

  // Rebuild indexes from own feed on startup
  const feed = store.getPrimaryFeed()
  const db = store.getIndexDb()
  await indexer.rebuildAll(db, feed)

  // Start network with author discovery topic
  const author = identity.getAuthorHex()
  await network.start(store.getCorestore(), author)

  // Auto-announce this device if not yet announced
  const deviceId = identity.getDeviceId()
  const feedKeyHex = store.getPrimaryFeedKeyHex()
  const existingDevice = await deviceRegistry.getDevice(db, author, deviceId)
  if (!existingDevice || existingDevice.feedKey !== feedKeyHex) {
    const keypair = identity.getKeypair()
    const announceEnv = await feedManager.append(feed, keypair, 'device.announce', {
      deviceId,
      feedKey: feedKeyHex,
    })
    await indexer.indexEvent(db, announceEnv)
  }

  // Create device discovery orchestrator
  const deviceDiscovery = createDeviceDiscovery({
    db,
    corestore: store.getCorestore(),
    network,
    sync,
    indexer,
    deviceRegistry,
  })

  // Sync own primary feed
  await sync.syncFeed(db, feed, author, indexer)
  sync.watchFeed(feed, feedKeyHex, async () => {
    try {
      await sync.syncFeed(db, feed, author, indexer)
    } catch { /* ignore background sync errors */ }
  })

  // Start discovery for own author (finds other own devices)
  await deviceDiscovery.startDiscovery(author)

  // Restore follows — start discovery for each followed author
  const following = await follows.getFollowing(db, author)
  for (const entry of following) {
    try {
      await deviceDiscovery.startDiscovery(entry.target)
    } catch {
      // Peer may not be online yet; will discover when they connect
    }
  }

  const server = createRpcServer({
    identity,
    store,
    feedManager,
    indexer,
    timeline,
    follows,
    sync,
    network,
    deviceRegistry,
    deviceDiscovery,
    storagePath,
  })

  const rl = createInterface({ input: process.stdin })

  rl.on('line', async (line: string) => {
    try {
      const request = JSON.parse(line) as JsonRpcRequest
      const response = await server.handle(request)
      process.stdout.write(JSON.stringify(response) + '\n')
    } catch {
      const error = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }
      process.stdout.write(JSON.stringify(error) + '\n')
    }
  })

  rl.on('close', async () => {
    await network.stop()
    await store.close()
    process.exit(0)
  })

  // Signal readiness
  process.stdout.write(
    JSON.stringify({ jsonrpc: '2.0', method: 'system.ready', params: {} }) + '\n',
  )
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n')
  process.exit(1)
})
