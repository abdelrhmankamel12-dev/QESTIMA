# QESTIMA — Priority Two Output Update

## Implemented in source (not released as a new installer)

The Report Center now uses a single permission-aware report model generated from the current project, selected scenario, resource snapshots, supplier quotations, tender review, revisions and audit trail.

### Report Center sections

- Management Summary and Tender Readiness score
- Priced BOQ
- Unpriced Items
- Detailed Rate Analysis
- Resource Breakdown
- Supplier Adjudication (lowest raw, lowest compliant and best evaluated)
- Tender Qualifications & Exclusions
- Scope Gaps
- Revision Impact
- Scenario Comparison
- Audit Trail
- Tender Submission Pack manifest

### Export and branding

- Formatted Excel workbook with title rows, company/project metadata, column widths, filters, frozen header rows, number formats and separate report sheets.
- Arabic/English report template selector with localized PDF/Excel sheet names and headers.
- Company branding fields: name, tagline, address, phone, email, VAT number and optional logo Data URL.
- Desktop PDF export uses Electron Chromium `printToPDF` with A4 CSS, page breaks, headers, footers and explicit page numbers. Browser-only fallback remains available through print preview.
- One-click Tender Submission Pack on Windows writes a complete folder containing the PDF report, formatted Excel workbook, manifest and current linked tender-document attachments. Browser fallback still exports PDF/Excel separately.

### Security and access

- The report builder checks business permissions before exposing cost or markup values.
- Estimator/procurement/technical roles can receive cost-only output where configured; markup and profit remain hidden unless `markup.view` or `reports.view` is granted.
- Restricted fields are redacted in the UI, Excel and PDF output rather than merely hidden buttons.

## Verification

```text
node --check app/core.js
node --check app/app.js
node --check electron/main.cjs
node --check electron/preload.cjs
node --test tests/*.test.cjs
29 tests passed, 0 failures
```

## Remaining work before a public Windows release

1. Install/pin the Electron runtime and build a new Windows package.
2. Sign the installer and executable with a production code-signing certificate.
3. Test the PDF engine, Excel export, upgrade path, package restore and large projects on the supported Windows matrix.
4. Confirm production license public key/endpoint and migrate-vs-factory-reset behavior.
5. Complete the full spreadsheet grid engine and package hash/compare checks.
6. Finish full Arabic/English language switching across every screen and report template.
7. Optional ZIP compression for the one-click submission pack; the current Windows pack is already a complete folder and Project Package remains the full source/restore archive.

No new installer or release artifact was issued at this checkpoint, in accordance with the project constraint to report remaining updates first.
