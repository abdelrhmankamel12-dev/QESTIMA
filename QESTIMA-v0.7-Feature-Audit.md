# QESTIMA v0.7.0 — Feature Audit

This audit records what is implemented in the v0.7.0 Preview, what exists as a safe foundation, and what remains deferred.

| # | Capability | v0.7 status | Implementation note |
|---:|---|---|---|
| 1 | Tender Control Center | Complete | Live readiness, deadlines, pricing, documents, quotations, clarifications, approvals and overdue work. |
| 2 | Smart BOQ Import Templates | Complete | Client templates, automatic mapping and cleaning diagnostics. |
| 3 | Intelligent Item Matching | Complete | Similarity-ranked historical matches with source and explicit copy review. |
| 4 | Dynamic Rate Assemblies | Complete | Reusable pipe and duct assemblies with editable resources and factors. |
| 5 | Revision Impact Analyzer | Complete | Added, deleted and changed items with estimated cost impact. |
| 6 | Commercial Bid Leveling | Complete | Raw and evaluated totals, commercial adjustments, compliance and validity. |
| 7 | Quote Expiry & Price Aging | Complete | Expiry and aging warnings with project and source context. |
| 8 | Pricing Quality Checker | Complete | Severity-based findings, waivers and final submission gate. |
| 9 | What-If & Sensitivity Analysis | Complete | Independent material, labor, equipment, contingency, discount and margin changes. |
| 10 | Target Price Optimizer | Complete | Gap, required reduction and highest-impact items; no automatic price rewrite. |
| 11 | Assignment & Approval Workflow | Complete | Item states from Not Started through Approved and Locked with role checks. |
| 12 | Comments and Mentions | Complete | Item-linked discussion, mentions, owner and due date. |
| 13 | Freeze Tender Snapshot | Complete | Immutable final snapshot after quality gate and scenario lock. |
| 14 | Project Benchmarking | Foundation | Cost data is structured for benchmarks; dedicated benchmark dashboard is deferred. |
| 15 | Win/Loss Analysis | Foundation | Outcome and reason fields exist; portfolio analysis dashboard is deferred. |
| 16 | Vendor Knowledge Base | Foundation | Supplier, quotation, resource and history links exist; full performance scoring is deferred. |
| 17 | Offline Work & Synchronization | Partial | Local cache and workspace separation exist; multi-device conflict sync needs the company server. |
| 18 | Auto Save & Crash Recovery | Complete | Local autosave, backward-key recovery, undo/redo and backups. |
| 19 | Automatic Updates | Deferred | Requires signed release hosting, staged rollout and rollback service. |
| 20 | Built-in Feedback | Complete | Downloads a sanitized diagnostic report with version, screen, steps and environment; prices and documents are excluded. |
| 21 | Arabic & English Interface | Partial | Mixed Arabic/English operational UI and locale-aware values; full language switch remains. |
| 22 | Company Data Isolation | Foundation | Workspace/tenant-aware model exists; production enforcement requires authenticated server policies. |

## Release boundary

Full PDF intelligence and visual PDF/DWG measurement are deliberately outside this release. The v0.7 Preview focuses on tender control, estimating intelligence, commercial decisions and pre-submission quality.

## Verification

The automated suite covers data migration, calculation engines, matching, leveling, expiry, revisions, quality gates, Tender Control, What-If, target optimization, frozen snapshots, licensing and UI smoke checks.

## v0.7.1 UI refresh note

QESTIMA v0.7.1 keeps this audit's data model, pricing engines, migration compatibility and licensing unchanged. It adds a desktop workbench layer: clickable top ribbon tabs with context command groups, a left project/drawing dock, workbook-style tabs, a CostX/RIB-inspired drawing canvas, Dimension Groups, and a Project / Building selection dialog. Full PDF/DWG rendering and visual measurement remain deferred as stated above.
