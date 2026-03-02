/** Hex-encoded 32-byte ed25519 public key */
export type AuthorHex = string

/** Hex-encoded event ID (blake2b-256 digest) */
export type EventId = string

/** Hex-encoded ed25519 detached signature */
export type SignatureHex = string

/** Hex-encoded Hypercore public key (32 bytes) */
export type FeedKeyHex = string

/** Unique device identifier (random hex, 16 bytes / 32 chars) */
export type DeviceId = string

export interface Keypair {
  publicKey: Buffer
  secretKey: Buffer
}

export type Visibility = 'public' | 'private'

export type EventKind =
  | 'post.create'
  | 'profile.update'
  | 'post.delete_tombstone'
  | 'follow.create'
  | 'follow.remove'
  | 'device.announce'
  | 'device.revoke'

export interface PostCreateBody {
  text: string
  replyTo?: EventId
  tags?: string[]
  visibility?: Visibility
}

export interface ProfileUpdateBody {
  displayName?: string
  bio?: string
}

export interface PostDeleteTombstoneBody {
  target: EventId
}

export interface FollowCreateBody {
  target: AuthorHex
}

export interface FollowRemoveBody {
  target: AuthorHex
}

export interface DeviceAnnounceBody {
  deviceId: DeviceId
  feedKey: FeedKeyHex
  deviceName?: string
}

export interface DeviceRevokeBody {
  deviceId: DeviceId
  feedKey: FeedKeyHex
}

export type EventBody =
  | PostCreateBody
  | ProfileUpdateBody
  | PostDeleteTombstoneBody
  | FollowCreateBody
  | FollowRemoveBody
  | DeviceAnnounceBody
  | DeviceRevokeBody

export interface UnsignedEnvelope {
  author: AuthorHex
  seq: number
  prev: EventId | null
  createdAt: string
  kind: EventKind
  body: EventBody
}

export interface SignedEnvelope extends UnsignedEnvelope {
  id: EventId
  sig: SignatureHex
}

export interface TimelineEntry {
  key: string
  eventId: EventId
  author: AuthorHex
  seq: number
  createdAt: string
  kind: EventKind
  visibility?: Visibility
}

export interface ProfileSnapshot {
  author: AuthorHex
  displayName?: string
  bio?: string
  updatedAt: string
  seq: number
}
