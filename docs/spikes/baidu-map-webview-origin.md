# Baidu Maps WebView Origin Spike

Related issues: `MAP-001`, `MAP-006`

Status: partial spike, not complete enough to close either issue.

## Current Evidence

- Tauri dev URL is configured as `http://localhost:1420` in `src-tauri/tauri.conf.json`.
- Tauri 2 source documents that dev mode uses `build.devUrl` when set.
- Tauri 2 source documents that packaged app assets use `tauri://localhost` on macOS and `http://tauri.localhost` or `https://tauri.localhost` on Windows/Android depending on HTTPS scheme handling.
- Current macOS desktop smoke verified the MapX WebView can run the app shell and native menu integration, but did not load Baidu Maps.

## Runtime Origin Working Assumption

| Runtime | Expected origin | Evidence |
| --- | --- | --- |
| Vite browser dev | `http://localhost:1420` | `src-tauri/tauri.conf.json` `build.devUrl` |
| Tauri dev WebView | `http://localhost:1420` | Tauri source: dev mode uses `build.devUrl` when set |
| Tauri packaged macOS | `tauri://localhost` | Tauri source: non-Windows app protocol URL returns `tauri://localhost` |
| Tauri packaged Windows | `http://tauri.localhost` or `https://tauri.localhost` | Tauri source: Windows app protocol URL maps to tauri.localhost with scheme based on HTTPS setting |

## Baidu AK Allowlist Risk

Baidu Maps JS API commonly relies on browser request origin or referer checks. The packaged macOS `tauri://localhost` origin may not be accepted by a Baidu web allowlist if the console expects HTTP(S) domains only.

Recommended early decision for `MAP-001` validation:

- Test with a real Baidu Maps browser AK in Tauri dev using `http://localhost:1420` allowlisted.
- Test packaged macOS with the default `tauri://localhost` origin.
- If Baidu rejects `tauri://localhost`, evaluate setting Tauri `useHttpsScheme` or another supported production origin strategy before implementing `MAP-002`.

## Settings Page Copy Points

The settings page should not ask users to log in with Baidu. It should explain that MapX only needs a Baidu Maps Open Platform AK.

Suggested Chinese UI points:

- `开发环境白名单：请在百度地图开放平台为当前 AK 放行 http://localhost:1420。`
- `打包应用白名单：请根据当前系统显示的 MapX 运行来源配置百度 AK 白名单。`
- `如果地图无法加载，请检查 AK、白名单、网络连接和百度地图服务状态。`
- `未填写 AK 时，MapX 仍可编辑已有项目和非坐标字段，但不会加载百度底图、POI 搜索或逆地址解析。`

## Minimal Domain Allowlist Candidate

This list is not final. It is a starting candidate for `MAP-006`; it must be replaced or confirmed by network-panel evidence from a real Baidu Maps load.

| Resource type | Candidate domains | Notes |
| --- | --- | --- |
| script | `api.map.baidu.com` | JS API loader entry point |
| script/connect/img/style | `*.bdimg.com` | Map tiles and static assets are often served from Baidu image/CDN domains; avoid this wildcard as production default until real requests are captured |
| connect | `api.map.baidu.com` | Geocoding/search endpoints may share API host or use additional service hosts |

Production default should not use broad wildcard domains. `MAP-006` must capture actual `script`, `connect`, `img`, and `style` requests from WebView before locking CSP/network allowlist.

## Blockers Before Closing

- A real Baidu Maps Open Platform AK is needed for a meaningful load test.
- macOS packaged app must be tested with the production origin, not only Vite dev.
- Windows WebView2 origin and behavior still needs evidence from a Windows machine or CI artifact.
- `MAP-006` needs captured request domains from a successful map load; this document only records candidates and risks.

