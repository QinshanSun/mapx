# MapX V1 Product And Technical Spec

## Purpose

MapX V1 is a Windows/macOS desktop map workspace for China-focused users. The first version is a project-based point management tool built around Baidu Maps online capabilities and local SQLite storage.

The V1 goal is to make project point management reliable and comfortable before adding heavier capabilities such as route planning, imports, exports, cloud sync, offline maps, or collaboration.

## Product Decisions

- App name: `MapX`
- Window title: `MapX`
- Bundle identifier: `com.qinshan.mapx`
- Primary platform: Windows and macOS desktop installers
- Primary users: China-based users
- UI language: Chinese only
- Theme: light mode only
- App model: single-window desktop app
- System tray/background running: not supported in V1
- Auto update: handled by the independent `V1 Auto Update` milestone using signed updater artifacts; manual installer downloads remain as fallback

## Technology Stack

- Desktop shell: Tauri
- Frontend: React + TypeScript
- UI: Tailwind CSS + shadcn/ui + lucide-react
- State management: Zustand
- Map provider: Baidu Maps GL JS API
- Backend: Rust Tauri commands
- Database: SQLite managed by Rust backend
- SQLite access: `sqlx` + explicit migrations
- Frontend/backend boundary: frontend calls repository/service modules, which call Tauri commands

## V1 Scope

### Included

- Multiple local projects
- Project create, switch, rename, and soft delete
- Project-based point management
- Marker create, view, edit, drag-to-move, and soft delete
- Single category per marker
- Multiple tags per marker
- Local point search and Baidu POI search
- Baidu reverse geocoding for address fill
- Normal/satellite map layer switching
- Optional locate-me button
- Local SQLite persistence
- Daily lightweight SQLite backup, keeping 7 backups
- Settings page
- Local logs
- macOS and Windows CI build verification

### Not Included

- Route planning UI or route persistence
- Import/export
- Cloud sync or accounts
- Offline maps
- Multi-user collaboration
- Attachments/photos
- Full audit log
- Undo/redo command stack
- Marker multi-select or batch operations
- Dark mode
- i18n
- macOS notarization and Windows code signing
- Custom data directory
- Full backup restore UI

## Product Model

MapX V1 is a project-based map management tool. Data belongs to a `Project`; markers are the core object. Route planning is deferred.

Each project contains:

- Markers
- Categories
- Tags
- Project map/search settings

The first launch creates a default project named `我的项目`.

## Map Capabilities

MapX V1 depends on network access for map features:

- Baidu base map
- Baidu POI search
- Baidu reverse geocoding
- Optional current location

Local project data remains accessible when Baidu Maps or network loading fails.

When the map is unavailable, users can still:

- View projects
- View marker lists
- Edit marker non-coordinate fields
- Manage categories and tags
- Soft delete markers/projects

When the map is unavailable, users cannot:

- Add marker by map click
- Drag marker to update coordinates
- Reverse geocode
- Search Baidu POIs
- Use locate-me
- Switch map layers meaningfully

## Baidu Maps Integration

The Baidu Maps GL JS API is loaded dynamically at runtime using the configured AK.

AK source order:

- Development: `.env` / `.env.local`
- User runtime: settings page

V1 stores the AK in SQLite settings. The AK must not be written to logs.

The app must handle:

- Missing AK
- Invalid AK
- AK quota or authorization problems
- Network failure
- Baidu script load failure

Tauri network/CSP permissions should allow only required Baidu Maps domains. Do not use wildcard external network permissions unless a specific development-only exception is documented.

V1 must verify the actual Tauri runtime origin for Baidu AK allowlist configuration and show guidance in settings for configuring Baidu allowlists.

## Map Provider Boundary

Use a thin provider abstraction covering only V1 needs. Do not design a full multi-map SDK in V1.

Suggested interface shape:

```ts
interface MapProvider {
  init(container: HTMLElement, options: InitOptions): Promise<void>
  destroy(): void
  setView(center: MapPoint, zoom: number): void
  getView(): MapViewState
  setLayer(layer: "normal" | "satellite"): void
  renderMarkers(markers: MarkerViewModel[]): void
  selectMarker(markerId: string | null): void
  enterAddMarkerMode(): void
  exitAddMarkerMode(): void
  reverseGeocode(point: MapPoint): Promise<AddressResult>
  searchPoi(query: PoiSearchQuery): Promise<PoiSearchResult[]>
  locateMe(): Promise<MapPoint>
}
```

Baidu objects such as `BMapGL.Map`, `BMapGL.Marker`, and `BMapGL.Point` must stay inside `BaiduMapProvider`. Business stores, React components, repositories, and database DTOs must use plain MapX data objects only.

## Coordinates

V1 stores marker coordinates as Baidu `BD-09` coordinates.

Marker coordinate fields:

- `lng REAL NOT NULL`
- `lat REAL NOT NULL`
- `coordinate_system TEXT NOT NULL`, fixed to `BD09` in V1

Do not store multiple coordinate systems per marker in V1.

## Marker Model

Markers are the central V1 object.

Marker fields:

- `id`
- `project_id`
- `name`
- `lng`
- `lat`
- `coordinate_system = BD09`
- `address`
- `category_id`
- `note`
- `source = manual | search | center`
- `created_at`
- `updated_at`
- `deleted_at`

Marker names are required but not unique within a project.

Marker creation methods:

- Add-marker tool mode, then click map
- Save Baidu search result as marker
- Save current map center as marker

Marker editing:

- Form editing uses explicit save/cancel
- Drag-to-move requires edit mode
- Dragged coordinates are persisted only after save
- Editing coordinates does not automatically overwrite address
- Provide a `重新获取地址` action for reverse geocoding

Marker deletion:

- Soft delete with `deleted_at`
- Requires confirmation

## Categories And Tags

Each marker has at most one category and may have multiple tags.

Category fields:

- `id`
- `project_id`
- `name`
- `color` as HEX
- `icon` as lucide icon name
- `sort_order`
- `created_at`
- `updated_at`
- `deleted_at`

Tag fields:

- `id`
- `project_id`
- `name`
- `created_at`
- `updated_at`
- `deleted_at`

Marker/tag join table:

- `marker_id`
- `tag_id`

Rules:

- Category names are unique within a project, ignoring soft-deleted categories
- Tag names are unique within a project, ignoring soft-deleted tags
- Tags do not have colors in V1
- Marker color and icon are controlled by category
- Per-marker style overrides are not supported in V1
- `未分类` is represented by `markers.category_id = null`, not a real category row
- New projects start without preset business categories; users define category names, colors, and lucide icons themselves

Deleting a category:

- Requires confirmation
- Soft deletes the category
- Moves affected markers to `未分类`

Deleting a tag:

- Requires confirmation
- Soft deletes the tag
- Removes the tag from all markers

## Projects

V1 supports multiple projects with minimal management:

- Create
- Switch
- Rename
- Soft delete

Project deletion:

- Requires confirmation
- Sets `deleted_at`
- Hides project from normal project list

No project archive, project templates, project duplication, project import/export, or project members in V1.

## Search

The left sidebar has separate tabs for `点位` and `搜索`.

Search searches two sources:

- Local project markers, categories, tags, and addresses
- Baidu POIs

Results are grouped:

- 我的点位
- 百度地点

Clicking a local marker selects and focuses it. Clicking a Baidu POI previews it and allows saving as a marker.

Baidu POI search defaults to the current map view/current project search city. If there are no useful results or the user chooses it, provide `扩大到全国搜索`.

Each project stores its own `search_city`.

## Map UI

Main layout: three-column workspace.

- Left: project switcher, point/search tabs, filters, marker list/search results
- Center: Baidu map
- Right: selected marker details or project overview

Right panel when no marker is selected:

- Project overview
- Marker count
- Category count
- Tag count
- Recent markers
- Quick actions for new marker/category/tag

Map layers:

- Normal map
- Satellite map

Road traffic layer is not included in V1.

Marker rendering:

- Lightweight custom marker
- Fixed size
- Category color and icon
- Hover may show name tooltip
- Click selects marker and opens right details panel
- No InfoWindow in V1

Adding marker:

- User activates add-marker tool mode
- User clicks the map
- App creates pending marker and opens right-side new marker form
- Pending marker must be saved or canceled
- Switching project, selecting another marker, closing window, or starting conflicting actions prompts the user

Editing marker:

- Dirty state is tracked
- Before switching marker/project or closing app, show app-owned dialog with `保存 / 放弃更改 / 取消`

## Lists And Filtering

V1 supports:

- Filter by category
- Filter by tag
- Filter only uncategorized markers
- Sort by recently updated
- Sort by recently created
- Sort by name A-Z

V1 does not support custom drag sorting, advanced saved views, multi-field sorting, pagination, multi-select, or batch operations.

Marker list uses virtual scrolling, not pagination.

Performance target:

- Single project with up to 1,000 markers should remain usable
- Marker clustering is deferred

## First Launch And Settings

First launch:

- Default city is prefilled as `上海`
- User may enter Baidu AK or skip
- App must not block entry when AK is missing
- App creates default project `我的项目`

Default city:

- V1 uses an internal list of 30-50 major Chinese cities
- City selection is city-level only, not district/county-level
- City records include fixed center coordinates
- Do not depend on Baidu geocoding to resolve the default city

Settings page includes only:

- Baidu Maps AK: view/change/clear
- Default city
- Backup: recent backup time and open backup directory
- About: app version, data directory, log directory

Settings page also explains Baidu AK allowlist/origin configuration after runtime origin is verified.

## Storage

Use the OS app data directory. Do not support custom data location in V1.

User-visible app data naming:

- Directory name: `MapX`
- Database file: `mapx.sqlite`
- Backups: `backups/mapx-YYYYMMDD.sqlite`
- Logs: `logs/`

SQLite is not encrypted in V1.

Core tables only:

- `projects`
- `project_settings`
- `markers`
- `categories`
- `tags`
- `marker_tags`
- `app_settings`
- `backup_metadata`

Do not create V1 tables for routes, route endpoints, audit events, imports, exports, attachments, users, or sync state.

Primary keys:

- Use UUID strings: `id TEXT PRIMARY KEY`

Time fields:

- Store ISO 8601 UTC strings
- Example: `2026-06-14T09:30:00Z`
- Standard fields: `created_at`, `updated_at`, `deleted_at`

## Migrations

Use explicit migrations from V1. Do not create or alter tables ad hoc at runtime.

Startup flow:

- Open app data directory
- Open SQLite database
- Run pending migrations
- Enter main UI only after migration success

Migration failure:

- Block main UI
- Show clear error page
- Provide `打开日志目录`
- Provide `打开数据目录`
- Provide exit action

V1 does not implement automatic migration rollback or repair.

Before migration, the app should create a backup when possible.

## Backup

V1 includes lightweight automatic backup.

Policy:

- At most once per day on startup
- Keep 7 daily backups
- Store under app data `backups/`

V1 does not include full restore UI. Settings provides `打开备份目录`.

## Tauri Commands

Commands are business-action oriented. Do not expose generic SQL/CRUD commands to the frontend.

Example commands:

- `create_project`
- `rename_project`
- `soft_delete_project`
- `list_projects`
- `create_marker`
- `update_marker_details`
- `move_marker`
- `soft_delete_marker`
- `list_markers_for_project`
- `create_category`
- `soft_delete_category_and_uncategorize_markers`
- `create_tag`
- `soft_delete_tag_and_unlink_markers`

## Validation

Validate on both frontend and backend. Backend is authoritative.

Frontend validation handles user experience:

- Required fields
- Name length
- Color format
- Tag count
- Note length

Backend validation protects integrity:

- Project exists and is not deleted
- Marker name is not empty
- Coordinates are valid
- Category/tag belong to the same project
- Soft-deleted objects cannot be edited through normal commands

## Errors And Logging

Backend returns structured errors. Frontend maps them to user-friendly Chinese text.

Example error shape:

```ts
type AppError = {
  code: string
  message: string
}
```

Example codes:

- `VALIDATION_ERROR`
- `PROJECT_NOT_FOUND`
- `MARKER_NOT_FOUND`
- `DB_ERROR`
- `BAIDU_AK_MISSING`
- `BAIDU_MAP_LOAD_FAILED`

Do not show raw Rust/sqlx errors directly to users.

Logging is local only in V1.

Log:

- App startup/shutdown
- DB migration success/failure
- Backup success/failure
- Baidu map load success/failure
- Command error code
- Uncaught frontend errors

Do not log:

- Baidu AK
- Search keywords
- Full marker notes
- Full addresses

V1 does not include automatic telemetry, analytics, crash upload, or remote error reporting.

Settings/about provides `打开日志目录`.

## Keyboard Shortcuts

V1 supports a small fixed shortcut set:

- `Cmd/Ctrl + N`: new marker
- `Cmd/Ctrl + F`: focus search
- `Cmd/Ctrl + S`: save current edit
- `Esc`: cancel edit or close transient UI
- `Delete/Backspace`: delete selected marker after confirmation

Shortcuts are not user-configurable in V1.

## Desktop Menu

V1 has a minimal menu bar.

File:

- New project
- New marker
- Settings
- Quit

Edit:

- Save
- Cancel edit
- Delete selected marker

View:

- Normal map
- Satellite map
- Locate me
- Zoom in
- Zoom out

Help:

- About

## Testing Strategy

V1 uses three light testing layers.

Rust data rule tests:

- Soft delete project
- Delete category uncategorizes markers
- Delete tag unlinks markers
- Invalid coordinates are rejected
- Migrations run on an empty database

Frontend pure logic tests:

- Store/repository state transitions
- Search result grouping
- Dirty state guard
- Marker form validation

End-to-end/smoke tests:

- App starts
- Missing AK shows settings entry
- Project can be created
- Marker creation form can open

Baidu online behavior should be covered through smoke/manual verification and mock provider tests where practical.

## CI

V1 CI should at least verify builds on macOS and Windows.

Expected checks:

- Typecheck
- Lint
- Frontend tests
- Rust tests
- Tauri build smoke
- macOS build verification
- Windows build verification

The independent `V1 Auto Update` milestone covers signed updater artifacts, startup/manual update checks, and packaged-app update validation. macOS notarization and Windows code signing remain deferred; unsigned manual installers stay available as a fallback.

## Acceptance Criteria

V1 is ready when:

- App runs as a Tauri desktop app named `MapX`
- macOS and Windows builds are verified in CI
- Missing/invalid Baidu AK states are handled without crashing
- Users can create/switch/rename/soft-delete projects
- New projects get project settings and no preset business categories
- Users can create, edit, drag-move, and soft-delete markers
- Marker data persists in SQLite through Rust commands
- Categories and tags work with the specified deletion rules
- Local search and Baidu POI search are separated and grouped
- Normal/satellite map switching works
- SQLite migrations run on startup
- Daily backup policy runs and keeps 7 backups
- Logs exist locally and avoid AK/user-content leakage
- Core tests cover the listed data and UI rules
