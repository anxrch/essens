import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('Sidecar E2E', () => {
  let tmpDir: string
  let proc: ChildProcess
  let rl: Interface
  let lines: string[]
  let lineResolvers: Array<(value: string) => void>

  async function nextLine(): Promise<string> {
    if (lines.length > 0) return lines.shift()!
    return new Promise(resolve => lineResolvers.push(resolve))
  }

  async function rpc(method: string, params: Record<string, unknown> = {}, id = Date.now()) {
    const request = JSON.stringify({ jsonrpc: '2.0', id, method, params })
    proc.stdin!.write(request + '\n')
    const raw = await nextLine()
    return JSON.parse(raw)
  }

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essens-sidecar-'))
    lines = []
    lineResolvers = []

    const sidecarRoot = path.resolve(__dirname, '../..')
    proc = spawn('node', [
      '--import', 'tsx',
      path.join(sidecarRoot, 'src/index.ts'),
      tmpDir,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: sidecarRoot,
    })

    rl = createInterface({ input: proc.stdout! })
    rl.on('line', (line: string) => {
      if (lineResolvers.length > 0) {
        lineResolvers.shift()!(line)
      } else {
        lines.push(line)
      }
    })

    // Wait for system.ready
    const readyLine = await nextLine()
    const ready = JSON.parse(readyLine)
    expect(ready.method).toBe('system.ready')
  })

  afterEach(async () => {
    proc.kill()
    rl.close()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('responds to system.ping', async () => {
    const res = await rpc('system.ping')
    expect(res.result.pong).toBe(true)
    expect(typeof res.result.uptime).toBe('number')
  })

  it('returns identity', async () => {
    const res = await rpc('identity.get')
    expect(res.result.author).toHaveLength(64)
  })

  it('appends and retrieves a post', async () => {
    const appendRes = await rpc('feed.append', {
      kind: 'post.create',
      body: { text: 'hello from sidecar' },
    })
    expect(appendRes.result.seq).toBe(0)
    expect(appendRes.result.kind).toBe('post.create')

    const lengthRes = await rpc('feed.length')
    expect(lengthRes.result.length).toBe(1)

    const getRes = await rpc('feed.get', { seq: 0 })
    expect(getRes.result.body.text).toBe('hello from sidecar')
  })

  it('queries timeline', async () => {
    await rpc('feed.append', { kind: 'post.create', body: { text: 'post 1' } })
    await rpc('feed.append', { kind: 'post.create', body: { text: 'post 2' } })

    const res = await rpc('timeline.recent', { limit: 10 })
    expect(res.result).toHaveLength(2)
  })

  it('updates and gets profile', async () => {
    await rpc('feed.append', {
      kind: 'profile.update',
      body: { displayName: 'sidecar-user' },
    })

    const res = await rpc('profile.get')
    expect(res.result.displayName).toBe('sidecar-user')
  })

  it('handles tombstone', async () => {
    const post = await rpc('feed.append', {
      kind: 'post.create',
      body: { text: 'to delete' },
    })

    await rpc('feed.append', {
      kind: 'post.delete_tombstone',
      body: { target: post.result.id },
    })

    const timeline = await rpc('timeline.recent', { limit: 10 })
    expect(timeline.result).toHaveLength(0)
  })

  it('returns error for unknown method', async () => {
    const res = await rpc('unknown.method')
    expect(res.error).toBeDefined()
    expect(res.error.code).toBe(-32601)
  })

  it('returns error for invalid body', async () => {
    const res = await rpc('feed.append', {
      kind: 'post.create',
      body: { text: '' },
    })
    expect(res.error).toBeDefined()
  })

  it('rebuilds indexes', async () => {
    await rpc('feed.append', { kind: 'post.create', body: { text: 'a' } })
    await rpc('feed.append', { kind: 'post.create', body: { text: 'b' } })

    const res = await rpc('index.rebuild')
    expect(res.result.count).toBe(2)
  })
})
