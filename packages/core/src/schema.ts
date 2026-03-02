import { z } from 'zod'

export const PostCreateSchema = z.object({
  text: z.string().min(1).max(500),
  replyTo: z.string().min(1).optional(),
  tags: z.array(z.string().min(1).max(32)).max(8).optional(),
})

export const ProfileUpdateSchema = z.object({
  displayName: z.string().max(50).optional(),
  bio: z.string().max(160).optional(),
}).refine(d => d.displayName !== undefined || d.bio !== undefined, {
  message: 'At least one field must be provided',
})

export const PostDeleteTombstoneSchema = z.object({
  target: z.string().min(1),
})

export const FollowCreateSchema = z.object({
  target: z.string().length(64).regex(/^[0-9a-f]+$/),
})

export const FollowRemoveSchema = z.object({
  target: z.string().length(64).regex(/^[0-9a-f]+$/),
})

export const DeviceAnnounceSchema = z.object({
  deviceId: z.string().length(32).regex(/^[0-9a-f]+$/),
  feedKey: z.string().length(64).regex(/^[0-9a-f]+$/),
  deviceName: z.string().max(50).optional(),
})

export const DeviceRevokeSchema = z.object({
  deviceId: z.string().length(32).regex(/^[0-9a-f]+$/),
  feedKey: z.string().length(64).regex(/^[0-9a-f]+$/),
})

const schemaMap: Record<string, z.ZodType> = {
  'post.create': PostCreateSchema,
  'profile.update': ProfileUpdateSchema,
  'post.delete_tombstone': PostDeleteTombstoneSchema,
  'follow.create': FollowCreateSchema,
  'follow.remove': FollowRemoveSchema,
  'device.announce': DeviceAnnounceSchema,
  'device.revoke': DeviceRevokeSchema,
}

export function validateBody(kind: string, body: unknown): { success: true; data: unknown } | { success: false; error: string } {
  const schema = schemaMap[kind]
  if (!schema) {
    return { success: false, error: `Unknown event kind: ${kind}` }
  }
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error.issues.map(i => i.message).join('; ') }
}
