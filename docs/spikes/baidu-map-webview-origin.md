# Baidu Maps WebView Origin Spike

Related issues: `MAP-001`, `MAP-006`

Status: `MAP-001` spike outcome recorded. `MAP-006` has browser/headless request-domain evidence, a real-AK tightened-CSP smoke, and a non-wildcard CSP draft. A Tauri WebView smoke is still recommended before enabling the final production CSP in `tauri.conf.json`.

## Current Evidence

- Tauri dev URL is configured as `http://localhost:1420` in `src-tauri/tauri.conf.json`.
- Tauri 2 source documents that dev mode uses `build.devUrl` when set.
- Tauri 2 source documents that packaged app assets use `tauri://localhost` on macOS and `http://tauri.localhost` or `https://tauri.localhost` on Windows/Android depending on HTTPS scheme handling.
- MapX now exposes the current runtime origin and Baidu AK allowlist hints in the settings page via `src/services/map-runtime.ts` and `src/components/settings-panel.tsx`.
- macOS Tauri dev smoke on 2026-06-14 launched `npm run tauri:dev`; the WebView accessibility tree reported `URL: tauri://localhost` while the Vite dev server was serving `http://localhost:1420`.
- Chrome headless network logs on 2026-06-14 loaded a minimal Baidu WebGL map page with a real browser AK, centered the map on Shanghai, and observed Baidu runtime requests to `api.map.baidu.com`, `dlswbr.baidu.com`, `reports.baidu.com`, `webmap0.bdimg.com`, and `apimaponline0-3.bdimg.com`.
- A second Chrome headless smoke used a tightened page-level CSP containing only those Baidu hosts for external script/style/img/connect sources. The map rendered successfully under that CSP, the screenshot showed the Shanghai base map, and the netlog had zero CSP violation/refusal matches. Chrome headless did not exit cleanly after the map render loop, so the process was killed after the screenshot/netlog were written.
- `npm run spike:baidu-domains` now captures the Baidu loader, `getscript`, and `bmap.css` resources without printing the AK value. Set `BAIDU_MAP_AK` for a real capture; otherwise it uses a placeholder AK and should be treated as loader/static-resource evidence only.

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

## Minimal Domain Allowlist Recommendation

The production default should use explicit hosts and should not use wildcard domains such as `*.bdimg.com` or `*.baidu.com`.

Observed on 2026-06-14 from Chrome headless netlogs for a minimal Baidu WebGL map page using a redacted real browser AK and centered on Shanghai:

| Resource type | Required domains | Evidence |
| --- | --- | --- |
| script | `api.map.baidu.com`, `dlswbr.baidu.com` | Initial JS API loader, `getscript`, `getmodules`, and Baidu security script `heicha/mw/abclite-2063-s.js` |
| style | `api.map.baidu.com` | `res/webgl/10/bmap.css` |
| img | `api.map.baidu.com`, `webmap0.bdimg.com`, `apimaponline0.bdimg.com`, `apimaponline1.bdimg.com`, `apimaponline2.bdimg.com`, `apimaponline3.bdimg.com` | Logo/blank assets and normal map tile requests |
| connect | `api.map.baidu.com`, `reports.baidu.com` | Baidu API runtime requests and Baidu CSP report endpoint `csp-report/map-web` |

Draft CSP shape for future Tauri hardening:

```text
default-src 'self';
script-src 'self' https://api.map.baidu.com https://dlswbr.baidu.com;
style-src 'self' 'unsafe-inline' https://api.map.baidu.com;
img-src 'self' data: https://api.map.baidu.com https://webmap0.bdimg.com https://apimaponline0.bdimg.com https://apimaponline1.bdimg.com https://apimaponline2.bdimg.com https://apimaponline3.bdimg.com;
connect-src 'self' https://api.map.baidu.com https://reports.baidu.com;
```

When this is moved into `src-tauri/tauri.conf.json`, keep Tauri's required local IPC/app protocol sources in the final CSP. This spike intentionally does not change `tauri.conf.json` yet because the app has not implemented the dynamic Baidu loader (`MAP-002`) and a real AK/Tauri WebView run is still needed.

## Reproduction Notes

Static loader/domain capture:

```bash
npm run spike:baidu-domains
```

For a real-AK capture, load `BAIDU_MAP_AK` into the process environment before running the command. The script redacts the AK in output.

Chrome headless netlog smoke used this page-level CSP with a redacted browser AK:

```text
default-src 'none'; script-src 'unsafe-inline' https://api.map.baidu.com https://dlswbr.baidu.com; style-src 'unsafe-inline' https://api.map.baidu.com; img-src data: https://api.map.baidu.com https://webmap0.bdimg.com https://apimaponline0.bdimg.com https://apimaponline1.bdimg.com https://apimaponline2.bdimg.com https://apimaponline3.bdimg.com; connect-src https://api.map.baidu.com https://reports.baidu.com;
```

The netlog was filtered to Baidu hosts only; Chrome's own background Google requests were ignored. Temporary HTML/netlog files that contained the AK were deleted after extracting the host list and validating the screenshot.

## MAP-001 Result

`MAP-001` can proceed as a documented risk spike with a minimal runtime-origin guidance implementation. The next implementation issue should assume:

- Browser dev allowlist entries: `http://localhost:1420`, and optionally `http://127.0.0.1:1420` for direct browser smoke.
- macOS Tauri dev observed origin: `tauri://localhost`.
- Packaged macOS expected origin: `tauri://localhost`.
- Packaged Windows expected origin: `http://tauri.localhost` or `https://tauri.localhost`.
- Missing/invalid AK, allowlist mismatch, offline network, or Baidu service failure must all be first-class map unavailable states.

## Remaining Risks

- Tauri WebView should still run the same tightened-CSP smoke after `MAP-002` introduces the real app loader.
- macOS packaged app must be tested with the production origin, not only Vite/browser dev.
- Windows WebView2 origin and behavior still needs evidence from a Windows machine or a later Windows smoke artifact.
- Satellite layer, POI search, geocoding, and route planning may add domains later. Do not broaden V1 production CSP until those issues capture their own request evidence.
