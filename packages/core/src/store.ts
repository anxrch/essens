import path from 'node:path'
import b4a from 'b4a'
import Corestore from 'corestore'
import Hyperbee from 'hyperbee'

export interface EssensStore {
  init(storagePath: string): Promise<void>
  getPrimaryFeed(): any
  getPrimaryFeedKeyHex(): string
  getIndexDb(): any
  getCorestore(): any
  getRemoteFeed(key: Buffer): Promise<any>
  close(): Promise<void>
}

export function createEssensStore(): EssensStore {
  let corestore: any = null
  let primaryFeed: any = null
  let indexDb: any = null

  return {
    async init(storagePath: string) {
      corestore = new Corestore(path.join(storagePath, 'cores'))
      await corestore.ready()

      primaryFeed = corestore.get({ name: 'primary-feed' })
      await primaryFeed.ready()

      const indexCore = corestore.get({ name: 'index' })
      await indexCore.ready()

      indexDb = new Hyperbee(indexCore, {
        keyEncoding: 'utf-8',
        valueEncoding: 'json',
      })
      await indexDb.ready()
    },

    getPrimaryFeed() {
      if (!primaryFeed) throw new Error('Store not initialized')
      return primaryFeed
    },

    getPrimaryFeedKeyHex() {
      if (!primaryFeed) throw new Error('Store not initialized')
      return b4a.toString(primaryFeed.key, 'hex')
    },

    getIndexDb() {
      if (!indexDb) throw new Error('Store not initialized')
      return indexDb
    },

    getCorestore() {
      if (!corestore) throw new Error('Store not initialized')
      return corestore
    },

    async getRemoteFeed(key: Buffer) {
      if (!corestore) throw new Error('Store not initialized')
      const feed = corestore.get({ key })
      await feed.ready()
      return feed
    },

    async close() {
      if (corestore) await corestore.close()
      corestore = null
      primaryFeed = null
      indexDb = null
    },
  }
}
