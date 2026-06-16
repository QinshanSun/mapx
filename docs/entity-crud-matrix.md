# Entity CRUD Reachability Matrix

This matrix is a lightweight audit tool for MapX V1. Use it when splitting issues, reviewing an epic, or closing a user-facing workflow.

A CRUD action is complete only when users can reach it through the app, not merely when a backend command or SQLite table exists.

## Reachability Standard

Each applicable entity/action should have this full path:

`backend command/service -> frontend service -> UI entry -> confirm/dirty guard -> state refresh -> error handling -> tests or manual AC`

Use `N/A` when an action does not apply. Do not leave cells blank.

## V1 Core Entities

| Entity | Create | View/List | Edit | Delete | Notes |
| --- | --- | --- | --- | --- | --- |
| Project | Done: sidebar create form, backend command, workspace refresh. | Done: project switcher and current project header. | Done: sidebar rename flow. | Done: soft delete with confirmation and current-project fallback. | Project delete keeps SQLite records and writes `deleted_at`. |
| Marker | Done: add-marker mode, map click/center, Baidu POI save, backend command. | Done: marker list, map markers, right detail panel, local search. | Done: detail form for non-coordinate fields and map drag-to-move coordinates. | Done: soft delete UI, confirmation dialog, list/map/detail refresh, and shortcut path. | Marker delete must be soft delete with confirmation. |
| Measurement | Done: map measurement mode, click-to-add points, double-click finish, save dialog, backend command. | Done: project overview measurement block, map polylines, right detail panel. | Done: right detail form edits name/note only. | Done: soft delete UI, confirmation dialog, overview/map/detail refresh. | Geometry is immutable after creation; offline can view/edit/delete saved records but cannot create new measurements. |
| Category | Done: settings category creation. | Done: settings category list and marker detail category display. | Done: settings rename/color/icon edit. | Done: soft delete with confirmation and marker uncategorizing. | Category names are unique per project, ignoring soft-deleted records. |
| Tag | Done: settings tag creation. | Done: settings tag list and marker detail tag display. | Done: settings rename. | Done: soft delete with confirmation and marker tag unlinking. | Tag names are unique per project, ignoring soft-deleted records. |
| Settings | N/A: settings are initialized by bootstrap/defaults. | Done: first-launch and settings page. | Done: Baidu AK, default city, search city, map layer, and app info flows. | N/A: V1 does not delete settings. | Settings actions should tolerate missing Baidu AK unless the feature explicitly requires it. |
| Backup metadata | Done: created by backup policy. | Done: settings backup metadata/directory entry. | N/A: metadata is system-managed. | N/A: V1 does not expose backup deletion. | Full restore UI is deferred. |

## Audit Questions

Ask these for every core entity touched by an issue or epic:

- Can a user create it from a visible UI entry?
- Can a user find it again after creation?
- Can a user edit the fields V1 promises to edit?
- Can a user delete or remove it when V1 says deletion exists?
- If delete is supported, is it soft delete or hard delete, and is that visible in the confirmation copy?
- Does the operation refresh all affected UI surfaces: list, detail, map, overview, search, and settings where applicable?
- Does the operation handle dirty or pending states before changing context?
- Does failure show a user-friendly Chinese message?
- Is there a test or manual acceptance criterion that would fail if the user-visible path disappeared?

## Gap Handling Rule

When the matrix exposes a missing user-reachable path, create a GitHub issue before implementing the fix. The issue should name the entity, action, affected surfaces, confirmation rules, refresh rules, and validation evidence.
