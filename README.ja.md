<p align="center">
  <img src="apps/desktop/src-tauri/icons/128x128@2x.png" width="128" height="128" alt="Essens アイコン">
</p>

<h1 align="center">Essens</h1>

<p align="center">
  マルチデバイス対応のP2Pマイクロブログ。<br>
  サーバーもアカウントも不要 — 鍵だけで。
</p>

<p align="center">
  <a href="https://github.com/anxrch/essens/releases"><img src="https://img.shields.io/github/v/release/anxrch/essens?style=flat-square" alt="リリース"></a>
  <a href="https://github.com/anxrch/essens/actions"><img src="https://img.shields.io/github/actions/workflow/status/anxrch/essens/ci.yml?style=flat-square&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/anxrch/essens?style=flat-square" alt="ライセンス"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <b>日本語</b>
</p>

---

[Hypercore](https://docs.holepunch.to/)ベースのappend-onlyフィードとDHTピアディスカバリーの上に、[Tauri 2](https://v2.tauri.app/)デスクトップアプリとして実装されています。

## 特徴

- **P2Pタイムライン** — 投稿が暗号化された接続を通じてピア間で直接伝播
- **フォローモデル** — 公開鍵で他のユーザーをフォローすると投稿が自動同期
- **マルチデバイス** — 同じIDを複数のデバイスで使用; 各デバイスのフィードが一つのタイムラインに統合
- **IDエクスポート/インポート** — パスフレーズで暗号化されたバンドルでデバイス間のID移行
- **デバイス無効化** — 漏洩したデバイスを無効化するとそのフィードがタイムラインから除外
- **オフラインファースト** — 全機能がローカルで動作; ピアがいる時に同期

## アーキテクチャ

```
essens/
├── packages/
│   ├── core/        # Hypercoreフィード、インデクサー、同期、暗号化、ネットワーキング
│   └── sidecar/     # Node.jsプロセス: core ↔ Tauriを繋ぐRPCサーバー
├── apps/
│   └── desktop/     # SvelteKitフロントエンド + Tauri 2シェル
└── scripts/
    └── build-sidecar.sh
```

デスクトップアプリは二つのプロセスで実行されます:

1. **Tauri (Rust)** — ウィンドウ管理、システムトレイ、OS統合
2. **Sidecar (Node.js SEA)** — Hypercoreネットワーキング、フィード管理、stdin/stdout JSON-RPCで公開

## ダウンロード

[Releases](https://github.com/anxrch/essens/releases)ページからビルド済みバイナリをダウンロードできます:

| プラットフォーム | ファイル |
|-----------------|---------|
| Linux | `.AppImage`, `.deb`, `.rpm` |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.exe` (NSIS), `.msi` |

## 開発

### 前提条件

- Node.js 22+
- pnpm 9+
- Rust (stable)
- Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

### セットアップ

```bash
pnpm install
```

### 実行

```bash
# まずcoreライブラリをビルド
pnpm build:core

# 開発モードでデスクトップアプリを起動
pnpm dev
```

### テスト

```bash
# 全テスト実行
pnpm test

# coreテストのみ実行
pnpm --filter @essens/core test
```

### ローカルでsidecarビルド

```bash
./scripts/build-sidecar.sh
```

`apps/desktop/src-tauri/binaries/essens-sidecar-{target}`にNode.js Single Executable Application (SEA)が生成されます。

## 技術スタック

- **Hypercore / Hyperswarm** — Append-onlyログ、DHTピアディスカバリー、暗号化ストリーム
- **Tauri 2** — 軽量デスクトップシェル (Rust + システムWebView)
- **SvelteKit 5** — Runesベースのリアクティブフロントエンド
- **Node.js SEA** — esbuild + postjectで単一実行ファイルにバンドルされたサイドカー
- **Vitest** — テスト

## ライセンス

MIT
