import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import createTestnet from '@hyperswarm/testnet'
import { createNetworkManager } from '../network.js'
import { createEssensStore } from '../store.js'
import { createIdentityManager } from '../identity.js'
import { createFeedManager } from '../feed.js'
import b4a from 'b4a'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('NetworkManager', () => {
  let testnet: Awaited<ReturnType<typeof createTestnet>>
  let tmpDirA: string
  let tmpDirB: string
  let storeA: ReturnType<typeof createEssensStore>
  let storeB: ReturnType<typeof createEssensStore>
  let identityA: ReturnType<typeof createIdentityManager>
  let identityB: ReturnType<typeof createIdentityManager>

  beforeEach(async () => {
    testnet = await createTestnet(3)
    tmpDirA = fs.mkdtempSync(path.join(os.tmpdir(), 'essens-net-a-'))
    tmpDirB = fs.mkdtempSync(path.join(os.tmpdir(), 'essens-net-b-'))

    storeA = createEssensStore()
    storeB = createEssensStore()
    identityA = createIdentityManager()
    identityB = createIdentityManager()

    await identityA.init(tmpDirA)
    await identityB.init(tmpDirB)
    await storeA.init(tmpDirA)
    await storeB.init(tmpDirB)
  })

  afterEach(async () => {
    await storeA.close()
    await storeB.close()
    await testnet.destroy()
    fs.rmSync(tmpDirA, { recursive: true, force: true })
    fs.rmSync(tmpDirB, { recursive: true, force: true })
  })

  it('starts and stops without errors', async () => {
    const network = createNetworkManager({ bootstrap: testnet.bootstrap })
    await network.start(storeA.getCorestore(), identityA.getAuthorHex())

    const status = network.getStatus()
    expect(status.running).toBe(true)
    expect(status.peerCount).toBe(0)
    expect(status.trackedAuthors).toEqual([])

    await network.stop()
    expect(network.getStatus().running).toBe(false)
  })

  it('replicates feed data between two peers via joinFeed', async () => {
    const networkA = createNetworkManager({ bootstrap: testnet.bootstrap })
    const networkB = createNetworkManager({ bootstrap: testnet.bootstrap })

    await networkA.start(storeA.getCorestore(), identityA.getAuthorHex())
    await networkB.start(storeB.getCorestore(), identityB.getAuthorHex())

    // Peer A writes some data to its primary feed
    const feedManager = createFeedManager()
    const feedA = storeA.getPrimaryFeed()
    const keypairA = identityA.getKeypair()

    await feedManager.append(feedA, keypairA, 'post.create', { text: 'hello from A' })
    await feedManager.append(feedA, keypairA, 'post.create', { text: 'second post from A' })

    // Peer B joins Peer A's feed by Hypercore key
    const feedAKeyHex = b4a.toString(feedA.key, 'hex')
    await networkB.joinFeed(feedAKeyHex)

    // Wait for replication to complete
    const remoteFeedB = await storeB.getRemoteFeed(feedA.key)
    await waitForLength(remoteFeedB, 2, 10000)

    expect(remoteFeedB.length).toBe(2)

    // Verify the replicated data
    const raw0 = await remoteFeedB.get(0)
    const envelope0 = JSON.parse(raw0.toString())
    expect(envelope0.body.text).toBe('hello from A')

    const raw1 = await remoteFeedB.get(1)
    const envelope1 = JSON.parse(raw1.toString())
    expect(envelope1.body.text).toBe('second post from A')

    await networkA.stop()
    await networkB.stop()
  }, 30000)

  it('reports connected peers', async () => {
    const networkA = createNetworkManager({ bootstrap: testnet.bootstrap })
    const networkB = createNetworkManager({ bootstrap: testnet.bootstrap })

    await networkA.start(storeA.getCorestore(), identityA.getAuthorHex())
    await networkB.start(storeB.getCorestore(), identityB.getAuthorHex())

    // B joins A's primary feed to trigger connection
    const feedAKeyHex = b4a.toString(storeA.getPrimaryFeed().key, 'hex')
    await networkB.joinFeed(feedAKeyHex)

    // Wait for connection to establish
    await waitForPeers(networkA, 1, 10000)

    const peersA = networkA.getConnectedPeers()
    expect(peersA.length).toBeGreaterThanOrEqual(1)
    expect(peersA[0].remotePublicKey).toBeTruthy()

    await networkA.stop()
    await networkB.stop()
  }, 30000)

  it('tracks followed authors in status', async () => {
    const network = createNetworkManager({ bootstrap: testnet.bootstrap })
    await network.start(storeA.getCorestore(), identityA.getAuthorHex())

    const authorBHex = identityB.getAuthorHex()
    await network.followAuthor(authorBHex)

    const status = network.getStatus()
    expect(status.trackedAuthors).toContain(authorBHex)

    await network.unfollowAuthor(authorBHex)
    const statusAfter = network.getStatus()
    expect(statusAfter.trackedAuthors).not.toContain(authorBHex)

    await network.stop()
  })

  it('emits peer-connected events', async () => {
    const networkA = createNetworkManager({ bootstrap: testnet.bootstrap })
    const networkB = createNetworkManager({ bootstrap: testnet.bootstrap })

    const connected: any[] = []
    networkA.on('peer-connected', (info: any) => {
      connected.push(info)
    })

    await networkA.start(storeA.getCorestore(), identityA.getAuthorHex())
    await networkB.start(storeB.getCorestore(), identityB.getAuthorHex())

    const feedAKeyHex = b4a.toString(storeA.getPrimaryFeed().key, 'hex')
    await networkB.joinFeed(feedAKeyHex)

    // Wait for connection event
    await waitFor(() => connected.length > 0, 10000)
    expect(connected.length).toBeGreaterThanOrEqual(1)

    await networkA.stop()
    await networkB.stop()
  }, 30000)

  it('throws when followAuthor called before start', async () => {
    const network = createNetworkManager({ bootstrap: testnet.bootstrap })
    await expect(network.followAuthor('a'.repeat(64))).rejects.toThrow('Network not started')
  })
})

// Helpers

async function waitForLength(feed: any, targetLength: number, timeout: number): Promise<void> {
  const start = Date.now()
  while (feed.length < targetLength) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout: feed.length is ${feed.length}, expected ${targetLength}`)
    }
    await new Promise<void>((resolve) => {
      if (feed.length >= targetLength) return resolve()
      const handler = () => {
        if (feed.length >= targetLength) {
          feed.removeListener('append', handler)
          resolve()
        }
      }
      feed.on('append', handler)
      // Also poll in case the event was missed
      setTimeout(() => {
        feed.removeListener('append', handler)
        resolve()
      }, 200)
    })
  }
}

async function waitForPeers(
  network: ReturnType<typeof createNetworkManager>,
  count: number,
  timeout: number,
): Promise<void> {
  const start = Date.now()
  while (network.getStatus().peerCount < count) {
    if (Date.now() - start > timeout) {
      throw new Error(`Timeout: peerCount is ${network.getStatus().peerCount}, expected >= ${count}`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}

async function waitFor(condition: () => boolean, timeout: number): Promise<void> {
  const start = Date.now()
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition')
    }
    await new Promise((r) => setTimeout(r, 200))
  }
}
