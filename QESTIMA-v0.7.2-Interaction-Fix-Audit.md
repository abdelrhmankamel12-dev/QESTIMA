# QESTIMA v0.7.2 — Interaction Fix Audit

This patch addresses the report that clicking tabs and navigation controls made the installed app appear read-only.

| Area | Change | Verification |
|---|---|---|
| Ribbon tabs | Added capture-phase click handling plus direct listeners for the permanent ribbon buttons. | Switching File/Home/Drawings/Dimensions/Revisions/Workbooks/Subcontractors/Admin updates the visible command panel. |
| Side navigation | Added the same direct fallback for the permanent project navigation buttons. | `data-view` navigation continues to open the requested workbench. |
| SVG/icon clicks | Replaced direct `event.target.closest()` calls with a compatibility-safe parent walk. | Clicks on nested SVG and `<use>` elements resolve to their owning button. |
| Duplicate activation | Added a `WeakSet` of handled click events. | Capture and fallback listeners cannot execute one click twice. |
| Update cache | Launcher app URL now carries the release version and starts Edge/Chrome with `--disable-http-cache`. | In-place installations load v0.7.2 assets instead of stale browser-cache files. |
| Data and permissions | No change to Schema v6, pricing snapshots, roles, approval locks or migration keys. | Existing tests remain green; deliberate locked/approval controls are still enforced. |

## Scope note

Full intelligent PDF reading and visual PDF/DWG measurement remain deferred. Manual Length/Area/Count measurement capture remains available.

## Verification

- `node --check app/app.js`
- `node --check app/core.js`
- `node --test tests/*.test.cjs` — 21 passing tests
