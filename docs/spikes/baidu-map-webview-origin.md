# Baidu Maps WebView Origin Spike

Related issues: `MAP-001`, `MAP-006`

Status: `MAP-001` spike outcome recorded. `MAP-006` still needs real request-domain capture before it can close.

## Current Evidence

- Tauri dev URL is configured as `http://localhost:1420` in `src-tauri/tauri.conf.json`.
- Tauri 2 source documents that dev mode uses `build.devUrl` when set.
- Tauri 2 source documents that packaged app assets use `tauri://localhost` on macOS and `http://tauri.localhost` or `https://tauri.localhost` on Windows/Android depending on HTTPS scheme handling.
- MapX now exposes the current runtime origin and Baidu AK allowlist hints in the settings page via `src/services/map-runtime.ts` and `src/components/settings-panel.tsx`.
- macOS Tauri dev smoke on 2026-06-14 launched `npm run tauri:dev`; the WebView accessibility tree reported `URL: tauri://localhost` while the Vite dev server was serving `http://localhost:1420`.
- A real Baidu Maps AK was not available in this session, so live map loading remains an explicit external validation risk.

## Runtime Origin Working Assumption

| Runtime | Expected origin | Evidence |
| --- | --- | --- |
| Vite browser dev | `http://localhost:1420` or `http://127.0.0.1:1420` | `src-tauri/tauri.conf.json` `build.devUrl`; direct browser smoke may use loopback IP |
| Tauri dev WebView on macOS | `tauri://localhost` observed by accessibility tree; Vite still serves `http://localhost:1420` | Local `npm run tauri:dev` smoke on 2026-06-14 |
| Tauri packaged macOS | `tauri://localhost` | Tauri source: non-Windows app protocol URL returns `tauri://localhost` |
| Tauri packaged Windows | `http://tauri.localhost` or `https://tauri.localhost` | Tauri source: Windows app protocol URL maps to tauri.localhost with scheme based on HTTPS setting |

The settings page also displays `window.location.origin` at runtime. That runtime value is the first allowlist entry users should compare with their Baidu Maps Open Platform browser AK configuration. The macOS WebView smoke suggests `tauri://localhost` must be treated as the primary macOS desktop origin even during local Tauri dev.

## Baidu AK Allowlist Risk

Baidu Maps JS API commonly relies on browser request origin or referer checks. The packaged macOS `tauri://localhost` origin may not be accepted by a Baidu web allowlist if the console expects HTTP(S) domains only.

Recommended early decision for map-provider implementation:

- Test with a real Baidu Maps browser AK in Tauri dev using both `tauri://localhost` and `http://localhost:1420` allowlisted where the Baidu console permits it.
- Test packaged macOS with the default `tauri://localhost` origin.
- If Baidu rejects `tauri://localhost`, evaluate setting Tauri `useHttpsScheme` or another supported production origin strategy before relying on the packaged macOS build for Baidu Maps.

## Settings Page Copy Points

The settings page should not ask users to log in with Baidu. It should explain that MapX only needs a Baidu Maps Open Platform AK.

Implemented Chinese UI points:

- `当前运行来源：{window.location.origin}`
- `开发白名单：tauri://localhost、http://localhost:1420、http://127.0.0.1:1420`
- `打包白名单参考：tauri://localhost、http://tauri.localhost、https://tauri.localhost`
- `地图无法加载时，请检查 AK 是否正确、白名单是否包含当前运行来源、网络连接是否可用、百度地图开放平台服务是否正常。`

Future map unavailable UI should keep the same failure causes, but present them in the map canvas instead of only the settings page.

## Minimal Verification Code

- `src/services/map-runtime.ts` centralizes the dev and packaged runtime-origin guidance.
- `src/services/map-runtime.test.ts` covers the dev origins, packaged origins, and user-facing failure checks.
- `src/components/settings-panel.tsx` renders the current origin and allowlist hints where users configure the Baidu AK.

This is intentionally thinner than `MAP-002`: it does not load the Baidu Maps script or create `BMapGL.Map` objects.

## Minimal Domain Allowlist Candidate

This list is not final. It is a starting candidate for `MAP-006`; it must be replaced or confirmed by network-panel evidence from a real Baidu Maps load.

| Resource type | Candidate domains | Notes |
| --- | --- | --- |
| script | `api.map.baidu.com` | JS API loader entry point |
| script/connect/img/style | `*.bdimg.com` | Map tiles and static assets are often served from Baidu image/CDN domains; avoid this wildcard as production default until real requests are captured |
| connect | `api.map.baidu.com` | Geocoding/search endpoints may share API host or use additional service hosts |

Production default should not use broad wildcard domains. `MAP-006` must capture actual `script`, `connect`, `img`, and `style` requests from WebView before locking CSP/network allowlist.

## MAP-001 Result

`MAP-001` can proceed as a documented risk spike with a minimal runtime-origin guidance implementation. The next implementation issue should assume:

- Browser dev allowlist entries: `http://localhost:1420`, and optionally `http://127.0.0.1:1420` for direct browser smoke.
- macOS Tauri dev observed origin: `tauri://localhost`.
- Packaged macOS expected origin: `tauri://localhost`.
- Packaged Windows expected origin: `http://tauri.localhost` or `https://tauri.localhost`.
- Missing/invalid AK, allowlist mismatch, offline network, or Baidu service failure must all be first-class map unavailable states.

## Remaining Risks

- A real Baidu Maps Open Platform AK is needed for a meaningful live map load test.
- macOS packaged app must be tested with the production origin, not only Vite/browser dev.
- Windows WebView2 origin and behavior still needs evidence from a Windows machine or a later Windows smoke artifact.
- `MAP-006` needs captured request domains from a successful map load; this document only records candidates and risks.
