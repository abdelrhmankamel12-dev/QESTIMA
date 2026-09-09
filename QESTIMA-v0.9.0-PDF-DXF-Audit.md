# QESTIMA v0.9.0 — PDF / Measurement / DXF Foundation (superseded by Priority Three/Four source update)

## Implemented

- PDF document inspection records text vs scanned/image status and queues Arabic/English OCR as a reviewable task. The newer source checkpoint now runs desktop `pdftotext`/Tesseract extraction when available.
- Document intelligence metadata keeps category, page, revision, extracted text, headings, tables and summary fields without replacing the source file.
- Measurement sheets now support Length, Area, Count and Perimeter, scale, page, layer/color, system, floor, opening deductions and BOQ links.
- Net area is calculated after opening deductions. Measurements remain pending until an engineer approves them.
- DXF summary foundation recognizes layers, block names, polylines and text entities and labels all quantities advisory.
- Drawings workspace now exposes Perimeter and the newer PDF viewer adds page navigation, calibration, overlays and revision carry-forward; all quantities still require engineer approval.

## Safety / scope

Native DWG rendering, bundled production OCR engines, and pixel-level revision diffs remain replaceable integrations; no automatic quantity or price is committed. Original tender files and revisions remain immutable.

## Verification

`node --check app/core.js`, `node --check app/app.js`, and the full test suite pass. Windows installer and source archive are built as v0.9.0.
