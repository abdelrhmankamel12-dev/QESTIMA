# QESTIMA — Priority One Status (pre-release)

## Implemented

- Create Project now offers Blank, Import Tender Package, and Copy Previous Project.
- Existing Folder/ZIP/Files tender intake is used as the package import path.
- Copy Previous Project preserves pricing and analysis as an independent working copy, resets tender review/revisions, and assigns a new code.
- BOQ import retains Excel file, row/cell and user metadata for quantity/description sources.
- Manual BOQ edits and pasted/fill-down values record a user/date/source type.
- BOQ grid includes bulk edit for filtered rows, multi-cell TSV paste and Ctrl/Cmd+D Fill Down.
- Quantity Review is a separate gate. Measurements show drawing/page/revision/system/floor and cannot become pricing quantity until an engineer approves them.

## Existing capabilities retained

Smart header mapping, client templates, cleanup diagnostics, duplicate detection, revision comparison, RFQ impact, source-linked Tender Review, audit log, snapshots and role/approval rules.

## Still required before release

- Add a full spreadsheet grid engine for range selection, freeze panes and advanced grouping/filter persistence.
- Hash/compare package files during import to mark duplicate documents and newly received revisions before commit.
- Complete Windows runtime packaging and code-signing prerequisites from Priority Zero.

The current checkpoint includes a Windows x64 `Preview-Unsigned` installer. A signed commercial installer still requires the Priority Zero signing and Windows validation gates.
