# MapX

MapX is a planned Windows/macOS desktop map workspace for China-focused users.

The V1 product direction is a Tauri + React app built around Baidu Maps online capabilities and local SQLite project data. The first release focuses on project-based point management before adding route planning, imports/exports, cloud sync, offline maps, or collaboration.

See the V1 product and technical specification:

- [docs/product-spec-v1.md](docs/product-spec-v1.md)
- [docs/features-v1.md](docs/features-v1.md)

## Current Status

The repository has the initial M1 foundation, the local data core through `DATA-004`, settings work through `SET-003`, and project workspace work through `PROJ-002`.

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
- Structured backend error codes with frontend Chinese message mapping
- Backend validation helpers for required names, BD-09 coordinates, active records, and project ownership checks
- GitHub Actions CI for frontend typecheck/lint/test and Rust fmt/check/test
- First-launch settings flow with Shanghai as the default city and optional Baidu AK entry
- Built-in China city list with city-level center coordinates and default city pickers
- Settings page essentials for Baidu AK save/clear, app/data directory information, and opening the data directory
- Default project auto-creation for `我的项目` with city-based search city, map center, zoom, and `normal` map layer
- Current project workspace loading, project switcher, and project creation flow
- Basic scripts for development, typechecking, linting, frontend tests, frontend build, and Tauri build

Last verified locally:

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `cargo fmt --check`
- `cargo check`
- `cargo test`
- `npm run tauri:build -- --bundles app`
- `npm run tauri:dev`
- GitHub Actions CI on `main`
- `npm audit --omit=dev`

Note: the full default `npm run tauri:build` currently builds the release binary and `.app`, then fails during local DMG bundling. Installer verification remains part of later packaging/build validation work.

## Recommended Next Steps

Work should continue from the M2 Local Workspace milestone in [docs/features-v1.md](docs/features-v1.md):

1. `TAX-001`: create default categories for new projects.
2. `MRK-001`: add marker repository and commands.
3. `MRK-002`: build the marker list with filters and sorting.
4. `MRK-003`: build marker detail and edit form.

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
