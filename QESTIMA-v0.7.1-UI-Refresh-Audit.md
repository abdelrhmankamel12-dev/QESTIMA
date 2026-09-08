# QESTIMA v0.7.1 — UI Refresh Audit

This release refreshes the desktop shell while preserving the QESTIMA v0.7 data schema, licensing behavior and migration path.

| Area | Status | Notes |
|---|---|---|
| Top Ribbon | Complete | File, Home, Drawings, Dimensions, Revisions, Workbooks, Subcontractors and Administration tabs. |
| Context command groups | Complete | Clicking a ribbon tab reveals its command groups below it. |
| Desktop navigation | Complete | Left project navigation, project switcher, workbook tabs and compact status bar. |
| Drawing workbench | Complete | Drawing list, Layers/Model/Views tabs, dark canvas preview, fit/zoom controls and Dimension Groups dock. |
| Manual measurements | Complete | Length, Area, Count and Dimension Group forms can be saved and linked to BOQ items. |
| Project / Building selector | Complete | Searchable CostX-like project table with direct drawing-workspace selection. |
| BOQ, pricing and reports | Preserved | Existing v0.7 workbenches remain reachable from the ribbon and side navigation. |
| PDF/DWG visual rendering | Deferred | The canvas is a professional preview surface; full PDF/DWG reading and on-canvas measurement are future work. |

## Compatibility and verification

- Schema remains v6; data from v0.2–v0.7.0 is migrated without rewriting saved rates.
- The Windows installer remains the universal browser-based launcher (Edge/Chrome) and does not require a separate runtime installation.
- `node --check app/app.js`, `node --check app/core.js`, and the automated suite pass before packaging.
