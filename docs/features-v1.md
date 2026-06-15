# MapX V1 Feature Breakdown

This document breaks the MapX V1 PRD into issue-ready work items. It is the source of truth for creating GitHub milestones, labels, and issues after review.

## Goals

- Split V1 into GitHub Issues that are independently implementable and reviewable.
- Keep most issues within 0.5-2 days of work, with 3 days as the upper bound.
- Preserve the V1 scope from [product-spec-v1.md](product-spec-v1.md).
- Prefer vertical user-flow slices after the foundation is stable.

## Global Definition Of Done

Every issue is done only when:

- The implementation stays inside the issue scope and does not add deferred V1 features.
- Acceptance criteria are satisfied with observable evidence.
- Relevant tests or validation steps listed in the issue pass.
- Errors shown to users are in Chinese and avoid raw internal error text.
- Logs do not include Baidu AK, search keywords, full marker notes, or full addresses.
- New code follows the existing project structure and naming once established.
- Documentation is updated when behavior, setup, or architecture changes.
- GitHub issue status is updated only after implementation is complete, validation has passed, and code is pushed to GitHub; completed issues are closed with a comment listing the commit, validation commands, and remaining risks, while partial progress is commented without closing the issue.

## Issue Template

```md
### ISSUE-ID: Example English Issue Title

Epic: Foundation
Type: feature | chore | test | docs | spike
Priority: P0 | P1 | P2
Estimate: 0.5-2 days
Milestone: M1 Foundation
Depends on: none | ISSUE-ID

Scope:
- 中文说明该 issue 要交付什么。

Acceptance Criteria:
- 使用可观察、可验证的结果描述完成标准。

Validation:
- 说明需要运行的测试、命令、手动验证或 spike 结论。

Out of Scope:
- 明确本 issue 不做什么。

Notes/Risks:
- 可选，记录风险、未知或实现提示。
```

## Epic IDs

- `FND` Foundation
- `DATA` Local Data Core
- `SET` Settings & First Launch
- `PROJ` Project Management
- `TAX` Categories & Tags
- `MRK` Marker Management
- `MAP` Map Provider & Baidu Integration
- `GEO` Marker Map Interaction
- `SRCH` Search
- `OPS` Backup & Logs
- `QA` Quality Gates

## Priority Rules

- `P0`: V1 cannot stand up, or later V1 work is blocked without it.
- `P1`: Required for V1 completeness, but not necessarily a blocker for early development.
- `P2`: V1 polish or optional V1.x candidate.

## Recommended GitHub Labels

Type labels:

- `type:feature`
- `type:bug`
- `type:chore`
- `type:test`
- `type:docs`
- `type:spike`

Epic labels:

- `epic:foundation`
- `epic:data`
- `epic:settings`
- `epic:project`
- `epic:taxonomy`
- `epic:marker`
- `epic:map`
- `epic:geo`
- `epic:search`
- `epic:ops`
- `epic:qa`

Priority labels:

- `priority:p0`
- `priority:p1`
- `priority:p2`

Area/platform labels:

- `area:frontend`
- `area:rust`
- `area:baidu`
- `area:sqlite`
- `platform:macos`
- `platform:windows`

## Milestones

### M1 Foundation

Purpose: establish a runnable Tauri desktop shell, UI base, repository shape, early CI, and the highest-risk platform spikes.

Parallelization notes:

- `FND-001` should land first.
- `FND-002`, `FND-003`, and `FND-004` can proceed after the scaffold exists.
- `QA-001` can begin after `FND-001`.
- `MAP-001` and `QA-002` are spikes and should run early to reduce platform risk.

### M2 Local Workspace

Purpose: make MapX usable as a local project and marker management workspace without depending on Baidu Maps.

Parallelization notes:

- `DATA-001` and `DATA-002` are the base for most M2 work.
- `PROJ`, `TAX`, and `MRK` should move toward user-visible slices instead of finishing all backend code first.
- `SET` starts once app settings persistence exists.

### M3 Map Experience

Purpose: connect Baidu Maps, marker rendering, map-based marker creation/editing, and local/Baidu search into real user flows.

Parallelization notes:

- `MAP` provides the map substrate.
- `GEO` depends on both marker management and map provider work.
- `SRCH` local search can start before Baidu search; Baidu search depends on `MAP` and AK settings.

### M4 Hardening

Purpose: add backup/logging operations, close test gaps, validate cross-platform builds, and polish failure states.

Parallelization notes:

- `OPS` can proceed after data paths and settings exist.
- `QA` hardening should run across all completed user flows.
- Failure-state polish should be validated on both macOS and Windows where possible.

## Deferred / Out Of Scope For V1

- Route planning UI and route persistence
- Import/export
- Cloud sync and accounts
- Offline maps
- Multi-user collaboration
- Attachments/photos
- Full audit log
- Undo/redo command stack
- Marker multi-select and batch operations
- Dark mode
- i18n
- Auto update
- Code signing, notarization, and release signing
- Custom data directory
- Full backup restore UI
- GitHub Projects board fields

## Issues

### FND-001: Scaffold Tauri React TypeScript app

Epic: Foundation
Type: chore
Priority: P0
Estimate: 1-2 days
Milestone: M1 Foundation
Depends on: none

Scope:
- 搭建 Tauri + React + TypeScript 基础工程。
- 保留现有 `docs/` 文档。
- 确保本地开发命令和基础构建命令可运行。

Acceptance Criteria:
- 本地可以启动 Tauri dev app。
- 前端入口显示一个最小 MapX 页面。
- README 包含本地启动和构建命令。

Validation:
- 运行前端 typecheck 或等价检查。
- 运行 Tauri dev/build smoke，至少验证 macOS 本机可启动。

Out of Scope:
- SQLite、百度地图、业务 UI。

Notes/Risks:
- 如果 scaffold 工具生成大量默认内容，需要清理默认 Tauri 文案和无关资产。

### FND-002: Configure MapX metadata and placeholder icon

Epic: Foundation
Type: chore
Priority: P0
Estimate: 0.5-1 day
Milestone: M1 Foundation
Depends on: FND-001

Scope:
- 配置应用名 `MapX`、窗口标题 `MapX`、bundle identifier `com.qinshan.mapx`。
- 替换默认 Tauri 图标为简单占位图标。

Acceptance Criteria:
- macOS app/window 显示 `MapX`。
- Tauri 配置中的 bundle identifier 是 `com.qinshan.mapx`。
- 应用不再使用默认 Tauri 图标。

Validation:
- 检查 Tauri 配置文件。
- 本地启动 app 并确认窗口标题。

Out of Scope:
- 正式品牌设计或最终图标。

### FND-003: Add frontend UI foundation

Epic: Foundation
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M1 Foundation
Depends on: FND-001

Scope:
- 接入 Tailwind CSS、shadcn/ui、lucide-react。
- 建立基础三栏工作台布局占位。
- 放置设置/关于入口占位。

Acceptance Criteria:
- 页面呈现左侧栏、中间地图占位、右侧详情占位。
- 至少使用一个 shadcn/ui 组件和一个 lucide 图标。
- 视觉为浅色工作台，不引入暗色模式。

Validation:
- 运行前端 typecheck/lint。
- 手动验证主窗口没有布局重叠。

Out of Scope:
- 实际地图、点位列表、设置表单。

### FND-004: Establish frontend state and service structure

Epic: Foundation
Type: chore
Priority: P1
Estimate: 0.5-1 day
Milestone: M1 Foundation
Depends on: FND-001

Scope:
- 接入 Zustand。
- 建立 `stores/`、`services/`、`types/` 目录结构。
- 添加 repository/service 调用 Tauri command 的约定示例。

Acceptance Criteria:
- 至少存在一个可测试的 store 示例。
- 组件不直接散落调用 Tauri command 示例逻辑。
- 目录结构与 PRD 的 frontend/backend boundary 一致。

Validation:
- 运行前端 typecheck。
- 为示例 store 添加一个轻量逻辑测试，或记录测试框架待接入依赖 `QA-001`。

Out of Scope:
- 实际项目/点位业务 store。

### FND-005: Add minimal desktop menu and shortcuts shell

Epic: Foundation
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M1 Foundation
Depends on: FND-001

Scope:
- 添加 File/Edit/View/Help 最小菜单结构。
- 为 `Cmd/Ctrl+N`、`Cmd/Ctrl+F`、`Cmd/Ctrl+S`、`Esc`、`Delete/Backspace` 建立前端事件分发壳。

Acceptance Criteria:
- 菜单项存在但可以先触发占位 action。
- 快捷键能路由到统一 action handler。
- 未实现的 action 不崩溃，并显示或记录明确占位状态。

Validation:
- 手动验证菜单和快捷键触发。
- 前端 typecheck 通过。

Out of Scope:
- 具体项目、点位、地图业务动作。

### DATA-001: Add SQLite migrations and connection bootstrap

Epic: Local Data Core
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: FND-001

Scope:
- 接入 `sqlx` + SQLite。
- 建立 app data 下的 `MapX/mapx.sqlite` 数据库路径。
- 添加显式 migrations 启动流程。

Acceptance Criteria:
- 空数据库启动时自动运行 migrations。
- migration 成功后 app 才进入主界面。
- migration 失败时显示错误页入口，而不是进入主界面。

Validation:
- Rust 测试覆盖空库 migration。
- 手动删除本地测试数据库后启动 app，确认重新创建。

Out of Scope:
- 业务表完整命令实现。

### DATA-002: Create V1 core database schema

Epic: Local Data Core
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: DATA-001

Scope:
- 添加 V1 核心表 migrations：`projects`、`project_settings`、`markers`、`categories`、`tags`、`marker_tags`、`app_settings`、`backup_metadata`。
- 使用 UUID 字符串主键和 ISO 8601 UTC 时间字段。
- 添加分类/标签同项目唯一约束，忽略软删除项。

Acceptance Criteria:
- schema 不包含 routes/imports/attachments/users/sync 等后置能力表。
- 时间字段为 `created_at`、`updated_at`、`deleted_at`。
- 分类名和标签名在同项目内唯一，软删除后允许重建同名。

Validation:
- Rust migration 测试检查核心表存在。
- SQLite 约束测试覆盖分类/标签唯一规则。

Out of Scope:
- 业务 command 和 UI。

### DATA-003: Implement structured backend errors

Epic: Local Data Core
Type: feature
Priority: P0
Estimate: 1 day
Milestone: M2 Local Workspace
Depends on: FND-001

Scope:
- 建立 Rust 后端结构化错误类型。
- Tauri command 返回可序列化错误码和 message。
- 前端建立错误码到中文文案的映射入口。

Acceptance Criteria:
- 示例 command 的错误不会暴露 raw Rust/sqlx 文本。
- 前端可以根据错误码展示中文提示。
- 至少包含 `VALIDATION_ERROR`、`DB_ERROR`、`PROJECT_NOT_FOUND` 示例。

Validation:
- Rust 单元测试覆盖错误序列化。
- 前端逻辑测试覆盖错误码映射。

Out of Scope:
- 全部业务错误枚举一次性完备。

### DATA-004: Add backend validation helpers

Epic: Local Data Core
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M2 Local Workspace
Depends on: DATA-003

Scope:
- 添加项目存在且未删除、坐标合法、名称非空、跨项目引用检查等后端校验 helper。

Acceptance Criteria:
- 无效坐标会返回结构化 validation error。
- 空名称会返回结构化 validation error。
- 软删除对象不可通过正常 command 编辑。

Validation:
- Rust 测试覆盖坐标、名称、软删除校验。

Out of Scope:
- 前端表单校验 UI。

### SET-001: Build first launch settings flow

Epic: Settings & First Launch
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: DATA-002

Scope:
- 首次启动显示默认城市和百度 AK 设置入口。
- 默认城市预填上海。
- 用户可跳过 AK 进入应用。

Acceptance Criteria:
- 没有 AK 时 app 仍可进入主界面。
- 默认城市为上海，并可在 UI 中修改。
- 首次启动完成后写入 `app_settings`。

Validation:
- 手动清空本地数据库后验证首次启动流程。
- 前端逻辑测试覆盖跳过 AK 的状态。

Out of Scope:
- 百度地图加载。

### SET-002: Add internal city list and default city picker

Epic: Settings & First Launch
Type: feature
Priority: P0
Estimate: 1 day
Milestone: M2 Local Workspace
Depends on: FND-003

Scope:
- 内置 30-50 个中国主要城市及固定中心坐标。
- 城市选择只支持城市级。

Acceptance Criteria:
- 上海、北京、深圳、广州、杭州等主要城市存在。
- 城市数据不依赖百度 geocoding。
- 默认城市 picker 只能选择内置城市。

Validation:
- 前端测试或静态检查确认城市数据包含必选城市。
- 手动验证设置页选择城市。

Out of Scope:
- 区/县选择、城市搜索 API。

### SET-003: Implement settings page essentials

Epic: Settings & First Launch
Type: feature
Priority: P1
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: SET-001, DATA-001

Scope:
- 设置页包含百度 AK、默认城市、备份目录入口占位、关于信息、数据目录入口。
- AK 存入 SQLite settings，可修改/清除。
- 提供打开数据目录的 Tauri command，并暴露只读路径信息给关于页使用。

Acceptance Criteria:
- 用户可以保存、修改、清除百度 AK。
- 保存 AK 时不写入日志。
- 关于区域显示版本和数据目录。
- 点击打开数据目录会打开 OS app data 下的 `MapX` 目录。

Validation:
- 前端表单测试覆盖 AK 保存/清除。
- 手动检查日志不包含 AK。
- 手动验证 macOS 打开数据目录。

Out of Scope:
- 系统安全存储、完整备份恢复 UI。

### PROJ-001: Auto-create default project and settings

Epic: Project Management
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: DATA-002, SET-002

Scope:
- 首次启动后自动创建默认项目 `我的项目`。
- 创建项目设置：`search_city`、地图中心、缩放、图层。

Acceptance Criteria:
- 空数据库进入应用后存在 `我的项目`。
- 新项目使用默认城市初始化搜索城市和地图中心。
- 地图图层默认 `normal`。

Validation:
- Rust 测试覆盖默认项目创建。
- 手动验证首次启动后项目列表。

Out of Scope:
- 项目切换 UI 的完整交互。

### PROJ-002: Build project switcher and create project flow

Epic: Project Management
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: PROJ-001

Scope:
- 左上角项目切换器。
- 新建项目流程。
- 通过业务 Tauri commands 写入 SQLite。

Acceptance Criteria:
- 用户可以新建项目并立即切换到新项目。
- 项目列表不显示 soft-deleted 项目。
- 新项目自动拥有项目设置，但不创建预置业务分类。

Validation:
- Rust 测试覆盖 create/list project。
- 手动验证新建和切换项目。

Out of Scope:
- 项目复制、归档、导入导出。

### PROJ-003: Support project rename

Epic: Project Management
Type: feature
Priority: P1
Estimate: 0.5-1 day
Milestone: M2 Local Workspace
Depends on: PROJ-002

Scope:
- 项目重命名 UI 和 command。
- 更新 `updated_at`。

Acceptance Criteria:
- 用户可以重命名当前项目。
- 空名称被前端和后端拒绝。
- 重命名后项目切换器立即显示新名称。

Validation:
- Rust 测试覆盖空名称校验。
- 前端测试或手动验证重命名。

Out of Scope:
- 项目名称唯一性要求，除非实现时另有明确约束。

### PROJ-004: Support project soft delete

Epic: Project Management
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M2 Local Workspace
Depends on: PROJ-002

Scope:
- 项目删除二次确认。
- 设置 `deleted_at` 并从普通列表隐藏。

Acceptance Criteria:
- 删除项目需要确认。
- 删除后项目不再出现在切换器。
- SQLite 记录保留并写入 `deleted_at`。
- 如果删除当前项目，app 切换到另一个可用项目或提示创建项目。

Validation:
- Rust 测试覆盖 soft delete。
- 手动验证确认弹窗和列表隐藏。

Out of Scope:
- 回收站/恢复项目。

### TAX-001: Initialize category model for new projects

Epic: Categories & Tags
Type: feature
Priority: P0
Estimate: 1 day
Milestone: M2 Local Workspace
Depends on: DATA-002, PROJ-001

Scope:
- 新项目不创建预置业务分类。
- 分类模型支持用户自定义名称、HEX 颜色、lucide icon name、sort order。

Acceptance Criteria:
- 每个新项目默认没有真实 category 行。
- `未分类` 不作为真实 category 行存在。
- 用户自定义分类图标来自 lucide allowlist。

Validation:
- Rust 测试覆盖新项目不创建预置分类。
- Rust 测试覆盖分类图标 allowlist。

Out of Scope:
- 分类管理 UI。

### TAX-002: Build category management UI and commands

Epic: Categories & Tags
Type: feature
Priority: P1
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: TAX-001

Scope:
- 分类列表、新建、重命名、颜色、图标选择。
- 分类名称同项目唯一，忽略软删除项。

Acceptance Criteria:
- 用户可以创建和编辑分类。
- 重名分类被前端提示并被后端拒绝。
- 分类颜色以 HEX 保存。

Validation:
- Rust 测试覆盖唯一约束。
- 前端表单测试覆盖颜色/图标校验。

Out of Scope:
- 删除分类规则，见 `TAX-003`。

### TAX-003: Implement category soft delete and uncategorize markers

Epic: Categories & Tags
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M2 Local Workspace
Depends on: TAX-002, MRK-001

Scope:
- 删除分类时二次确认。
- 软删除分类，并把引用它的 markers 转为 `category_id = null`。

Acceptance Criteria:
- 确认文案说明受影响点位数量。
- 删除分类不会删除任何 marker。
- 删除后相关 marker 显示为未分类。

Validation:
- Rust 测试覆盖 delete category uncategorizes markers。
- 手动验证 UI 提示和点位分类变化。

Out of Scope:
- 删除时迁移到另一个分类。

### TAX-004: Build tag management UI and commands

Epic: Categories & Tags
Type: feature
Priority: P1
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: DATA-002, PROJ-002

Scope:
- 标签列表、新建、重命名、删除。
- 标签只存名称，无颜色。
- 标签名称同项目唯一，忽略软删除项。

Acceptance Criteria:
- 用户可以创建和编辑标签。
- 重名标签被前端提示并被后端拒绝。
- 删除标签二次确认，并从所有 marker 解除关联。

Validation:
- Rust 测试覆盖 delete tag unlinks markers。
- 手动验证标签删除不删除 marker。

Out of Scope:
- 标签颜色、多级标签。

### MRK-001: Add marker repository and commands

Epic: Marker Management
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: DATA-002, DATA-004, PROJ-002, TAX-001

Scope:
- 实现 marker create/list/update/soft delete 基础 commands。
- 支持 `BD09` 坐标、address、category、note、source、timestamps。

Acceptance Criteria:
- marker 坐标统一保存为 `BD09`。
- marker 名称必填但同项目允许重复。
- soft-deleted marker 不出现在普通列表。

Validation:
- Rust 测试覆盖 create/list/update/soft delete marker。
- Rust 测试覆盖允许重名 marker。

Out of Scope:
- 地图点击创建、拖动坐标。

### MRK-002: Build marker list with filters and sorting

Epic: Marker Management
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: MRK-001, TAX-004

Scope:
- 左侧 `点位` tab。
- 分类筛选、标签筛选、只看未分类。
- 最近更新、最近创建、名称 A-Z 排序。
- 使用虚拟滚动。

Acceptance Criteria:
- 切换筛选条件会更新列表。
- 排序结果稳定且可观察。
- 列表不使用分页。

Validation:
- 前端逻辑测试覆盖筛选和排序。
- 手动验证 1,000 条测试 marker 列表可滚动。

Out of Scope:
- 地图 marker 聚合、多选、批量操作。

### MRK-003: Build marker detail and edit form

Epic: Marker Management
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M2 Local Workspace
Depends on: MRK-001, MRK-002

Scope:
- 右侧 marker 详情。
- 编辑名称、地址、分类、标签、备注等非地图字段。
- 保存/取消模式。

Acceptance Criteria:
- 选中 marker 后右侧显示详情。
- 编辑后点击保存会持久化到 SQLite。
- 点击取消不会写入数据库。

Validation:
- 前端表单测试覆盖必填和保存/取消。
- 手动验证刷新后数据仍存在。

Out of Scope:
- 坐标拖动编辑、逆地址解析。

### MRK-004: Add dirty state guard for marker editing

Epic: Marker Management
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M2 Local Workspace
Depends on: MRK-003

Scope:
- 编辑已有 marker 时追踪 dirty state。
- 切换 marker、项目、关闭窗口或开始冲突动作前，显示应用内自定义弹窗。

Acceptance Criteria:
- 弹窗按钮为 `保存 / 放弃更改 / 取消`。
- 选择保存会持久化并继续原操作。
- 选择放弃会丢弃更改并继续原操作。
- 选择取消会停留在当前编辑状态。

Validation:
- 前端逻辑测试覆盖三种选择。
- 手动验证切换 marker 和项目时的拦截。

Out of Scope:
- 通用 undo/redo。

### MRK-005: Add project overview empty state

Epic: Marker Management
Type: feature
Priority: P1
Estimate: 0.5-1 day
Milestone: M2 Local Workspace
Depends on: MRK-002, TAX-004

Scope:
- 右侧未选中 marker 时显示项目概览和快速操作。

Acceptance Criteria:
- 显示点位数、分类数、标签数、最近添加点位。
- 快速操作入口包括新建点位、新建分类、新建标签。
- 空状态没有大段说明文字。

Validation:
- 手动验证无选中 marker 时右侧面板。

Out of Scope:
- 地图添加点位模式。

### MAP-001: Spike Baidu AK origin and WebView behavior

Epic: Map Provider & Baidu Integration
Type: spike
Priority: P0
Estimate: 1-2 days
Milestone: M1 Foundation
Depends on: FND-001

Scope:
- 验证 Tauri dev/prod runtime origin。
- 验证百度地图 JS API 在 macOS WebView 和 Windows WebView2 的基础加载行为。

Acceptance Criteria:
- 文档记录 dev origin 和 production origin。
- 文档记录百度 AK allowlist 配置建议。
- 结论说明设置页应展示的白名单说明和地图失败提示文案要点。
- 至少有最小验证代码或截图证明地图能加载，或明确记录阻塞风险。

Validation:
- macOS 本机 smoke。
- Windows smoke 可通过 CI artifact 或手动机器验证记录。

Out of Scope:
- 完整 MapProvider 实现。

### MAP-002: Implement dynamic Baidu Maps script loader

Epic: Map Provider & Baidu Integration
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M3 Map Experience
Depends on: SET-003, MAP-001

Scope:
- 根据 AK 动态注入百度地图 GL JS script。
- 处理重复加载、加载成功、加载失败。

Acceptance Criteria:
- 未填写 AK 时不加载百度脚本。
- AK 存在时尝试加载百度地图。
- 加载失败返回结构化状态供 UI 展示。

Validation:
- 前端测试覆盖 loader 状态转换。
- 手动验证无 AK 和有 AK 两种状态。

Out of Scope:
- marker 渲染、POI 搜索。

### MAP-003: Add thin MapProvider abstraction and Baidu implementation

Epic: Map Provider & Baidu Integration
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M3 Map Experience
Depends on: MAP-002

Scope:
- 定义薄 `MapProvider` 接口。
- 实现 BaiduMapProvider 的 init/destroy/setView/getView 基础能力。
- 确保 BMapGL 对象只存在于 provider 内部。

Acceptance Criteria:
- React 组件、stores、repositories 不保存或传递 `BMapGL.Map`/`BMapGL.Marker`。
- 地图可以初始化到项目中心点。
- destroy 后再次进入页面不会重复残留旧地图实例。

Validation:
- 代码搜索确认 BMapGL 类型只在 provider 边界内使用。
- 手动验证切换/重载地图页面不崩溃。

Out of Scope:
- marker 渲染、搜索、逆地址解析。

### MAP-004: Handle map unavailable states

Epic: Map Provider & Baidu Integration
Type: feature
Priority: P0
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: MAP-002, MRK-002

Scope:
- 地图区域处理无 AK、AK 无效/加载失败、网络失败状态。
- 地图失败时本地点位列表和非坐标编辑仍可用。

Acceptance Criteria:
- 无 AK 时地图区域显示设置入口。
- 加载失败时显示重试、设置、日志入口。
- 地图失败时左侧点位列表仍可浏览。

Validation:
- 手动验证无 AK 状态。
- 用模拟 loader failure 验证失败状态。

Out of Scope:
- 自动错误上报。

### MAP-005: Add normal and satellite layer switching

Epic: Map Provider & Baidu Integration
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: MAP-003, PROJ-002

Scope:
- 支持普通地图/卫星图切换。
- 将选择保存到 `project_settings.map_layer`。

Acceptance Criteria:
- 用户可以在普通/卫星图之间切换。
- 切换项目后恢复该项目保存的图层。
- 不实现路况图。

Validation:
- 手动验证切换和项目持久化。

Out of Scope:
- 路况图、更多底图。

### MAP-006: Spike minimal Baidu CSP and domain allowlist

Epic: Map Provider & Baidu Integration
Type: spike
Priority: P1
Estimate: 1 day
Milestone: M1 Foundation
Depends on: MAP-001

Scope:
- 记录百度地图实际请求域名。
- 形成 Tauri CSP/network 最小 allowlist 建议。

Acceptance Criteria:
- 文档列出 script/connect/img/style 所需百度域名。
- 没有建议使用通配符作为生产默认配置。

Validation:
- 开发环境网络面板或日志记录域名。
- 手动验证收紧 allowlist 后地图仍加载。

Out of Scope:
- 完整安全审计。

### MAP-007: Add optional locate-me action

Epic: Map Provider & Baidu Integration
Type: feature
Priority: P2
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: MAP-003

Scope:
- 添加定位到我按钮。
- 定位失败时给出轻提示，不阻塞主流程。

Acceptance Criteria:
- 定位成功时地图移动到当前位置。
- 定位失败时 app 不崩溃，并显示中文提示。
- 不依赖定位完成项目创建或搜索。

Validation:
- 手动验证成功或失败路径。

Out of Scope:
- 后台定位、轨迹记录。

### GEO-001: Render project markers on map

Epic: Marker Map Interaction
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M3 Map Experience
Depends on: MAP-003, MRK-002

Scope:
- 将当前筛选结果渲染为轻量自定义 marker。
- 样式由分类颜色和图标控制。

Acceptance Criteria:
- 地图 marker 数量跟随左侧筛选结果。
- 分类颜色/图标反映在 marker 上。
- 单项目 1,000 marker 的基础场景仍可操作。

Validation:
- 手动验证筛选与地图 marker 同步。
- 使用测试数据验证 1,000 marker 基础性能。

Out of Scope:
- marker clustering、heatmap、富弹窗。

### GEO-002: Sync marker selection across map, list, and detail

Epic: Marker Map Interaction
Type: feature
Priority: P0
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: GEO-001, MRK-003

Scope:
- 点击地图 marker 选中点位。
- 左侧列表高亮，右侧详情显示。
- 不显示 InfoWindow。

Acceptance Criteria:
- 点击 marker 后右侧显示对应详情。
- 点击列表项后地图 marker 显示选中态。
- 地图上不出现复杂 InfoWindow。

Validation:
- 前端状态测试覆盖 selection state。
- 手动验证三栏同步。

Out of Scope:
- 多选。

### GEO-003: Add map-based marker creation mode

Epic: Marker Map Interaction
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M3 Map Experience
Depends on: GEO-001, MRK-003

Scope:
- 添加点位工具模式。
- 地图点击创建 pending marker，右侧打开新建表单。
- pending marker 必须保存或取消。
- 提供将当前地图中心保存为点位的入口，复用 pending marker 流程。

Acceptance Criteria:
- 普通单击地图不会直接添加点位。
- 进入添加模式后点击地图产生 pending marker。
- 切换项目/marker/关闭窗口前触发保存或放弃提示。
- 保存当前中心点时，source 保存为 `center`，坐标接近地图中心。

Validation:
- 前端逻辑测试覆盖 pending state。
- 手动验证保存/取消流程。
- 手动验证当前中心点保存流程。

Out of Scope:
- 右键菜单添加点位。

### GEO-004: Add drag-to-move marker editing

Epic: Marker Map Interaction
Type: feature
Priority: P1
Estimate: 1-2 days
Milestone: M3 Map Experience
Depends on: GEO-002, MRK-004

Scope:
- 编辑模式下 marker 可拖动。
- 拖动后必须保存或取消才写入 SQLite。

Acceptance Criteria:
- 非编辑模式 marker 不可拖动。
- 拖动后坐标只在保存后持久化。
- 取消后 marker 回到原位置。
- 地址不会自动覆盖。

Validation:
- 手动验证拖动、保存、取消。
- Rust 测试覆盖 move_marker command 校验。

Out of Scope:
- 批量移动、坐标系转换。

### GEO-005: Add reverse geocoding for marker addresses

Epic: Marker Map Interaction
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: MAP-003, GEO-003

Scope:
- 创建地图点/当前中心点时自动逆地址填充。
- 编辑坐标后提供 `重新获取地址` 按钮。

Acceptance Criteria:
- 新建地图点会尝试填充地址。
- 逆地址失败时仍可手动保存 marker。
- 编辑坐标保存不会自动覆盖用户手写地址。

Validation:
- 手动验证成功和失败路径。
- 前端测试覆盖地址不自动覆盖逻辑。

Out of Scope:
- 批量地址解析。

### SRCH-001: Implement local marker search

Epic: Search
Type: feature
Priority: P0
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: MRK-002, TAX-004

Scope:
- 在当前 project 内搜索 marker 名称、分类、标签、地址。
- 地图不可用时仍可使用。

Acceptance Criteria:
- 搜索关键词能返回匹配的本地点位。
- soft-deleted marker 不出现在结果中。
- 点击本地结果选中并显示 marker 详情。

Validation:
- 前端/后端测试覆盖搜索匹配和 soft delete 排除。
- 手动验证地图失败时本地搜索仍可用。

Out of Scope:
- 高级查询语法、跨项目搜索。

### SRCH-002: Build search tab and grouped local results

Epic: Search
Type: feature
Priority: P0
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: SRCH-001

Scope:
- 左侧 `搜索` tab。
- 搜索结果分组显示 `我的点位`。

Acceptance Criteria:
- `点位` 和 `搜索` 是独立 tab。
- 搜索输入不会破坏点位列表筛选状态。
- 本地结果点击后切回或同步选中 marker。

Validation:
- 前端状态测试覆盖 tab 和搜索状态隔离。
- 手动验证搜索结果点击。

Out of Scope:
- 百度 POI 结果。

### SRCH-003: Implement Baidu POI search provider

Epic: Search
Type: feature
Priority: P0
Estimate: 1-2 days
Milestone: M3 Map Experience
Depends on: MAP-003, SET-003

Scope:
- 基于 BaiduMapProvider 实现 POI 搜索。
- 默认使用当前项目 search city 或当前 bounds。
- 在当前城市/视野搜索无结果或用户需要时，提供 `扩大到全国搜索`。

Acceptance Criteria:
- 有 AK 且地图可用时能返回百度 POI 结果。
- 无 AK 或地图不可用时显示明确不可用状态。
- 搜索不记录完整关键词到日志。
- 默认搜索不直接全国搜索。
- 用户选择城市时更新当前项目 `search_city`。

Validation:
- 手动验证一个常见关键词搜索。
- Mock provider 测试覆盖成功/失败状态。
- 手动验证城市搜索和全国扩展。

Out of Scope:
- 保存 POI 为 marker。

### SRCH-004: Group Baidu results and preview POI

Epic: Search
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: SRCH-003, SRCH-002

Scope:
- 搜索结果分组显示 `百度地点`。
- 点击百度地点时地图定位并显示临时预览。

Acceptance Criteria:
- 本地结果和百度结果分组清晰。
- 点击百度结果不会立即保存 marker。
- 临时预览可取消或被下一次预览替换。

Validation:
- 手动验证本地/百度结果混合展示。
- 前端状态测试覆盖 POI preview state。

Out of Scope:
- 保存 POI 为 marker。

### SRCH-005: Save Baidu POI as marker

Epic: Search
Type: feature
Priority: P1
Estimate: 1 day
Milestone: M3 Map Experience
Depends on: SRCH-004, MRK-003

Scope:
- 将百度 POI 结果保存为 marker。
- 使用 POI 名称、地址、BD09 坐标。
- source 保存为 `search`。

Acceptance Criteria:
- 保存后 marker 出现在点位列表和地图上。
- 保存前可以编辑名称/分类/标签/备注。
- POI 保存不要求 marker 名称唯一。

Validation:
- 手动验证搜索地点保存为点位。
- Rust 测试覆盖 source 字段保存。

Out of Scope:
- POI 批量保存。

### OPS-001: Implement daily SQLite backup policy

Epic: Backup & Logs
Type: feature
Priority: P1
Estimate: 1-2 days
Milestone: M4 Hardening
Depends on: DATA-001

Scope:
- 启动时最多每日备份一次 SQLite。
- 保留最近 7 个每日备份。
- 写入 `backup_metadata`。

Acceptance Criteria:
- 备份文件位于 `backups/mapx-YYYYMMDD.sqlite`。
- 一天内重复启动不会无限创建备份。
- 超过 7 个每日备份时清理旧备份。

Validation:
- Rust 测试覆盖保留策略。
- 手动验证备份文件创建。

Out of Scope:
- 完整恢复 UI。

### OPS-002: Add backup directory and metadata UI

Epic: Backup & Logs
Type: feature
Priority: P1
Estimate: 0.5-1 day
Milestone: M4 Hardening
Depends on: OPS-001, SET-003

Scope:
- 设置页显示最近备份时间。
- 提供打开备份目录按钮。

Acceptance Criteria:
- 设置页能看到最近备份时间或暂无备份状态。
- 点击按钮打开备份目录。

Validation:
- 手动验证设置页和目录打开。

Out of Scope:
- 从备份恢复数据库。

### OPS-003: Add local logging without sensitive data

Epic: Backup & Logs
Type: feature
Priority: P1
Estimate: 1-2 days
Milestone: M4 Hardening
Depends on: FND-001, DATA-003

Scope:
- 接入本地日志。
- 记录 app/db/map/command 错误关键事件。
- 禁止记录 AK、搜索词、完整备注、完整地址。

Acceptance Criteria:
- app 启动、migration、backup、map load failure、command error code 有日志。
- 设置/关于页可打开日志目录。
- 日志中不包含 AK 明文。

Validation:
- 手动触发错误并检查日志内容。
- 添加测试或静态 helper 防止 AK 写日志。

Out of Scope:
- 自动遥测、crash upload、行为分析。

### QA-001: Add frontend test and lint/typecheck harness

Epic: Quality Gates
Type: test
Priority: P0
Estimate: 1 day
Milestone: M1 Foundation
Depends on: FND-001

Scope:
- 配置前端 typecheck、lint、unit/logic test 命令。
- 添加一个最小测试样例。

Acceptance Criteria:
- `npm` scripts 或等价命令清楚可运行。
- CI 可以调用 typecheck/lint/test。
- 最小测试在本地通过。

Validation:
- 运行前端 typecheck/lint/test。

Out of Scope:
- E2E 测试。

### QA-002: Add GitHub Actions CI skeleton

Epic: Quality Gates
Type: test
Priority: P0
Estimate: 1-2 days
Milestone: M1 Foundation
Depends on: FND-001, QA-001

Scope:
- 添加 GitHub Actions workflow。
- 至少运行前端检查和 Rust check/test skeleton。

Acceptance Criteria:
- PR/main push 会触发 CI。
- CI 能在当前空壳阶段通过。
- workflow 不包含签名、公证、自动发布。

Validation:
- GitHub Actions 显示 workflow 成功。

Out of Scope:
- 完整 macOS/Windows installer 发布。

### QA-003: Add macOS and Windows Tauri build verification

Epic: Quality Gates
Type: test
Priority: P0
Estimate: 1-2 days
Milestone: M4 Hardening
Depends on: QA-002, FND-002

Scope:
- 在 CI 中验证 macOS 和 Windows Tauri build。
- 不做签名、公证或自动发布。

Acceptance Criteria:
- macOS build job 通过。
- Windows build job 通过。
- 失败时日志足够定位缺失依赖或平台配置问题。

Validation:
- GitHub Actions macOS/Windows job 成功。

Out of Scope:
- release artifact 签名和发布。

### QA-004: Add E2E smoke test harness

Epic: Quality Gates
Type: test
Priority: P1
Estimate: 1-2 days
Milestone: M4 Hardening
Depends on: FND-003, SET-001, PROJ-002

Scope:
- 添加少量端到端冒烟测试或等价自动化 smoke。
- 覆盖 app 启动、无 AK 状态、创建项目、打开 marker 创建表单。

Acceptance Criteria:
- smoke 测试能在本地或 CI 可控环境运行。
- 无 AK 时显示设置入口。
- 创建项目流程可被自动化验证。

Validation:
- 运行 E2E smoke 命令。

Out of Scope:
- 深度百度在线能力测试。

### QA-005: Add mock map provider test support

Epic: Quality Gates
Type: test
Priority: P1
Estimate: 1 day
Milestone: M4 Hardening
Depends on: MAP-003

Scope:
- 提供 mock MapProvider 以测试地图相关业务流。
- 用 mock 覆盖地图加载失败、POI 搜索成功/失败、逆地址成功/失败。

Acceptance Criteria:
- 不依赖真实百度网络即可测试地图业务状态。
- 至少一个 GEO 或 SRCH 流程使用 mock provider 测试。

Validation:
- 运行前端测试并确认 mock provider 测试通过。

Out of Scope:
- 替代真实百度手动 smoke。
