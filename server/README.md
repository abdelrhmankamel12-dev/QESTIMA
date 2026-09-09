# QESTIMA Central API (Priority 5)

This folder contains a small, dependency-free reference API for the first 5–10 company users. It is intentionally separate from the local encrypted SQLite vault used by the Windows client.

Implemented contracts:

- tenant-isolated projects and central SQLite storage;
- device/seat registration and last-connection/app-version tracking;
- soft project locks, optimistic version checks and sync conflict responses;
- signed HMAC access tokens for the reference service (the signing secret stays on the server);
- optional Ed25519-signed license tokens carrying validity dates, seats, feature flags and offline grace (set `QESTIMA_LICENSE_PRIVATE_KEY` outside the client);
- license suspend/extend/revoke/activate actions;
- owner overview, user/device seat management, central audit log and time-limited support access;
- local object storage scoped to `objects/<tenant-id>`;
- signed-update manifest endpoint (the production update signer is external to this repository).

## Run locally

Use Node.js 22 or newer and provide a high-entropy secret. There are no default accounts, bootstrap secrets or production signing keys in the source tree.

```powershell
$env:QESTIMA_CENTRAL_SECRET = "generate-a-random-secret-at-least-32-characters"
$env:QESTIMA_CENTRAL_DB = "C:\ProgramData\QESTIMA\central\qestima-central.db"
$env:QESTIMA_OBJECT_ROOT = "C:\ProgramData\QESTIMA\central\objects"
# Optional: Ed25519 private key used only by the server to issue license tokens.
# $env:QESTIMA_LICENSE_PRIVATE_KEY = Get-Content .\license-private.pem -Raw
node server/api.cjs
```

Provision the first tenant and owner through an isolated administration process by passing `provisioningSecret` to `createCentralServer` (or by placing the API behind an authenticated provisioning gateway). The `/api/v1/provision` route is disabled unless that secret is explicitly configured.

The API is a reference foundation, not a hosted production service. Before a commercial rollout, place it behind TLS, a reverse proxy, managed secret/key storage, a real identity provider, rate limiting, malware scanning for objects, encrypted backups, monitoring, and a signed update distribution service.

## Important safety rules

- Every authenticated request is scoped to the tenant in the access token; cross-tenant project/object paths are rejected.
- A project update with an old `expectedVersion` returns `VERSION_CONFLICT`; it never overwrites newer server data.
- A project update made by another user while a valid project lock is held returns `PROJECT_LOCKED`; stale locks expire automatically.
- Project locks are soft and expire automatically. The client must still show and resolve conflicts.
- Audit rows are append-only from the application contract. Database/file permissions must enforce immutability in production.
- Suspended, revoked or fully expired licenses keep read access for review but reject project/object writes with `LICENSE_READ_ONLY` until an owner extends or activates them.
- License claims and update signatures are verified at the service boundary; never ship the HMAC secret, license private key or update private key in the Windows app.
