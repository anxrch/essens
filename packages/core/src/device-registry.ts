export interface DeviceRecord {
  deviceId: string
  feedKey: string
  deviceName?: string
  announcedAt: string
  revoked: boolean
  revokedAt?: string
}

export interface DeviceRegistry {
  getDevices(db: any, authorHex: string): Promise<DeviceRecord[]>
  getAllDevices(db: any, authorHex: string): Promise<DeviceRecord[]>
  getDevice(db: any, authorHex: string, deviceId: string): Promise<DeviceRecord | null>
  getFeedKeys(db: any, authorHex: string): Promise<string[]>
}

export function createDeviceRegistry(): DeviceRegistry {
  return {
    async getDevices(db, authorHex) {
      const entries: DeviceRecord[] = []
      const prefix = `device!${authorHex}!`
      const stream = db.createReadStream({
        gte: prefix,
        lt: prefix.slice(0, -1) + '"',
      })
      for await (const entry of stream) {
        const record = entry.value as DeviceRecord
        if (!record.revoked) entries.push(record)
      }
      return entries
    },

    async getAllDevices(db, authorHex) {
      const entries: DeviceRecord[] = []
      const prefix = `device!${authorHex}!`
      const stream = db.createReadStream({
        gte: prefix,
        lt: prefix.slice(0, -1) + '"',
      })
      for await (const entry of stream) {
        entries.push(entry.value as DeviceRecord)
      }
      return entries
    },

    async getDevice(db, authorHex, deviceId) {
      const entry = await db.get(`device!${authorHex}!${deviceId}`)
      return (entry?.value as DeviceRecord) ?? null
    },

    async getFeedKeys(db, authorHex) {
      const devices = await this.getDevices(db, authorHex)
      return devices.map(d => d.feedKey)
    },
  }
}
