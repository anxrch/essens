<p align="center">
  <img src="apps/desktop/src-tauri/icons/128x128@2x.png" width="128" height="128" alt="Essens 아이콘">
</p>

<h1 align="center">Essens</h1>

<p align="center">
  멀티 디바이스를 지원하는 P2P 마이크로블로그.<br>
  서버도, 계정도 없이 — 오직 키만으로.
</p>

<p align="center">
  <a href="https://github.com/anxrch/essens/releases"><img src="https://img.shields.io/github/v/release/anxrch/essens?style=flat-square" alt="릴리스"></a>
  <a href="https://github.com/anxrch/essens/actions"><img src="https://img.shields.io/github/actions/workflow/status/anxrch/essens/ci.yml?style=flat-square&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/anxrch/essens?style=flat-square" alt="라이선스"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <b>한국어</b> | <a href="README.ja.md">日本語</a>
</p>

---

[Hypercore](https://docs.holepunch.to/) 기반의 append-only 피드와 DHT 피어 탐색 위에, [Tauri 2](https://v2.tauri.app/) 데스크톱 앱으로 구현되었습니다.

## 특징

- **P2P 타임라인** — 게시물이 암호화된 연결을 통해 피어 간 직접 전파
- **팔로우 모델** — 공개 키로 다른 사용자를 팔로우하면 게시물이 자동 동기화
- **멀티 디바이스** — 동일한 ID를 여러 기기에서 사용; 각 기기의 피드가 하나의 타임라인으로 합쳐짐
- **ID 내보내기/가져오기** — 패스프레이즈로 암호화된 번들로 기기 간 ID 이동
- **기기 폐기** — 유출된 기기를 폐기하면 해당 피드가 타임라인에서 제외
- **오프라인 우선** — 모든 기능이 로컬에서 동작; 피어가 있을 때 동기화

## 아키텍처

```
essens/
├── packages/
│   ├── core/        # Hypercore 피드, 인덱서, 동기화, 암호화, 네트워킹
│   └── sidecar/     # Node.js 프로세스: core ↔ Tauri를 연결하는 RPC 서버
├── apps/
│   └── desktop/     # SvelteKit 프론트엔드 + Tauri 2 쉘
└── scripts/
    └── build-sidecar.sh
```

데스크톱 앱은 두 개의 프로세스로 실행됩니다:

1. **Tauri (Rust)** — 윈도우 관리, 시스템 트레이, OS 통합
2. **Sidecar (Node.js SEA)** — Hypercore 네트워킹, 피드 관리, stdin/stdout JSON-RPC로 노출

## 다운로드

[Releases](https://github.com/anxrch/essens/releases) 페이지에서 빌드된 바이너리를 받을 수 있습니다:

| 플랫폼 | 파일 |
|--------|------|
| Linux | `.AppImage`, `.deb`, `.rpm` |
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.exe` (NSIS), `.msi` |

## 개발

### 필요 사항

- Node.js 22+
- pnpm 9+
- Rust (stable)
- Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`

### 설치

```bash
pnpm install
```

### 실행

```bash
# 먼저 core 라이브러리 빌드
pnpm build:core

# 개발 모드로 데스크톱 앱 실행
pnpm dev
```

### 테스트

```bash
# 전체 테스트 실행
pnpm test

# core 테스트만 실행
pnpm --filter @essens/core test
```

### 로컬에서 sidecar 빌드

```bash
./scripts/build-sidecar.sh
```

`apps/desktop/src-tauri/binaries/essens-sidecar-{target}` 경로에 Node.js Single Executable Application (SEA)이 생성됩니다.

## 기술 스택

- **Hypercore / Hyperswarm** — Append-only 로그, DHT 피어 탐색, 암호화 스트림
- **Tauri 2** — 경량 데스크톱 쉘 (Rust + 시스템 웹뷰)
- **SvelteKit 5** — Runes 기반 반응형 프론트엔드
- **Node.js SEA** — esbuild + postject로 단일 실행 파일로 번들링된 사이드카
- **Vitest** — 테스트

## 라이선스

MIT
