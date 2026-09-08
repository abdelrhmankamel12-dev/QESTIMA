# QESTIMA v0.12.0 Source Checkpoint — Tender Operating System

QESTIMA is a Windows-first Tender Operating System for MEP tender intake, BOQ pricing, supplier quotations, quality control and submission decisions. The current source checkpoint (`v0.12.0`) adds a configuration-driven Ribbon command system on top of the central collaboration/licensing API foundation, tenant-safe sync contracts, IFC model mapping and the PDF intelligence/takeoff workbench while preserving Schema v6 pricing data.

This checkpoint includes a **Windows x64 preview installer** built from the current source. It is explicitly marked **Preview-Unsigned** because no company Code Signing certificate is available in this build environment. It is suitable for controlled testing on Windows 10/11 x64; do not treat it as the final trusted commercial distribution until the signing and Windows validation gates below are completed.

## Preview release 0.12.0

- Installer: `QESTIMA-Setup-0.12.0-win32-x64-Preview-Unsigned.exe`.
- Electron runtime: official Electron `37.2.6` for Windows x64, embedded in the installer.
- The installer is built with NSIS and includes the current app, SQLite/Project Package storage, encrypted local state, Ribbon/Cost Estimation workbench, PDF/DXF/IFC adapters and central-sync client.
- The sidecar `.sha256` and `.release.json` files record the exact binary digest and the unsigned preview status.
- A signed commercial build must be produced after running `build/sign-release.ps1` with the company's certificate and completing the Windows matrix.

## New in v0.11.0 — Collaboration, central licensing and IFC

- `server/api.cjs` and `server/central-store.cjs` provide a dependency-free Node reference API with central SQLite, tenant isolation, project version checks, soft locks, sync conflict responses, device/user seat tracking, owner overview, license actions and signed license-token support, support access, object storage and central audit routes.
- Central login uses server-side scrypt password hashes and signed HMAC access tokens. There are no default central accounts or secrets; provisioning is explicitly disabled until an operator supplies a bootstrap secret.
- The desktop preload exposes only bounded IFC extraction and central requests; the HMAC secret and update private key never ship to the client.
- `app/ifc.js` imports STEP IFC and the neutral JSON emitted by the Revit bridge, maps elements to BOQ items/rate assemblies and compares model revisions. Mappings remain pending until approved; only an explicit Apply action changes a BOQ takeoff quantity.
- The new IFC & Model Mapping workbench and Owner Portal surface element metadata, model revisions, devices/seats, license state, conflicts and audit activity.
- `revit-addin/QestimaRevitBridge.cs` is a source-only Revit command. It exports Category, Family, Type, System, Level/Zone, size/material, quantities, stable element ids and model version without changing BOQ data.

## Priority 7 — Ten-tab professional Ribbon

- The top Ribbon is limited to ten fixed modules: File, Home, Drawings, Dimensions, Revisions, Cost Estimation, Suppliers, Intelligence, Reports and Administration.
- Every top tab switches a dedicated command strip beneath it; the strip contains grouped actions that open the existing workspaces instead of dashboard-only shortcuts.
- IFC/Model Mapping is grouped under Drawings, while supplier RFQs, commercial markup and scenarios are grouped under Suppliers/Intelligence so the top level stays compact.
- Reports has its own command strip for Report Center, formatted Excel, Tender Submission Pack, Quality Gate, Revision Impact and Risks/Gaps.
- Existing sidebar navigation and workbook tabs remain available, and opening a workspace automatically selects the relevant Ribbon module.

## Priority 8–9 — Command groups and contextual workbench

- Drawings now exposes CostX/RIB-inspired groups for Import, Drawing, View, Layers, Scale, Revisions and Model Review. PDF import, page navigation, calibration, overlay and IFC mapping use the existing workspaces; DXF/DWG, pan/rotate and PDF layers remain visibly disabled with a reason until their licensed engines are integrated.
- Cost Estimation now owns the estimating workbench: BOQ, Rate Build-Up, Resources, Productivity, Indirect Cost, Pricing, Selling Price, Scenarios, Review, History and Outputs. Its commands open the existing BOQ sheet, Rate Inspector, resource library, markup/scenario and report workspaces.
- The shell keeps a three-zone workbench: project/navigation tree on the left, BOQ/drawing/rate-analysis workspace in the center, and an inspector or cost ladder on the right where the active workspace provides one. Status totals remain in the bottom bar.
- Workspace tabs are real tablist/tab panels with keyboard navigation. They remain open when commands switch screens, preserve the active project/item/drawing and restore the last view after restart.
- Contextual tabs appear only when relevant: Drawing Tools, Dimension Tools, BOQ Item Tools and Quotation Tools. Their commands are permission/license aware and do not auto-approve quantities, rates or offers.
- Double-clicking a main Ribbon tab collapses or restores the command strip so the drawing/BOQ canvas can use the full height. A collapsed Ribbon state is saved with the project UI state.

## New source checkpoint — PDF intelligence and takeoff

- Windows desktop extraction uses `pdftotext` for text PDFs and `pdftoppm` + Tesseract (`ara+eng`, with English fallback) for scanned PDFs. The app reports when those optional runtimes are not installed.
- Tender documents are classified and findings for deadline, validity, warranty, payment, retention, LD, execution period, manufacturers, scope and risks are shown with page, source text and confidence.
- Review Queue decisions are explicit: Approve → Apply to Tender Review. Reading and approval never mutate BOQ quantities, rates or prices.
- Ask PDFs searches indexed content inside the active project only; revision comparison includes superseded source files.
- Drawings & Takeoff now renders PDF pages with page navigation, per-page calibration, Length/Polyline/Area/Perimeter/Count, snap, colored overlays, BOQ linking and revision carry-forward. Measurements remain pending until Quantity Review approval.

## New in v0.8.0 — Estimating Intelligence

- Smart BOQ preview now compares an incoming workbook against the current BOQ and reports added, deleted, changed and RFQ-affected items before import.
- Reusable Dynamic Rate Assemblies now cover CHW, PPR, Fire Fighting pipe, Ductwork, Insulation, Valves, Pumps, AHU/FCU and Sanitary Fixtures. Every component remains editable and engineer-controlled.
- Historical matching stays advisory and displays prior rate context; no match is copied without an explicit review action.
- Pricing Quality Checker adds missing-source, supplier-unit mismatch, stale/expired quote, RFQ follow-up, Scope Gap, historical outlier and minimum-margin checks.
- Tender Review Gate makes the final checklist visible: intake review, scope, pricing, selected quotes, risks, markup approval and saved revision.
- Supplier leveling distinguishes Lowest Raw, Lowest Compliant and Best Evaluated offers after commercial adjustments.
- What-If now supports currency factors and alternate supplier quotes without mutating the base tender.
- A new Intelligence ribbon tab exposes Smart Import, Historical Match, Rate Assemblies, Quality Checker, Revision Impact, Bid Leveling and What-If commands.
- BOQ is the primary work area with compact intelligence signals; Ctrl/Cmd+1…7 opens the main estimating workbenches.

## New in v0.7.4 — Login, license and professional workbench

- QESTIMA opens with a professional `USERNAME` / `PASSWORD` screen before the estimating workbench.
- The active preview period is shown on the sign-in screen and as a compact license indicator in the top bar after login.
- After login, the first screen is the Cost Estimation workbench with the BOQ sheet and Rate Inspector visible; Drawings/Dimensions, Projects and every other module remain one click away through the Ribbon and workspace tabs.
- **Activate / Reactivate** accepts local preview codes such as `QESTIMA-DEMO-30` or `QESTIMA-TRIAL-90`; production signed activation can be connected to a company licensing server later.
- The default local preview account is `admin` / `Qestima@2026`. The password is checked locally through a deterministic preview guard and is never stored as plain text.
- Logout, last username, login audit entries and license status are stored with the normal local project state; no project price or tender document is changed by activation.

## New in v0.7.2 — Interaction and update reliability

- Ribbon and side-navigation clicks are handled during capture and with direct fallback listeners, so SVG/icon clicks and older Chromium builds open the requested screen reliably.
- A compatibility-safe `closest` path supports clicks originating on nested SVG elements.
- The launcher adds a release query and disables browser cache so an in-place update loads the new JavaScript instead of a stale cached copy.
- The app remains editable; read-only behavior is limited to deliberate approval/locked-submission controls.

## New in v0.7.1 — Desktop UI refresh

- Professional top ribbon with File, Home, Drawings, Dimensions, Revisions, Cost Estimation, Suppliers, Intelligence, Reports and Administration tabs.
- Clicking a ribbon tab opens its command groups directly beneath it; the existing pricing actions remain available without leaving the current screen.
- Docked project navigation on the left, compact workbook tabs, a dense work area and a Windows-style status strip replace the dashboard-first feel.
- Drawings & Dimensions now opens a large drawing workspace with Drawings/Layers/Model/Views navigation, Dimension Groups, zoom/fit tools and manual Length/Area/Count measurement capture.
- Select Project / Building dialog provides a CostX-like recent/all project table and links cleanly into the drawing workspace.
- Existing BOQ, rate inspector, tender control, quality gate, supplier comparison and reports remain available from the ribbon and side navigation.

## New in v0.7

- Tender Control Center with days remaining, pricing progress, missing documents, pending quotations, open clarifications, approval queue, overdue assignments and a live Tender Readiness score.
- Smart BOQ Import Templates that remember client layouts and diagnose blank rows, duplicates, unit inconsistencies, text-formatted numbers, missing quantities and formula errors.
- Intelligent Item Matching against previous projects with similarity score, rate date, source and an explicit engineer-reviewed copy action.
- Dynamic Rate Assemblies for chilled-water pipe and ductwork, with editable resource mapping and consumption factors.
- Revision Impact Analyzer for additions, deletions, quantity/unit/description changes and estimated project cost movement.
- Commercial Bid Leveling with discount, freight, risk adjustment, VAT, quotation validity and separate lowest-price versus best-evaluated-offer results.
- Quote Expiry and Price Aging warnings.
- Pricing Quality Checker with blockers, severity, formal waivers and a submission gate.
- Independent What-If scenarios and Target Price Optimizer without changing the approved base estimate.
- Item assignment and approval workflow, comments and mentions, plus frozen submission snapshots.
- Built-in feedback package that exports version and technical diagnostics without project prices or tender documents.

## Core dependency chain

`Supplier price → Resource Library → Project rate snapshot → Unit-rate analysis → BOQ item → Section total → Tender price`

Central Library changes never rewrite an active tender silently. QESTIMA shows the current project snapshot beside the latest library rate and requires an explicit Update or Keep Current decision.

## Tender and estimating workspace

- Standard Tender Workflow and Quick Pricing Mode.
- Tender Documents register with Current and Superseded revisions.
- Source-backed Tender Summary, Scope Matrix, risks and clarifications.
- Excel-like BOQ sheet and docked Unit Rate Inspector.
- Materials, labor, equipment and subcontractor resource library.
- RFQ tracking, supplier comparison and per-item supplier selection.
- Conservative, Competitive, Target Profit and Management Final pricing scenarios.
- Priced BOQ, unpriced items, rate analysis and selling-summary exports.
- Light/dark mode, autosave, undo/redo, crash recovery and JSON backup.
- Windows desktop storage through encrypted SQLite and structured Project Packages; browser fallback keeps IndexedDB only for preview mode.

## Multi-user and licensing model

Schema v6 separates users, workspaces, tenant ids, project access, assignments, resources, rate snapshots, documents, revisions, quality waivers, comments, submission snapshots and audit entries. Personal workspaces remain local and encrypted; Company workspaces can connect to the central API without changing the project shape. The client holds only a short-lived access token and an encrypted sync snapshot; tenant authorization, seats, license actions and audit persistence belong to the server.

The local Owner Portal is a control surface for the first pilot users. Production deployment still requires TLS, an identity provider, managed secrets, database/object-storage backups, rate limiting, monitoring and a signed update service.

## New in v0.12.0 — Configuration-driven Ribbon and Cost Estimation

- The ten top-level tabs and their command groups are defined in one `ribbonConfig` model; the HTML contains accessible panel shells and the renderer builds the commands at runtime.
- Every command carries an id, English/Arabic label, icon, shortcut, permission, feature flag, enabled state/reason and optional data attributes. Availability is evaluated in the business layer, including role permissions, tenant features and license expiry.
- The File, Home, Drawings, Dimensions, Revisions, Cost Estimation, Suppliers, Intelligence, Reports and Administration split now follows the requested CostX/RIB-style workflow, while retaining QESTIMA colors and icons.
- Cost Estimation replaces the former visible Workbooks tab and is positioned after Revisions and before Suppliers. Legacy `workbooks` UI state is migrated to `cost_estimation` so saved projects reopen on the new module.
- The Cost Estimation commands are permission-aware: BOQ/rate build-up/productivity edits require pricing rights, resource edits require resource rights, and profit/markup/final-price commands require markup visibility.
- Command tooltips expose the shortcut and disabled reason. Ctrl+S/O/F/Z/Y and configured shortcuts work without reloading the workspace.
- Workspace scroll positions, active item/drawing, open workspaces, panel widths and hidden commands persist in `uiState`. Right-click a command to hide it and double-click a group label to set its width; Administration → Customize Ribbon restores the defaults.
- The document direction follows the selected language (`dir=rtl` for Arabic and `dir=ltr` for English), and switching commands preserves selection and scroll position.

## Interface concept alignment (source-only)

- The desktop workbench now follows the attached QESTIMA concept: dark Windows-style chrome, gold active accent, compact two-level Ribbon, workbook tabs, dense BOQ grid and a docked Rate Inspector.
- Cost Estimation is selected after sign-in so the primary task is immediately actionable instead of opening a dashboard-only surface. The Project Center remains available from Home/File and the left navigator.
- The concept is implemented as a code-native skin over the existing functional views; no CostX/RIB proprietary assets or branding are copied.

## Production hardening and preview release status

- Electron desktop storage now uses a normalized SQLite schema with an authenticated AES-256-GCM vault key (Electron `safeStorage` on Windows), atomic writes, WAL checkpoints and legacy-key migration.
- Project Packages contain an encrypted SQLite database, category-organized files, checksums bound to the signed manifest, revision-safe folders and referenced attachments. A passphrase option makes a package portable to another authorized device; an empty passphrase keeps it machine-bound.
- Company projects queue local edits while offline and the Central API worker pulls remote projects, merges non-conflicting changes, records conflicts and marks queue operations synced. A periodic background sync starts after Central login.
- DXF ASCII files are indexed for layers, entities, blocks, lengths, areas, counts, units and inferred MEP systems. Native DWG remains an explicit adapter: configure `QESTIMA_DWG_CONVERTER` or an approved CAD SDK; no unlicensed parser is bundled.
- `build/prepare-runtime.cjs` stages an official embedded Electron runtime, `build/create-release.cjs` reproducibly builds the Windows x64 Preview-Unsigned installer, `build/release-preflight.cjs` simulates installation/upgrade/rollback, and `build/sign-release.ps1` signs/verifies the runtime binaries and installer. The preview is intentionally unsigned; commercial distribution remains gated on the company's certificate and Windows validation matrix.
- Packaging tests cover SQLite round-trip/tamper detection (including encrypted normalized indexes), portable and machine-bound packages, signed checksum inventories, DXF/PDF adapters, runtime staging, simulated install/upgrade/rollback, manifest verification and atomic crash recovery.

## Intentionally deferred

- Bundled production Poppler/Tesseract runtime, progress/cancellation and large-file worker hardening.
- Pixel/geometry diffing between drawing revisions (current revision overlay and carry-forward are reviewable, not auto-approved).
- Native DWG geometry through a licensed CAD SDK or AutoCAD connector, plus pixel-perfect CAD rendering.
- Hosted production identity federation and server-side operational hardening (the Central API sync contract is implemented, but deployment still requires TLS, secrets, rate limiting, monitoring and managed backups).
- Automatic update distribution, staged rollout and rollback service (the API accepts a signed manifest; deployment/signing infrastructure remains external).
- Full bilingual translation of every UI label and report.

The UI refresh is structural and code-native; it is inspired by professional estimating workspaces and does not copy CostX branding or proprietary assets.

AI-assisted matching remains advisory: no quantity, resource rate or supplier is approved without an engineer action.

## Compatibility

- The current preview installer targets Windows 10/11 x64 with the embedded Electron `37.2.6` runtime.
- x86 and ARM64 builds remain separate targets and are not included in this preview installer.
- Microsoft Edge or Google Chrome application mode remains available as a browser fallback.
- Existing local data from v0.3 through v0.7.0 migrates to schema v6 without rewriting saved tender prices or licensing state.

## Test and build

```bash
npm test
npm run test:packaging
# On a Windows build host, after downloading the pinned official Electron zip:
npm run prepare:runtime -- --electron-dist C:\\path\\to\\electron-dist --electron-version 37.2.6
# Sign only after review (Windows SDK):
powershell -File build\\sign-release.ps1 -RuntimeDirectory build\\runtime-staging -CertificateThumbprint <thumbprint>
```

The NSIS script consumes `build/runtime-staging` and launches the embedded `QESTIMA.exe`. The reproducible preview command is `npm run release:build -- --electron-dist <electron-dist> --platform win32 --arch x64`; it writes the installer, SHA-256 sidecar and release manifest. Do not treat the unsigned preview as a trusted commercial distribution until the production blockers above and the remaining release checklist have been approved.
