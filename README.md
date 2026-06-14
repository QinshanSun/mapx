# MapX

MapX is a planned Windows/macOS desktop map workspace for China-focused users.

The V1 product direction is a Tauri + React app built around Baidu Maps online capabilities and local SQLite project data. The first release focuses on project-based point management before adding route planning, imports/exports, cloud sync, offline maps, or collaboration.

See the V1 product and technical specification:

- [docs/product-spec-v1.md](docs/product-spec-v1.md)
- [docs/features-v1.md](docs/features-v1.md)

## Current Status

The repository has the initial M1 foundation through `FND-004`.

Implemented foundation:

- Tauri desktop shell with app name `MapX` and bundle identifier `com.qinshan.mapx`
- React + TypeScript frontend powered by Vite
- Placeholder MapX desktop icon
- Tailwind CSS, shadcn/ui component conventions, and lucide-react icons
- Three-column light workspace shell with map/detail placeholders
- Zustand store structure plus `stores/`, `services/`, and `types/` frontend boundaries
- Basic scripts for development, typechecking, frontend build, and Tauri build

Last verified locally:

- `npm run typecheck`
- `npm run build`
- `npm run tauri:build`
- `npm run tauri:dev`
- `npm audit --omit=dev`

## Recommended Next Steps

Work should continue from the M1 Foundation milestone in [docs/features-v1.md](docs/features-v1.md):

1. `QA-001`: add frontend lint and test harness; this should include the first store logic test for the Zustand example.
2. `MAP-001` and `MAP-006`: run the Baidu Maps WebView/origin and allowlist spikes early to reduce integration risk.
3. `FND-005`: add the minimal desktop menu and shortcut dispatch shell.
4. `DATA-001`: start SQLite migration and connection bootstrap once the foundation is stable.
5. `DATA-003`: establish structured backend error conventions before business commands grow.

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

Typecheck and build the frontend:

```sh
npm run typecheck
npm run build
```

Build the desktop app:

```sh
npm run tauri:build
```
