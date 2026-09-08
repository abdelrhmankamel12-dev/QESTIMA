# QESTIMA v0.7.3 — Login and License Audit

This release adds the requested startup sign-in and license-period experience without changing the tender-pricing workflow.

| Area | Change | Verification |
|---|---|---|
| Startup gate | Added a dedicated QESTIMA login surface requesting `USERNAME` and `PASSWORD`; the workbench stays hidden until authentication succeeds. | Local preview boot sets the session unauthenticated and renders the login surface before the shell. |
| Preview account | Added a seeded `admin` account with password `Qestima@2026`; only a deterministic credential digest is stored. | Correct credentials open the shell; incorrect credentials keep the login screen and show an error. |
| License period | Added a 30-day local preview license with expiry, status, organization and last-validation metadata. | The remaining days and expiry date render on the login card and top-bar indicator. |
| Reactivation | Added `Activate / Reactivate` from both login and the authenticated top bar. Local preview codes accept `QESTIMA-DEMO-N` or `QESTIMA-TRIAL-N` (1–3650 days). | A valid code updates the license only after form validation; an invalid code leaves the existing license unchanged. |
| Audit and persistence | Added login audit entries, last username and license state to Schema v6; existing project, BOQ, resource, quote and revision data remains intact. | `ensureState()` migrates older saved data and fills missing auth/license fields without overwriting an existing license. |
| Session controls | Added Logout and startup session reset so every launch requests credentials again. | Logout hides the shell, returns to login and saves `authenticated: false`. |
| UI | Added responsive light login card, dark license panel, status colors and a compact top-bar license pill. | Desktop and narrow-window CSS paths are present; the existing CostX/RIB-inspired ribbon remains unchanged. |

## Scope and security note

The current activation flow is intentionally a local preview mechanism for the free Windows build. It is not a replacement for signed server-side licensing, password hashing policy, SSO, device limits or company tenant isolation. Those are the next steps for a Company Workspace licensing service. No raw password is written to the project JSON.

Full intelligent PDF reading and visual PDF/DWG measurement remain deferred as previously agreed.

## Verification

- `node --check app/app.js`
- `node --check app/core.js`
- `node --test tests/*.test.cjs`
- NSIS installer build for `QESTIMA-Universal-Setup-0.7.3.exe`
