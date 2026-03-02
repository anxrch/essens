declare module 'sodium-universal' {
  const sodium: {
    crypto_sign_PUBLICKEYBYTES: number
    crypto_sign_SECRETKEYBYTES: number
    crypto_sign_BYTES: number
    crypto_sign_keypair(publicKey: Buffer, secretKey: Buffer): void
    crypto_sign_detached(sig: Buffer, message: Buffer, secretKey: Buffer): void
    crypto_sign_verify_detached(sig: Buffer, message: Buffer, publicKey: Buffer): boolean
    crypto_generichash(output: Buffer, input: Buffer): void
    crypto_generichash_BYTES: number

    // Random
    randombytes_buf(buf: Buffer): void

    // Secretbox (XSalsa20-Poly1305)
    crypto_secretbox_KEYBYTES: number
    crypto_secretbox_NONCEBYTES: number
    crypto_secretbox_MACBYTES: number
    crypto_secretbox_easy(ciphertext: Buffer, message: Buffer, nonce: Buffer, key: Buffer): void
    crypto_secretbox_open_easy(message: Buffer, ciphertext: Buffer, nonce: Buffer, key: Buffer): boolean

    // Password hashing (Argon2id)
    crypto_pwhash_SALTBYTES: number
    crypto_pwhash_OPSLIMIT_INTERACTIVE: number
    crypto_pwhash_MEMLIMIT_INTERACTIVE: number
    crypto_pwhash_ALG_ARGON2ID13: number
    crypto_pwhash(output: Buffer, password: Buffer, salt: Buffer, opslimit: number, memlimit: number, algorithm: number): void
  }
  export default sodium
}

declare module 'b4a' {
  const b4a: {
    alloc(size: number): Buffer
    from(input: string, encoding?: string): Buffer
    from(input: Buffer | Uint8Array): Buffer
    toString(buf: Buffer, encoding?: string): string
    concat(buffers: Buffer[]): Buffer
    isBuffer(value: unknown): value is Buffer
  }
  export default b4a
}

declare module 'corestore' {
  class Corestore {
    constructor(storage: string)
    ready(): Promise<void>
    get(opts: { name: string } | { key: Buffer }): any
    close(): Promise<void>
  }
  export default Corestore
}

declare module 'hyperbee' {
  class Hyperbee {
    constructor(core: any, opts?: { keyEncoding?: string; valueEncoding?: string })
    ready(): Promise<void>
    get(key: string): Promise<{ key: string; value: any } | null>
    put(key: string, value: any): Promise<void>
    del(key: string): Promise<void>
    batch(): {
      put(key: string, value: any): Promise<void>
      del(key: string): Promise<void>
      flush(): Promise<void>
    }
    createReadStream(opts?: {
      gte?: string
      gt?: string
      lte?: string
      lt?: string
      limit?: number
      reverse?: boolean
    }): AsyncIterable<{ key: string; value: any }>
  }
  export default Hyperbee
}

declare module 'compact-encoding' {
  export const string: any
  export const buffer: any
  export const json: any
}

declare module 'hyperswarm' {
  class Hyperswarm {
    constructor(opts?: { bootstrap?: any[]; keyPair?: any })
    on(event: 'connection', handler: (stream: any, info: any) => void): this
    join(topic: Buffer, opts?: { server?: boolean; client?: boolean }): any
    leave(topic: Buffer): Promise<void>
    flush(): Promise<void>
    destroy(): Promise<void>
    connections: Set<any>
  }
  export default Hyperswarm
}

declare module '@hyperswarm/testnet' {
  function createTestnet(size?: number, opts?: any): Promise<{
    bootstrap: any[]
    nodes: any[]
    destroy(): Promise<void>
  }>
  export default createTestnet
}
