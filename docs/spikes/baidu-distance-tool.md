# Baidu DistanceTool Spike

Issue: https://github.com/QinshanSun/mapx/issues/76

## Scope

本 spike 验证 `huiyan-fe/BMapGLLib` 的 `DistanceTool` 是否适合 MapX 的测距记录能力。范围只覆盖加载、provider 隔离、事件转换和最小状态规则，不实现 measurements SQLite 持久化和正式 UI。

## Findings

- `DistanceTool` 可以通过独立脚本加载：`https://mapopen.bj.bcebos.com/github/BMapGLLib/DistanceTool/src/DistanceTool.min.js`。
- README 暴露的事件满足核心创建流程：`addpoint` 返回测点和累计距离，`drawend` 返回 `points` 和 `distance`，`removepolyline` 表示用户清除本次测距。
- 源码显示 `close()` 会触发 `drawend`；如果点数少于 2，会清除临时数据。MapX 主动退出测距时必须抑制这次完成事件，避免误进入保存流程。
- 源码显示有效测距结束后会保留结果 overlay 和关闭按钮，但公开 API 没有明确的“程序化清除已完成测距结果”方法。后续正式实现必须通过真实地图 smoke 验证清理策略；如果清理不稳定，应退回 provider 内自绘折线。

## Real Smoke Result

2026-06-16 使用真实浏览器 AK 执行 `tools/distance-tool-smoke.mjs`：

- `DistanceTool` 可以在 Vite browser dev origin 中加载并启动。
- 单击加点、双击结束可触发完成事件。
- 完成事件可稳定返回 3 个测点和总距离，本次 smoke 得到 `1738` 米。
- `stopDistanceMeasurement()` 在 `drawend` 后没有移除已完成测距 DOM/overlay。
- `provider.destroy()` 在 DistanceTool 完成后触发 `Cannot read properties of undefined (reading 'clearData')`。

结论：DistanceTool 可以作为行为参考和风险验证工具，但不适合作为 MapX V1 正式测距实现的核心生命周期。正式实现应在 `BaiduMapProvider` 内使用百度基础 overlay 能力自绘折线、端点和距离标签，以保证保存、取消、切换工具、销毁地图时都能稳定清理。

## Implemented In Spike

- 新增 `tools/distance-tool-smoke.mjs`，用于真实浏览器环境验证测距启动、点位/距离回传和清理行为。
- `MapProvider` 新增测距相关 MapX 纯类型和方法：`startDistanceMeasurement` / `stopDistanceMeasurement`。
- `BaiduMapProvider` 正式实现改为自绘测距 overlay，不传出百度 SDK 对象。
- 少于 2 个点时，完成结果为 `null`，调用方不能进入可保存状态。

## Validation

- `npm run test -- src/services/baidu-map-provider.test.ts src/services/mock-map-provider.test.ts`
- `npm run typecheck`
- `BAIDU_MAP_AK=<redacted> node tools/distance-tool-smoke.mjs`
- `BAIDU_MAP_AK=<redacted> MAPX_DISTANCE_SMOKE_PORT=1437 MAPX_DISTANCE_SMOKE_DEBUG_PORT=9337 node tools/distance-tool-smoke.mjs`
- `BAIDU_MAP_AK=<redacted> MAPX_SMOKE_PORT=1439 MAPX_SMOKE_DEBUG_PORT=9339 MAPX_SMOKE_TIMEOUT_MS=90000 npm run smoke:e2e`

2026-06-16 复测自绘 provider 实现：真实 Baidu GL runtime 中可启动测距、单击取得 3 个普通坐标点、双击完成返回 `1738` 米，停止测距后不会继续响应点击，provider 销毁不再抛出百度内部 `clearData` 异常。

2026-06-16 复测真实浏览器 UI：通过设置页保存 AK 后，地图进入 ready 状态；测距工具可单击添加点、双击结束，保存弹窗会拦截空名称并可创建测距记录，右侧详情可编辑名称/备注，删除确认后项目概览测距列表刷新为空。

## Remaining Risk

- 还没有在真实 Tauri WebView + 百度地图中执行自绘测距 smoke；当前已覆盖真实浏览器 + 百度地图 runtime。
- `DistanceTool` 脚本域名不进入正式 V1 运行时依赖；如果未来重新引入，需要单独加入安全白名单验证。
- measurements 的 SQLite 持久化、列表/详情、保存弹窗和删除确认已在后续实现中接入，仍需真实打包应用手动验收。
