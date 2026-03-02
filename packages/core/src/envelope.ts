import b4a from 'b4a'
import { canonicalUnsignedBytes, computeEventId } from './canonical.js'
import { sign, verify } from './crypto.js'
import { validateBody } from './schema.js'
import type {
  Keypair, EventId, EventKind, EventBody,
  UnsignedEnvelope, SignedEnvelope,
} from './types.js'

export interface CreateEnvelopeParams {
  keypair: Keypair
  seq: number
  prev: EventId | null
  kind: EventKind
  body: EventBody
}

export function createSignedEnvelope(params: CreateEnvelopeParams): SignedEnvelope {
  const { keypair, seq, prev, kind, body } = params
  const author = b4a.toString(keypair.publicKey, 'hex')

  const validation = validateBody(kind, body)
  if (!validation.success) {
    throw new Error(`Invalid body for kind "${kind}": ${validation.error}`)
  }

  const createdAt = new Date().toISOString()
  const unsigned: UnsignedEnvelope = { author, seq, prev, createdAt, kind, body }
  const id = computeEventId(author, seq, unsigned)
  const canonical = canonicalUnsignedBytes(unsigned)
  const sig = sign(canonical, keypair.secretKey)

  return { id, ...unsigned, sig }
}

export function verifyEnvelope(envelope: SignedEnvelope): boolean {
  const validation = validateBody(envelope.kind, envelope.body)
  if (!validation.success) return false

  const { id, sig, ...unsigned } = envelope
  const expectedId = computeEventId(envelope.author, envelope.seq, unsigned)
  if (id !== expectedId) return false

  const canonical = canonicalUnsignedBytes(unsigned)
  const publicKey = b4a.from(envelope.author, 'hex')
  return verify(canonical, sig, publicKey)
}
