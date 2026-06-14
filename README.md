# MapX

MapX is a planned Windows/macOS desktop map workspace for China-focused users.

The V1 product direction is a Tauri + React app built around Baidu Maps online capabilities and local SQLite project data. The first release focuses on project-based point management before adding route planning, imports/exports, cloud sync, offline maps, or collaboration.

See the V1 product and technical specification:

- [docs/product-spec-v1.md](docs/product-spec-v1.md)
- [docs/features-v1.md](docs/features-v1.md)

## Current Status

The repository has the initial M1 foundation plus the local data core schema through `DATA-002`.

Implemented foundation:

- Tauri desktop shell with app name `MapX` and bundle identifier `com.qinshan.mapx`
- React + TypeScript frontend powered by Vite
- Placeholder MapX desktop icon
- Tailwind CSS, shadcn/ui component conventions, and lucide-react icons
- Three-column light workspace shell with map/detail placeholders
- Zustand store structure plus `stores/`, `services/`, and `types/` frontend boundaries
- Minimal desktop menu and shortcut action dispatch shell
- SQLite connection bootstrap using system app data directory `MapX/mapx.sqlite`
- Explicit migration baseline and frontend startup gate for migration failures
- V1 core SQLite schema for projects, settings, markers, categories, tags, marker tags, app settings, and backup metadata
- Basic scripts for development, typechecking, linting, frontend tests, frontend build, and Tauri build

Last verified locally:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `cargo fmt --check`
- `cargo check`
- `cargo test`
- `npm run tauri:build`
- `npm run tauri:dev`
- `npm audit --omit=dev`

## Recommended Next Steps

Work should continue from the M1 Foundation milestone in [docs/features-v1.md](docs/features-v1.md):

1. `MAP-001` and `MAP-006`: run the Baidu Maps WebView/origin and allowlist spikes early to reduce integration risk.
2. `DATA-003`: establish structured backend error conventions before business commands grow.
3. `QA-002`: add GitHub Actions CI so typecheck/lint/test can run automatically.
4. `SET-001`: begin the first-launch settings flow after backend errors are structured.

## Development

Prerequisites:

- Node.js 26+
- npm 11+
- Rust/Cargo for Tauri builds

If Cargo is not on your shell path yet, load it for the current terminal:

```sh
. "$HOME/.cargo/env"
```

Install dependencies:

```sh
npm install
```

Run the frontend dev server:

```sh
npm run dev
```

Run the Tauri desktop app in development:

```sh
npm run tauri:dev
```

Check and build the frontend:

```sh
npm run typecheck
npm run lint
npm run test
npm run build
```

Build the desktop app:

```sh
npm run tauri:build
```
