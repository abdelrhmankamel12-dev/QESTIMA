# QESTIMA v0.10.0 — Priority Three & Four Update

## Implemented in source and included in the x64 preview installer

### PDF Document Intelligence

- Desktop PDF extraction uses `pdftotext` for text PDFs and `pdftoppm` + Tesseract (`ara+eng`, with English fallback) for scanned PDFs.
- The Document Register shows analysis method and page count; the original file and every revision remain untouched.
- Classification and source-linked findings cover deadline, validity, warranty, payment terms, retention, liquidated damages, execution period, approved manufacturers, scope, and exclusions/risks.
- Every finding stores document, revision, page, source text, extraction method, confidence, reviewer and decision status.
- Review Queue supports Approve, Reject and an explicit Apply to Tender Review action. Parsing and approval alone never change BOQ, quantities or prices.
- Project-only document search and natural-language question lookup (for example, "What is the retention percentage?") return source/page answers from indexed PDFs only.
- Analyzed PDF revisions can be compared by extracted fields and changed pages, including superseded source files.
- The Document Intelligence panel now lists every current PDF with its classification, discipline, revision, extraction method and short summary before the Review Queue.
- `electron/pdf-engine.cjs` normalizes Poppler/Tesseract output, distinguishes text/OCR/unavailable scans, preserves page provenance and supports project-only page search.

### PDF Takeoff Workspace

- Multi-page PDF viewer with page navigation and per-page scale calibration.
- Page count is discovered from the PDF engine when the drawing is opened, even before Smart Read is run.
- Length, Polyline, Area, Perimeter and Count tools on a measurement overlay canvas.
- Endpoint/axis/intersection snapping with an on/off control.
- Color-coded pending/approved measurement groups, labels and saved geometry.
- Dimension Groups can be created from the workbench, assigned a system and color, and selected for each new measurement; the group color is reused in the overlay and review register.
- Optional BOQ link for each new measurement; source keeps drawing, page, revision, system, floor and measured-by metadata.
- BOQ quantity is not changed when a measurement is drawn. Quantity Review must approve it first; only then is the approved total applied.
- Revision overlay and measurement carry-forward create pending measurements on the new revision for engineer review.

### Verification

```text
node --check app/core.js
node --check app/app.js
node --check electron/main.cjs
node --check electron/preload.cjs
node --test tests/*.test.cjs
33 tests passed, 0 failures
```

## Remaining before a public release

1. Bundle and pin Poppler/Tesseract binaries (or a licensed equivalent) in the Windows package and test Arabic OCR on representative documents.
2. Add a production PDF renderer/worker for very large files, cancellation and progress reporting.
3. Add pixel/geometry diffing between drawing revisions; current overlay carries saved measurements and marks them for review.
4. DXF ASCII indexing is now available for layers, blocks, geometry, units and inferred MEP systems. Connect its index to the visual measurement/BOQ workflow, then add native DWG through a licensed CAD SDK or AutoCAD connector.
5. Run Windows install/upgrade/restore, offline, large-PDF, OCR, multi-user and crash-recovery matrix tests.
6. Complete production code-signing, license backend/public-key configuration, and the remaining Arabic/English language pass.

The current checkpoint includes the unsigned Windows x64 preview installer. Bundled Poppler/Tesseract, native DWG and the signed commercial Windows validation matrix remain release gates.
