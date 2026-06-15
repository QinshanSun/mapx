# MapX Release

MapX uses GitHub Actions to build unsigned manual-install releases from Git tags.

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

## Release Artifacts

The first release track is unsigned and intended for manual download/install:

- macOS: `.dmg`
- Windows: `.msi`

The GitHub Release is published as a pre-release and includes generated release notes plus a fixed unsigned-install warning.

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
