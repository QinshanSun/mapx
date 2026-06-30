# MapX Auto Update QA

Use this checklist before closing `QA-009`. Dev-server checks and mock updater tests are useful, but they do not replace packaged Tauri app validation.

## Preconditions

- GitHub Actions can start release runners for this repository.
- `TAURI_SIGNING_PRIVATE_KEY` is configured in GitHub Actions secrets.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is configured only if the private key is password-protected.
- A stable `vX.Y.Z` release exists with these assets:
  - macOS manual installer: `.dmg`
  - macOS updater bundle: `.app.tar.gz`
  - macOS updater signature: `.app.tar.gz.sig`
  - Windows manual installer: `.msi`
  - Windows updater bundle: `.msi.zip` or the Tauri-generated Windows updater archive
  - Windows updater signature: matching `.sig`
  - updater manifest: `latest.json`
- The old installed app version is lower than the stable release version.
- Draft and prerelease releases, if present, are not the latest stable release consumed by the app.

## Release Asset Checks

1. Open the GitHub Release for the target tag.
2. Confirm the release is stable, not draft and not prerelease.
3. Download `latest.json`.
4. Confirm `latest.json` contains:
   - `version` matching the release version without the leading `v`
   - `platforms.darwin-*` entry with `url` and inline `signature`
   - `platforms.windows-*` entry with `url` and inline `signature`
5. Confirm every URL in `latest.json` resolves to an uploaded release asset.
6. Confirm the release notes include the signed-updater path and the unsigned/manual-install fallback warning.

## macOS Packaged App Flow

1. Install the previous MapX `.dmg` build.
2. If Gatekeeper blocks the unsigned app, apply the documented quarantine workaround.
3. Launch MapX and open Settings.
4. Confirm the current version shown in Settings is the old version.
5. Confirm `启动时自动检查更新` is enabled by default unless this test case intentionally disables it.
6. Click `检查更新`.
7. Confirm MapX shows the new stable version, release notes, `立即更新`, and `稍后`.
8. Click `立即更新`.
9. Confirm download progress is shown and duplicate update actions are disabled while downloading.
10. Confirm download completion shows `重启安装` and does not restart automatically.
11. If a point form has unsaved changes, click `重启安装` and confirm the existing `保存 / 放弃 / 取消` guard appears.
12. Complete restart installation.
13. Relaunch MapX and confirm the Settings version is the new version.
14. Click `检查更新` again and confirm MapX reports the current version is latest.

## Windows Packaged App Flow

1. Install the previous MapX `.msi` build.
2. Launch MapX and open Settings.
3. Confirm the current version shown in Settings is the old version.
4. Confirm `启动时自动检查更新` is enabled by default unless this test case intentionally disables it.
5. Click `检查更新`.
6. Confirm MapX shows the new stable version, release notes, `立即更新`, and `稍后`.
7. Click `立即更新`.
8. Confirm download progress is shown and duplicate update actions are disabled while downloading.
9. Confirm download completion shows `重启安装` and does not restart automatically.
10. Complete restart installation. Windows may exit the app as part of installer execution.
11. Relaunch MapX and confirm the Settings version is the new version.
12. Click `检查更新` again and confirm MapX reports the current version is latest.

## Negative Checks

- Startup check failure must not block the main workspace.
- Manual check failure must show a user-friendly error and a download-page fallback.
- Closing the update dialog with `稍后` must not install or restart the app.
- A draft release must not be offered as an update.
- A prerelease must not be offered as an update in V1.
- A signature failure must stop installation and show a blocking error.

## Record Template

Copy this template into the issue comment when validating a release:

```md
## Auto Update QA Record

- Issue: QA-009
- PR / commit:
- Old version:
- New version:
- Stable release URL:
- GitHub Actions release run URL:
- latest.json URL:

### macOS

- Hardware / architecture:
- OS version:
- Old installer:
- New updater asset:
- Result:
- Evidence:
- Remaining risk:

### Windows

- Hardware / architecture:
- OS version:
- Old installer:
- New updater asset:
- Result:
- Evidence:
- Remaining risk:

### Negative Checks

- Startup failure does not block workspace:
- Manual failure shows fallback:
- Draft/prerelease ignored:
- Signature failure blocks install:

### Notes

- Steps not automated:
- Reason they remain manual:
```
