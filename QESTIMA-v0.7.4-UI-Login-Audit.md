# QESTIMA v0.7.4 — Professional Workbench and Login Audit

This release combines the v0.7.3 login/license flow with the requested CostX/RIB-style opening workbench.

| Area | Change | Verification |
|---|---|---|
| Post-login landing | Successful sign-in now opens the Drawing/Dimensions workbench instead of the dashboard-style Projects Center. | `authenticateUser()` selects `drawings`, activates the Drawings ribbon and resets the open work tab. |
| Application chrome | The top application bar uses a dark professional workbench palette, while the ribbon tabs and command strip remain high-contrast and compact. | Desktop refresh CSS overrides topbar, search, command groups, icon buttons and user controls. |
| Work page | Drawing workspace keeps the left drawing/dimension docks, central dark stage, rulers, Fit/Zoom and Length/Area/Count tools. | Existing drawing smoke assertions remain green; visual PDF/DWG measurement stays clearly deferred. |
| Navigation | Projects, BOQ, Rate Analysis, RFQs, Markup, Reports and controls remain accessible from the fixed sidebar and ribbon groups. | Existing capture-phase and fallback click paths are preserved. |
| Login/license | v0.7.3 startup authentication, 30-day preview, expiry indicator and Activate/Reactivate remain unchanged. | Core auth/license test and all UI smoke tests pass. |

## Scope note

The workbench is a professional shell and manual measurement surface. It does not yet read PDF content intelligently or measure native PDF/DWG geometry; those remain planned phases.

## Verification

- `node --check app/app.js`
- `node --check app/core.js`
- `node --test tests/*.test.cjs` — 22 passing tests
- NSIS installer build for `QESTIMA-Universal-Setup-0.7.4.exe`
