# Issue Quality Gate

This checklist keeps MapX issues tied to observable user outcomes. Use it before creating an issue, before implementation, and before closing an issue or epic.

## Before Creating An Issue

- Identify the user-facing workflow or platform risk.
- Identify every touched entity: Project, Marker, Category, Tag, Settings, Backup metadata, or `N/A`.
- Check [entity-crud-matrix.md](entity-crud-matrix.md) for the touched entity/action.
- If a missing user-reachable path is found, create a GitHub issue before implementing it.
- Write acceptance criteria as observable results, not internal implementation statements.
- Include direct dependencies only; do not list transitive dependencies.

## Required Issue Sections

Every executable issue should include:

- Background: why this work exists.
- Scope: what will change.
- Acceptance Criteria: observable results the user or reviewer can verify.
- Validation: automated tests, manual checks, or build commands.
- Direct Dependencies: only the issues directly needed before this one.
- Out of Scope when there is a tempting adjacent feature.

## Entity Reachability Check

For each touched entity/action, verify the full path:

- Backend command/service exists, or the issue explicitly creates it.
- Frontend service/repository wrapper exists, or the issue explicitly creates it.
- UI entry exists and is discoverable.
- Confirmation rules are defined for destructive actions.
- Dirty state and pending state behavior is defined.
- Success refreshes affected surfaces: list, detail, map, overview, search, settings, or project switcher.
- Failure maps structured errors to user-friendly Chinese copy.
- Tests or manual AC cover the user-visible path.
- Non-applicable actions are marked `N/A`, not omitted.

## Before Implementation

- Confirm there is a GitHub issue for the work.
- Confirm the issue has labels, milestone, priority, and direct dependencies.
- Re-read immediate callers, services, shared types, and existing UI patterns before editing.
- Keep changes scoped to the issue.
- If implementation reveals a new independent gap, create or update a GitHub issue before expanding scope.

## Before Closing An Issue

- Acceptance criteria are fully satisfied.
- Validation commands or manual checks have passed.
- Code is committed and pushed to GitHub.
- The GitHub issue has a closing comment with commit SHA, validation evidence, and remaining risks.
- If only part of the AC is complete, comment progress but do not close the issue.

## Before Closing An Epic

- Re-scan [entity-crud-matrix.md](entity-crud-matrix.md) for every core entity owned or touched by the epic.
- Confirm each promised Create, View/List, Edit, and Delete action has a user-reachable path.
- Confirm deferred actions are explicitly listed as out of scope.
- Confirm no backend-only capability is counted as complete unless there is a UI path or the issue is intentionally backend-only.
