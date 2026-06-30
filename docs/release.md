# MapX Release

MapX uses GitHub Actions to build stable GitHub Releases from Git tags. The release track has two parts:

- Signed updater artifacts for in-app automatic updates.
- Unsigned manual-install artifacts as a fallback download path.

## Release Trigger

Create and push a tag that matches `vX.Y.Z`, for example:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The release workflow also supports manual re-runs through `workflow_dispatch` with the same tag name.

## Version Gate

Before any bundle is built, the release workflow verifies that all versions match the tag without the `v` prefix:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

For example, tag `v0.1.0` requires all three files to declare `0.1.0`.

## Release Artifacts And Updater Manifest

Each `vX.Y.Z` tag publishes a stable release. Draft and prerelease releases are not consumed by the app updater.

The release workflow uploads manual-install artifacts:

- macOS: `.dmg`
- Windows: `.msi`

It also uploads updater artifacts and signatures:

- macOS: `.app.tar.gz` plus `.app.tar.gz.sig`
- Windows: Tauri-generated updater archive plus matching `.sig`
- `latest.json`: static updater manifest consumed by MapX from GitHub Releases

The updater public key is stored in `src-tauri/tauri.conf.json`. The updater private key must be configured only as a GitHub Actions secret named `TAURI_SIGNING_PRIVATE_KEY`. If a password-protected key is adopted later, add `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as a second secret. Do not commit private key material or write it into release logs.

## Pre-Release Smoke Checklist

- Run the release version gate with the target tag, for example `node tools/verify-release-version.mjs v0.1.2`.
- Run the frontend release gate: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
- Run the Rust release gate from `src-tauri`: `cargo test`.
- Review [workspace-visual-smoke.md](workspace-visual-smoke.md) for the main workspace states touched by the release.
- Confirm the generated GitHub Release body still includes the signed-updater and unsigned/manual-install fallback warning.
- Confirm `latest.json` exists and contains macOS and Windows platform entries with signatures.
- After artifacts are available, download the macOS `.dmg` and Windows `.msi` from GitHub and verify the installer opens far enough to identify itself as MapX.
- Before closing auto-update work, run the packaged-app checklist in [auto-update-qa.md](auto-update-qa.md) and record the results on `QA-009`.
- On macOS unsigned builds, verify the quarantine workaround below opens the installed app.

## Automatic Update Fallback

MapX checks `https://github.com/QinshanSun/mapx/releases/latest/download/latest.json` for signed updates. GitHub connectivity can be unreliable for some users. Startup check failures are silent and do not block the main workspace. Manual check, download, install, or signature failures are shown in the app with an option to open the GitHub Releases download page.

## macOS Unsigned Install

The first release track is not signed or notarized with an Apple Developer ID. On macOS, Gatekeeper may show `"MapX" is damaged and can't be opened` after downloading the `.dmg` from GitHub.

For manual test installs, drag `MapX.app` into Applications, then run:

```sh
xattr -dr com.apple.quarantine /Applications/MapX.app
open /Applications/MapX.app
```

If the app is installed somewhere else, replace `/Applications/MapX.app` with the actual `.app` path.

Before broader distribution, MapX should move from unsigned builds to Developer ID signing and notarization.

## Local Version Check

Run the same version check locally before tagging:

```sh
node tools/verify-release-version.mjs v0.1.0
```

## Local macOS Bundle Check

On macOS, `npm run tauri:build` builds an unsigned `MapX.app` and then creates an APFS `.dmg` with `hdiutil`. The APFS step avoids local HFS+ image creation failures seen on newer macOS versions while keeping the release artifact as a manual-install DMG.

```sh
npm run tauri:build
ls src-tauri/target/release/bundle/dmg/*.dmg
```
