# Essens

Peer-to-peer microblog with multi-device support. No servers, no accounts — just your keys.

Built on [Hypercore](https://docs.holepunch.to/) for append-only feeds and DHT-based peer discovery, wrapped in a [Tauri 2](https://v2.tauri.app/) desktop app.

## Features

- **P2P timeline** — Posts propagate directly between peers over encrypted connections
- **Follow model** — Follow other users by their public key; their posts sync automatically
- **Multi-device** — Use the same identity across devices; each device gets its own feed that merges into a unified timeline
- **Identity export/import** — Move your identity between devices with a passphrase-encrypted bundle
- **Device revocation** — Revoke compromised devices; revoked feeds are excluded from the timeline
- **Offline-first** — Everything works locally; syncs when peers are available

## Architecture

```
essens/
├── packages/
│   ├── core/        # Hypercore feeds, indexer, sync, crypto, networking
│   └── sidecar/     # Node.js process: RPC server bridging core ↔ Tauri
├── apps/
│   └── desktop/     # SvelteKit frontend + Tauri 2 shell
└── scripts/
    └── build-sidecar.sh
```

The desktop app runs two processes:

1. **Tauri (Rust)** — Window management, system tray, OS integration
2. **Sidecar (Node.js SEA)** — Hypercore networking, feed management, exposed via JSON-RPC over stdin/stdout

## Download

Pre-built binaries are available on the [Releases](https://github.com/anxrch/essens/releases) page:

| Platform | File |
|----------|------|
| Linux | `.AppImage`, `.deb`, `.rpm` |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.exe` (NSIS), `.msi` |

## Development

### Prerequisites

- Node.js 22+
- pnpm 9+
- Rust (stable)
- Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

### Setup

```bash
pnpm install
```

### Run

```bash
# Build core library first
pnpm build:core

# Start desktop app in dev mode
pnpm dev
```

### Test

```bash
# Run all tests
pnpm test

# Run core tests only
pnpm --filter @essens/core test
```

### Build sidecar locally

```bash
./scripts/build-sidecar.sh
```

This creates a Node.js Single Executable Application (SEA) at `apps/desktop/src-tauri/binaries/essens-sidecar-{target}`.

## Tech Stack

- **Hypercore / Hyperswarm** — Append-only logs, DHT peer discovery, encrypted streams
- **Tauri 2** — Lightweight desktop shell (Rust + system webview)
- **SvelteKit 5** — Frontend with runes-based reactivity
- **Node.js SEA** — Sidecar bundled as single executable via esbuild + postject
- **Vitest** — Testing

## License

MIT
