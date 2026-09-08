# QESTIMA — Priority Zero Status (Windows x64 preview)

## Implemented in source

- Electron desktop entrypoint and preload bridge are present; browser launcher remains only as a compatibility fallback.
- SQLite `qestima.db` storage is used by Electron when the bundled runtime supports `node:sqlite`; state is encrypted with AES-256-GCM before storage. Legacy JSON is read only for migration.
- Project Package export/import creates an encrypted SQLite database, `manifest.json`, `checksums.json`, revision-safe folders and referenced attachments. A passphrase option supports portable restore.
- Renderer no longer writes LocalStorage when running through the desktop bridge.
- Business write guard blocks unauthorised users, expired licenses and locked submissions.
- License token verification bridge supports signed claims, expiry and Offline Grace Period; claims can carry device/user limits and feature flags.
- Commercial first-run mode has no default account; it asks the owner to create the first administrator.
- A Windows `signtool` signing/verification script signs the embedded runtime binaries, native modules, DLLs and installer.
- `build/prepare-runtime.cjs` stages an official Electron runtime as `QESTIMA.exe`; NSIS is intentionally blocked until that staging directory exists.
- Atomic recovery writes and runtime manifest hash verification are covered by packaging tests.

## Preview installer built

- `QESTIMA-Setup-0.12.0-win32-x64-Preview-Unsigned.exe` was built from the current source using the official Electron `37.2.6` Windows x64 runtime and the NSIS script.
- The installer is accompanied by `.sha256` and `.release.json` metadata.
- The build is intentionally labelled **Preview-Unsigned**. It is for controlled testing only and is not a signed commercial distribution.

## Required before a public commercial release

1. Obtain the company EV/OV Code Signing certificate and run `build/sign-release.ps1` on Windows for the runtime and installer.
3. Add the production public key and license service endpoint; never ship a private signing key.
4. Run the Windows matrix: clean install, upgrade, restore, crash/power interruption, large attachments, expired token and multi-user conflict tests. Source-level recovery/manifest tests are now present.
5. Decide whether existing personal data should be migrated or explicitly factory-reset. The updater must not silently delete it.

The unsigned preview is not a final commercial release. The next release after signing should retain the same source/package schema and publish the signed installer together with its checksum and release manifest.
