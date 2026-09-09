(function () {
  "use strict"

  const C = window.QESTIMACore
  const Collab = window.QESTIMACollaboration || { ensureCollaborationState: (value) => value }
  const Model = window.QESTIMAModel || {}
  const viewTitles = {
    dashboard: "Project Overview",
    control: "Tender Control Center",
    projects: "إدارة المشاريع",
    documents: "Tender Documents",
    tender_review: "Tender Review",
    scope: "Scope & Systems",
    boq: "BOQ",
    quantity_review: "Quantity Review",
    analysis: "Resources & Rate Analysis",
    resources: "مكتبة الموارد",
    suppliers: "RFQs & Quotations",
    markup: "Pricing & Markup",
    risks: "Clarifications & Risks",
    quality: "Quality & Submission",
    decisions: "What-If & Target Price",
    reports: "Reports",
    drawings: "Drawings & Takeoff",
    models: "IFC & Model Mapping",
    owner_portal: "Owner Portal",
    revisions: "Revisions",
  }
  const resourceTypeLabels = { material: "مواد", labor: "عمالة", equipment: "معدات", subcontractor: "مقاول باطن" }
  const statusLabels = { draft: "مسودة", pricing: "جاري التسعير", review: "مراجعة", submitted: "تم التقديم", awarded: "تمت الترسية", lost: "غير فائز", sent: "تم الإرسال", waiting: "بانتظار الرد", received: "وصل العرض", closed: "مغلق" }
  const currencyLabels = { SAR: "ر.س", AED: "د.إ", USD: "$", EUR: "€", EGP: "ج.م" }
  const documentCategoryLabels = { instructions: "Tender Instructions", commercial: "Commercial", scope: "Scope", boq: "BOQ", drawings: "Drawings", specifications: "Specifications", schedules: "Schedules", vendors: "Approved Vendors", addenda: "Addenda", clarifications: "Clarifications", forms: "Returnable Forms" }
  const scopeStateLabels = { yes: "Yes", no: "No", partial: "Partial", available: "Available", missing: "Missing", unknown: "Not reviewed", na: "N/A" }
  const riskTypeLabels = { clarification: "Tender Clarification", commercial: "Commercial Risk", technical: "Technical Risk", assumption: "Assumption", exclusion: "Exclusion" }
  const tenderStatusLabels = { documents_missing: "Tender Documents Missing", review_incomplete: "Tender Review Incomplete", pricing: "Pricing In Progress", ready: "Ready for Final Review" }
  const mainRibbonTabs = ["file", "home", "drawings", "dimensions", "revisions", "cost_estimation", "suppliers", "intelligence", "reports", "admin"]
  // The Ribbon is data-driven: this is the single source of truth for tab
  // order, groups, command metadata, permissions, feature flags and
  // keyboard shortcuts.  The HTML only provides accessible panel shells.
  const ribbonCommand = (id, label, labelAr, iconName, target = {}, options = {}) => ({ id, label, labelAr, icon: iconName, ...target, permission: options.permission || "project.view", feature: options.feature || "", enabled: options.enabled !== false, reason: options.reason || "", shortcut: options.shortcut || "", data: options.data || target.data || {} })
  const ribbonGroup = (title, titleAr, commands) => ({ title, titleAr, commands })
  const ribbonConfig = [
    { id: "file", label: "File", groups: [
      ribbonGroup("Project", "المشروع", [ribbonCommand("new-project", "New Project", "مشروع جديد", "plus", { action: "new-project" }, { permission: "project.edit", shortcut: "Ctrl+N" }), ribbonCommand("open-project", "Open Project", "فتح مشروع", "folder", { view: "projects" }, { shortcut: "Ctrl+O" }), ribbonCommand("close-project", "Close Project", "إغلاق المشروع", "x", { action: "close-project" }, { permission: "project.view" }), ribbonCommand("recent-projects", "Recent Projects", "المشروعات الأخيرة", "history", { view: "projects" }, { shortcut: "Alt+R" })]),
      ribbonGroup("Tender Package", "حزمة المناقصة", [ribbonCommand("import-tender-package", "Import Tender Package", "استيراد حزمة المناقصة", "upload", { action: "upload-tender-zip" }, { permission: "documents.edit" }), ribbonCommand("export-project", "Export Project", "تصدير المشروع", "download", { action: "export-project-package" }, { permission: "project.view" }), ribbonCommand("backup", "Backup", "نسخة احتياطية", "save", { action: "backup" }, { permission: "project.view" }), ribbonCommand("restore", "Restore", "استعادة", "upload", { action: "import-project-package" }, { permission: "project.view" })]),
      ribbonGroup("Output", "الإخراج", [ribbonCommand("print", "Print", "طباعة", "report", { action: "print-report" }, { permission: "reports.view" }), ribbonCommand("report-problem", "Report a Problem", "إبلاغ عن مشكلة", "alert", { action: "report-problem" }, { permission: "project.view" })]),
    ] },
    { id: "home", label: "Home", groups: [
      ribbonGroup("Project Center", "مركز المشروع", [ribbonCommand("project-center", "Project Center", "مركز المشاريع", "folder", { view: "projects" }), ribbonCommand("tender-dashboard", "Tender Dashboard", "لوحة المناقصة", "grid", { view: "control" }), ribbonCommand("tender-status", "Tender Status", "حالة المناقصة", "clock", { view: "tender_review" })]),
      ribbonGroup("Edit", "تحرير", [ribbonCommand("save", "Save", "حفظ", "save", { action: "save-now" }, { permission: "project.edit", shortcut: "Ctrl+S" }), ribbonCommand("undo", "Undo", "تراجع", "undo", { action: "undo" }, { permission: "project.edit", shortcut: "Ctrl+Z" }), ribbonCommand("redo", "Redo", "إعادة", "redo", { action: "redo" }, { permission: "project.edit", shortcut: "Ctrl+Y" })]),
      ribbonGroup("Team & Search", "الفريق والبحث", [ribbonCommand("search", "Search", "بحث", "search", { action: "focus-search" }, { shortcut: "Ctrl+F" }), ribbonCommand("assign-user", "Assign User", "تعيين مستخدم", "users", { view: "control" }, { permission: "team.assign" }), ribbonCommand("sync-now", "Sync Now", "مزامنة الآن", "link", { action: "owner-sync-all" }, { feature: "central.sync" }), ribbonCommand("notifications", "Notifications", "الإشعارات", "alert", { action: "notifications" })]),
    ] },
    { id: "drawings", label: "Drawings", groups: [
      ribbonGroup("Import", "استيراد", [ribbonCommand("import-drawing", "Import Drawing", "استيراد رسم", "upload", { action: "upload-tender-files" }, { permission: "documents.edit" }), ribbonCommand("import-dxf", "DXF", "DXF", "upload", { action: "import-cad-document" }, { feature: "cad.dxf", permission: "documents.edit", data: { format: "DXF" } }), ribbonCommand("import-dwg", "DWG", "DWG", "upload", { action: "import-cad-document" }, { feature: "cad.dwg", permission: "documents.edit", data: { format: "DWG" }, reason: "قراءة DWG تحتاج محوّلًا أو CAD SDK مرخصًا؛ يمكنك تفعيل QESTIMA_DWG_CONVERTER." }), ribbonCommand("import-ifc", "IFC", "IFC", "link", { action: "import-ifc-model" }, { feature: "ifc.import" })]),
      ribbonGroup("Drawing", "الرسم", [ribbonCommand("drawing-register", "Drawing Register", "سجل الرسومات", "table", { view: "documents" }), ribbonCommand("open-drawing", "Open", "فتح", "ruler", { view: "drawings" }), ribbonCommand("drawing-properties", "Properties", "الخصائص", "edit", { action: "drawing-properties" }, { permission: "documents.view" })]),
      ribbonGroup("View", "العرض", [ribbonCommand("drawing-views", "Views", "طرق العرض", "grid", { view: "drawings" }), ribbonCommand("pan", "Pan", "تحريك", "ruler", { action: "ribbon-unavailable" }, { enabled: false, reason: "التحريك الكامل قيد التجهيز." }), ribbonCommand("rotate", "Rotate", "تدوير", "history", { action: "ribbon-unavailable" }, { enabled: false, reason: "التدوير قيد التجهيز." })]),
      ribbonGroup("Layers & Scale", "الطبقات والمقياس", [ribbonCommand("show-layers", "Layers", "الطبقات", "check", { action: "ribbon-unavailable" }, { enabled: false, reason: "طبقات PDF تحتاج محرك DXF/DWG." }), ribbonCommand("scale", "Scale", "المقياس", "ruler", { action: "calibrate-scale" }, { permission: "takeoff.edit" }), ribbonCommand("calibration", "Calibration", "المعايرة", "ruler", { action: "calibrate-scale" }, { permission: "takeoff.edit" })]),
    ] },
    { id: "dimensions", label: "Dimensions", groups: [
      ribbonGroup("Measure", "القياس", [ribbonCommand("length", "Length", "طول", "ruler", { action: "measure-length" }, { permission: "takeoff.edit" }), ribbonCommand("polyline", "Polyline", "خط متعدد", "ruler", { action: "measure-polyline" }, { permission: "takeoff.edit" }), ribbonCommand("area", "Area", "مساحة", "grid", { action: "measure-area" }, { permission: "takeoff.edit" }), ribbonCommand("count", "Count", "عد", "plus", { action: "measure-count" }, { permission: "takeoff.edit" }), ribbonCommand("auto-count", "Auto Count", "عد تلقائي", "grid", { action: "ribbon-unavailable" }, { enabled: false, reason: "العد الذكي سيُضاف بعد اعتماد القياس اليدوي." })]),
      ribbonGroup("Dimensions", "مجموعات القياس", [ribbonCommand("dimension-groups", "Dimension Groups", "مجموعات القياس", "table", { action: "add-measurement" }, { permission: "takeoff.edit" }), ribbonCommand("link-to-boq", "Link to BOQ", "ربط بالـBOQ", "link", { action: "link-current-boq" }, { permission: "takeoff.edit" }), ribbonCommand("measurement-sheet", "Measurement Sheet", "ورقة الحصر", "check", { view: "quantity_review" }, { permission: "takeoff.view" })]),
    ] },
    { id: "revisions", label: "Revisions", groups: [
      ribbonGroup("Revision Control", "إدارة الإصدارات", [ribbonCommand("add-revision", "Add Revision", "إضافة Revision", "plus", { action: "upload-tender-files" }, { permission: "documents.edit" }), ribbonCommand("compare-drawings", "Compare Drawings", "مقارنة الرسومات", "history", { action: "compare-document-revisions" }, { permission: "documents.view" }), ribbonCommand("overlay", "Overlay", "مطابقة شفافة", "grid", { action: "toggle-drawing-overlay" }, { permission: "documents.view" })]),
      ribbonGroup("Impact", "الأثر", [ribbonCommand("added-deleted", "Added / Deleted Items", "البنود المضافة والمحذوفة", "alert", { action: "revision-impact" }, { permission: "project.view" }), ribbonCommand("quantity-changes", "Quantity Changes", "تغير الكميات", "table", { action: "revision-impact" }, { permission: "project.view" }), ribbonCommand("boq-impact", "BOQ Impact", "أثر الـBOQ", "table", { action: "revision-impact" }, { permission: "project.view" }), ribbonCommand("cost-impact", "Cost Impact", "أثر التكلفة", "calculator", { action: "revision-impact" }, { permission: "project.view" }), ribbonCommand("revision-report", "Revision Report", "تقرير الـRevision", "report", { view: "revisions" }, { permission: "reports.view" })]),
    ] },
    { id: "cost_estimation", label: "Cost Estimation", groups: [
      ribbonGroup("BOQ", "الـBOQ", [ribbonCommand("boq-workbook", "BOQ Workbook", "دفتر الـBOQ", "table", { view: "boq" }), ribbonCommand("boq-add", "Add Item", "إضافة بند", "plus", { action: "add-boq" }, { permission: "pricing.edit" }), ribbonCommand("boq-import", "Import", "استيراد", "upload", { action: "open-import" }, { permission: "pricing.edit" }), ribbonCommand("item-details", "Item Details", "تفاصيل البند", "edit", { view: "boq" })]),
      ribbonGroup("Rate Build-Up", "تحليل السعر", [ribbonCommand("new-analysis", "New Analysis", "تحليل جديد", "calculator", { view: "analysis" }), ribbonCommand("copy-analysis-command", "Copy Analysis", "نسخ التحليل", "copy", { action: "copy-analysis" }, { permission: "pricing.edit_assigned" }), ribbonCommand("rate-assembly", "Rate Assembly", "تجميعة سعرية", "library", { action: "open-rate-assembly" }, { permission: "pricing.edit_assigned" }), ribbonCommand("recalculate", "Recalculate", "إعادة الحساب", "calculator", { action: "recalculate-analysis" }, { permission: "pricing.edit_assigned" })]),
      ribbonGroup("Resources", "الموارد", [ribbonCommand("material", "Material", "مواد", "library", { action: "resource-filter", data: { type: "material" } }, { permission: "resources.edit" }), ribbonCommand("labor", "Labor", "عمالة", "users", { action: "resource-filter", data: { type: "labor" } }, { permission: "resources.edit" }), ribbonCommand("equipment", "Equipment", "معدات", "grid", { action: "resource-filter", data: { type: "equipment" } }, { permission: "resources.edit" }), ribbonCommand("subcontractor", "Subcontractor", "مقاول باطن", "users", { action: "resource-filter", data: { type: "subcontractor" } }, { permission: "resources.edit" })]),
      ribbonGroup("Productivity", "الإنتاجية", [ribbonCommand("crew", "Crew", "الطاقم", "users", { action: "open-productivity" }, { permission: "pricing.edit_assigned" }), ribbonCommand("output-day", "Output / Day", "إنتاجية / يوم", "grid", { action: "open-productivity" }, { permission: "pricing.edit_assigned" }), ribbonCommand("manhours", "Manhours", "ساعات العمل", "clock", { action: "open-productivity" }, { permission: "pricing.edit_assigned" }), ribbonCommand("equipment-hours", "Equipment Hours", "ساعات المعدات", "calculator", { action: "open-productivity" }, { permission: "pricing.edit_assigned" })]),
      ribbonGroup("Indirect Cost", "التكلفة غير المباشرة", [ribbonCommand("site-overhead", "Site Overhead", "مصروفات الموقع", "calculator", { view: "markup" }), ribbonCommand("head-office", "Head Office", "المكتب الرئيسي", "calculator", { view: "markup" }), ribbonCommand("mobilization", "Mobilization", "التجهيز والنقل", "upload", { view: "markup" }), ribbonCommand("temporary-works", "Temporary Works", "أعمال مؤقتة", "grid", { view: "markup" })]),
      ribbonGroup("Pricing", "التسعير", [ribbonCommand("waste", "Waste", "الهالك", "percent", { view: "analysis" }), ribbonCommand("transport", "Transport", "النقل", "upload", { view: "analysis" }), ribbonCommand("escalation", "Escalation", "التصعيد", "percent", { view: "markup" }), ribbonCommand("contingency", "Contingency", "الاحتياطي", "alert", { view: "markup" })]),
      ribbonGroup("Selling Price", "سعر البيع", [ribbonCommand("profit", "Profit", "الربح", "percent", { view: "markup" }, { permission: "markup.view" }), ribbonCommand("markup-command", "Markup", "Markup", "percent", { view: "markup" }, { permission: "markup.view" }), ribbonCommand("discount", "Discount", "الخصم", "percent", { view: "markup" }, { permission: "markup.view" }), ribbonCommand("vat", "VAT", "الضريبة", "percent", { view: "markup" }, { permission: "markup.view" }), ribbonCommand("final-adjustment", "Final Adjustment", "التعديل النهائي", "target", { view: "markup" }, { permission: "markup.view" })]),
      ribbonGroup("Scenarios", "السيناريوهات", [ribbonCommand("conservative", "Conservative", "محافظ", "grid", { view: "markup" }), ribbonCommand("competitive", "Competitive", "تنافسي", "grid", { view: "markup" }), ribbonCommand("target", "Target", "مستهدف", "target", { view: "markup" }), ribbonCommand("management-final", "Management Final", "النهائي الإداري", "lock", { view: "markup" }, { permission: "markup.view" })]),
      ribbonGroup("Review", "المراجعة", [ribbonCommand("unpriced", "Unpriced Items", "بنود غير مسعرة", "alert", { action: "show-unpriced" }), ribbonCommand("rate-errors", "Rate Errors", "أخطاء الأسعار", "alert", { view: "quality" }), ribbonCommand("outliers", "Outliers", "القيم الشاذة", "alert", { view: "quality" }), ribbonCommand("quality-check", "Quality Check", "فحص الجودة", "check", { view: "quality" })]),
      ribbonGroup("History", "السجل", [ribbonCommand("previous-rates", "Previous Rates", "الأسعار السابقة", "history", { view: "boq" }), ribbonCommand("similar-items", "Similar Items", "بنود مشابهة", "search", { view: "boq" }), ribbonCommand("price-updates", "Price Updates", "تحديثات الأسعار", "history", { view: "resources" })]),
      ribbonGroup("Outputs", "المخرجات", [ribbonCommand("estimate-summary", "Estimate Summary", "ملخص التقدير", "report", { view: "reports" }), ribbonCommand("rate-analysis-output", "Rate Analysis", "تحليل الأسعار", "calculator", { view: "reports" }), ribbonCommand("cost-breakdown", "Cost Breakdown", "تفصيل التكلفة", "grid", { view: "reports" })]),
    ] },
    { id: "suppliers", label: "Suppliers", groups: [
      ribbonGroup("Supplier Register", "سجل الموردين", [ribbonCommand("supplier-register", "Supplier Register", "سجل الموردين", "users", { view: "suppliers" }), ribbonCommand("new-supplier", "New Supplier", "مورد جديد", "plus", { action: "add-supplier" }, { permission: "rfq.edit" })]),
      ribbonGroup("RFQ & Quotes", "طلبات الأسعار والعروض", [ribbonCommand("create-rfq", "Create RFQ", "إنشاء RFQ", "upload", { action: "add-rfq" }, { permission: "rfq.edit" }), ribbonCommand("import-quotation", "Import Quotation", "استيراد عرض", "attach", { action: "add-quote" }, { permission: "rfq.edit" }), ribbonCommand("quote-mapping", "Quote Mapping", "ربط العرض", "link", { view: "suppliers" }, { permission: "rfq.view" })]),
      ribbonGroup("Adjudication", "المفاضلة", [ribbonCommand("technical-compliance", "Technical Compliance", "المطابقة الفنية", "check", { view: "suppliers" }, { permission: "rfq.view" }), ribbonCommand("commercial-adjustments", "Commercial Adjustments", "التعديلات التجارية", "percent", { view: "suppliers" }, { permission: "rfq.view" }), ribbonCommand("bid-leveling", "Bid Leveling", "موازنة العروض", "grid", { view: "suppliers" }, { permission: "rfq.view" }), ribbonCommand("adopt-offer", "Adopt Offer", "اعتماد العرض", "check", { view: "suppliers" }, { permission: "rfq.edit" })]),
    ] },
    { id: "intelligence", label: "Intelligence", groups: [
      ribbonGroup("Tender Intelligence", "ذكاء المناقصة", [ribbonCommand("smart-pdf-review", "Smart PDF Review", "مراجعة PDF الذكية", "search", { action: "analyze-selected-pdf" }, { permission: "documents.view", feature: "pdf.intelligence" }), ribbonCommand("tender-summary", "Tender Summary", "ملخص المناقصة", "report", { view: "tender_review" }), ribbonCommand("scope-matrix", "Scope Matrix", "مصفوفة النطاق", "table", { view: "scope" }), ribbonCommand("historical-matching", "Historical Matching", "المطابقة التاريخية", "search", { view: "boq" })]),
      ribbonGroup("Diagnostics & Scenarios", "الفحص والسيناريوهات", [ribbonCommand("boq-diagnostics", "BOQ Diagnostics", "تشخيص الـBOQ", "check", { view: "quality" }), ribbonCommand("quality-checker", "Quality Checker", "فاحص الجودة", "check", { action: "run-quality-check" }, { permission: "project.view" }), ribbonCommand("what-if", "What-If", "ماذا لو", "percent", { view: "decisions" }), ribbonCommand("tender-review-gate", "Tender Review Gate", "بوابة مراجعة المناقصة", "lock", { view: "quality" })]),
    ] },
    { id: "reports", label: "Reports", groups: [
      ribbonGroup("Report Center", "مركز التقارير", [ribbonCommand("priced-boq-report", "Priced BOQ", "BOQ المسعّر", "report", { view: "reports" }), ribbonCommand("rate-analysis-report", "Rate Analysis", "تحليل السعر", "calculator", { view: "reports" }), ribbonCommand("resource-report", "Resource Summary", "ملخص الموارد", "library", { view: "reports" }), ribbonCommand("supplier-report", "Supplier Comparison", "مقارنة الموردين", "users", { view: "reports" })]),
      ribbonGroup("Review Outputs", "مخرجات المراجعة", [ribbonCommand("scope-gaps-report", "Scope Gaps", "فجوات النطاق", "alert", { view: "reports" }), ribbonCommand("unpriced-report", "Unpriced Items", "البنود غير المسعرة", "alert", { action: "show-unpriced" }), ribbonCommand("management-summary", "Management Summary", "ملخص الإدارة", "grid", { view: "reports" }), ribbonCommand("submission-pack", "Submission Pack", "حزمة التقديم", "download", { action: "export-report-pack" }, { permission: "reports.view" })]),
    ] },
    { id: "admin", label: "Administration", groups: [
      ribbonGroup("Access", "الوصول", [ribbonCommand("users", "Users", "المستخدمون", "users", { view: "owner_portal" }, { permission: "team.manage", feature: "owner.portal" }), ribbonCommand("roles", "Roles", "الأدوار", "lock", { view: "owner_portal" }, { permission: "team.manage", feature: "owner.portal" }), ribbonCommand("workspaces", "Workspaces", "مساحات العمل", "folder", { view: "owner_portal" }, { permission: "team.manage", feature: "owner.portal" }), ribbonCommand("license-status", "License Status", "حالة الترخيص", "lock", { view: "owner_portal" }, { permission: "project.view" })]),
      ribbonGroup("Company", "الشركة", [ribbonCommand("company-details", "Company Details", "بيانات الشركة", "edit", { action: "report-company-profile" }, { permission: "project.edit" }), ribbonCommand("report-templates", "Report Templates", "قوالب التقارير", "report", { action: "report-company-profile" }, { permission: "project.edit" }), ribbonCommand("units-currencies", "Units / Currencies", "الوحدات والعملات", "grid", { action: "report-company-profile" }, { permission: "project.edit" })]),
      ribbonGroup("Operations", "التشغيل", [ribbonCommand("updates", "Updates", "التحديثات", "download", { action: "central-health" }, { feature: "updates" }), ribbonCommand("audit-log", "Audit Log", "سجل التغييرات", "history", { view: "reports" }, { permission: "audit.view" }), ribbonCommand("customize-ribbon", "Customize Ribbon", "تخصيص الـRibbon", "edit", { action: "reset-ribbon" }), ribbonCommand("diagnostics", "Diagnostics", "التشخيص", "alert", { action: "report-problem" })]),
    ] },
  ]
  const ribbonActionPermissions = Object.fromEntries(ribbonConfig.flatMap((tab) => tab.groups.flatMap((group) => group.commands.filter((command) => command.action).map((command) => [command.action, command.permission]))))
  const reportSectionMeta = [
    ["managementSummary", "Management Summary", "ملخص الإدارة", "اتخاذ القرار ومؤشرات الجاهزية"],
    ["pricedBoq", "Priced BOQ", "جدول BOQ المسعّر", "الكميات والأسعار ومصادرها"],
    ["unpricedItems", "Unpriced Items", "بنود غير مسعّرة", "بنود تحتاج إجراء قبل التقديم"],
    ["rateAnalysis", "Detailed Rate Analysis", "تحليل سعر الوحدة", "تفصيل المواد والعمالة والإضافات"],
    ["resourceBreakdown", "Resource Breakdown", "توزيع الموارد", "Material / Labor / Equipment / Subcontractor"],
    ["supplierAdjudication", "Supplier Adjudication", "مفاضلة الموردين", "Lowest / Compliant / Best Evaluated"],
    ["qualificationsExclusions", "Qualifications & Exclusions", "التوضيحات والاستثناءات", "نقاط يجب تضمينها في العرض"],
    ["scopeGaps", "Scope Gaps", "فجوات النطاق", "الأنظمة غير المغلقة"],
    ["revisionImpact", "Revision Impact", "أثر الـRevision", "الإضافات والحذف وتغير الكميات"],
    ["scenarioComparison", "Scenario Comparison", "مقارنة السيناريوهات", "الربح والسعر قبل الضريبة"],
    ["auditTrail", "Audit Trail", "سجل التغييرات", "من عدّل ماذا ومتى"],
    ["submissionPack", "Tender Submission Pack", "حزمة التقديم", "كل الملفات والمستندات في خطوة واحدة"],
  ]
  const reportCopy = {
    en: {
      reportCenter: "Report Center", managementSummary: "Management Summary", pricedBoq: "Priced BOQ", unpricedItems: "Unpriced Items", rateAnalysis: "Detailed Rate Analysis", resourceBreakdown: "Resource Breakdown", supplierAdjudication: "Supplier Adjudication", qualificationsExclusions: "Qualifications & Exclusions", scopeGaps: "Scope Gaps", revisionImpact: "Revision Impact", scenarioComparison: "Scenario Comparison", auditTrail: "Audit Trail", documentRegister: "Document Register", tenderReview: "Tender Review", submissionPack: "Tender Submission Pack", tenderDocuments: "Tender Submission Documents", item: "Item", description: "Description", unit: "Unit", qty: "Qty", pricingQty: "Pricing Qty", section: "Section", system: "System", floor: "Floor / Zone", status: "Status", source: "Source", rateSource: "Rate Source", costRate: "Cost Rate", costTotal: "Cost Total", sellingRate: "Selling Rate", sellingTotal: "Selling Total", material: "Material", labor: "Labor", equipment: "Equipment", subcontractor: "Subcontractor", waste: "Waste", extras: "Other Additions", unitCost: "Unit Cost", profit: "Profit", sellingBeforeVat: "Selling Before VAT", beforeVat: "Before VAT", vat: "VAT", type: "Type", code: "Code", resource: "Resource", factor: "Factor", rate: "Rate", total: "Total", supplier: "Supplier", reference: "Reference", compliance: "Compliance", quotedUnit: "Quoted Unit", evaluatedUnit: "Best Evaluated Unit", delivery: "Delivery", payment: "Payment", warranty: "Warranty", validity: "Validity", deviation: "Deviation", metric: "Metric", value: "Value", access: "Access", requirement: "Requirement", summary: "Summary", page: "Page", verified: "Verified", include: "Included Output", change: "Change", before: "Before", after: "After", delta: "Delta", baseline: "Baseline", added: "Added", deleted: "Deleted", changed: "Changed", directCost: "Direct Cost", totalCost: "Total Cost", indirectCost: "Indirect Cost", contingencyRisk: "Contingency / Risk", escalation: "Escalation", discount: "Discount", grandTotal: "Grand Total", trueMargin: "True Margin", readiness: "Tender Readiness", pricingProgress: "Pricing Progress", documentsGaps: "Documents / Gaps", outputAccess: "Output Access", gateQuality: "Gate & Quality", tenderReviewGate: "Tender Review Gate", qualityScore: "Quality Score", openFindings: "Open Findings", noData: "No data", noOffers: "No offers", noOpenGaps: "No open scope gaps", noRecorded: "None recorded", noDocuments: "No documents", restricted: "Restricted", visible: "Visible", revision: "Revision", submissionDeadline: "Submission deadline", scenario: "Scenario", currencyVat: "Currency / VAT", full: "Full", costOnly: "Cost only", cost: "Cost", noCost: "No cost", markup: "Markup", noMarkup: "No markup", generated: "Generated", priced: "Priced", unpriced: "Unpriced", compliant: "Compliant", expired: "Expired", valid: "Valid", deviationStatus: "Deviation", approved: "Approved", working: "Working", ready: "Ready", openItems: "Open items", review: "Review", closed: "Closed", noBaseline: "No saved baseline", current: "Current", superseded: "Superseded", tenderOperatingSystem: "TENDER OPERATING SYSTEM", role: "Role", documentsCount: "documents", documentNo: "Document No", title: "Title", category: "Category", discipline: "Discipline", file: "File", date: "Date", user: "User", action: "Action", inScope: "In Scope", boq: "BOQ", drawings: "Drawings", specifications: "Specifications", notes: "Notes",
    },
    ar: {
      reportCenter: "مركز التقارير", managementSummary: "ملخص الإدارة", pricedBoq: "BOQ المسعّر", unpricedItems: "البنود غير المسعّرة", rateAnalysis: "تحليل سعر الوحدة", resourceBreakdown: "توزيع الموارد", supplierAdjudication: "مفاضلة الموردين", qualificationsExclusions: "التوضيحات والاستثناءات", scopeGaps: "فجوات النطاق", revisionImpact: "أثر المراجعة", scenarioComparison: "مقارنة السيناريوهات", auditTrail: "سجل التغييرات", documentRegister: "سجل المستندات", tenderReview: "مراجعة المناقصة", submissionPack: "حزمة التقديم", tenderDocuments: "مستندات التقديم", item: "البند", description: "الوصف", unit: "الوحدة", qty: "الكمية", pricingQty: "كمية التسعير", section: "القسم", system: "النظام", floor: "الدور / المنطقة", status: "الحالة", source: "المصدر", rateSource: "مصدر السعر", costRate: "سعر التكلفة", costTotal: "إجمالي التكلفة", sellingRate: "سعر البيع", sellingTotal: "إجمالي البيع", material: "مواد", labor: "عمالة", equipment: "معدات", subcontractor: "مقاول باطن", waste: "هالك", extras: "إضافات أخرى", unitCost: "تكلفة الوحدة", profit: "الربح", sellingBeforeVat: "سعر البيع قبل الضريبة", beforeVat: "قبل الضريبة", vat: "الضريبة", type: "النوع", code: "الكود", resource: "المورد/المورد التشغيلي", factor: "المعامل", rate: "السعر", total: "الإجمالي", supplier: "المورد", reference: "المرجع", compliance: "المطابقة", quotedUnit: "السعر المعروض", evaluatedUnit: "أفضل سعر مُقيّم", delivery: "التوريد", payment: "الدفع", warranty: "الضمان", validity: "الصلاحية", deviation: "الانحرافات", metric: "المؤشر", value: "القيمة", access: "الصلاحية", requirement: "المتطلب", summary: "الملخص", page: "الصفحة", verified: "تم التحقق", include: "المخرج المضمن", change: "التغيير", before: "قبل", after: "بعد", delta: "الفرق", baseline: "النسخة المرجعية", added: "مضاف", deleted: "محذوف", changed: "متغير", directCost: "التكلفة المباشرة", totalCost: "إجمالي التكلفة", indirectCost: "التكلفة غير المباشرة", contingencyRisk: "المخاطر والاحتياطي", escalation: "التصعيد", discount: "الخصم", grandTotal: "الإجمالي النهائي", trueMargin: "هامش الربح الحقيقي", readiness: "جاهزية المناقصة", pricingProgress: "تقدم التسعير", documentsGaps: "المستندات / الفجوات", outputAccess: "صلاحية الإخراج", gateQuality: "بوابة المراجعة والجودة", tenderReviewGate: "بوابة مراجعة المناقصة", qualityScore: "درجة الجودة", openFindings: "ملاحظات مفتوحة", noData: "لا توجد بيانات", noOffers: "لا توجد عروض", noOpenGaps: "لا توجد فجوات نطاق مفتوحة", noRecorded: "لا يوجد مسجل", noDocuments: "لا توجد مستندات", restricted: "محجوب حسب الصلاحية", visible: "ظاهر", revision: "المراجعة", submissionDeadline: "موعد التسليم", scenario: "السيناريو", currencyVat: "العملة / الضريبة", full: "كامل", costOnly: "التكلفة فقط", cost: "التكلفة", noCost: "بدون تكلفة", markup: "Markup", noMarkup: "بدون Markup", generated: "تاريخ الإنشاء", priced: "مسعّر", unpriced: "غير مسعّر", compliant: "مطابق", expired: "منتهي", valid: "ساري", deviationStatus: "به انحراف", approved: "معتمد", working: "قيد العمل", ready: "جاهز", openItems: "عناصر مفتوحة", review: "مراجعة", closed: "مغلق", noBaseline: "لا توجد نسخة مرجعية محفوظة", current: "حالي", superseded: "مستبدل", tenderOperatingSystem: "نظام تشغيل المناقصات", role: "الدور", documentsCount: "مستندات", documentNo: "رقم المستند", title: "العنوان", category: "التصنيف", discipline: "التخصص", file: "الملف", date: "التاريخ", user: "المستخدم", action: "الإجراء", inScope: "داخل النطاق", boq: "BOQ", drawings: "الرسومات", specifications: "المواصفات", notes: "ملاحظات",
    },
  }
  const reportT = (packOrLanguage, key, fallback = key) => {
    const language = typeof packOrLanguage === "string" ? packOrLanguage : packOrLanguage?.language
    return reportCopy[language === "ar" ? "ar" : "en"]?.[key] || reportCopy.en[key] || fallback
  }

  let state = null
  let activeView = "projects"
  let activeRibbonTab = "home"
  let activeContextTab = ""
  let openTabs = ["projects"]
  let projectSearch = ""
  let projectStatusFilter = ""
  let modelPage = 0
  let activeItemId = null
  let activeDrawingId = null
  let drawingClosed = false
  let activeModelId = null
  let activeReportTab = "managementSummary"
  let reportLanguage = "ar"
  let inspectorHidden = false
  let ribbonCollapsed = false
  let workspaceScroll = {}
  let ribbonHiddenCommands = []
  let ribbonLayout = {}
  let undoStack = []
  let redoStack = []
  let saveTimer = null
  let centralSyncTimer = null
  let importDraft = null
  let filters = { boqSearch: "", section: "", system: "", floor: "", pricing: "", resourceSearch: "", resourceType: "", resourceCategory: "" }
  let isAuthenticated = false
  let authMessage = ""
  let measurementCanvas = { mode: "", kind: "", points: [], page: 1, zoom: 1, drawingId: null, revisionOverlayId: null, sourceWidth: 0, sourceHeight: 0, image: null, snap: true }
  let drawingPage = 1
  // Keep track of events handled during capture so the direct fallback
  // listeners below cannot run the same action twice.
  const handledClickEvents = new WeakSet()

  const $ = (selector, parent = document) => parent.querySelector(selector)
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)]
  const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char])
  const unique = (values) => [...new Set(values.filter(Boolean))]

  // Element.closest() is available in modern Chromium, but using a small
  // fallback keeps the universal launcher usable with older Edge/Chrome
  // builds and with clicks that originate on an SVG <use> element.
  function closestElement(node, selector) {
    let current = node
    while (current) {
      if (current.nodeType === 1 && typeof current.matches === "function" && current.matches(selector)) return current
      current = current.parentElement || current.parentNode
    }
    return null
  }

  function browserDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("qestima-universal", 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains("attachments")) db.createObjectStore("attachments", { keyPath: "id" })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function storeBrowserAttachment(file) {
    const db = await browserDatabase()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-")}`
    await new Promise((resolve, reject) => {
      const request = db.transaction("attachments", "readwrite").objectStore("attachments").put({ id, name: file.name, type: file.type, size: file.size, blob: file, savedAt: new Date().toISOString() })
      request.onsuccess = resolve
      request.onerror = () => reject(request.error)
    })
    db.close()
    return { id, name: file.name, originalName: file.name, size: file.size, fileType: file.name.includes(".") ? file.name.split(".").pop().toUpperCase() : "FILE" }
  }

  async function openBrowserAttachment(id) {
    const db = await browserDatabase()
    const record = await new Promise((resolve, reject) => {
      const request = db.transaction("attachments").objectStore("attachments").get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    if (!record) return toast("المرفق غير موجود", "قد يكون تم نقل المشروع بدون ملفاته المحلية.", "warning")
    const url = URL.createObjectURL(record.blob)
    const link = document.createElement("a")
    link.href = url
    link.target = "_blank"
    link.rel = "noopener"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  function browserPickFiles(mode = "files", accept = ".pdf,.dwg,.dxf,.xlsx,.xls,.docx,.doc,.zip,.jpg,.jpeg,.png,.txt") {
    return new Promise((resolve) => {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = mode === "zip" ? ".zip" : accept
      input.multiple = mode !== "zip"
      if (mode === "folder") input.setAttribute("webkitdirectory", "")
      input.addEventListener("change", () => resolve([...input.files]))
      input.click()
    })
  }

  function browserDownload(name, content, type = "application/json") {
    const url = URL.createObjectURL(new Blob([content], { type }))
    const link = document.createElement("a")
    link.href = url
    link.download = name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 3000)
  }

  async function browserImportBackup() {
    const files = await browserPickFiles("file", ".json")
    if (!files[0]) return null
    return JSON.parse(await files[0].text())
  }

  function currentProject() {
    const projects = state.projects.filter((project) => project.workspaceId === state.session?.workspaceId && C.can(state, "project.view", project))
    return projects.find((project) => project.id === state.activeProjectId) || projects[0] || C.emptyProject(state)
  }

  function currentScenario(project = currentProject()) {
    return project.scenarios.find((scenario) => scenario.id === state.activeScenarioId) || project.scenarios[0]
  }

  function money(value, currency = currentProject()?.currency || "SAR") {
    try {
      return new Intl.NumberFormat("ar-SA", { style: "currency", currency, maximumFractionDigits: 2 }).format(C.number(value))
    } catch {
      return `${C.round(value, 2).toLocaleString("en-US")} ${currencyLabels[currency] || currency}`
    }
  }

  function num(value, digits = 2) {
    return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: digits }).format(C.number(value))
  }

  function dateLabel(value) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return esc(value)
    return new Intl.DateTimeFormat("ar-SA", { year: "numeric", month: "short", day: "numeric" }).format(date)
  }

  function projectRateSource(project, item) {
    if (item.pricingMethod === "manual") return "سعر يدوي"
    if (item.pricingMethod === "supplier") {
      const quote = project.quotes.find((entry) => entry.id === item.selectedQuoteId)
      const supplier = state.suppliers.find((entry) => entry.id === quote?.supplierId)
      return supplier ? `عرض ${supplier.name}` : "عرض مورد"
    }
    const lines = project.analyses[item.id]?.lines || []
    return lines.length ? `تحليل ${lines.length} موارد` : "بدون تحليل"
  }

  function toast(title, text = "", type = "success") {
    const element = document.createElement("div")
    element.className = `toast ${type}`
    element.innerHTML = `<div><strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ""}</div>`
    $("#toast-root").append(element)
    setTimeout(() => element.remove(), 4200)
  }

  function audit(project, action) {
    project.audit ||= []
    project.audit.unshift({ id: C.id("audit"), date: new Date().toISOString(), user: state.user.name, action })
    if (project.audit.length > 100) project.audit.length = 100
  }

  function commit(action, mutator, options = {}) {
    const license = C.licenseStatus(state)
    if (license.expired && !options.allowExpired) {
      toast("البرنامج في وضع Read-Only", "انتهى الترخيص. استخدم Activate / Reactivate قبل تعديل البيانات.", "warning")
      return false
    }
    const projectBefore = currentProject()
    if (!projectBefore?.id && !String(action || "").startsWith("إنشاء مشروع") && !options.allowWithoutProject) {
      toast("أنشئ مشروعًا أولًا", "افتح Projects Center ثم Create Project.", "warning")
      return false
    }
    const projectBeforeSnapshot = projectBefore ? C.deepClone(projectBefore) : null
    if (projectBefore && !options.allowUnauthorized && !C.canWrite(state, projectBefore)) {
      toast("الصلاحية غير متاحة", "هذا الحساب لا يملك صلاحية تعديل بيانات المشروع.", "warning")
      return false
    }
    if (projectBefore?.submittedLockedAt && !options.allowLocked) {
      toast("نسخة التسليم مقفلة", "أنشئ Revision جديدة قبل إجراء أي تعديل.", "warning")
      return false
    }
    const activeLock = Collab.activeProjectLock?.(projectBefore)
    const actorId = C.activeUser(state)?.id || state.session?.userId || ""
    if (activeLock && activeLock.userId && activeLock.userId !== actorId && !options.allowLockOverride) {
      toast("المشروع قيد التعديل", "يعدّل مستخدم آخر هذا المشروع حاليًا. انتظر انتهاء القفل أو اطلب حله من المدير.", "warning")
      return false
    }
    undoStack.push(C.deepClone(state))
    if (undoStack.length > 30) undoStack.shift()
    redoStack = []
    mutator(state)
    const project = currentProject()
    if (project) {
      project.updatedAt = new Date().toISOString()
      if (action && options.audit !== false) audit(project, action)
      if (Collab.recordCentralAudit && options.centralAudit !== false) Collab.recordCentralAudit(state, { tenantId: project.tenantId, actorId, action: action || "change", entityType: "project", entityId: project.id, detail: "local change" })
      // Company projects are syncable even while offline.  Keep one durable,
      // auditable operation per local change; the sync worker coalesces these
      // entries before sending them to the Central API.
      if (projectBeforeSnapshot && options.syncQueue !== false && Collab.queueSyncOperation && Collab.changedPaths) {
        const tenant = C.tenantFor?.(state, project.tenantId)
        const workspace = C.activeWorkspace?.(state)
        const companyProject = tenant?.type === "company" || workspace?.type === "company"
        const changed = Collab.changedPaths(projectBeforeSnapshot, project).filter((path) => path && !/^(updatedAt|audit|centralAudit)(\/|$)/.test(path))
        if (companyProject && changed.length) Collab.queueSyncOperation(state, { tenantId: project.tenantId, projectId: project.id, baseVersion: projectBeforeSnapshot.serverVersion || project.serverVersion || 1, payload: C.deepClone(project), changedPaths: changed.slice(0, 500), actorId, deviceId: state.session?.deviceId || "" })
      }
    }
    render()
    scheduleSave()
    return true
  }

  function undo() {
    if (!undoStack.length) return
    if (!historyAllowed(undoStack[undoStack.length - 1])) return
    redoStack.push(C.deepClone(state))
    state = undoStack.pop()
    render()
    scheduleSave()
    toast("تم التراجع عن آخر تعديل")
  }

  function redo() {
    if (!redoStack.length) return
    if (!historyAllowed(redoStack[redoStack.length - 1])) return
    undoStack.push(C.deepClone(state))
    state = redoStack.pop()
    render()
    scheduleSave()
    toast("تمت إعادة التعديل")
  }

  function historyAllowed(previous) {
    const project = currentProject()
    const lock = Collab.activeProjectLock?.(project)
    const userId = C.activeUser(state)?.id
    if (!isAuthenticated || C.licenseStatus(state).expired || !C.canWrite(state, project) || project.submittedLockedAt || (lock?.userId && lock.userId !== userId) || previous?.session?.userId !== state.session.userId || previous?.session?.workspaceId !== state.session.workspaceId || previous?.activeProjectId !== state.activeProjectId) {
      toast("التراجع غير متاح", "راجع الترخيص والصلاحية وقفل المشروع ومساحة العمل.", "warning")
      return false
    }
    return true
  }

  function scheduleSave() {
    const dot = $("#save-dot")
    const label = $("#save-label")
    if (dot) dot.classList.add("saving")
    if (label) label.textContent = "جارٍ الحفظ…"
    clearTimeout(saveTimer)
    saveTimer = setTimeout(saveNow, 550)
  }

  function persistUiState() {
    if (!state) return
    state.uiState ||= {}
    state.uiState.activeView = activeView
    state.uiState.activeRibbonTab = activeRibbonTab
    state.uiState.activeContextTab = activeContextTab
    state.uiState.openTabs = unique(openTabs.filter((view) => viewTitles[view]))
    state.uiState.activeItemId = activeItemId || ""
    state.uiState.activeDrawingId = activeDrawingId || ""
    state.uiState.drawingClosed = drawingClosed === true
    state.uiState.ribbonCollapsed = ribbonCollapsed === true
    state.uiState.workspaceScroll = C.deepClone(workspaceScroll)
    state.uiState.ribbonHiddenCommands = [...ribbonHiddenCommands]
    state.uiState.ribbonLayout = C.deepClone(ribbonLayout)
  }

  function restoreUiState() {
    const saved = state?.uiState || {}
    const savedTabs = Array.isArray(saved.openTabs) ? saved.openTabs.filter((view) => viewTitles[view]) : []
    openTabs = unique(savedTabs.length ? savedTabs : ["projects"])
    activeView = viewTitles[saved.activeView] ? saved.activeView : openTabs[0] || "projects"
    if (!openTabs.includes(activeView)) openTabs.unshift(activeView)
    const savedRibbonTab = saved.activeRibbonTab === "workbooks" ? "cost_estimation" : saved.activeRibbonTab
    activeRibbonTab = mainRibbonTabs.includes(savedRibbonTab) ? savedRibbonTab : "home"
    activeContextTab = String(saved.activeContextTab || "")
    activeItemId = saved.activeItemId || null
    activeDrawingId = saved.activeDrawingId || null
    drawingClosed = saved.drawingClosed === true
    ribbonCollapsed = saved.ribbonCollapsed === true
    workspaceScroll = saved.workspaceScroll && typeof saved.workspaceScroll === "object" ? saved.workspaceScroll : {}
    ribbonHiddenCommands = Array.isArray(saved.ribbonHiddenCommands) ? saved.ribbonHiddenCommands : []
    ribbonLayout = saved.ribbonLayout && typeof saved.ribbonLayout === "object" ? saved.ribbonLayout : {}
  }

  function localizeRibbon(value, valueAr = "") {
    return state?.settings?.language === "en" ? String(value || valueAr) : String(valueAr || value)
  }

  function activeFeatureFlags() {
    const workspace = C.activeWorkspace(state)
    const tenant = C.tenantFor?.(state)
    // Workspace/tenant flags are the source of truth for company features.
    // Keep license flags as the outer gate, then let the active tenant grant
    // only the capabilities assigned to that workspace. This prevents a
    // personal preview from exposing central sync while allowing the company
    // pilot to use the same command configuration.
    return { ...(state?.license?.featureFlags || {}), ...(tenant?.featureFlags || {}), ...(workspace?.featureFlags || {}) }
  }

  function featureEnabled(feature) {
    if (!feature) return true
    const aliases = { "ifc.import": "ifcImport", "owner.portal": "ownerPortal", "central.sync": "centralSync", "cad.dxf": "dxfImport", "cad.dwg": "nativeDwg" }
    const flags = activeFeatureFlags()
    const key = aliases[feature] || feature
    return flags[key] === true
  }

  function findRibbonCommand(idOrAction) {
    return ribbonConfig.flatMap((tab) => tab.groups.flatMap((group) => group.commands)).find((command) => command.id === idOrAction || command.action === idOrAction) || null
  }

  function commandAvailability(action, project = currentProject()) {
    const command = typeof action === "string" ? findRibbonCommand(action) : action
    action = typeof action === "string" ? action : command?.action
    const pending = new Set(["head-office", "mobilization", "temporary-works", "quote-mapping", "units-currencies", "updates", "users", "roles", "workspaces"])
    if (pending.has(command?.id)) return { blocked: true, title: "هذه الأداة لم تكتمل بعد في الإصدار الحالي." }
    const permission = command?.permission || ribbonActionPermissions[action]
    if (command && command.enabled === false) return { blocked: true, title: command.reason || "هذا الأمر غير متاح في هذه النسخة." }
    if (command && !featureEnabled(command.feature)) return { blocked: true, title: command.reason || `الميزة ${command.feature} غير مفعلة في الترخيص الحالي.` }
    if (!permission) return { blocked: false, title: "" }
    const license = C.licenseStatus(state)
    if (license.expired && permission !== "reports.view") return { blocked: true, title: "انتهى الترخيص؛ أعد التفعيل للعودة إلى وضع التحرير." }
    if (!C.can(state, permission, project)) return { blocked: true, title: `الصلاحية المطلوبة: ${permission}` }
    return { blocked: false, title: "" }
  }

  function contextualRibbonContexts() {
    const contexts = []
    const project = currentProject()
    const hasDrawing = Boolean(activeDrawingId && (project.documents || []).some((entry) => entry.id === activeDrawingId))
    const hasLayerSupport = false
    const layerTitle = hasLayerSupport ? "إدارة طبقات الرسم" : "طبقات PDF غير متاحة؛ ستُفعل مع محرك DXF/DWG المصرّح به"
    if (activeView === "drawings" || activeView === "models" || hasDrawing) {
      contexts.push({
        id: "drawing-tools",
        label: "Drawing Tools",
        groups: [
          { title: "Drawing", commands: [{ label: "Open", icon: "ruler", view: "drawings" }, { label: "Close", icon: "x", action: "close-drawing", disabled: !hasDrawing, title: "اختر رسمًا أولًا" }, { label: "Properties", icon: "edit", action: "drawing-properties", disabled: !hasDrawing, title: "اختر رسمًا أولًا" }] },
          { title: "View", commands: [{ label: "Zoom In", icon: "plus", action: "drawing-zoom-in", disabled: !hasDrawing }, { label: "Fit", icon: "grid", action: "drawing-fit", disabled: !hasDrawing }, { label: "Zoom Out", icon: "minus", action: "drawing-zoom-out", disabled: !hasDrawing }] },
          { title: "Layers", commands: [{ label: "Show", icon: "check", action: "show-drawing-layers", disabled: !hasDrawing || !hasLayerSupport, title: layerTitle }, { label: "Hide", icon: "x", action: "hide-drawing-layers", disabled: !hasDrawing || !hasLayerSupport, title: layerTitle }, { label: "Filter", icon: "filter", action: "filter-drawing-layers", disabled: !hasDrawing || !hasLayerSupport, title: layerTitle }] },
          { title: "Scale", commands: [{ label: "Calibrate", icon: "ruler", action: "calibrate-scale", disabled: !hasDrawing }, { label: "Change Units", icon: "edit", action: "change-scale-units", disabled: !hasDrawing }] },
          { title: "Revisions", commands: [{ label: "Add Revision", icon: "plus", action: "upload-tender-files" }, { label: "Compare", icon: "history", action: "compare-document-revisions", disabled: !hasDrawing }, { label: "Overlay", icon: "grid", action: "toggle-drawing-overlay", disabled: !hasDrawing }] },
        ],
      })
    }
    if (activeView === "drawings" && (measurementCanvas.mode || activeContextTab === "dimension-tools")) {
      contexts.push({ id: "dimension-tools", label: "Dimension Tools", groups: [
        { title: "Measure", commands: [{ label: "Length", icon: "ruler", action: "measure-length" }, { label: "Area", icon: "grid", action: "measure-area" }, { label: "Perimeter", icon: "ruler", action: "measure-perimeter" }, { label: "Count", icon: "plus", action: "measure-count" }] },
        { title: "Review", commands: [{ label: "Link to BOQ", icon: "link", view: "boq" }, { label: "Quantity Review", icon: "check", view: "quantity_review" }] },
      ] })
    }
    if ((activeView === "boq" || activeView === "analysis") && activeItemId) {
      contexts.push({ id: "boq-item-tools", label: "BOQ Item Tools", groups: [
        { title: "Item", commands: [{ label: "Rate Analysis", icon: "calculator", view: "analysis" }, { label: "Add Resource", icon: "plus", action: "add-analysis-line" }, { label: "Copy Analysis", icon: "copy", action: "copy-analysis" }] },
        { title: "Sources", commands: [{ label: "Historical Match", icon: "search", view: "boq" }, { label: "Supplier Quotes", icon: "users", view: "suppliers" }, { label: "Link Drawing", icon: "attach", action: "link-current-boq" }] },
        { title: "Review", commands: [{ label: "Quality Check", icon: "check", view: "quality" }, { label: "Unpriced Items", icon: "alert", action: "show-unpriced" }] },
      ] })
    }
    if (activeView === "suppliers") {
      contexts.push({ id: "quotation-tools", label: "Quotation Tools", groups: [
        { title: "Quotation", commands: [{ label: "Register Quote", icon: "attach", action: "add-quote" }, { label: "Open Quotes", icon: "attach", view: "suppliers" }] },
        { title: "Evaluate", commands: [{ label: "Compare Offers", icon: "grid", view: "suppliers" }, { label: "Select Offer", icon: "check", view: "suppliers", disabled: !project.quotes.length, title: "لا توجد عروض مسجلة" }] },
        { title: "RFQ", commands: [{ label: "New RFQ", icon: "users", action: "add-rfq" }, { label: "Follow-up", icon: "clock", view: "control" }] },
      ] })
    }
    return contexts
  }

  function renderContextualRibbon() {
    const tabHost = $("#contextual-tabs")
    const commandHost = $("#contextual-command-ribbon")
    if (!tabHost || !commandHost) return
    const contexts = contextualRibbonContexts()
    if (!contexts.length) {
      if ($("#command-ribbon")) $("#command-ribbon").hidden = false
      activeContextTab = ""
      tabHost.hidden = true
      commandHost.hidden = true
      tabHost.innerHTML = ""
      commandHost.innerHTML = ""
      persistUiState()
      return
    }
    if (!contexts.some((context) => context.id === activeContextTab)) activeContextTab = ""
    tabHost.hidden = false
    tabHost.innerHTML = contexts.map((context) => `<button id="context-tab-${esc(context.id)}" class="contextual-tab ${context.id === activeContextTab ? "active" : ""}" role="tab" aria-selected="${context.id === activeContextTab}" aria-controls="context-panel-${esc(context.id)}" data-action="contextual-tab" data-context="${esc(context.id)}">${esc(context.label)}</button>`).join("")
    const context = contexts.find((entry) => entry.id === activeContextTab)
    const mainCommands = $("#command-ribbon")
    if (mainCommands) mainCommands.hidden = Boolean(context)
    if (!context) { commandHost.hidden = true; commandHost.innerHTML = ""; return }
    commandHost.hidden = false
    commandHost.innerHTML = `<div id="context-panel-${esc(context.id)}" class="contextual-panel" role="tabpanel" aria-labelledby="context-tab-${esc(context.id)}">${context.groups.map((group) => `<div class="ribbon-group"><span>${esc(group.title)}</span><div>${group.commands.map((command) => { const attrs = command.view ? `data-view="${esc(command.view)}"` : `data-action="${esc(command.action)}"`; const availability = commandAvailability(command.action); const disabled = command.disabled || availability.blocked; const title = command.title || availability.title; return `<button class="contextual-command ${disabled ? "ribbon-disabled" : ""}" ${attrs} ${disabled ? "disabled aria-disabled=\"true\"" : ""} ${title ? `title="${esc(title)}"` : ""}>${command.icon ? icon(command.icon) : ""}<b>${esc(command.label)}</b></button>` }).join("")}</div></div>`).join("")}</div>`
    persistUiState()
  }

  function toggleRibbonCollapsed() {
    ribbonCollapsed = !ribbonCollapsed
    persistUiState()
    $("#app-shell")?.classList.toggle("ribbon-collapsed", ribbonCollapsed)
    $("#ribbon-tabs")?.setAttribute("aria-expanded", String(!ribbonCollapsed))
    scheduleSave()
  }

  async function saveNow() {
    clearTimeout(saveTimer)
    try {
      if (!window.qestimaDesktop) localStorage.setItem("qestima-v6", JSON.stringify(state))
      const result = window.qestimaDesktop ? await window.qestimaDesktop.saveData(state) : { savedAt: new Date().toISOString() }
      $("#save-dot")?.classList.remove("saving")
      if ($("#save-label")) $("#save-label").textContent = "محفوظ"
      if ($("#save-time")) $("#save-time").textContent = `آخر حفظ ${new Date(result.savedAt).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}`
      return true
    } catch (error) {
      $("#save-dot")?.classList.remove("saving")
      if ($("#save-label")) $("#save-label").textContent = "تعذر الحفظ"
      toast("تعذر حفظ البيانات", error.message, "error")
      return false
    }
  }

  function openView(view) {
    if (!viewTitles[view]) return
    activeView = view
    activeContextTab = ""
    if (view === "drawings" && !activeDrawingId) drawingClosed = false
    const ribbonForView = { projects: "home", dashboard: "home", control: "home", documents: "file", tender_review: "home", scope: "home", boq: "cost_estimation", quantity_review: "dimensions", analysis: "cost_estimation", resources: "cost_estimation", suppliers: "suppliers", markup: "cost_estimation", risks: "intelligence", quality: "cost_estimation", decisions: "cost_estimation", reports: "reports", drawings: "drawings", models: "drawings", owner_portal: "admin", revisions: "revisions" }
    activeRibbonTab = ribbonForView[view] || activeRibbonTab
    openTabs = [view]
    persistUiState()
    scheduleSave()
    render()
  }

  function closeTab(view) {
    if (openTabs.length === 1) return
    const index = openTabs.indexOf(view)
    openTabs = openTabs.filter((entry) => entry !== view)
    if (activeView === view) activeView = openTabs[Math.max(0, index - 1)]
    persistUiState()
    scheduleSave()
    render()
  }

  function renderRibbonCommand(command) {
    const availability = commandAvailability(command)
    const hidden = ribbonHiddenCommands.includes(command.id)
    if (hidden) return ""
    const target = command.view ? `data-view=\"${esc(command.view)}\"` : `data-action=\"${esc(command.action || "ribbon-unavailable")}\"`
    const data = Object.entries(command.data || {}).map(([key, value]) => `data-${esc(key)}=\"${esc(value)}\"`).join(" ")
    const title = availability.title || `${command.label}${command.shortcut ? ` · ${command.shortcut}` : ""}`
    const disabled = availability.blocked
    return `<button class="ribbon-command ${disabled ? "ribbon-disabled" : ""}" ${target} data-command-id="${esc(command.id)}" data-shortcut="${esc(command.shortcut)}" data-qestima-permission="${esc(command.permission)}" data-qestima-feature="${esc(command.feature)}" ${data} ${disabled ? "disabled aria-disabled=\"true\"" : ""} title="${esc(title)}">${icon(command.icon)}<b>${esc(localizeRibbon(command.label, command.labelAr))}</b>${command.shortcut ? `<small>${esc(command.shortcut)}</small>` : ""}</button>`
  }

  function renderRibbonGroup(group, tabId) {
    const width = Number(ribbonLayout[`${tabId}.${group.title}`])
    const style = Number.isFinite(width) && width > 0 ? ` style="--ribbon-group-width:${Math.max(100, Math.min(360, width))}px"` : ""
    return `<div class="ribbon-group" data-ribbon-group="${esc(group.title)}"${style}><span>${esc(localizeRibbon(group.title, group.titleAr))}</span><div>${group.commands.map(renderRibbonCommand).join("")}</div></div>`
  }

  function renderRibbon() {
    $$("#ribbon-tabs [data-tab]").forEach((button) => {
      const active = button.dataset.tab === activeRibbonTab
      button.classList.toggle("active", active)
      button.setAttribute("aria-selected", String(active))
      button.tabIndex = active ? 0 : -1
    })
    $$("#command-ribbon [data-ribbon-panel]").forEach((panel) => {
      const active = panel.dataset.ribbonPanel === activeRibbonTab
      panel.classList.toggle("active", active)
      panel.hidden = !active
      const tab = ribbonConfig.find((entry) => entry.id === panel.dataset.ribbonPanel)
      if (tab) {
        panel.setAttribute("aria-label", `${tab.label} commands`)
        panel.innerHTML = tab.groups.map((group) => renderRibbonGroup(group, tab.id)).join("")
      }
    })
  }

  function handleRibbonKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    const tabs = $$("#ribbon-tabs .ribbon-tab")
    if (!tabs.length) return
    const current = tabs.indexOf(document.activeElement)
    if (current < 0) return
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + direction + tabs.length) % tabs.length
    event.preventDefault()
    tabs[next].focus()
    tabs[next].click()
  }

  function handleRibbonShortcut(event) {
    const modifier = event.ctrlKey || event.metaKey ? "Ctrl" : event.altKey ? "Alt" : event.shiftKey ? "Shift" : ""
    if (!modifier) return false
    const wanted = `${modifier}+${String(event.key || "").toUpperCase()}`
    const command = ribbonConfig.flatMap((tab) => tab.groups.flatMap((group) => group.commands)).find((entry) => String(entry.shortcut || "").toUpperCase() === wanted)
    if (!command) return false
    const button = $(`#command-ribbon [data-command-id="${command.id}"]`)
    if (!button || button.disabled) return false
    event.preventDefault()
    button.click()
    return true
  }

  function handleWorkspaceTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    const tabs = $$("#workspace-tabs .workspace-tab")
    const current = tabs.indexOf(event.currentTarget)
    if (current < 0) return
    const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + direction + tabs.length) % tabs.length
    event.preventDefault()
    tabs[next]?.focus?.()
    tabs[next]?.click?.()
  }

  // Bind the two permanent navigation surfaces directly as a fallback for
  // browser/application shells that do not bubble delegated clicks reliably.
  function bindStaticNavigation() {
    $$("#ribbon-tabs .ribbon-tab").forEach((button) => {
      button.addEventListener("click", handleClick)
      button.addEventListener("keydown", handleRibbonKeydown)
      button.addEventListener("dblclick", toggleRibbonCollapsed)
    })
    $$("#main-nav [data-view]").forEach((button) => {
      button.addEventListener("click", handleClick)
    })
    const ribbon = $("#command-ribbon")
    ribbon?.addEventListener("contextmenu", (event) => {
      const button = closestElement(event.target, "[data-command-id]")
      if (!button) return
      event.preventDefault()
      const command = findRibbonCommand(button.dataset.commandId)
      if (!command || !window.confirm?.(`إخفاء الأمر ${localizeRibbon(command.label, command.labelAr)} من الـRibbon؟ يمكن إعادته من الإعدادات.`)) return
      ribbonHiddenCommands = unique([...ribbonHiddenCommands, command.id])
      persistUiState(); renderRibbon(); scheduleSave()
    })
    ribbon?.addEventListener("dblclick", (event) => {
      const group = closestElement(event.target, "[data-ribbon-group]")
      if (!group || !closestElement(event.target, "span")) return
      const tabId = group.closest("[data-ribbon-panel]")?.dataset.ribbonPanel || activeRibbonTab
      const groupName = group.dataset.ribbonGroup || "Group"
      const current = Number(ribbonLayout[`${tabId}.${groupName}`]) || 0
      const value = window.prompt?.("عرض مجموعة الأوامر بالبكسل (100–360)", String(current || 160))
      const width = Number(value)
      if (!Number.isFinite(width) || width < 100 || width > 360) return
      ribbonLayout[`${tabId}.${groupName}`] = width
      persistUiState(); renderRibbon(); scheduleSave()
    })
  }

  function renderOpenNavigation() {
    if (!state.settings.openEdition) return
    document.body?.classList.add("open-edition")
    const labels = { projects: "المشروعات", documents: "مستندات المناقصة", tender_review: "مراجعة المتطلبات", boq: "جدول الكميات والتسعير", quantity_review: "مراجعة الكميات", drawings: "الرسومات والحصر", analysis: "تحليل الأسعار", resources: "مكتبة الموارد", suppliers: "عروض الموردين", markup: "الإضافات والربح", quality: "المراجعة النهائية", reports: "التقارير والتصدير" }
    $$("#main-nav [data-view]").forEach(button => {
      const label = labels[button.dataset.view]
      button.hidden = !label
      if (label) { const span = button.querySelector("span"); if (span) span.textContent = label }
    })
    $$("#main-nav .nav-section").forEach((node, index) => { node.textContent = ["١ · المشروع", "٢ · المستندات", "٣ · الحصر والتسعير", "٤ · المراجعة والتسليم"][index] || "" })
    $$('#main-nav [data-action="report-problem"], [data-action="logout"], [data-action="reactivate-license"], [data-ribbon-tab="administration"]').forEach(button => { button.hidden = true })
  }

  function renderShell() {
    renderOpenNavigation()
    const project = currentProject()
    const health = C.projectHealth(project, state.resources)
    const tender = C.tenderHealth(project, state.resources)
    const workspace = C.activeWorkspace(state)
    const user = C.activeUser(state) || state.user
    const verified = project.tenderSummary.filter((field) => field.verified && field.value).length
    const reviewProgress = project.tenderReview.completedAt ? 100 : Math.round((verified / Math.max(project.tenderSummary.length, 1)) * 70 + ((5 - tender.missingCategories.length) / 5) * 30)
    renderLicenseIndicator()
    $("#workspace-switcher").innerHTML = state.workspaces.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === workspace?.id ? "selected" : ""}>${esc(entry.name)}</option>`).join("")
    $("#workspace-mode").textContent = workspace?.type === "company" ? `Company · ${workspace.syncStatus === "server_not_connected" ? "Server not connected" : "Central"}` : "Personal · Local"
    $("#project-switcher").innerHTML = state.projects.filter((entry) => entry.workspaceId === workspace?.id && C.can(state, "project.view", entry)).map((entry) => `<option value="${esc(entry.id)}" ${entry.id === project.id ? "selected" : ""}>${esc(entry.name)}</option>`).join("")
    $("#sidebar-progress-bar").style.width = `${health.progress}%`
    $("#sidebar-progress-text").textContent = `${health.progress}% مكتمل · ${health.pricedCount}/${health.totalItems} بند`
    $("#nav-unpriced").textContent = health.unpriced.length
    $("#nav-documents").textContent = tender.documentCount
    $("#nav-risks").textContent = tender.openRisks.length
    $("#nav-review-state").textContent = tender.reviewComplete ? "مكتمل" : "ناقص"
    $("#page-title").textContent = viewTitles[activeView]
    $("#user-name").textContent = user?.name || state.user.name
    $("#user-initials").textContent = user?.initials || state.user.initials || "QS"
    $$("#main-nav [data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === activeView))
    $("#undo-btn").disabled = !undoStack.length
    $("#redo-btn").disabled = !redoStack.length
    $("#theme-btn").innerHTML = icon(state.settings.theme === "dark" ? "sun" : "moon")
    document.documentElement.dataset.theme = state.settings.theme
    document.documentElement.lang = state.settings.language === "en" ? "en" : "ar"
    document.documentElement.dir = state.settings.language === "en" ? "ltr" : "rtl"
    $("#ribbon-stack")?.setAttribute("dir", state.settings.language === "en" ? "ltr" : "rtl")
    $("#app-shell").classList.toggle("inspector-hidden", inspectorHidden)
    $("#app-shell").classList.toggle("ribbon-collapsed", ribbonCollapsed)
    $("#workspace").dataset.view = activeView
    $("#workspace-tabs")?.setAttribute?.("role", "tablist")
    $("#workspace-tabs")?.setAttribute?.("aria-label", "Open workspaces")
    $("#workspace-tabs").innerHTML = openTabs.map((view) => `<div class="workspace-tab ${view === activeView ? "active" : ""}" role="tab" aria-selected="${view === activeView}" tabindex="${view === activeView ? "0" : "-1"}" data-tab="${view}" title="${esc(viewTitles[view])}"><span>${esc(viewTitles[view])}</span>${openTabs.length > 1 ? `<button data-action="close-tab" data-view="${view}" title="إغلاق">${icon("x")}</button>` : ""}</div>`).join("")
    $$("#workspace-tabs .workspace-tab").forEach((tab) => tab.addEventListener("keydown", handleWorkspaceTabKeydown))
    renderRibbon()
    renderContextualRibbon()
    $("#status-project-code").textContent = project.tenderCode
    $("#status-pricing").textContent = `BOQ Pricing ${health.progress}%`
    $("#status-review").textContent = `Tender Review ${reviewProgress}%`
    $("#status-currency").textContent = `${project.currency} · VAT ${C.number(project.tax)}%`
    $("#status-unpriced").textContent = `${health.unpriced.length} Unpriced`
    $("#status-save").textContent = "AutoSave On"
  }

  function captureWorkspaceScroll() {
    const root = $("#workspace")
    if (!root || !state) return
    const viewState = { top: root.scrollTop || 0, left: root.scrollLeft || 0, nested: {} }
    const selectors = [".table-wrap", ".item-list", ".drawing-list", ".dimension-list", ".stage-canvas"]
    selectors.forEach((selector) => $$(selector, root).forEach((element, index) => { viewState.nested[`${selector}:${index}`] = { top: element.scrollTop || 0, left: element.scrollLeft || 0 } }))
    workspaceScroll[activeView] = viewState
  }

  function restoreWorkspaceScroll() {
    const root = $("#workspace")
    const viewState = workspaceScroll[activeView]
    if (!root || !viewState) return
    root.scrollTop = Number(viewState.top) || 0
    root.scrollLeft = Number(viewState.left) || 0
    const nested = viewState.nested || {}
    Object.entries(nested).forEach(([key, position]) => {
      const separator = key.lastIndexOf(":")
      const selector = key.slice(0, separator); const index = Number(key.slice(separator + 1)); const element = $$(selector, root)[index]
      if (!element) return
      element.scrollTop = Number(position.top) || 0
      element.scrollLeft = Number(position.left) || 0
    })
  }

  function bindWorkspaceScroll() {
    const root = $("#workspace")
    if (!root) return
    root.onscroll = () => { captureWorkspaceScroll(); persistUiState(); scheduleSave() }
    $$(".table-wrap, .item-list, .drawing-list, .dimension-list, .stage-canvas", root).forEach((element) => { element.onscroll = () => { captureWorkspaceScroll(); persistUiState(); scheduleSave() } })
  }

  function render() {
    if ($("#login-screen") && !isAuthenticated) return
    const focused = document.activeElement
    const editor = focused && ["INPUT", "TEXTAREA", "SELECT"].includes(focused.tagName) && $("#workspace")?.contains?.(focused)
    const identity = editor ? { id: focused.id, data: { ...focused.dataset }, start: focused.selectionStart, end: focused.selectionEnd } : null
    captureWorkspaceScroll()
    persistUiState()
    renderShell()
    const renderers = { dashboard: renderDashboard, control: renderControl, projects: renderProjects, documents: renderTenderDocuments, tender_review: renderTenderReview, scope: renderScope, boq: renderBoq, quantity_review: renderQuantityReview, analysis: renderAnalysis, resources: renderResources, suppliers: renderSuppliers, markup: renderMarkup, risks: renderRisks, quality: renderQuality, decisions: renderDecisions, reports: renderReports, drawings: renderDrawings, models: renderModels, owner_portal: renderOwnerPortal, revisions: renderRevisions }
    $("#workspace").innerHTML = (renderers[activeView] || renderDashboard)()
    bindWorkbenchControls()
    if (identity) {
      const replacement = $$("input, textarea, select", $("#workspace")).find((element) => identity.id ? element.id === identity.id : Object.keys(identity.data).length && Object.entries(identity.data).every(([key, value]) => element.dataset[key] === value))
      replacement?.focus?.({ preventScroll: true })
      if (replacement && typeof identity.start === "number") { try { replacement.setSelectionRange(identity.start, identity.end) } catch {} }
    }
    bindWorkspaceScroll()
    restoreWorkspaceScroll()
    if (activeView === "drawings") setTimeout(() => { restoreWorkspaceScroll(); loadDrawingPage() }, 0)
  }

  function pageHead(title, description, actions = "") {
    return `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="page-actions no-print">${actions}</div></div>`
  }

  function bindWorkbenchControls() {
    const workspace = $("#workspace")
    if (!workspace) return
    // Until implemented, dock labels must not pretend to be interactive.
    $$(".dock-tabs button", workspace).forEach((button) => {
      if (!button.dataset.action && !button.dataset.view) {
        button.disabled = true
        button.title = button.classList.contains("active") ? "اللوحة الحالية" : "غير متاح في هذه النسخة"
      }
    })
    if (activeView === "projects") {
      const search = $(".table-toolbar input", workspace)
      const status = $(".table-toolbar select", workspace)
      const apply = () => {
        let visible = 0
        $$(".project-list-table tbody tr", workspace).forEach((row) => {
          const id = row.querySelector(".project-open")?.dataset.id
          const project = state.projects.find((entry) => entry.id === id)
          if (!project) return
          const haystack = [project.name, project.client, project.consultant, project.location, project.tenderCode].join(" ").toLocaleLowerCase()
          const statusMatch = !projectStatusFilter || (projectStatusFilter === "active" ? !["submitted", "awarded", "lost", "archived"].includes(project.status) : project.status === projectStatusFilter)
          row.hidden = !statusMatch || !haystack.includes(projectSearch.toLocaleLowerCase())
          if (!row.hidden) visible++
        })
        const count = $(".table-toolbar .badge", workspace)
        if (count) count.textContent = `${visible} Projects`
      }
      if (search) { search.id = "project-search"; search.value = projectSearch; search.oninput = () => { projectSearch = search.value; apply() } }
      if (status) { status.id = "project-status-filter"; [...status.options].forEach((option, index) => { option.value = ["", "active", "submitted", "awarded", "lost"][index] }); status.value = projectStatusFilter; status.onchange = () => { projectStatusFilter = status.value; apply() } }
      $$(".project-list-table tbody tr", workspace).forEach((row) => {
        const opener = row.querySelector(".project-open")
        if (!opener) return
        row.tabIndex = 0
        row.onclick = (event) => { if (!event.target.closest("button, input, select, a")) opener.click() }
        row.onkeydown = (event) => { if (event.key === "Enter" && event.target === row) opener.click() }
      })
      apply()
    }
    const dock = $(".drawing-right-dock", workspace)
    if (dock) { dock.style.resize = "horizontal"; dock.style.overflow = "auto" }
    if (activeView === "models") {
      const table = $(".model-elements-table", workspace)
      if (table) {
        const count = (currentProject().ifcModels?.find((entry) => entry.id === activeModelId)?.elements || []).length
        const pager = document.createElement("div")
        pager.className = "page-actions"
        pager.innerHTML = `<button data-action="model-page-prev" ${modelPage === 0 ? "disabled" : ""}>Previous</button><span>Page ${modelPage + 1} / ${Math.max(1, Math.ceil(count / 250))}</span><button data-action="model-page-next" ${(modelPage + 1) * 250 >= count ? "disabled" : ""}>Next</button>`
        table.parentElement.before(pager)
      }
    }
  }

  function kpi(label, value, hint, iconName, tone = "") {
    return `<article class="kpi-card ${tone}"><div class="kpi-top"><span>${esc(label)}</span><span class="kpi-icon">${icon(iconName)}</span></div><strong>${value}</strong><small>${esc(hint)}</small></article>`
  }

  function renderDashboardLegacy() {
    const project = currentProject()
    const scenario = currentScenario(project)
    const totals = C.calculateProject(project, state.resources, scenario)
    const health = C.projectHealth(project, state.resources)
    const tender = C.tenderHealth(project, state.resources)
    const stale = C.staleResources(state.resources, state.settings.stalePriceDays)
    const tenderAlert = tender.key === "documents_missing"
      ? `<div class="alert-strip danger">${icon("alert")}<div><strong>Tender Documents Missing</strong><small>يمكن بدء BOQ في Quick Pricing Mode، لكن السعر النهائي يحتاج مراجعة الرسومات والمواصفات والشروط.</small></div><button class="secondary-btn small-btn" data-view="documents">رفع المستندات</button></div>`
      : !tender.reviewComplete
        ? `<div class="alert-strip">${icon("clock")}<div><strong>Tender Documents Review Incomplete</strong><small>العمل غير متوقف، لكن ${tender.missingCategories.length} تصنيفات أساسية تحتاج مراجعة أو توثيق.</small></div><button class="secondary-btn small-btn" data-view="tender_review">استكمال المراجعة</button></div>`
        : `<div class="alert-strip success">${icon("check")}<div><strong>Tender Intake & Review مكتمل</strong><small>تم تثبيت مصادر الشروط والنطاق قبل اعتماد السعر النهائي.</small></div></div>`
    const alert = health.unpriced.length
      ? `<div class="alert-strip danger">${icon("alert")}<div><strong>يوجد ${health.unpriced.length} بند غير مسعّر</strong><small>لن يكون سعر العرض النهائي آمنًا قبل إغلاق البنود الناقصة.</small></div><button class="secondary-btn small-btn" data-action="show-unpriced">مراجعة البنود</button></div>`
      : stale.length
        ? `<div class="alert-strip">${icon("clock")}<div><strong>${stale.length} سعر قديم يحتاج مراجعة</strong><small>حد تنبيه الأسعار مضبوط على ${state.settings.stalePriceDays} يومًا.</small></div><button class="secondary-btn small-btn" data-view="resources">فتح المكتبة</button></div>`
        : `<div class="alert-strip success">${icon("check")}<div><strong>التسعير مكتمل ولا توجد بنود صفرية</strong><small>راجع السيناريو النهائي واحفظ Revision قبل التقديم.</small></div></div>`
    const sectionTotals = unique(project.boq.map((item) => item.section)).map((section) => {
      const total = project.boq.filter((item) => item.section === section).reduce((sum, item) => sum + C.effectiveQuantity(item) * C.itemCostUnit(project, item, state.resources), 0)
      return { section, total }
    }).sort((a, b) => b.total - a.total)
    const maxSection = Math.max(...sectionTotals.map((entry) => entry.total), 1)
    const audits = (project.audit || []).slice(0, 6)
    return `
      ${pageHead(project.name, `${project.tenderCode} · ${project.client || "بدون عميل"} · ${project.location || "الموقع غير محدد"} · Revision ${project.revisionNo || 0}`, `
        <button class="secondary-btn" data-view="projects">${icon("folder")} المشاريع</button>
        <button class="secondary-btn" data-action="edit-project" data-id="${project.id}">${icon("edit")} بيانات المشروع</button>
        <button class="secondary-btn" data-action="save-revision">${icon("history")} حفظ Revision</button>
        <button class="primary-btn" data-view="boq">${icon("table")} استكمال التسعير</button>`)}
      ${tenderAlert}
      ${alert}
      <section class="kpi-grid">
        ${kpi("التكلفة المباشرة", money(totals.direct), `${health.pricedCount} بند مسعّر`, "calculator")}
        ${kpi("سعر العرض قبل الضريبة", money(totals.beforeVat), scenario.name, "report", "success")}
        ${kpi("البنود غير المسعّرة", `${health.unpriced.length}`, health.unpriced.length ? "تحتاج إجراء فوري" : "جميع البنود مغلقة", "alert", health.unpriced.length ? "danger" : "success")}
        ${kpi("طلبات الأسعار المنتظرة", `${health.pendingRfqs}`, `${project.quotes.length} عروض مسجلة`, "users", health.pendingRfqs ? "warning" : "success")}
      </section>
      <div class="card" style="margin-bottom:14px">
        <div class="card-head"><div><h2>دورة العمل المعتمدة</h2><p>Standard Workflow للمراجعة الكاملة، وQuick Mode يبدأ من BOQ مع تحذير واضح.</p></div><span class="badge teal">${project.workflowMode === "quick" ? "Quick Mode" : "Standard Mode"}</span></div>
        <div class="card-body"><img class="workflow-svg" src="tender-workflow.svg" alt="دورة QESTIMA من إنشاء المشروع ومراجعة المناقصة حتى العرض النهائي" /></div>
      </div>
      <div class="layout-2">
        <div>
          <section class="card">
            <div class="card-head"><div><h2>ملخص التكلفة حسب القسم</h2><p>التأثير محسوب من أسعار الموارد الحالية داخل تحليلات البنود.</p></div><button class="ghost-btn small-btn" data-view="reports">عرض التقرير</button></div>
            <div class="card-body">
              ${sectionTotals.length ? sectionTotals.map((entry) => `<div style="display:grid;grid-template-columns:120px 1fr 120px;gap:10px;align-items:center;margin:10px 0"><strong style="font-size:10px">${esc(entry.section)}</strong><div class="project-progress" style="margin:0;background:var(--surface-3)"><span style="width:${entry.total / maxSection * 100}%"></span></div><span class="num" style="font-size:10px;font-weight:700">${money(entry.total)}</span></div>`).join("") : `<div class="empty-state"><p>أضف بنود BOQ لعرض توزيع التكلفة.</p></div>`}
            </div>
          </section>
          <section class="card">
            <div class="card-head"><div><h2>سلسلة التأثير المركزي</h2><p>أي تعديل في المصدر ينتقل فورًا حتى إجمالي المشروع.</p></div></div>
            <div class="card-body"><div class="formula-line" style="justify-content:center;font-size:11px"><b>سعر المورد</b><i>←</i><b>المورد داخل التحليل</b><i>←</i><b>سعر البند</b><i>←</i><b>إجمالي القسم</b><i>←</i><b>سعر المشروع</b></div></div>
          </section>
        </div>
        <div>
          <section class="card">
            <div class="card-head"><div><h2>اكتمال التسعير</h2><p>نسبة البنود ذات السعر الفعلي.</p></div></div>
            <div class="card-body">
              <div class="progress-ring" style="--p:${health.progress}"><div><strong>${health.progress}%</strong><span>مكتمل</span></div></div>
              <div class="mini-stats"><div class="mini-stat"><strong>${health.totalItems}</strong><span>إجمالي البنود</span></div><div class="mini-stat"><strong>${health.pricedCount}</strong><span>مسعّر</span></div><div class="mini-stat"><strong>${health.unpriced.length}</strong><span>ناقص</span></div></div>
            </div>
          </section>
          <section class="card">
            <div class="card-head"><div><h2>آخر التغييرات</h2><p>من عدّل ماذا ومتى.</p></div></div>
            <div class="card-body"><div class="timeline">${audits.length ? audits.map((entry) => `<div class="timeline-item"><strong>${esc(entry.action)}</strong><span>${esc(entry.user)} · ${dateLabel(entry.date)}</span></div>`).join("") : `<p class="field-hint">لا توجد تغييرات مسجلة.</p>`}</div></div>
          </section>
        </div>
      </div>`
  }

  function renderDashboard() {
    const project = currentProject()
    const scenario = currentScenario(project)
    const totals = C.calculateProject(project, state.resources, scenario)
    const health = C.projectHealth(project, state.resources)
    const tender = C.tenderHealth(project, state.resources)
    const verified = project.tenderSummary.filter((field) => field.verified && field.value).length
    const documentProgress = Math.round(((5 - tender.missingCategories.length) / 5) * 100)
    const reviewProgress = project.tenderReview.completedAt ? 100 : Math.round((verified / Math.max(project.tenderSummary.length, 1)) * 100)
    const scopeComplete = project.scopeMatrix.filter((row) => ["complete", "not_applicable"].includes(C.scopeStatus(row))).length
    const scopeProgress = Math.round(scopeComplete / Math.max(project.scopeMatrix.length, 1) * 100)
    const commercialProgress = Math.round(((project.scenarios.length ? 45 : 0) + (project.revisionNo ? 25 : 0) + (project.risks.every((risk) => risk.status === "closed") ? 30 : 0)))
    const readiness = Math.round(health.progress * .45 + reviewProgress * .25 + scopeProgress * .15 + commercialProgress * .15)
    const attention = []
    if (tender.missingCategories.length) attention.push({ tone: "danger", title: `${tender.missingCategories.length} Tender document categories missing`, detail: tender.missingCategories.map((key) => documentCategoryLabels[key]).join(" · "), view: "documents" })
    if (health.unpriced.length) attention.push({ tone: "danger", title: `${health.unpriced.length} BOQ items are unpriced`, detail: "أغلق البنود صفر السعر قبل إصدار العرض.", action: "show-unpriced" })
    if (tender.scopeGaps.length) attention.push({ tone: "warning", title: `${tender.scopeGaps.length} scope gaps need review`, detail: "راجع BOQ gaps والرسومات والمواصفات.", view: "scope" })
    if (health.pendingRfqs) attention.push({ tone: "warning", title: `${health.pendingRfqs} RFQs awaiting response`, detail: `${project.quotes.length} quotations recorded`, view: "suppliers" })
    if (!attention.length) attention.push({ tone: "success", title: "No critical pricing blockers", detail: "راجع السيناريو واحفظ Revision قبل التقديم.", view: "markup" })
    const readinessItem = (label, value, tone = "") => `<article class="readiness-item ${tone}"><header><span>${esc(label)}</span><strong>${value}%</strong></header><div class="bar"><span style="width:${value}%"></span></div></article>`
    return `
      ${pageHead(project.name, `${project.tenderCode} · ${project.client || "بدون عميل"} · ${project.location || "الموقع غير محدد"} · R${project.revisionNo || 0}`, `
        <button class="secondary-btn small-btn" data-action="edit-project" data-id="${project.id}">${icon("edit")} Project Data</button>
        <button class="secondary-btn small-btn" data-action="save-revision">${icon("history")} Save Revision</button>
        <button class="primary-btn small-btn" data-view="boq">${icon("table")} Open Pricing Sheet</button>`)}
      <section class="readiness-grid">
        ${readinessItem("BOQ Pricing", health.progress, health.progress < 100 ? "danger" : "")}
        ${readinessItem("Tender Review", reviewProgress, reviewProgress < 100 ? "warning" : "")}
        ${readinessItem("Scope Review", scopeProgress, scopeProgress < 100 ? "warning" : "")}
        ${readinessItem("Submission Readiness", readiness, readiness < 70 ? "danger" : readiness < 100 ? "warning" : "")}
      </section>
      <section class="kpi-grid compact-kpis">
        ${kpi("Direct Cost", money(totals.direct), `${health.pricedCount}/${health.totalItems} priced`, "calculator")}
        ${kpi("Selling Before VAT", money(totals.beforeVat), scenario.name, "report", "success")}
        ${kpi("Unpriced Items", `${health.unpriced.length}`, health.unpriced.length ? "Action required" : "Closed", "alert", health.unpriced.length ? "danger" : "success")}
        ${kpi("Pending RFQs", `${health.pendingRfqs}`, `${project.quotes.length} quotations`, "users", health.pendingRfqs ? "warning" : "success")}
      </section>
      <div class="layout-2">
        <section class="card">
          <div class="card-head"><div><h2>What Needs Attention</h2><p>العناصر التي تؤثر مباشرةً على جاهزية السعر.</p></div><span class="badge ${readiness === 100 ? "green" : "amber"}">${readiness}% Ready</span></div>
          <div class="attention-list">${attention.map((entry) => `<div class="attention-row"><span class="${entry.tone}">${icon(entry.tone === "danger" ? "alert" : entry.tone === "success" ? "check" : "clock")}</span><div><strong>${esc(entry.title)}</strong><small>${esc(entry.detail)}</small></div><button class="ghost-btn small-btn" ${entry.view ? `data-view="${entry.view}"` : `data-action="${entry.action}"`}>Open</button></div>`).join("")}</div>
        </section>
        <section class="card">
          <div class="card-head"><div><h2>Project Control</h2><p>حالة المشروع بدون خلطها بنسبة تسعير الـBOQ.</p></div></div>
          <div class="card-body"><div class="totals-table"><div class="total-row"><span>Workflow</span><strong>${project.workflowMode === "quick" ? "Quick" : "Standard"}</strong></div><div class="total-row"><span>Tender Status</span><strong>${esc(tenderStatusLabels[tender.key])}</strong></div><div class="total-row"><span>Scenario</span><strong>${esc(scenario.name)}</strong></div><div class="total-row"><span>Deadline</span><strong>${dateLabel(project.deadline)}</strong></div><div class="total-row emphasis"><span>Current Revision</span><strong>R${project.revisionNo || 0}</strong></div></div></div>
        </section>
      </div>`
  }

  function renderControl() {
    const project = currentProject()
    const scenario = currentScenario(project)
    const control = C.tenderControl(project, state, scenario)
    const daysLabel = control.daysLeft == null ? "—" : control.daysLeft < 0 ? `${Math.abs(control.daysLeft)} days overdue` : `${control.daysLeft} days`
    const statusTone = control.readiness >= 90 ? "green" : control.readiness >= 65 ? "amber" : "red"
    const cards = [
      ["Days to submission", daysLabel, project.deadline ? dateLabel(project.deadline) : "No deadline", "clock", control.daysLeft != null && control.daysLeft < 7 ? "danger" : ""],
      ["Tender Readiness", `${control.readiness}%`, `${control.quality.counts.blocker} blockers · ${control.quality.counts.high} high`, "check", statusTone === "red" ? "danger" : statusTone === "amber" ? "warning" : "success"],
      ["Unpriced Items", control.pricing.unpriced.length, `${control.pricing.pricedCount}/${control.pricing.totalItems} priced`, "alert", control.pricing.unpriced.length ? "danger" : "success"],
      ["Pending Quotations", control.pendingQuotes, `${project.rfqs.length} RFQs / ${project.quotes.length} quotes`, "users", control.pendingQuotes ? "warning" : "success"],
      ["Open Clarifications", control.tender.openRisks.length, "Technical + commercial", "alert", control.tender.openRisks.length ? "warning" : "success"],
      ["Approval Queue", (project.boq || []).filter((item) => item.workflowStatus === "under_review").length, "Items waiting for review", "lock", ""],
    ]
    const overdue = control.overdueAssignments
    const recent = (project.audit || []).slice(0, 8)
    return `<div class="control-center-shell">
      ${pageHead("Tender Control Center", `${esc(project.name)} · ${esc(project.tenderCode)} · Revision R${project.revisionNo || 0}`, `<button class="secondary-btn small-btn" data-view="quality">${icon("check")} Quality Gate</button><button class="primary-btn small-btn" data-view="decisions">${icon("percent")} What-If Analysis</button>`)}
      <section class="control-hero"><div><span class="eyebrow">TENDER READINESS</span><h2>${control.readiness}% ready for final review</h2><p>${control.pricing.unpriced.length} unpriced items · ${control.pendingQuotes} quotation follow-ups · ${control.tender.missingCategories.length} document categories missing</p></div><div class="readiness-gauge ${statusTone}"><strong>${control.readiness}%</strong><span>Readiness</span></div></section>
      <section class="kpi-grid control-kpis">${cards.map(([label, value, hint, iconName, tone]) => kpi(label, value, hint, iconName, tone)).join("")}</section>
      <div class="control-grid"><section class="card"><div class="card-head"><div><h2>Readiness by workstream</h2><p>الأرقام تساعدك على معرفة الخطوة التالية داخل المناقصة.</p></div><span class="badge ${statusTone}">${control.daysLeft == null ? "Deadline not set" : daysLabel}</span></div><div class="card-body"><div class="control-progress-row"><span>BOQ Pricing</span><strong>${control.pricing.progress}%</strong><div class="bar"><span style="width:${control.pricing.progress}%"></span></div></div><div class="control-progress-row"><span>Tender Review</span><strong>${control.review}%</strong><div class="bar"><span style="width:${control.review}%"></span></div></div><div class="control-progress-row"><span>Scope &amp; Systems</span><strong>${control.scope}%</strong><div class="bar"><span style="width:${control.scope}%"></span></div></div><div class="control-progress-row"><span>Quality Gate</span><strong>${control.quality.score}%</strong><div class="bar"><span style="width:${control.quality.score}%"></span></div></div><div class="control-progress-row"><span>Tender Review Gate</span><strong>${control.reviewGate.completed}/${control.reviewGate.total}</strong><div class="bar"><span style="width:${control.reviewGate.total ? control.reviewGate.completed / control.reviewGate.total * 100 : 0}%"></span></div></div></div></section>
        <section class="card"><div class="card-head"><div><h2>Work needing action</h2><p>المهام التي تمنع اعتماد العرض أو تحتاج متابعة.</p></div></div><div class="card-body attention-list">${control.pricing.unpriced.slice(0, 4).map((item) => `<div class="attention-row"><span class="danger">${icon("alert")}</span><div><strong>${esc(item.itemNo)} — ${esc(item.description)}</strong><small>Unpriced · ${esc(item.system || item.section || "MEP")}</small></div><button class="ghost-btn small-btn" data-action="open-analysis" data-id="${item.id}">Price</button></div>`).join("")}${control.tender.openRisks.slice(0, 3).map((risk) => `<div class="attention-row"><span class="warning">${icon("clock")}</span><div><strong>${esc(risk.title)}</strong><small>${esc(risk.type)} · ${esc(risk.severity)}</small></div><button class="ghost-btn small-btn" data-view="risks">Open</button></div>`).join("")}${overdue.slice(0, 2).map((assignment) => `<div class="attention-row"><span class="danger">${icon("clock")}</span><div><strong>${esc(assignment.discipline)} assignment overdue</strong><small>Due ${dateLabel(assignment.dueDate)}</small></div><button class="ghost-btn small-btn" data-view="quality">Review</button></div>`).join("")}${!control.pricing.unpriced.length && !control.tender.openRisks.length && !overdue.length ? `<div class="empty-state"><div class="empty-icon">${icon("check")}</div><h3>No critical actions</h3><p>راجع الـQuality Gate واحفظ Revision قبل التقديم.</p></div>` : ""}</div></section></div>
      <section class="card"><div class="card-head"><div><h2>Recent control activity</h2><p>سجل من عدّل ماذا ومتى — لا يتم حذف الإدخالات القديمة.</p></div><button class="ghost-btn small-btn" data-view="revisions">View Revisions</button></div><div class="card-body"><div class="timeline">${recent.map((entry) => `<div class="timeline-item"><strong>${esc(entry.action)}</strong><span>${esc(entry.user || "QESTIMA")} · ${dateLabel(entry.date)}</span></div>`).join("") || `<p class="field-hint">No activity yet.</p>`}</div></div>
    </div>`
  }

  function renderTenderReviewGate(project, scenario) {
    const gate = C.tenderReviewGate(project, state, scenario, { state })
    const viewByCode = { TENDER_REVIEW: "tender_review", SCOPE_MATRIX: "scope", ALL_PRICED: "boq", QUOTES_VALID: "suppliers", RISKS_APPROVED: "risks", MARKUP_APPROVED: "markup", FINAL_REVISION: "revisions" }
    return `<section class="card tender-gate-card"><div class="card-head"><div><h2>Tender Review Gate</h2><p>قائمة الاعتماد النهائية قبل إصدار العرض — لا تمنع Quick Pricing من البدء.</p></div><span class="badge ${gate.canSubmit ? "green" : "amber"}">${gate.completed}/${gate.total} complete</span></div><div class="gate-checklist">${gate.items.map((item) => `<div class="gate-check-row ${item.complete ? "complete" : "pending"}"><span class="gate-check-icon">${icon(item.complete ? "check" : "clock")}</span><div><strong>${esc(item.label)}</strong><small>${esc(item.detail)}</small></div>${item.complete ? `<span class="status-dot priced">Ready</span>` : `<button class="ghost-btn tiny-btn" data-view="${viewByCode[item.code] || "control"}">Open</button>`}</div>`).join("")}</div><div class="gate-footer"><span>Quality checker: <strong>${gate.quality.canSubmit ? "Passed" : "Needs attention"}</strong></span><span>${gate.canSubmit ? "Ready for final submission" : "Complete or formally waive the open checks"}</span></div></section>`
  }

  function renderQuality() {
    const project = currentProject()
    const scenario = currentScenario(project)
    const quality = C.pricingQuality(project, state.resources, scenario, { state })
    const reviewGate = C.tenderReviewGate(project, state, scenario, { state, quality })
    const findings = quality.findings
    const workflow = C.ITEM_WORKFLOW || ["not_started", "in_progress", "priced", "under_review", "approved", "locked"]
    const statusText = { not_started: "Not Started", in_progress: "In Progress", priced: "Priced", under_review: "Under Review", approved: "Approved", locked: "Locked" }
    const snapshotRows = (project.submissionSnapshots || []).slice(0, 5)
    return `<div class="quality-shell">${pageHead("Quality & Submission", `${esc(project.name)} · quality gate يمنع إرسال سعر غير مكتمل`, `<button class="secondary-btn small-btn" data-view="control">${icon("grid")} Control Center</button><button class="${reviewGate.canSubmit ? "primary-btn" : "secondary-btn"} small-btn" data-action="freeze-submission">${icon("lock")} Freeze Submission</button>`)}
      <section class="quality-score-panel"><div><span class="eyebrow">PRICING QUALITY SCORE</span><h2>${quality.score}% <small>${quality.canSubmit ? "Ready to submit" : "Needs attention"}</small></h2><p>${quality.counts.blocker} blockers · ${quality.counts.high} high · ${quality.counts.medium} medium · ${quality.counts.waived} waived</p></div><div class="quality-score-bar"><span style="width:${quality.score}%"></span></div><div class="quality-actions"><button class="secondary-btn small-btn" data-action="run-quality-check">Re-run Check</button><button class="ghost-btn small-btn" data-action="request-quality-waiver">Request Waiver</button></div></section>
      ${renderTenderReviewGate(project, scenario)}
      <div class="quality-grid"><section class="card"><div class="card-head"><div><h2>Pricing Quality Checker</h2><p>التحذيرات الاستشارية لا تعتمد أي سعر تلقائيًا.</p></div><span class="badge ${quality.canSubmit ? "green" : "red"}">${quality.canSubmit ? "Gate Passed" : "Blocked"}</span></div><div class="table-wrap"><table class="data-table quality-table"><thead><tr><th>Severity</th><th>Finding</th><th>Detail</th><th>Item</th><th>Status</th><th></th></tr></thead><tbody>${findings.map((finding) => `<tr class="${finding.waived ? "waived-row" : finding.severity === "blocker" ? "unpriced-row" : ""}"><td><span class="badge ${finding.severity === "blocker" ? "red" : finding.severity === "high" ? "amber" : "teal"}">${esc(finding.severity)}</span></td><td><strong>${esc(finding.title)}</strong><small class="price-source">${esc(finding.code)}</small></td><td class="desc">${esc(finding.detail)}</td><td>${esc(project.boq.find((item) => item.id === finding.itemId)?.itemNo || "Project")}</td><td><span class="status-dot ${finding.waived ? "priced" : "unpriced"}">${finding.waived ? "Waived" : "Open"}</span></td><td>${finding.waived ? "" : `<button class="ghost-btn tiny-btn" data-action="waive-quality" data-code="${esc(finding.code)}" data-item="${esc(finding.itemId || "")}">Waive</button>`}</td></tr>`).join("") || `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">${icon("check")}</div><h3>No findings</h3><p>Pricing checks are clear.</p></div></td></tr>`}</tbody></table></div></section>
        <aside class="quality-side"><section class="card"><div class="card-head"><div><h2>Item workflow</h2><p>تعيين ومراجعة واعتماد بدون استبدال تعديل شخص آخر.</p></div></div><div class="card-body quality-workflow-list">${project.boq.slice(0, 12).map((item) => `<div class="quality-item-row"><div><strong>${esc(item.itemNo)}</strong><small>${esc(item.description)}</small></div><select class="cell-select" data-boq-workflow="${item.id}">${workflow.map((key) => `<option value="${key}" ${(item.workflowStatus || (C.itemCostUnit(project, item, state.resources) > 0 ? "priced" : "not_started")) === key ? "selected" : ""}>${statusText[key]}</option>`).join("")}</select></div>`).join("") || `<p class="field-hint">No BOQ items.</p>`}</div></section>
        <section class="card"><div class="card-head"><div><h2>Frozen submissions</h2><p>Snapshot مغلق لا يتغير عند تعديل النسخة العاملة.</p></div><span class="badge teal">${snapshotRows.length}</span></div><div class="card-body">${snapshotRows.map((snapshot) => `<div class="snapshot-row"><strong>${esc(snapshot.label)}</strong><span>${dateLabel(snapshot.createdAt)} · ${esc(snapshot.createdBy)}</span><small>R${snapshot.revisionNo} · Quality ${snapshot.qualityScore}%</small></div>`).join("") || `<p class="field-hint">لم يتم إنشاء نسخة تسليم مغلقة.</p>`}</div></section></aside></div>
      <section class="card comments-card"><div class="card-head"><div><h2>Comments &amp; Mentions</h2><p>ملاحظات مرتبطة بالمشروع أو بند محدد مع مسؤول وموعد متابعة.</p></div><button class="primary-btn small-btn" data-action="add-comment">${icon("plus")} Add Comment</button></div><div class="card-body">${(project.comments || []).slice(0, 12).map((comment) => `<div class="comment-row"><span class="comment-avatar">${esc((comment.author || "Q").slice(0, 2).toUpperCase())}</span><div><strong>${esc(comment.text)}</strong><small>${comment.itemId ? `Item ${esc(project.boq.find((item) => item.id === comment.itemId)?.itemNo || comment.itemId)} · ` : ""}${esc(comment.author || "QESTIMA")} · ${dateLabel(comment.createdAt)}</small></div></div>`).join("") || `<p class="field-hint">لا توجد تعليقات. استخدم @Procurement أو @Commercial داخل ملاحظتك.</p>`}</div></section>
    </div>`
  }

  function renderDecisions() {
    const project = currentProject()
    const scenario = currentScenario(project)
    const draft = { materialPercent: 0, laborPercent: 0, equipmentPercent: 0, subcontractorPercent: 0, contingencyPercent: 0, supplierDiscountPercent: 0, currencyFactor: 1, alternateQuoteId: "", profitOverride: scenario.profitPercent, targetPrice: 0, ...(project.decisionDraft || {}) }
    const whatIf = C.applyWhatIf(project, state.resources, scenario, draft)
    const target = C.targetPriceOptimizer(project, state.resources, scenario, draft.targetPrice)
    const field = (label, key, value, suffix = "%") => `<label class="decision-field"><span>${esc(label)}</span><div><input type="number" step="0.25" data-decision-field="${key}" value="${C.number(value)}" /><b>${suffix}</b></div></label>`
    const alternateQuotes = latestQuotesBySupplier(project).map((quote) => `<option value="${esc(quote.id)}" ${quote.id === draft.alternateQuoteId ? "selected" : ""}>${esc(state.suppliers.find((entry) => entry.id === quote.supplierId)?.name || "Supplier")} · ${esc(quote.reference || quote.id)}</option>`).join("")
    return `<div class="decisions-shell">${pageHead("What-If & Target Price", `${esc(project.name)} · السيناريو الأساسي ${esc(scenario.name)} لا يتغير حتى تحفظ قرارًا جديدًا`, `<button class="secondary-btn small-btn" data-action="reset-decision-draft">Reset</button><button class="primary-btn small-btn" data-action="save-decision-scenario">${icon("save")} Save Scenario</button>`)}
      <div class="decisions-grid"><section class="card"><div class="card-head"><div><h2>What-If sensitivity</h2><p>جرّب تغيرات السوق بدون تعديل السعر الأساسي أو لقطات الأسعار.</p></div><span class="badge teal">Draft only</span></div><div class="card-body"><div class="decision-fields">${field("Material rate change", "materialPercent", draft.materialPercent)}${field("Labor rate change", "laborPercent", draft.laborPercent)}${field("Equipment rate change", "equipmentPercent", draft.equipmentPercent)}${field("Subcontractor rate change", "subcontractorPercent", draft.subcontractorPercent)}${field("Contingency change", "contingencyPercent", draft.contingencyPercent)}${field("Supplier discount", "supplierDiscountPercent", draft.supplierDiscountPercent)}${field("Currency factor", "currencyFactor", draft.currencyFactor, "×")}${field("Profit override", "profitOverride", draft.profitOverride)}${field("Management target", "targetPrice", draft.targetPrice, project.currency)}<label class="decision-field"><span>Alternate supplier quote</span><div><select data-decision-field="alternateQuoteId"><option value="">Keep current selections</option>${alternateQuotes}</select></div></label></div></div></section>
        <aside class="card decision-result"><div class="card-head"><div><h2>Impact preview</h2><p>نتيجة مستقلة عن السيناريو المعتمد.</p></div></div><div class="card-body"><div class="decision-total"><span>Current before VAT</span><strong>${money(C.calculateProject(project, state.resources, scenario).beforeVat)}</strong></div><div class="decision-total highlight"><span>What-If before VAT</span><strong>${money(whatIf.totals.beforeVat)}</strong><small>${money(whatIf.totals.beforeVat - C.calculateProject(project, state.resources, scenario).beforeVat)} delta · margin ${num(whatIf.totals.trueMargin)}%</small></div><div class="decision-total"><span>What-If grand total</span><strong>${money(whatIf.totals.total)}</strong></div></div></aside></div>
      <section class="card target-panel"><div class="card-head"><div><h2>Target Price Optimizer</h2><p>حدد سعر الإدارة لمعرفة الفجوة وأعلى البنود تأثيرًا. لا يتم خفض أي بند تلقائيًا.</p></div><span class="badge ${draft.targetPrice && target.gap <= 0 ? "green" : "amber"}">${draft.targetPrice ? (target.gap <= 0 ? "Target achievable" : `${money(target.gap)} gap`) : "Enter target"}</span></div><div class="card-body"><div class="target-summary"><div><span>Current</span><strong>${money(target.currentPrice)}</strong></div><div><span>Target</span><strong>${draft.targetPrice ? money(target.targetPrice) : "—"}</strong></div><div><span>Required reduction</span><strong>${draft.targetPrice ? `${num(target.reductionPercent)}%` : "—"}</strong></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>Item</th><th>Description</th><th>Direct Cost</th><th>Share</th><th>Suggested action</th></tr></thead><tbody>${target.topImpactItems.map((item, index) => `<tr><td>${index + 1}</td><td><strong>${esc(item.itemNo)}</strong></td><td class="desc">${esc(item.description)}</td><td class="num">${money(item.currentCost)}</td><td>${num(item.sharePercent)}%</td><td><button class="ghost-btn tiny-btn" data-action="open-analysis" data-id="${item.itemId}">Review rate</button></td></tr>`).join("") || `<tr><td colspan="6">No priced items yet.</td></tr>`}</tbody></table></div></div></section>
      <section class="card"><div class="card-head"><div><h2>Saved decision scenarios</h2><p>نسخ مستقلة للمقارنة والإدارة، ولا تغيّر السيناريو الأساسي.</p></div></div><div class="card-body">${(project.decisionScenarios || []).map((entry) => `<div class="snapshot-row"><strong>${esc(entry.name)}</strong><span>${dateLabel(entry.createdAt)} · ${money(entry.totals?.beforeVat || 0)}</span><small>${entry.changes?.materialPercent || 0}% material · ${entry.changes?.laborPercent || 0}% labor</small></div>`).join("") || `<p class="field-hint">لم يتم حفظ سيناريو What-If بعد.</p>`}</div></section>
    </div>`
  }

  function renderProjectsLegacy() {
    return `
      ${pageHead("إدارة المشاريع", "أنشئ مشروعًا جديدًا، انسخ مشروعًا سابقًا، واحفظ كل نسخة تسعير بدون فقد التاريخ.", `<button class="primary-btn" data-action="new-project">${icon("plus")} مشروع جديد</button>`)}
      <div class="project-grid">
        ${state.projects.map((project) => {
          const health = C.projectHealth(project, state.resources)
          const totals = C.calculateProject(project, state.resources, project.scenarios.find((s) => s.id === state.activeScenarioId) || project.scenarios[0])
          return `<article class="project-card ${project.id === state.activeProjectId ? "active" : ""}" data-action="select-project" data-id="${esc(project.id)}">
            <div class="project-card-head"><div><h3>${esc(project.name)}</h3><p>${esc(project.client || "بدون عميل")}</p></div><span class="badge ${project.status === "submitted" ? "green" : "teal"}">${esc(statusLabels[project.status] || project.status)}</span></div>
            <div class="meta"><div><strong>${money(totals.beforeVat, project.currency)}</strong><span>قيمة العرض</span></div><div><strong>${health.progress}%</strong><span>اكتمال التسعير</span></div><div><strong>R${project.revisionNo || 0}</strong><span>آخر Revision</span></div><div><strong>${dateLabel(project.deadline)}</strong><span>إغلاق المناقصة</span></div></div>
            <div class="bar"><span style="width:${health.progress}%"></span></div>
            <div class="card-actions" style="margin-top:13px"><button class="ghost-btn small-btn" data-action="edit-project" data-id="${esc(project.id)}">${icon("edit")} تعديل</button><button class="ghost-btn small-btn" data-action="copy-project" data-id="${esc(project.id)}">${icon("copy")} نسخ كبداية</button><button class="ghost-btn small-btn" data-action="project-revisions" data-id="${esc(project.id)}">${icon("history")} Revisions</button></div>
          </article>`
        }).join("")}
      </div>`
  }

  function renderProjects() {
    const workspace = C.activeWorkspace(state)
    const projects = state.projects.filter((project) => !workspace || project.workspaceId === workspace.id)
    const active = projects.filter((project) => !["submitted", "awarded", "lost", "archived"].includes(project.status)).length
    const submitted = projects.filter((project) => project.status === "submitted").length
    return `
      <div class="project-center-head"><div><h1>Projects Center</h1><p>${esc(workspace?.name || "Personal Workspace")} · ابحث وافتح وراجع جميع المناقصات من مكان واحد.</p></div><div class="page-actions"><button class="secondary-btn" data-action="open-building-selector">${icon("folder")} Select Project / Building</button><button class="primary-btn" data-action="new-project">${icon("plus")} Create Project</button></div></div>
      <section class="readiness-grid">
        ${kpi("All Projects", projects.length, "Accessible projects", "folder")}
        ${kpi("Active Pricing", active, "Draft / Pricing / Review", "calculator", "success")}
        ${kpi("Submitted", submitted, "Locked tender revisions", "check")}
        ${kpi("Shared Resources", state.resources.length, "Central price library", "library")}
      </section>
      <div class="project-center-layout">
        <section class="card">
          <div class="table-toolbar"><div class="filters"><label class="global-search" style="display:flex;width:290px"><svg><use href="#i-search"/></svg><input placeholder="Project, client, city or tender code…" /></label><select class="compact-select"><option>All Statuses</option><option>Active</option><option>Submitted</option><option>Awarded</option><option>Lost</option></select></div><span class="badge">${projects.length} Projects</span></div>
          <div class="table-wrap"><table class="data-table project-list-table"><thead><tr><th>Project</th><th>Code</th><th>Client / Consultant</th><th>Location</th><th>Deadline</th><th>Status</th><th>BOQ Progress</th><th>Offer Value</th><th>Revision</th><th></th></tr></thead><tbody>${projects.map((project) => {
            const health = C.projectHealth(project, state.resources)
            const scenario = project.scenarios.find((entry) => entry.id === state.activeScenarioId) || project.scenarios[0]
            const totals = C.calculateProject(project, state.resources, scenario)
            return `<tr class="${project.id === state.activeProjectId ? "selected" : ""}"><td class="desc"><button class="project-open" data-action="open-project-workspace" data-id="${project.id}">${esc(project.name)}</button><small class="price-source">${esc(project.projectType || "Commercial")}</small></td><td>${esc(project.tenderCode)}</td><td><strong>${esc(project.client || "—")}</strong><small class="price-source">${esc(project.consultant || "—")}</small></td><td>${esc(project.location || "—")}</td><td>${dateLabel(project.deadline)}</td><td><span class="badge ${project.status === "submitted" ? "green" : "teal"}">${esc(statusLabels[project.status] || project.status)}</span></td><td><strong>${health.progress}%</strong><div class="bar" style="height:3px;margin-top:4px;background:var(--surface-3)"><span style="display:block;height:100%;width:${health.progress}%;background:var(--teal)"></span></div></td><td class="num"><strong>${money(totals.beforeVat, project.currency)}</strong></td><td>R${project.revisionNo || 0}</td><td><div class="cell-actions"><button data-action="edit-project" data-id="${project.id}" title="Edit">${icon("edit")}</button><button data-action="copy-project" data-id="${project.id}" title="Copy">${icon("copy")}</button><button data-action="project-revisions" data-id="${project.id}" title="Revisions">${icon("history")}</button></div></td></tr>`
          }).join("") || `<tr><td colspan="10"><div class="empty-state"><h3>No projects in this workspace</h3><p>أنشئ أول مشروع أو ارجع إلى Personal Workspace.</p><button class="primary-btn" data-action="new-project">Create Project</button></div></td></tr>`}</tbody></table></div>
        </section>
        <aside class="quick-panel"><h2>Quick Start</h2><button class="quick-action" data-action="new-project">${icon("plus")}<div><strong>New Tender Project</strong><small>Standard or Quick workflow</small></div></button><button class="quick-action" data-action="open-import">${icon("upload")}<div><strong>Import BOQ</strong><small>Excel mapping and cleaning</small></div></button><button class="quick-action" data-view="resources">${icon("library")}<div><strong>Resource Library</strong><small>Materials, labor and rates</small></div></button><button class="quick-action" data-view="reports">${icon("report")}<div><strong>Reports Center</strong><small>Pricing and submission outputs</small></div></button><div class="alert-strip" style="margin-top:12px;margin-bottom:0"><div><strong>Universal Mode</strong><small>Local project data with portable JSON backup.</small></div></div></aside>
      </div>`
  }

  function documentOptions(project, selected = "", category = "") {
    return `<option value="">— اختر المستند المصدر —</option>${(project.documents || []).filter((document) => !category || document.category === category).map((document) => `<option value="${esc(document.id)}" ${document.id === selected ? "selected" : ""}>${esc(document.documentNumber || document.title)} · Rev ${esc(document.revision)}</option>`).join("")}`
  }

  function currentPdfDocuments(project = currentProject()) {
    return (project.documents || []).filter((document) => document.status !== "superseded" && String(document.fileType || "").toUpperCase() === "PDF")
  }

  function documentAnalysisStatus(document, project = currentProject()) {
    const analysis = project?.pdfAnalyses?.[document?.id]
    if (!analysis) return "Not analyzed"
    if (analysis.extractionMethod === "ocr") return `OCR · ${analysis.pageCount || 0} pages`
    return `Text · ${analysis.pageCount || 0} pages`
  }

  function renderDocumentIntelligencePanel(project) {
    const summary = C.documentIntelligenceSummary(project)
    const insights = (project.documentInsights || []).filter((entry) => entry.status !== "rejected" && entry.status !== "superseded").slice(0, 12)
    const pdfs = currentPdfDocuments(project)
    const documentCards = pdfs.map((document) => {
      const analysis = project.pdfAnalyses?.[document.id]
      const classification = analysis?.classification || { category: document.category, discipline: document.discipline }
      const method = analysis ? documentAnalysisStatus(document, project) : "Not analyzed"
      return `<article class="intelligence-document-row"><div class="intelligence-document-main"><span class="document-type-mark">${esc(document.fileType || "PDF")}</span><div><strong>${esc(document.title || document.originalName || "PDF")}</strong><small>${esc(document.documentNumber || "No document number")} · Rev ${esc(document.revision || "00")} · ${esc(classification.category || "instructions")} · ${esc(classification.discipline || "General")}</small>${analysis?.summary ? `<p>${esc(analysis.summary.slice(0, 240))}</p>` : ""}</div></div><div class="intelligence-document-actions"><span class="badge ${analysis ? "teal" : "amber"}">${esc(method)}</span><button class="secondary-btn tiny-btn" data-action="analyze-document" data-id="${esc(document.id)}">${analysis ? "Re-analyze" : "Analyze"}</button></div></article>`
    }).join("")
    return `<section class="card document-intelligence-card"><div class="card-head"><div><h2>PDF Document Intelligence</h2><p>قراءة النص وOCR وتصنيف المستندات اقتراحات موثقة بالمصدر؛ لا يتم تعديل Tender Review أو BOQ تلقائيًا.</p></div><div class="card-head-actions"><span class="badge teal">${summary.analyzed}/${Math.max(summary.documents, pdfs.length)} analyzed</span><button class="primary-btn small-btn" data-action="analyze-selected-pdf">Analyze PDF</button></div></div><div class="intelligence-status-grid"><div><span>Pending review</span><strong>${summary.pending}</strong></div><div><span>Approved</span><strong>${summary.approved}</strong></div><div><span>OCR runs</span><strong>${summary.ocr}</strong></div><div><span>Project-only index</span><strong>${summary.analyzed ? "Active" : "Waiting"}</strong></div></div>${pdfs.length ? `<div class="intelligence-document-list">${documentCards}</div>` : ""}${insights.length ? `<div class="table-wrap intelligence-queue"><table class="data-table"><thead><tr><th>Finding</th><th>Value</th><th>Source</th><th>Confidence</th><th>Review</th></tr></thead><tbody>${insights.map((insight) => { const source = project.documents.find((document) => document.id === insight.documentId); const review = insight.status === "approved" ? `<span class="badge green">Approved</span>${insight.appliedToTenderReview ? `<span class="badge teal">Applied</span>` : `<button class="primary-btn tiny-btn" data-action="apply-insight" data-id="${esc(insight.id)}">Apply to Review</button>`}` : `<button class="primary-btn tiny-btn" data-action="approve-insight" data-id="${esc(insight.id)}">Approve</button><button class="ghost-btn tiny-btn" data-action="reject-insight" data-id="${esc(insight.id)}">Reject</button>`; return `<tr><td><strong>${esc(insight.label)}</strong><small class="price-source">${esc(source?.title || source?.originalName || "PDF")}</small></td><td class="desc">${esc(insight.value)}</td><td>Page ${esc(insight.page || "—")}<small class="price-source">${esc(insight.sourceText || "")}</small></td><td><span class="badge ${C.number(insight.confidence) >= .8 ? "green" : "amber"}">${Math.round(C.number(insight.confidence) * 100)}%</span></td><td>${review}</td></tr>` }).join("")}</tbody></table></div>` : `<div class="empty-state compact-empty"><div class="empty-icon">${icon("check")}</div><h3>${pdfs.length ? "No pending PDF findings" : "Add a PDF to start"}</h3><p>${pdfs.length ? "Approved findings can be explicitly applied to Tender Review." : "Upload Tender Instructions, Commercial, Scope or Specifications as PDF."}</p></div>`}</section>`
  }

  function pdfAskModal() {
    openModal("Ask Project Documents", "البحث داخل ملفات PDF التي فهرسها هذا المشروع فقط. الإجابة استرشادية ومرفقة بالصفحة والمصدر.", `<form id="pdf-question-form"><div class="field"><label>Question or search phrase *</label><input name="query" required placeholder="مثال: What is the retention percentage?" /></div></form><div id="pdf-question-results" class="document-answer-results"></div>`, `<button class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn" type="submit" form="pdf-question-form">Search project documents</button>`, true)
  }

  function documentRevisionCompareModal() {
    const project = currentProject()
    // Revision comparison must include superseded source documents; the old
    // file remains immutable and is exactly what the engineer needs to compare
    // with the current addendum.
    const docs = (project.documents || []).filter((document) => String(document.fileType || "").toUpperCase() === "PDF" && project.pdfAnalyses?.[document.id])
    const options = docs.map((document) => `<option value="${esc(document.id)}">${esc(document.title || document.originalName)} · Rev ${esc(document.revision)}</option>`).join("")
    if (docs.length < 2) return toast("Revision comparison needs two analyzed PDFs", "حلّل Revision قديمة وجديدة أولًا.", "warning")
    openModal("Compare PDF Revisions", "يقارن النتائج النصية والحقول المستخرجة؛ النسخ الأصلية لا يتم استبدالها.", `<form id="pdf-compare-form"><div class="field-grid cols-2"><div class="field"><label>Previous revision</label><select name="beforeId">${options}</select></div><div class="field"><label>New revision</label><select name="afterId">${options}</select></div></div></form><div id="pdf-compare-results" class="document-answer-results"></div>`, `<button class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn" type="submit" form="pdf-compare-form">Compare</button>`, true)
  }

  async function analyzePdfDocument(document) {
    const project = currentProject()
    if (!document?.attachment?.id) return toast("لا يوجد ملف مرفق", "أعد رفع المستند من Document Register.", "warning")
    if (String(document.fileType || "").toUpperCase() !== "PDF") return inspectCadDocument(document)
    if (!window.qestimaDesktop?.extractPdfText) return toast("تحليل PDF الكامل متاح في تطبيق Windows", "نسخة المتصفح تحفظ المستندات، بينما استخراج النص وOCR يحتاجان محرك سطح المكتب.", "warning")
    toast("جاري تحليل PDF", `${document.title || document.originalName} — استخراج النص أو OCR…`, "success")
    let result
    try {
      result = window.qestimaDesktop.readPdfBytes && window.QESTIMAPdf ? await window.QESTIMAPdf.extract(document.attachment.id) : await window.qestimaDesktop.extractPdfText(document.attachment.id)
    } catch (error) { return toast("تعذر تحليل PDF", error.message, "error") }
    if (!result?.ok || !result.pages?.length) return toast("لم يتم استخراج نص", (result?.warnings || []).join(" ") || "تأكد من وجود Poppler/Tesseract أو استخدم PDF نصيًا.", "warning")
    const analysis = C.analyzeTenderDocument(document, result.pages, { method: result.method === "pdftoppm+tesseract" ? "ocr" : "pdftotext", ocrLanguages: ["ara", "eng"], warnings: result.warnings || [], analyzedBy: C.activeUser(state)?.name || state.user.name })
    commit(`تحليل PDF ${document.title || document.originalName}`, () => {
      project.pdfAnalyses ||= {}
      project.documentInsights ||= []
      const previous = project.documentInsights.filter((entry) => entry.documentId === document.id && entry.status === "pending")
      previous.forEach((entry) => { entry.status = "superseded"; entry.reviewRequired = false })
      project.pdfAnalyses[document.id] = analysis
      project.documentInsights.push(...analysis.insights)
      document.smartReadStatus = result.kind === "ocr" ? "ocr_complete" : "text_complete"
      document.smartReadMethod = analysis.extractionMethod
      document.smartReadAt = analysis.analyzedAt
      document.pdfPageCount = analysis.pageCount
    })
    toast("تم تحليل PDF", `${analysis.insights.length} نتيجة تحتاج Review Queue · ${analysis.extractionMethod === "ocr" ? "OCR" : "Text PDF"}`)
  }

  function renderTenderDocuments() {
    const project = currentProject()
    const tender = C.tenderHealth(project, state.resources)
    return `
      ${pageHead("Tender Documents", "ارفع ملفات منفردة أو مجلدًا أو ZIP؛ QESTIMA يقترح التصنيف ويحفظ كل Revision دون حذف السابق.", `
        <button class="secondary-btn" data-action="upload-tender-folder">${icon("folder")} رفع مجلد</button>
        <button class="secondary-btn" data-action="upload-tender-zip">${icon("attach")} رفع ZIP</button>
        <button class="secondary-btn" data-action="ask-project-docs">${icon("search")} Ask PDFs</button>
        <button class="primary-btn" data-action="upload-tender-files">${icon("upload")} إضافة ملفات</button>`)}
      <div class="intake-status ${tender.key}"><div><span>${project.workflowMode === "quick" ? "QUICK MODE" : "STANDARD WORKFLOW"}</span><strong>${tenderStatusLabels[tender.key]}</strong><small>${tender.documentCount} مستند · ${tender.missingCategories.length ? `ناقص: ${tender.missingCategories.map((key) => documentCategoryLabels[key]).join("، ")}` : "التصنيفات الأساسية موجودة"}</small></div><button class="secondary-btn small-btn" data-view="tender_review">فتح Tender Review</button></div>
      ${renderDocumentIntelligencePanel(project)}
      <section class="card">
        <div class="card-head"><div><h2>Document Register</h2><p>التعديلات تُحفظ تلقائيًا. أعلى Revision للمستند نفسه يصبح Current تلقائيًا.</p></div><span class="badge teal">${project.documents.length} Files</span></div>
        <div class="table-wrap" style="max-height:calc(100vh - 245px)"><table class="data-table document-register"><thead><tr><th>#</th><th>Document No.</th><th>Title / File</th><th>Category</th><th>Discipline</th><th>Rev.</th><th>Issue Date</th><th>Received</th><th>Type</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>
          ${project.documents.map((document, index) => `<tr class="${document.status === "superseded" ? "superseded-row" : ""}">
            <td class="num">${index + 1}</td>
            <td><input class="cell-input" data-document-id="${document.id}" data-field="documentNumber" value="${esc(document.documentNumber)}" placeholder="M-HVAC-204" /></td>
            <td class="desc"><input class="cell-input" data-document-id="${document.id}" data-field="title" value="${esc(document.title)}" /><small class="price-source">${esc(document.originalName || document.attachment?.name || "")}</small></td>
            <td><select class="cell-select" data-document-id="${document.id}" data-field="category">${C.DOCUMENT_CATEGORIES.map((key) => `<option value="${key}" ${key === document.category ? "selected" : ""}>${documentCategoryLabels[key]}</option>`).join("")}</select></td>
            <td><select class="cell-select" data-document-id="${document.id}" data-field="discipline">${C.DISCIPLINES.map((key) => `<option value="${key}" ${key === document.discipline ? "selected" : ""}>${key}</option>`).join("")}</select></td>
            <td><input class="cell-input" data-document-id="${document.id}" data-field="revision" value="${esc(document.revision)}" /></td>
            <td><input class="cell-input" type="date" data-document-id="${document.id}" data-field="issueDate" value="${esc(document.issueDate)}" /></td>
            <td><input class="cell-input" type="date" data-document-id="${document.id}" data-field="receivedDate" value="${esc(document.receivedDate)}" /></td>
            <td><span class="badge">${esc(document.fileType)}</span><small class="price-source">${esc(document.fileType === "PDF" ? documentAnalysisStatus(document, project) : "Indexed")}</small></td>
            <td><span class="badge ${document.latestRevision ? "green" : "amber"}">${document.latestRevision ? "Current" : `Superseded${document.supersededBy ? "" : ""}`}</span></td>
            <td><input class="cell-input" data-document-id="${document.id}" data-field="notes" value="${esc(document.notes)}" /></td>
            <td><div class="cell-actions"><button data-action="open-document" data-id="${document.attachment?.id || ""}" title="فتح الملف">${icon("attach")}</button>${document.fileType === "PDF" ? `<button data-action="analyze-document" data-id="${document.id}" title="قراءة PDF">${icon("search")}</button>` : ["DXF", "DWG"].includes(String(document.fileType || "").toUpperCase()) ? `<button data-action="inspect-cad" data-id="${document.id}" title="فحص CAD">${icon("search")}</button>` : ""}<button class="remove" data-action="delete-document" data-id="${document.id}" title="حذف السجل">${icon("trash")}</button></div></td>
          </tr>`).join("") || `<tr><td colspan="12"><div class="empty-state"><div class="empty-icon">${icon("upload")}</div><h3>لا توجد مستندات للمناقصة</h3><p>يمكنك رفع مجلد كامل أو ملفات منفردة. Quick Mode يسمح ببدء BOQ الآن مع بقاء تحذير المراجعة.</p><button class="primary-btn" data-action="upload-tender-files">رفع أول مستند</button></div></td></tr>`}
        </tbody></table></div>
      </section>`
  }

  function renderTenderReview() {
    const project = currentProject()
    const tender = C.tenderHealth(project, state.resources)
    const verified = project.tenderSummary.filter((field) => field.verified && field.value).length
    return `
      ${pageHead("Tender Intake & Review", "كل قيمة يجب أن ترتبط بمستند وصفحة؛ الاستخراج اقتراح فقط والاعتماد النهائي للمهندس.", `
        <button class="secondary-btn" data-view="documents">${icon("attach")} Document Register</button>
        <button class="${tender.reviewComplete ? "secondary-btn" : "primary-btn"}" data-action="${tender.reviewComplete ? "reopen-tender-review" : "complete-tender-review"}">${icon(tender.reviewComplete ? "history" : "check")} ${tender.reviewComplete ? "إعادة فتح المراجعة" : "اعتماد المراجعة"}</button>`)}
      ${tender.missingCategories.length ? `<div class="alert-strip danger">${icon("alert")}<div><strong>المراجعة تحتوي مستندات أساسية ناقصة</strong><small>${tender.missingCategories.map((key) => documentCategoryLabels[key]).join(" · ")}</small></div><button class="secondary-btn small-btn" data-view="documents">إضافة المستندات</button></div>` : ""}
      <section class="kpi-grid compact-kpis">
        ${kpi("المعلومات المعتمدة", `${verified}/${project.tenderSummary.length}`, "قيمة + مصدر + مراجعة", "check", verified === project.tenderSummary.length ? "success" : "warning")}
        ${kpi("المستندات الحالية", project.documents.filter((document) => document.latestRevision).length, `${project.documents.filter((document) => !document.latestRevision).length} نسخ superseded`, "attach")}
        ${kpi("فجوات النطاق", tender.scopeGaps.length, "تظهر في Scope Matrix", "alert", tender.scopeGaps.length ? "danger" : "success")}
        ${kpi("المخاطر المفتوحة", tender.openRisks.length, "Clarifications & Risks", "clock", tender.openRisks.length ? "warning" : "success")}
      </section>
      <section class="card">
        <div class="card-head"><div><h2>Tender Summary</h2><p>أدخل النتيجة المختصرة وحدد المصدر والصفحة ثم ضع علامة Verified بعد المراجعة.</p></div><span class="badge ${tender.reviewComplete ? "green" : "amber"}">${tender.reviewComplete ? `Approved · ${dateLabel(project.tenderReview.completedAt)}` : "Draft Review"}</span></div>
        <div class="review-grid">${project.tenderSummary.map((field) => `<article class="review-field ${field.verified ? "verified" : ""}">
          <div class="review-field-head"><strong>${esc(field.label)}</strong><label><input type="checkbox" data-summary-id="${field.id}" data-field="verified" ${field.verified ? "checked" : ""}/> Verified</label></div>
          <textarea class="cell-input" data-summary-id="${field.id}" data-field="value" placeholder="أدخل الملخص المستخرج…">${esc(field.value)}</textarea>
          <div class="source-fields"><select class="cell-select" data-summary-id="${field.id}" data-field="sourceDocumentId">${documentOptions(project, field.sourceDocumentId)}</select><input class="cell-input" data-summary-id="${field.id}" data-field="sourcePage" value="${esc(field.sourcePage)}" placeholder="Page 14" /></div>
          <small class="source-ref">${field.sourceDocumentId ? `Source: ${esc(project.documents.find((document) => document.id === field.sourceDocumentId)?.title || "Document")} — ${esc(field.sourcePage || "Page not set")}` : "Source not linked"}</small>
        </article>`).join("")}</div>
        <div class="card-body"><div class="field"><label>ملاحظات مراجعة المناقصة</label><textarea data-tender-review-field="notes" placeholder="ملاحظات عامة لا تظهر كسعر معتمد…">${esc(project.tenderReview.notes)}</textarea></div></div>
      </section>
      ${renderDocumentIntelligencePanel(project)}
      <section class="card document-review-tools"><div class="card-head"><div><h2>PDF review tools</h2><p>راجع نتائج القراءة، اسأل داخل مستندات المشروع، وقارن Addendum أو Revision بعد تحليلها.</p></div><div class="page-actions"><button class="secondary-btn small-btn" data-action="ask-project-docs">Ask project PDFs</button><button class="secondary-btn small-btn" data-action="compare-document-revisions">Compare revisions</button></div></div></section>`
  }

  function renderScope() {
    const project = currentProject()
    return `
      ${pageHead("Scope & Systems", "اكشف الأنظمة الموجودة في الرسومات أو المواصفات وغير المغطاة في BOQ قبل التسعير.", `<button class="secondary-btn" data-action="generate-scope-risks">${icon("alert")} إنشاء مخاطر للفجوات</button><button class="primary-btn" data-action="add-scope">${icon("plus")} إضافة System</button>`)}
      <section class="card"><div class="card-head"><div><h2>Scope Matrix</h2><p>الحالة محسوبة من In Scope وBOQ وDrawings وSpecifications.</p></div><span class="badge teal">${project.scopeMatrix.length} Systems</span></div>
        <div class="table-wrap"><table class="data-table"><thead><tr><th>System</th><th>داخل النطاق؟</th><th>BOQ</th><th>Drawings</th><th>Specifications</th><th>الحالة</th><th>Notes</th><th></th></tr></thead><tbody>${project.scopeMatrix.map((row) => {
          const status = C.scopeStatus(row)
          const labels = { complete: "Complete", clarification: "Clarification", boq_gap: "BOQ Gap", incomplete: "Incomplete", review: "Review", not_applicable: "N/A" }
          return `<tr><td><input class="cell-input" data-scope-id="${row.id}" data-field="system" value="${esc(row.system)}" /></td>
            <td><select class="cell-select" data-scope-id="${row.id}" data-field="inScope">${["yes","partial","no"].map((key) => `<option value="${key}" ${row.inScope === key ? "selected" : ""}>${scopeStateLabels[key]}</option>`).join("")}</select></td>
            <td><select class="cell-select" data-scope-id="${row.id}" data-field="boqStatus">${["yes","no","unknown","na"].map((key) => `<option value="${key}" ${row.boqStatus === key ? "selected" : ""}>${key === "yes" ? "Available" : key === "no" ? "Missing" : scopeStateLabels[key]}</option>`).join("")}</select></td>
            <td><select class="cell-select" data-scope-id="${row.id}" data-field="drawingsStatus">${["available","missing","unknown","na"].map((key) => `<option value="${key}" ${row.drawingsStatus === key ? "selected" : ""}>${scopeStateLabels[key]}</option>`).join("")}</select></td>
            <td><select class="cell-select" data-scope-id="${row.id}" data-field="specsStatus">${["available","missing","unknown","na"].map((key) => `<option value="${key}" ${row.specsStatus === key ? "selected" : ""}>${scopeStateLabels[key]}</option>`).join("")}</select></td>
            <td><span class="matrix-status ${status}">${labels[status]}</span></td><td><input class="cell-input" data-scope-id="${row.id}" data-field="notes" value="${esc(row.notes)}" /></td>
            <td><div class="cell-actions"><button class="remove" data-action="delete-scope" data-id="${row.id}">${icon("trash")}</button></div></td></tr>`
        }).join("") || `<tr><td colspan="8"><div class="empty-state"><h3>لا توجد أنظمة</h3><button class="primary-btn" data-action="add-scope">إضافة System</button></div></td></tr>`}</tbody></table></div>
      </section>`
  }

  function renderRisks() {
    const project = currentProject()
    const open = project.risks.filter((risk) => risk.status !== "closed")
    return `
      ${pageHead("Clarifications & Risks", "حوّل المستندات الناقصة وفجوات النطاق والتعارضات إلى سجل قابل للمتابعة والتصدير.", `<button class="secondary-btn" data-action="auto-detect-risks">${icon("search")} كشف الفجوات</button><button class="secondary-btn" data-action="export-clarifications">${icon("download")} Export Clarifications</button><button class="primary-btn" data-action="add-risk">${icon("plus")} إضافة</button>`)}
      <section class="risk-summary">${Object.entries(riskTypeLabels).map(([key, label]) => `<article><span>${esc(label)}</span><strong>${project.risks.filter((risk) => risk.type === key && risk.status !== "closed").length}</strong></article>`).join("")}</section>
      <section class="card"><div class="card-head"><div><h2>Risk & Clarification Register</h2><p>${open.length} عنصر مفتوح — لا يعتمد الذكاء الاصطناعي أي قرار بدل المهندس.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Type</th><th>Title</th><th>Description / Required Action</th><th>Severity</th><th>Source</th><th>Owner</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>${project.risks.map((risk) => {
        const source = project.documents.find((document) => document.id === risk.sourceDocumentId)
        return `<tr><td><span class="badge">${riskTypeLabels[risk.type] || risk.type}</span></td><td class="desc"><strong>${esc(risk.title)}</strong></td><td class="desc">${esc(risk.description || "—")}</td><td><span class="badge ${risk.severity === "high" ? "red" : risk.severity === "medium" ? "amber" : "teal"}">${esc(risk.severity)}</span></td><td>${source ? `${esc(source.documentNumber || source.title)} · ${esc(risk.sourcePage || "—")}` : "—"}</td><td>${esc(risk.owner || "—")}</td><td>${dateLabel(risk.dueDate)}</td><td><select class="cell-select" data-risk-id="${risk.id}" data-field="status"><option value="open" ${risk.status === "open" ? "selected" : ""}>Open</option><option value="sent" ${risk.status === "sent" ? "selected" : ""}>Sent</option><option value="answered" ${risk.status === "answered" ? "selected" : ""}>Answered</option><option value="closed" ${risk.status === "closed" ? "selected" : ""}>Closed</option></select></td><td><div class="cell-actions"><button class="remove" data-action="delete-risk" data-id="${risk.id}">${icon("trash")}</button></div></td></tr>`
      }).join("") || `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">${icon("check")}</div><h3>لا توجد مخاطر مسجلة</h3><p>شغّل كشف الفجوات لتحويل النواقص الحالية إلى سجل متابعة.</p><button class="primary-btn" data-action="auto-detect-risks">كشف الفجوات</button></div></td></tr>`}</tbody></table></div></section>`
  }

  function renderRevisions() {
    const project = currentProject()
    return `${pageHead("Revisions", "احفظ Snapshot مستقلًا قبل أي تغيير رئيسي واعرف بالضبط أي Revision تم التسعير عليه.", `<button class="secondary-btn" data-action="revision-impact">${icon("search")} Analyze Impact</button><button class="primary-btn" data-action="save-revision">${icon("history")} حفظ Revision جديد</button>`)}
      <section class="card"><div class="card-head"><div><h2>Pricing Revision History</h2><p>الاستعادة لا تحذف النسخة الحالية؛ تُنشئ نقطة رجوع في سجل التغييرات.</p></div><span class="badge teal">R${project.revisionNo || 0}</span></div><div class="card-body"><div class="timeline">${project.revisions.map((revision) => `<div class="timeline-item"><strong>${esc(revision.label || "Pricing Snapshot")}</strong><span>${dateLabel(revision.date)} · ${esc(revision.user || state.user.name)}</span><button class="ghost-btn small-btn" style="margin-top:7px" data-action="revision-impact" data-id="${revision.id}">Impact</button><button class="ghost-btn small-btn" style="margin-top:7px" data-action="restore-revision" data-id="${revision.id}" data-project="${project.id}">استعادة هذه النسخة</button></div>`).join("") || `<div class="empty-state"><h3>لم يتم حفظ أي Revision بعد</h3><p>احفظ أول Revision بعد اكتمال Tender Review وقبل تغيير الأسعار.</p></div>`}</div></div></section>`
  }

  function renderModels() {
    const project = currentProject()
    const models = Array.isArray(project.ifcModels) ? project.ifcModels : []
    if (!activeModelId || !models.some((model) => model.id === activeModelId)) activeModelId = models[0]?.id || ""
    const model = models.find((entry) => entry.id === activeModelId)
    const elements = model?.elements || (project.ifcElements || []).filter((entry) => entry.modelId === activeModelId)
    const mappings = project.ifcMappings || []
    const summary = model && Model.modelMappingSummary ? Model.modelMappingSummary(project, model.id) : { elements: elements.length, mapped: mappings.filter((entry) => entry.modelId === activeModelId && entry.status !== "rejected").length, approved: mappings.filter((entry) => entry.modelId === activeModelId && entry.status === "approved").length, pending: mappings.filter((entry) => entry.modelId === activeModelId && entry.status === "pending").length, unmapped: elements.filter((entry) => !mappings.some((candidate) => candidate.modelId === activeModelId && candidate.elementId === entry.elementId && candidate.status !== "rejected")).length }
    const modelOptions = models.map((entry) => `<option value="${esc(entry.id)}" ${entry.id === activeModelId ? "selected" : ""}>${esc(entry.fileName)} · Rev ${esc(entry.revision || entry.modelVersion || "01")}</option>`).join("")
    const boqOptions = `<option value="">— Unlinked —</option>${project.boq.map((item) => `<option value="${esc(item.id)}">${esc(item.itemNo)} · ${esc(item.description).slice(0, 48)}</option>`).join("")}`
    const assemblyOptions = `<option value="">— Rate Assembly —</option>${(state.rateAssemblies || []).map((entry) => `<option value="${esc(entry.id)}">${esc(entry.name)}</option>`).join("")}`
    modelPage = Math.min(modelPage, Math.max(0, Math.ceil(elements.length / 250) - 1))
    const rows = elements.slice(modelPage * 250, (modelPage + 1) * 250).map((element) => {
      const mapping = mappings.find((entry) => entry.modelId === activeModelId && entry.elementId === element.elementId && entry.status !== "rejected")
      const field = mapping?.quantityField || (element.quantities?.length ? "length" : element.quantities?.area ? "area" : element.quantities?.volume ? "volume" : "count")
      const quantity = C.number(element.quantities?.[field])
      return `<tr><td><strong>${esc(element.elementId)}</strong><small>${esc(element.ifcType || "IFC")}</small></td><td><strong>${esc(element.category)}</strong><small>${esc(element.family || "—")} · ${esc(element.typeName || "—")}</small></td><td>${esc(element.system || "—")}</td><td>${esc(element.level || "—")} / ${esc(element.zone || "—")}</td><td>${esc(element.size || "—")} · ${esc(element.material || "—")}</td><td class="num">${num(quantity)} ${esc(field)}</td><td><select class="cell-select" data-ifc-map="${esc(element.elementId)}" data-ifc-field="boqItemId">${boqOptions.replace(`value="${esc(mapping?.boqItemId || "")}"`, `value="${esc(mapping?.boqItemId || "")}" selected`)}</select></td><td><select class="cell-select" data-ifc-map="${esc(element.elementId)}" data-ifc-field="rateAssemblyId">${assemblyOptions.replace(`value="${esc(mapping?.rateAssemblyId || "")}"`, `value="${esc(mapping?.rateAssemblyId || "")}" selected`)}</select></td><td><select class="cell-select" data-ifc-map="${esc(element.elementId)}" data-ifc-field="quantityField">${["length", "area", "volume", "count"].map((key) => `<option value="${key}" ${field === key ? "selected" : ""}>${key}</option>`).join("")}</select></td><td><span class="badge ${mapping?.status === "approved" ? "green" : mapping?.status === "pending" ? "amber" : "red"}">${mapping?.status || "unmapped"}</span>${mapping ? `<div class="cell-actions"><button class="ghost-btn tiny-btn" data-action="ifc-approve-mapping" data-id="${esc(mapping.id)}">Approve</button><button class="ghost-btn tiny-btn" data-action="ifc-reject-mapping" data-id="${esc(mapping.id)}">Reject</button>${mapping.status === "approved" ? `<button class="primary-btn tiny-btn" data-action="ifc-apply-quantity" data-id="${esc(mapping.id)}">Apply qty</button>` : ""}</div>` : ""}</td></tr>`
    }).join("")
    return `<div class="model-workspace-shell">${pageHead("IFC & Model Mapping", `${esc(project.name)} · IFC quantities are advisory until engineer approval.`, `<button class="secondary-btn small-btn" data-action="import-ifc-model">${icon("upload")} Import IFC</button><button class="secondary-btn small-btn" data-action="compare-ifc-revisions" ${models.length < 2 ? "disabled" : ""}>${icon("history")} Compare revisions</button><button class="primary-btn small-btn" data-action="owner-sync-project">${icon("link")} Sync status</button>`)}
      <section class="model-banner"><div><span class="eyebrow">MODEL CONTROL</span><h2>${model ? esc(model.fileName) : "No IFC model imported"}</h2><p>${model ? `Schema ${esc(model.schema)} · Revision ${esc(model.revision || model.modelVersion)} · Imported ${dateLabel(model.importedAt)}` : "استورد ملف IFC لبدء Model Mapping. لا يتم تعديل BOQ تلقائيًا."}</p></div><select class="compact-select" data-model-select ${models.length ? "" : "disabled"}>${modelOptions || "<option>— لا توجد نماذج —</option>"}</select></section>
      <section class="kpi-grid compact-kpis">${kpi("Elements", summary.elements, `${summary.mapped} mapped`, "grid")} ${kpi("Unmapped", summary.unmapped, "needs BOQ link", "link", summary.unmapped ? "warning" : "success")} ${kpi("Pending review", summary.pending, "engineer approval", "clock", summary.pending ? "warning" : "success")} ${kpi("Approved mappings", summary.approved, "eligible for apply", "check", summary.approved ? "success" : "")}</section>
      <section class="card"><div class="card-head"><div><h2>Element Mapping</h2><p>Category · Family · Type · System · Level · Zone · Size · Material · quantities. اربط ثم راجع واعتمد قبل نقل الكمية.</p></div><span class="badge amber">AI / IFC Suggested — Review Required</span></div><div class="table-wrap"><table class="data-table model-elements-table"><thead><tr><th>Element ID / IFC type</th><th>Category / Family / Type</th><th>System</th><th>Level / Zone</th><th>Size / Material</th><th>Quantity</th><th>BOQ Item</th><th>Rate Assembly</th><th>Field</th><th>Mapping Status</th></tr></thead><tbody>${rows || `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">${icon("link")}</div><h3>لا توجد عناصر IFC</h3><p>استورد نموذج IFC صالحًا؛ ملف IFC يُحفظ كنسخة Revision ولا يستبدل كميات BOQ المعتمدة.</p></div></td></tr>`}</tbody></table></div></section>
      <section class="card"><div class="card-head"><div><h2>Model Revision History</h2><p>كل نموذج سابق يظل محفوظًا للمقارنة ولا يتم الكتابة فوقه.</p></div></div><div class="card-body"><div class="timeline">${(project.modelRevisions || []).map((revision) => `<div class="timeline-item"><strong>${esc(revision.fileName || revision.modelId || "IFC model")} · Rev ${esc(revision.revision || "01")}</strong><span>${esc(revision.elementCount || 0)} elements · ${dateLabel(revision.importedAt)} · ${revision.status === "current" ? "Current" : "Superseded"}</span></div>`).join("") || `<p class="field-hint">لم يتم استيراد Revision لنموذج بعد.</p>`}</div></div></section>
    </div>`
  }

  function renderOwnerPortal() {
    const tenantId = state.session?.tenantId || C.activeWorkspace(state)?.tenantId || ""
    const overview = Collab.ownerOverview ? Collab.ownerOverview(state, tenantId) : null
    const tenant = overview?.tenant || Collab.tenantFor?.(state, tenantId) || { name: "Local workspace", status: "active", plan: "Preview", maxUsers: 1, maxDevices: 1 }
    const usage = overview?.usage || { users: 0, devices: 0, maxUsers: tenant.maxUsers || 1, maxDevices: tenant.maxDevices || 1 }
    const license = overview?.license || C.licenseStatus(state)
    const api = state.central || {}
      return `<div class="owner-portal-shell">${pageHead("Owner Portal", `${esc(tenant.name)} · devices, seats, license, audit and sync control`, `<button class="secondary-btn small-btn" data-action="central-login">${icon("link")} Connect Central</button><button class="secondary-btn small-btn" data-action="central-health">${icon("check")} Check API</button><button class="secondary-btn small-btn" data-action="register-device">${icon("plus")} Register device</button><button class="secondary-btn small-btn" data-action="owner-sync-all">${icon("history")} Sync all projects</button><button class="primary-btn small-btn" data-action="request-support-access">Request support access</button>`)}
      <section class="owner-hero"><div><span class="eyebrow">TENANT CONTROL</span><h2>${esc(tenant.name)}</h2><p>${esc(tenant.type || "company")} · ${esc(tenant.plan || "Pilot")} · Tenant ID ${esc(tenant.id || tenantId)}</p></div><span class="badge ${tenant.status === "active" ? "green" : "red"}">${esc(tenant.status || "active")}</span></section>
      <section class="kpi-grid compact-kpis">${kpi("Seats", `${usage.users}/${usage.maxUsers}`, "active users", "users")} ${kpi("Devices", `${usage.devices}/${usage.maxDevices}`, "registered devices", "link")} ${kpi("License", license.daysLeft == null ? "—" : `${license.daysLeft} days`, license.status || "active", "clock", license.expired ? "danger" : "success")} ${kpi("Connection", api.connectionState || "local", api.lastSyncAt ? `last sync ${dateLabel(api.lastSyncAt)}` : "central sync not configured", "grid", api.connectionState === "central" ? "success" : "warning")}</section>
      <div class="owner-grid"><section class="card"><div class="card-head"><div><h2>Devices &amp; Seats</h2><p>آخر اتصال وإصدار البرنامج لكل جهاز. إلغاء الجهاز لا يحذف بياناته.</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Device</th><th>Platform</th><th>Status</th><th>App Version</th><th>Last Connection</th></tr></thead><tbody>${(state.devices || []).filter((device) => device.tenantId === tenantId).map((device) => `<tr><td>${esc(device.name || device.id)}<small>${esc(device.id)}</small></td><td>${esc(device.platform || "windows")}</td><td><span class="badge ${device.status === "active" ? "green" : "red"}">${esc(device.status)}</span></td><td>${esc(device.appVersion || "—")}</td><td>${dateLabel(device.lastConnectionAt)}</td></tr>`).join("") || `<tr><td colspan="5"><div class="empty-state compact-empty"><p>لا توجد أجهزة مسجلة محليًا بعد.</p></div></td></tr>`}</tbody></table></div></section>
        <section class="card"><div class="card-head"><div><h2>License Actions</h2><p>التحول إلى Read-Only عند التعليق أو انتهاء الصلاحية؛ لا يتم تعديل السعر.</p></div></div><div class="card-body owner-actions"><button class="secondary-btn" data-action="license-action" data-license-action="activate">Activate</button><button class="secondary-btn" data-action="license-action" data-license-action="extend">Extend 30 days</button><button class="danger-btn" data-action="license-action" data-license-action="suspend">Suspend</button><button class="danger-btn" data-action="license-action" data-license-action="revoke">Revoke</button><div class="field-hint">Valid to: ${esc(license.expiresAt ? dateLabel(license.expiresAt) : "—")} · Grace: ${esc(license.graceDays || license.offlineGraceDays || 0)} days</div></div></section></div>
      <div class="owner-grid"><section class="card"><div class="card-head"><div><h2>Sync Conflicts</h2><p>التعارضات لا تُستبدل تلقائيًا؛ راجع النسخة المحلية والبعيدة قبل الحل.</p></div><span class="badge ${overview?.openConflicts?.length ? "red" : "green"}">${overview?.openConflicts?.length || 0} open</span></div><div class="card-body">${(overview?.openConflicts || state.syncConflicts || []).filter((entry) => entry.tenantId === tenantId && entry.status === "open").map((conflict) => `<div class="attention-row"><span class="danger">${icon("alert")}</span><div><strong>${esc(conflict.projectId)}</strong><small>${esc((conflict.paths || []).join(", "))}</small></div><span class="badge amber">Resolve in project</span></div>`).join("") || `<div class="empty-state compact-empty"><p>لا توجد تعارضات مفتوحة.</p></div>`}</div></section>
        <section class="card"><div class="card-head"><div><h2>Central Audit</h2><p>سجل مركزي Append-only للعمل الجماعي والترخيص.</p></div></div><div class="card-body"><div class="timeline">${(overview?.lastAudit || state.centralAudit || []).filter((entry) => entry.tenantId === tenantId).slice(0, 10).map((entry) => `<div class="timeline-item"><strong>${esc(entry.action)}</strong><span>${esc(entry.actorId || entry.user || "QESTIMA")} · ${dateLabel(entry.timestamp || entry.date)}</span></div>`).join("") || `<p class="field-hint">لا توجد أحداث مركزية بعد.</p>`}</div></div></section></div>
      <div class="owner-footer-note"><span>${icon("lock")}</span><div><strong>Tenant isolation active</strong><small>الـAPI المركزي يجب تشغيله خلف TLS، مع مفاتيح سرية خارج التطبيق، ونسخ احتياطية ومراقبة قبل استخدامه تجاريًا.</small></div></div>
    </div>`
  }

  function renderBoqLegacy() {
    const project = currentProject()
    const health = C.projectHealth(project, state.resources)
    const sections = unique(project.boq.map((item) => item.section))
    const systems = unique(project.boq.map((item) => item.system))
    const floors = unique(project.boq.map((item) => item.floor))
    const rows = project.boq.filter((item) => {
      const search = filters.boqSearch.toLowerCase()
      const priced = C.itemCostUnit(project, item, state.resources) > 0
      return (!search || `${item.itemNo} ${item.description}`.toLowerCase().includes(search))
        && (!filters.section || item.section === filters.section)
        && (!filters.system || item.system === filters.system)
        && (!filters.floor || item.floor === filters.floor)
        && (!filters.pricing || (filters.pricing === "priced" ? priced : !priced))
    })
    return `
      ${pageHead("BOQ Pricing Sheet", `${project.boq.length} بند · ${health.unpriced.length} غير مسعّر · تعديل مباشر بطريقة تشبه Excel`, `
        <button class="secondary-btn" data-action="download-template">${icon("download")} نموذج Excel</button>
        <button class="secondary-btn" data-action="open-import">${icon("upload")} استيراد BOQ</button>
        <button class="primary-btn" data-action="add-boq">${icon("plus")} إضافة بند</button>`)}
      <section class="card">
        <div class="table-toolbar">
          <div class="filters">
            <label class="global-search" style="display:flex;width:230px;height:32px"><svg><use href="#i-search"/></svg><input data-filter="boqSearch" value="${esc(filters.boqSearch)}" placeholder="بحث في الكود أو الوصف" /></label>
            ${filterSelect("section", "كل الأقسام", sections, filters.section)}
            ${filterSelect("system", "كل الأنظمة", systems, filters.system)}
            ${filterSelect("floor", "كل الأدوار", floors, filters.floor)}
            <select class="compact-select" data-filter="pricing"><option value="">مسعّر وغير مسعّر</option><option value="priced" ${filters.pricing === "priced" ? "selected" : ""}>المسعّر فقط</option><option value="unpriced" ${filters.pricing === "unpriced" ? "selected" : ""}>غير المسعّر</option></select>
          </div>
          <span class="badge">${rows.length} نتيجة</span>
        </div>
        <div class="table-wrap" style="max-height:calc(100vh - 230px)">
          <table class="data-table">
            <thead><tr><th>#</th><th>Item No</th><th>الوصف</th><th>الوحدة</th><th>BOQ Qty</th><th>Pricing Qty</th><th>Variance</th><th>القسم</th><th>السيستم</th><th>الدور</th><th>طريقة التسعير</th><th>تكلفة الوحدة</th><th>الإجمالي</th><th>المراجع</th><th>الحالة</th><th></th></tr></thead>
            <tbody>${rows.map((item, index) => {
              const rate = C.itemCostUnit(project, item, state.resources)
              const priced = rate > 0
              const pricingQuantity = C.effectiveQuantity(item)
              const variance = C.number(item.takeoffQuantity) ? C.number(item.takeoffQuantity) - C.number(item.quantity) : 0
              return `<tr class="${priced ? "" : "unpriced-row"}">
                <td class="num">${index + 1}</td>
                <td><input class="cell-input" data-boq-id="${item.id}" data-field="itemNo" value="${esc(item.itemNo)}" /></td>
                <td class="desc"><input class="cell-input" data-boq-id="${item.id}" data-field="description" value="${esc(item.description)}" /></td>
                <td><input class="cell-input" data-boq-id="${item.id}" data-field="unit" value="${esc(item.unit)}" /></td>
                <td><input class="cell-input" type="number" data-boq-id="${item.id}" data-field="quantity" value="${C.number(item.quantity)}" /></td>
                <td class="num"><strong>${num(pricingQuantity)}</strong><small class="price-source">${item.quantityBasis === "takeoff" ? "Takeoff" : "BOQ"}</small></td>
                <td class="num"><span class="${variance ? "variance-value" : ""}">${variance > 0 ? "+" : ""}${num(variance)}</span></td>
                <td><input class="cell-input" data-boq-id="${item.id}" data-field="section" value="${esc(item.section)}" /></td>
                <td><input class="cell-input" data-boq-id="${item.id}" data-field="system" value="${esc(item.system)}" /></td>
                <td><input class="cell-input" data-boq-id="${item.id}" data-field="floor" value="${esc(item.floor)}" /></td>
                <td><select class="cell-select" data-boq-id="${item.id}" data-field="pricingMethod"><option value="analysis" ${item.pricingMethod === "analysis" ? "selected" : ""}>تحليل موارد</option><option value="supplier" ${item.pricingMethod === "supplier" ? "selected" : ""}>عرض مورد</option><option value="manual" ${item.pricingMethod === "manual" ? "selected" : ""}>سعر يدوي</option></select>${item.pricingMethod === "manual" ? `<input class="cell-input" style="margin-top:4px" type="number" data-boq-id="${item.id}" data-field="manualRate" value="${C.number(item.manualRate)}" />` : ""}</td>
                <td class="num"><strong>${money(rate)}</strong><small class="price-source">${esc(projectRateSource(project, item))}</small></td>
                <td class="num"><strong>${money(pricingQuantity * rate)}</strong></td>
                <td><small class="price-source">${item.drawingDocumentId ? "Drawing ✓" : "Drawing —"}<br>${item.specificationDocumentId ? "Spec ✓" : "Spec —"}<br>${item.sources?.quantity?.file ? `Qty: ${esc(item.sources.quantity.file)} · ${esc(item.sources.quantity.cell || "")}` : "Qty: manual / legacy"}</small></td>
                <td><span class="status-dot ${priced ? "priced" : "unpriced"}">${priced ? "مسعّر" : "ناقص"}</span></td>
                <td><div class="cell-actions"><button data-action="link-boq" data-id="${item.id}" title="ربط المستندات والحصر">${icon("attach")}</button><button data-action="open-analysis" data-id="${item.id}" title="فتح التحليل">${icon("calculator")}</button><button class="remove" data-action="delete-boq" data-id="${item.id}" title="حذف">${icon("trash")}</button></div></td>
              </tr>`
            }).join("")}</tbody>
          </table>
        </div>
      </section>`
  }

  function renderBoqInspector(project, item) {
    if (!item) return `<aside class="rate-inspector"><div class="empty-state"><h3>No BOQ item selected</h3><p>اختر بندًا لعرض تحليل السعر.</p></div></aside>`
    const analysis = project.analyses[item.id] || { lines: [], extras: C.defaultExtras() }
    const result = C.calculateAnalysis(analysis, state.resources)
    const rate = C.itemCostUnit(project, item, state.resources)
    const lines = analysis.lines.map((line) => ({ line, drift: C.snapshotDrift(line, state.resources) })).filter((entry) => entry.drift.resource)
    const matches = C.findHistoricalMatches(state, item, { projectId: project.id, limit: 3 })
    return `<aside class="rate-inspector">
      <div class="inspector-head"><span>UNIT RATE INSPECTOR · ${esc(item.itemNo)}</span><h2>${esc(item.description)}</h2><p>${esc(item.system || item.section)} · ${esc(item.unit)} · Pricing Qty ${num(C.effectiveQuantity(item))}</p></div>
      <div class="inspector-metrics"><div><span>Material</span><strong>${money(result.components.material)}</strong></div><div><span>Labor</span><strong>${money(result.components.labor)}</strong></div><div><span>Equipment + Subcontract</span><strong>${money(result.components.equipment + result.components.subcontractor)}</strong></div><div><span>Unit Direct Cost</span><strong>${money(rate)}</strong></div></div>
      <div class="inspector-lines">${lines.map(({ line, drift }) => `<div class="inspector-line"><header><b>${esc(drift.resource.code)} · ${esc(drift.resource.name)}</b><span>${num(line.factor, 3)} × ${money(drift.projectRate)}</span></header><small>${esc(drift.resource.type)} · ${esc(line.rateSnapshot?.source || drift.resource.sourceProject || "Resource Library")}</small>${drift.changed ? `<div class="rate-update"><div><b>New Rate Available</b><small>Project ${money(drift.projectRate)} → Library ${money(drift.latestRate)}</small></div><button data-action="update-rate-snapshot" data-line="${line.id}" data-item="${item.id}">Update</button></div>` : ""}</div>`).join("") || `<div class="empty-state"><h3>No rate build-up</h3><p>أضف مواد وعمالة ومعدات لهذا البند.</p></div>`}</div>
      <section class="historical-matches"><header><strong>Historical item matches</strong><span>Review before copying</span></header>${matches.map((match) => `<article><div><b>${esc(match.score)}% · ${esc(match.itemNo)}</b><small>${esc(match.projectName)} · ${esc(match.source)}</small></div><strong>${money(match.rate)}</strong><button class="ghost-btn tiny-btn" data-action="copy-historical-rate" data-item="${item.id}" data-rate="${match.rate}" data-match="${esc(match.itemNo)}">Review &amp; Copy</button>${match.differences.length ? `<small class="price-source">${esc(match.differences.join(" · "))}</small>` : ""}</article>`).join("") || `<p class="field-hint">No comparable historical item in this workspace.</p>`}</section>
      <div class="inspector-actions"><button class="secondary-btn small-btn" data-action="add-analysis-line">${icon("plus")} Add Resource</button><button class="secondary-btn small-btn" data-action="open-rate-assembly" data-item="${item.id}">${icon("library")} Rate Assembly</button><button class="primary-btn small-btn" data-action="open-analysis" data-id="${item.id}">${icon("calculator")} Full Analysis</button></div>
    </aside>`
  }

  function renderBoq() {
    const project = currentProject()
    const health = C.projectHealth(project, state.resources)
    const quality = C.pricingQuality(project, state.resources, currentScenario(project), { state })
    const gate = C.tenderReviewGate(project, state, currentScenario(project), { state, quality })
    const sections = unique(project.boq.map((item) => item.section))
    const systems = unique(project.boq.map((item) => item.system))
    const floors = unique(project.boq.map((item) => item.floor))
    const rows = project.boq.filter((item) => {
      const search = filters.boqSearch.toLowerCase()
      const priced = C.itemCostUnit(project, item, state.resources) > 0
      return (!search || `${item.itemNo} ${item.description}`.toLowerCase().includes(search))
        && (!filters.section || item.section === filters.section)
        && (!filters.system || item.system === filters.system)
        && (!filters.floor || item.floor === filters.floor)
        && (!filters.pricing || (filters.pricing === "priced" ? priced : !priced))
    })
    if (!project.boq.some((item) => item.id === activeItemId)) activeItemId = project.boq[0]?.id || null
    const selected = project.boq.find((item) => item.id === activeItemId)
    const directTotal = project.boq.reduce((sum, item) => sum + C.effectiveQuantity(item) * C.itemCostUnit(project, item, state.resources), 0)
    return `<div class="boq-pro-shell">
      <div class="boq-pro-head"><div><h1>BOQ Pricing Sheet</h1><p>${esc(project.name)} · ${project.boq.length} items · ${health.unpriced.length} unpriced · R${project.revisionNo || 0}</p></div><div class="page-actions"><button class="secondary-btn small-btn" data-action="download-template">${icon("download")} Template</button><button class="secondary-btn small-btn" data-action="open-import">${icon("upload")} Import Excel</button><button class="secondary-btn small-btn" data-action="bulk-edit-boq">Bulk Edit</button><button class="primary-btn small-btn" data-action="add-boq">${icon("plus")} Add Item</button></div></div>
      <section class="readiness-grid" style="margin:0">
        <article class="readiness-item"><header><span>Priced Items</span><strong>${health.pricedCount}/${health.totalItems}</strong></header><div class="bar"><span style="width:${health.progress}%"></span></div></article>
        <article class="readiness-item ${health.unpriced.length ? "danger" : ""}"><header><span>Unpriced</span><strong>${health.unpriced.length}</strong></header><div class="bar"><span style="width:${health.unpriced.length ? 100 : 0}%"></span></div></article>
        <article class="readiness-item"><header><span>Direct Cost</span><strong>${money(directTotal)}</strong></header><div class="bar"><span style="width:${health.progress}%"></span></div></article>
        <article class="readiness-item ${project.rfqs.some((rfq) => !["received", "closed"].includes(rfq.status)) ? "warning" : ""}"><header><span>Pending RFQs</span><strong>${health.pendingRfqs}</strong></header><div class="bar"><span style="width:${health.pendingRfqs ? 100 : 0}%"></span></div></article>
      </section>
      <section class="boq-intelligence-strip"><div class="boq-intelligence-title"><span class="eyebrow">ESTIMATING INTELLIGENCE</span><strong>Pricing workspace signals</strong><small>اقتراحات استشارية فقط — لا يتم اعتماد سعر أو كمية تلقائيًا.</small></div><div class="boq-intelligence-stat"><span>Quality</span><strong>${quality.score}%</strong><small>${quality.findings.length} checks</small></div><div class="boq-intelligence-stat"><span>Review Gate</span><strong>${gate.completed}/${gate.total}</strong><small>${gate.canSubmit ? "Ready" : "Open checks"}</small></div><div class="boq-intelligence-stat"><span>Historical links</span><strong>${project.boq.filter((item) => C.findHistoricalMatches(state, item, { projectId: project.id, limit: 1 }).length).length}</strong><small>items with prior rates</small></div><div class="boq-intelligence-actions"><button class="ghost-btn small-btn" data-view="quality">Run Quality</button><button class="ghost-btn small-btn" data-action="open-import">Smart Import</button></div></section>
      <div class="boq-pro-layout">
        <section class="pricing-grid-card">
          <div class="table-toolbar"><div class="filters"><label class="global-search" style="display:flex;width:225px;height:28px"><svg><use href="#i-search"/></svg><input data-filter="boqSearch" value="${esc(filters.boqSearch)}" placeholder="Find item or description…" /></label>${filterSelect("section", "All Sections", sections, filters.section)}${filterSelect("system", "All Systems", systems, filters.system)}${filterSelect("floor", "All Floors", floors, filters.floor)}<select class="compact-select" data-filter="pricing"><option value="">All Pricing Status</option><option value="priced" ${filters.pricing === "priced" ? "selected" : ""}>Priced</option><option value="unpriced" ${filters.pricing === "unpriced" ? "selected" : ""}>Unpriced</option></select></div><span class="badge">${rows.length} rows</span></div>
          <div class="table-wrap"><table class="data-table pricing-grid"><thead><tr><th>#</th><th>Item No.</th><th>Description</th><th>Unit</th><th>BOQ Qty</th><th>Takeoff Qty</th><th>Pricing Qty</th><th>Section</th><th>System</th><th>Material</th><th>Labor</th><th>Equip/Sub</th><th>Unit Cost</th><th>Total Cost</th><th>Method</th><th>Status</th><th></th></tr></thead><tbody>${rows.map((item, index) => {
            const analysis = project.analyses[item.id] || { lines: [], extras: C.defaultExtras() }
            const result = C.calculateAnalysis(analysis, state.resources)
            const rate = C.itemCostUnit(project, item, state.resources)
            const qty = C.effectiveQuantity(item)
            const priced = rate > 0
            const drift = analysis.lines.some((line) => C.snapshotDrift(line, state.resources).changed)
            return `<tr class="${item.id === activeItemId ? "active-row" : ""} ${priced ? "" : "unpriced-row"} ${drift ? "new-rate-row" : ""}"><td class="num">${index + 1}</td><td><button class="project-open" data-action="select-boq-inspector" data-id="${item.id}">${esc(item.itemNo)}</button></td><td class="desc"><input class="cell-input" data-boq-id="${item.id}" data-field="description" value="${esc(item.description)}" /></td><td><input class="cell-input" data-boq-id="${item.id}" data-field="unit" value="${esc(item.unit)}" /></td><td><input class="cell-input" type="number" data-boq-id="${item.id}" data-field="quantity" value="${C.number(item.quantity)}" /></td><td><input class="cell-input" type="number" data-boq-id="${item.id}" data-field="takeoffQuantity" value="${C.number(item.takeoffQuantity)}" /></td><td class="num"><strong>${num(qty)}</strong><small class="price-source">${item.quantityBasis === "takeoff" ? "Takeoff" : "BOQ"}</small></td><td><input class="cell-input" data-boq-id="${item.id}" data-field="section" value="${esc(item.section)}" /></td><td><input class="cell-input" data-boq-id="${item.id}" data-field="system" value="${esc(item.system)}" /></td><td class="num">${money(result.components.material)}</td><td class="num">${money(result.components.labor)}</td><td class="num">${money(result.components.equipment + result.components.subcontractor)}</td><td class="num"><strong>${money(rate)}</strong>${drift ? `<small class="price-source" style="color:var(--amber)">New rate available</small>` : ""}</td><td class="num"><strong>${money(qty * rate)}</strong></td><td><select class="cell-select" data-boq-id="${item.id}" data-field="pricingMethod"><option value="analysis" ${item.pricingMethod === "analysis" ? "selected" : ""}>Analysis</option><option value="supplier" ${item.pricingMethod === "supplier" ? "selected" : ""}>Supplier</option><option value="manual" ${item.pricingMethod === "manual" ? "selected" : ""}>Manual</option></select></td><td><span class="status-dot ${priced ? "priced" : "unpriced"}">${priced ? "Priced" : "Missing"}</span></td><td><div class="cell-actions"><button data-action="link-boq" data-id="${item.id}">${icon("attach")}</button><button data-action="open-analysis" data-id="${item.id}">${icon("calculator")}</button></div></td></tr>`
          }).join("") || `<tr><td colspan="17"><div class="empty-state"><h3>No BOQ items</h3><p>Import Excel or add the first pricing item.</p><button class="primary-btn" data-action="open-import">Import BOQ</button></div></td></tr>`}</tbody></table></div>
          <footer class="pricing-footer"><span>Visible: <strong>${rows.length}</strong></span><span>Priced: <strong>${health.pricedCount}</strong></span><span>Unpriced: <strong>${health.unpriced.length}</strong></span><span>Direct Cost: <strong>${money(directTotal)}</strong></span></footer>
        </section>
        ${renderBoqInspector(project, selected)}
      </div>
    </div>`
  }

  function filterSelect(key, placeholder, values, selected) {
    return `<select class="compact-select" data-filter="${key}"><option value="">${esc(placeholder)}</option>${values.map((value) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(value)}</option>`).join("")}</select>`
  }

  function renderAnalysis() {
    const project = currentProject()
    if (!project.boq.length) return `${pageHead("تحليل سعر الوحدة", "أنشئ بنود BOQ أولًا ثم اربط الموارد بكل بند.")}<div class="card empty-state"><div class="empty-icon">${icon("calculator")}</div><h3>لا توجد بنود للتحليل</h3><p>استورد ملف BOQ أو أضف بندًا جديدًا لبدء التحليل.</p><button class="primary-btn" data-view="boq">فتح BOQ</button></div>`
    if (!project.boq.some((item) => item.id === activeItemId)) activeItemId = project.boq[0].id
    const item = project.boq.find((entry) => entry.id === activeItemId)
    const analysis = project.analyses[item.id] || { lines: [], extras: C.defaultExtras() }
    const result = C.calculateAnalysis(analysis, state.resources)
    const map = Object.fromEntries(state.resources.map((resource) => [resource.id, resource]))
    const driftCount = analysis.lines.filter((line) => C.snapshotDrift(line, state.resources).changed).length
    const directLines = [
      ["Material", result.components.material], ["Labor", result.components.labor], ["Equipment", result.components.equipment], ["Subcontractor", result.components.subcontractor],
    ]
    const additions = [
      ["Waste", result.waste], ["Transport", result.transport], ["Accessories", result.accessories], ["Preliminaries", result.preliminaries],
      ["Escalation", result.escalation], ["Risk", result.risk], ["Item Overhead", result.overhead],
    ]
    return `<div class="analysis-pro-shell">
      <div class="workbench-head"><div><h1>Unit Rate Analysis</h1><p>${esc(project.name)} · الأسعار محفوظة كلقطة مستقلة داخل المناقصة</p></div><div class="page-actions"><button class="secondary-btn small-btn" data-action="copy-analysis">${icon("copy")} Copy Previous Analysis</button><button class="secondary-btn small-btn" data-view="resources">${icon("library")} Resource Library</button><button class="primary-btn small-btn" data-action="add-analysis-line">${icon("plus")} Add Resource</button></div></div>
      <div class="analysis-workbench">
        <aside class="analysis-navigator"><header><span>PROJECT BOQ</span><strong>${project.boq.length} Items</strong></header><div class="item-list">${project.boq.map((entry) => {
          const rate = C.itemCostUnit(project, entry, state.resources)
          return `<button class="${entry.id === item.id ? "active" : ""}" data-action="select-analysis-item" data-id="${entry.id}"><span class="status-dot ${rate > 0 ? "priced" : "unpriced"}"></span><div><strong>${esc(entry.itemNo)}</strong><span>${esc(entry.description)}</span></div><em>${rate ? money(rate) : "—"}</em></button>`
        }).join("")}</div></aside>
        <main class="analysis-sheet">
          <header class="sheet-title"><div><span>RATE BUILD-UP · ${esc(item.itemNo)}</span><h2>${esc(item.description)}</h2><p>${esc(item.system || item.section)} · UOM ${esc(item.unit)} · Pricing Qty ${num(C.effectiveQuantity(item))} (${item.quantityBasis === "takeoff" ? "Takeoff" : "BOQ"})</p></div><div><span class="status-dot ${result.costUnit > 0 ? "priced" : "unpriced"}">${result.costUnit > 0 ? "Priced" : "Unpriced"}</span>${driftCount ? `<span class="badge amber">${driftCount} New Rates</span>` : ""}</div></header>
          <div class="formula-line compact"><b>Direct Cost</b> = <i>Material</i> + <i>Labor</i> + <i>Equipment</i> + <i>Subcontractor</i></div>
          <div class="analysis-grid-wrap"><table class="data-table analysis-grid"><thead><tr><th>Cost Type</th><th>Resource Code</th><th>Description &amp; Source</th><th>UOM</th><th>Consumption / Unit</th><th>Project Rate</th><th>Line Cost</th><th></th></tr></thead><tbody>
              ${analysis.lines.map((line) => {
                const resource = map[line.resourceId]
                if (!resource) return ""
                const drift = C.snapshotDrift(line, state.resources)
                return `<tr class="${drift.changed ? "new-rate-row" : ""}"><td><span class="cost-type ${resource.type}">${esc(resourceTypeLabels[resource.type])}</span></td><td><strong>${esc(resource.code)}</strong></td><td class="desc"><strong>${esc(resource.name)}</strong><small class="price-source">${esc(line.rateSnapshot?.source || resource.sourceProject || "بدون مصدر")} · ${dateLabel(line.rateSnapshot?.capturedAt || resource.updatedAt)}</small></td><td>${esc(resource.unit)}</td><td><input class="cell-input" type="number" step="0.001" data-analysis-line="${line.id}" data-field="factor" value="${C.number(line.factor)}" /></td><td class="num"><div class="snapshot-rate"><strong>${money(drift.projectRate)}</strong>${drift.changed ? `<small class="rate-drift">Library ${money(drift.latestRate)}</small><button class="ghost-btn tiny-btn" data-action="update-rate-snapshot" data-line="${line.id}" data-item="${item.id}">Update</button>` : ""}</div></td><td class="num"><strong>${money(drift.projectRate * line.factor)}</strong></td><td><div class="cell-actions"><button class="remove" data-action="remove-analysis-line" data-id="${line.id}">${icon("trash")}</button></div></td></tr>`
              }).join("") || `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">${icon("library")}</div><h3>لا يوجد تحليل لهذا البند</h3><p>أضف مادة أو عمالة أو معدة أو مقاول باطن.</p><button class="primary-btn" data-action="add-analysis-line">إضافة أول مورد</button></div></td></tr>`}
            </tbody></table></div>
          <section class="rate-extras"><header><div><strong>Item Cost Additions</strong><span>خاصة بالبند قبل Markup المشروع</span></div><button class="ghost-btn tiny-btn" data-action="clear-analysis">Clear Analysis</button></header><div class="extras-grid">
              ${extraField("Waste", "wastePercent", analysis.extras?.wastePercent, true)}
              ${extraField("Transport / Unit", "transport", analysis.extras?.transport)}
              ${extraField("Accessories / Unit", "accessories", analysis.extras?.accessories)}
              ${extraField("Preliminaries", "prelimPercent", analysis.extras?.prelimPercent, true)}
              ${extraField("Escalation", "escalationPercent", analysis.extras?.escalationPercent, true)}
              ${extraField("Risk / Contingency", "riskPercent", analysis.extras?.riskPercent, true)}
              ${extraField("Item Overhead", "overheadPercent", analysis.extras?.overheadPercent, true)}
              ${extraField("Item Profit", "profitPercent", analysis.extras?.profitPercent, true)}
              ${extraField("Discount", "discountPercent", analysis.extras?.discountPercent, true)}
              ${extraField("VAT", "vatPercent", analysis.extras?.vatPercent, true)}
            </div></section>
        </main>
        <aside class="cost-ladder"><header><span>COST CALCULATION</span><strong>${money(result.costUnit)} / ${esc(item.unit)}</strong></header><div class="ladder-section"><label>Direct components</label>${directLines.map(([label, value]) => `<div><span>${label}</span><b>${money(value)}</b></div>`).join("")}<div class="ladder-total"><span>Direct Base</span><b>${money(result.base)}</b></div></div><div class="ladder-section"><label>Additions</label>${additions.map(([label, value]) => `<div><span>${label}</span><b>${money(value)}</b></div>`).join("")}<div class="ladder-total"><span>Cost Unit</span><b>${money(result.costUnit)}</b></div></div><div class="ladder-section selling"><div><span>Item Profit</span><b>${money(result.profit)}</b></div><div><span>Discount</span><b>-${money(result.discount)}</b></div><div class="ladder-total"><span>Selling / Unit</span><b>${money(result.sellingBeforeVat)}</b></div><div><span>VAT</span><b>${money(result.vat)}</b></div></div><footer><span>BOQ Total Cost</span><strong>${money(result.costUnit * C.effectiveQuantity(item))}</strong></footer></aside>
      </div>
    </div>`
  }

  function extraField(label, field, value, percent = false) {
    return `<div class="field"><label>${esc(label)}</label><div class="${percent ? "percent-input" : ""}"><input type="number" step="0.1" min="0" data-analysis-extra="${field}" value="${C.number(value)}" />${percent ? "<span>%</span>" : ""}</div></div>`
  }

  function renderResources() {
    const project = currentProject()
    const categories = unique(state.resources.map((resource) => resource.category))
    const stale = new Set(C.staleResources(state.resources, state.settings.stalePriceDays).map((resource) => resource.id))
    const rows = state.resources.filter((resource) => {
      const search = filters.resourceSearch.toLowerCase()
      return (!search || `${resource.code} ${resource.name} ${resource.supplierId || ""}`.toLowerCase().includes(search))
        && (!filters.resourceType || resource.type === filters.resourceType)
        && (!filters.resourceCategory || resource.category === filters.resourceCategory)
    })
    return `
      ${pageHead("مكتبة الأسعار والموارد", "قلب QESTIMA: السعر الواحد يمكن أن يغذي عشرات البنود مع تاريخ ومصدر وتأثير واضح.", `<button class="secondary-btn" data-action="export-resources">${icon("download")} تصدير المكتبة</button><button class="primary-btn" data-action="add-resource">${icon("plus")} مورد جديد</button>`)}
      ${stale.size ? `<div class="alert-strip">${icon("clock")}<div><strong>${stale.size} سعر تجاوز ${state.settings.stalePriceDays} يومًا</strong><small>راجع تاريخ ومصدر السعر قبل اعتماد العرض النهائي.</small></div></div>` : ""}
      <section class="card">
        <div class="table-toolbar"><div class="filters">
          <label class="global-search" style="display:flex;width:260px;height:32px"><svg><use href="#i-search"/></svg><input data-filter="resourceSearch" value="${esc(filters.resourceSearch)}" placeholder="بحث بالكود أو اسم المورد" /></label>
          <select class="compact-select" data-filter="resourceType"><option value="">كل أنواع التكلفة</option>${Object.entries(resourceTypeLabels).map(([value, label]) => `<option value="${value}" ${value === filters.resourceType ? "selected" : ""}>${label}</option>`).join("")}</select>
          ${filterSelect("resourceCategory", "كل التصنيفات", categories, filters.resourceCategory)}
        </div><span class="badge">${rows.length} مورد</span></div>
        <div class="table-wrap" style="max-height:calc(100vh - 235px)"><table class="data-table"><thead><tr><th>الكود</th><th>الاسم</th><th>النوع</th><th>تصنيف MEP</th><th>الوحدة</th><th>السعر الحالي</th><th>المورد</th><th>المنطقة</th><th>المصدر والتاريخ</th><th>الأثر الحالي</th><th></th></tr></thead><tbody>
          ${rows.map((resource) => {
            const supplier = state.suppliers.find((entry) => entry.id === resource.supplierId)
            const impact = C.resourceImpact(state, resource.id, project.id)
            return `<tr class="${stale.has(resource.id) ? "unpriced-row" : ""}">
              <td><input class="cell-input" data-resource-id="${resource.id}" data-field="code" value="${esc(resource.code)}" /></td>
              <td class="desc"><input class="cell-input" data-resource-id="${resource.id}" data-field="name" value="${esc(resource.name)}" /></td>
              <td><select class="cell-select" data-resource-id="${resource.id}" data-field="type">${Object.entries(resourceTypeLabels).map(([value, label]) => `<option value="${value}" ${value === resource.type ? "selected" : ""}>${label}</option>`).join("")}</select></td>
              <td><input class="cell-input" data-resource-id="${resource.id}" data-field="category" value="${esc(resource.category)}" /></td>
              <td><input class="cell-input" data-resource-id="${resource.id}" data-field="unit" value="${esc(resource.unit)}" /></td>
              <td><input class="cell-input" type="number" step="0.01" data-resource-id="${resource.id}" data-field="rate" value="${C.number(resource.rate)}" /></td>
              <td>${esc(supplier?.name || "معدل داخلي")}</td>
              <td><input class="cell-input" data-resource-id="${resource.id}" data-field="region" value="${esc(resource.region || "")}" /></td>
              <td><strong style="font-size:9px">${esc(resource.sourceProject || "بدون مصدر")}</strong><small class="price-source ${stale.has(resource.id) ? "badge amber" : ""}">${dateLabel(resource.updatedAt)}</small></td>
              <td><span class="badge ${impact.length ? "teal" : ""}">${impact.length} بنود</span></td>
              <td><div class="cell-actions"><button data-action="resource-history" data-id="${resource.id}" title="السجل">${icon("history")}</button><button class="remove" data-action="delete-resource" data-id="${resource.id}" title="حذف">${icon("trash")}</button></div></td>
            </tr>`
          }).join("")}</tbody></table></div>
      </section>`
  }

  function comparisonTargets(project) {
    const seen = new Map()
    project.quotes.forEach((quote) => (quote.items || []).forEach((line) => {
      const key = `${line.targetType}:${line.targetId}`
      if (!seen.has(key)) seen.set(key, { key, targetType: line.targetType, targetId: line.targetId })
    }))
    return [...seen.values()].map((target) => {
      const source = target.targetType === "resource" ? state.resources.find((entry) => entry.id === target.targetId) : project.boq.find((entry) => entry.id === target.targetId)
      return { ...target, code: target.targetType === "resource" ? source?.code : source?.itemNo, name: source?.name || source?.description || "عنصر غير موجود", unit: source?.unit || "", quantity: target.targetType === "boq" ? C.effectiveQuantity(source) : 1 }
    }).filter((entry) => entry.code || entry.name !== "عنصر غير موجود")
  }

  function latestQuotesBySupplier(project) {
    const map = new Map()
    ;[...project.quotes].sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach((quote) => map.set(quote.supplierId, quote))
    return [...map.values()]
  }

  function renderSuppliers() {
    const project = currentProject()
    const quotes = latestQuotesBySupplier(project)
    const targets = comparisonTargets(project)
    const pending = project.rfqs.filter((rfq) => !["received", "closed"].includes(rfq.status)).length
    const selectedCount = targets.filter((target) => target.targetType === "boq"
      ? project.boq.find((item) => item.id === target.targetId)?.selectedQuoteId
      : state.resources.find((resource) => resource.id === target.targetId)?.selectedQuoteId).length
    return `<div class="supplier-pro-shell">
      <div class="workbench-head"><div><h1>Supplier Comparison &amp; RFQ Control</h1><p>${esc(project.name)} · اختر المورد المناسب لكل بند، وليس موردًا واحدًا للعرض بالكامل</p></div><div class="page-actions"><button class="secondary-btn small-btn" data-action="add-supplier">${icon("plus")} Supplier</button><button class="secondary-btn small-btn" data-action="add-rfq">${icon("users")} New RFQ</button><button class="secondary-btn small-btn" data-action="add-quote">${icon("attach")} Register Quote</button><button class="primary-btn small-btn" data-action="add-quote-line">${icon("plus")} Add Price</button></div></div>
      <section class="readiness-grid" style="margin:0"><article class="readiness-item ${pending ? "warning" : ""}"><header><span>Pending RFQs</span><strong>${pending}</strong></header><div class="bar"><span style="width:${pending ? 100 : 0}%"></span></div></article><article class="readiness-item"><header><span>Quotes Received</span><strong>${project.quotes.length}</strong></header><div class="bar"><span style="width:${Math.min(100, project.quotes.length * 20)}%"></span></div></article><article class="readiness-item"><header><span>Compared Items</span><strong>${targets.length}</strong></header><div class="bar"><span style="width:${targets.length ? 100 : 0}%"></span></div></article><article class="readiness-item ${selectedCount < targets.length ? "warning" : ""}"><header><span>Selections Approved</span><strong>${selectedCount}/${targets.length}</strong></header><div class="bar"><span style="width:${targets.length ? selectedCount / targets.length * 100 : 0}%"></span></div></article></section>
      <section class="rfq-control-strip"><header><strong>RFQ Register</strong><span>${project.rfqs.length} requests</span></header><div class="rfq-list">${project.rfqs.map((rfq) => `<article><div><strong>${esc(rfq.title)}</strong><span>${rfq.supplierIds.length} suppliers · ${rfq.targetIds.length} items</span></div><div><span>Sent ${dateLabel(rfq.sentAt)}</span><span>Due ${dateLabel(rfq.dueAt)}</span></div><select class="cell-select" data-rfq-id="${rfq.id}" data-field="status"><option value="draft" ${rfq.status === "draft" ? "selected" : ""}>Draft</option><option value="sent" ${rfq.status === "sent" ? "selected" : ""}>Sent</option><option value="waiting" ${rfq.status === "waiting" ? "selected" : ""}>Waiting</option><option value="received" ${rfq.status === "received" ? "selected" : ""}>Received</option><option value="closed" ${rfq.status === "closed" ? "selected" : ""}>Closed</option></select></article>`).join("") || `<span class="empty-inline">No RFQs — create one to track supplier responses.</span>`}</div></section>
      <section class="quote-header-grid">${quotes.map((quote) => {
        const supplier = state.suppliers.find((entry) => entry.id === quote.supplierId)
        const coverage = targets.length ? Math.round((quote.items || []).filter((line) => targets.some((target) => target.targetType === line.targetType && target.targetId === line.targetId)).length / targets.length * 100) : 0
        const validity = C.quoteValidity(quote)
        const validityBadge = validity.expired ? `<span class="badge red">Expired</span>` : validity.expiringSoon ? `<span class="badge amber">Expires in ${validity.daysToExpiry}d</span>` : validity.expiry ? `<span class="badge teal">Valid to ${validity.expiry}</span>` : ""
        return `<article><header><div><strong>${esc(supplier?.name || "Unknown Supplier")}</strong><span>${esc(quote.reference || "No reference")} · ${dateLabel(quote.date)}</span></div><b>${coverage}%</b></header><div class="quote-commercial"><span>Delivery <strong>${esc(quote.delivery || "—")}</strong></span><span>Payment <strong>${esc(quote.payment || "—")}</strong></span><span>Warranty <strong>${esc(quote.warranty || "—")}</strong></span><span>VAT <strong>${num(quote.vat)}%</strong></span></div><footer>${quote.attachment ? `<button class="ghost-btn tiny-btn" data-action="open-attachment" data-id="${esc(quote.attachment.id)}">${icon("attach")} Original Quote</button>` : `<button class="ghost-btn tiny-btn" data-action="attach-quote" data-id="${quote.id}">${icon("attach")} Attach Original</button>`}<span>${quote.items.length} rates</span>${validityBadge}</footer></article>`
      }).join("") || `<div class="empty-inline">No supplier quotations registered yet.</div>`}</section>
      <section class="comparison-board"><header><div><strong>Technical &amp; Commercial Comparison</strong><span>Green = lowest compliant price · Selected = project rate source</span></div><span class="badge">${quotes.length} suppliers</span></header><div class="table-wrap"><table class="data-table comparison-matrix" style="min-width:${Math.max(1040, 455 + quotes.length * 245)}px"><thead><tr><th>Type</th><th>Item / Resource</th><th>Description</th><th>UOM / Qty</th>${quotes.map((quote) => `<th>${esc(state.suppliers.find((entry) => entry.id === quote.supplierId)?.name || "Supplier")}<small class="price-source">${esc(quote.reference || "")}</small></th>`).join("")}<th>Benchmark</th></tr></thead><tbody>
          ${targets.map((target) => {
            const leveled = C.levelQuoteOffers(project, target)
            const entries = quotes.map((quote) => ({ quote, line: (quote.items || []).find((line) => line.targetType === target.targetType && line.targetId === target.targetId) }))
            const lowest = leveled.lowestRaw?.rawUnit || 0
            const lowestCompliant = leveled.lowestCompliant
            const best = leveled.bestEvaluated
            const source = target.targetType === "resource" ? state.resources.find((entry) => entry.id === target.targetId) : project.boq.find((entry) => entry.id === target.targetId)
            return `<tr><td><span class="badge ${target.targetType === "resource" ? "teal" : ""}">${target.targetType === "resource" ? "Resource" : "BOQ"}</span></td><td><strong>${esc(target.code || "")}</strong></td><td class="desc">${esc(target.name)}</td><td><strong>${esc(target.unit)}</strong><small class="price-source">Qty ${num(target.quantity)}</small></td>${entries.map(({ quote, line }) => {
              const selected = source?.selectedQuoteId === quote.id
              if (!line) return `<td class="quote-missing">Not Quoted</td>`
              const evaluated = C.evaluateQuoteLine(quote, line, target, project)
              const compliant = evaluated.compliant
              const unitMismatch = line.unit && C.normalizeUnit(line.unit) !== C.normalizeUnit(target.unit)
              const isLowest = evaluated.rawUnit === lowest && lowest
              const isLowestCompliant = lowestCompliant && evaluated.rawUnit === lowestCompliant.rawUnit && compliant
              const deltaPercent = lowest ? (evaluated.rawUnit - lowest) / lowest * 100 : 0
              const expired = evaluated.validity.expired
              return `<td class="quote-cell ${isLowest ? "price-lowest" : ""} ${isLowestCompliant ? "price-compliant-lowest" : ""} ${selected ? "quote-selected" : ""}"><div class="quote-rate"><strong>${money(evaluated.rawUnit, quote.currency)}</strong><span>/ ${esc(target.unit)}</span></div><small>Evaluated ${money(evaluated.evaluatedUnit, quote.currency)} · Total ${money(evaluated.grandTotal, quote.currency)}</small><div class="brand-model">${esc(line.brand || "No brand")} · ${esc(line.model || "No model")}</div><div class="quote-flags"><span class="badge ${compliant ? "green" : "red"}">${compliant ? "Compliant" : "Deviation"}</span>${unitMismatch ? `<span class="badge amber">Unit mismatch</span>` : ""}${isLowestCompliant ? `<span class="badge green">Lowest compliant</span>` : ""}${isLowest && !compliant ? `<span class="badge amber">Lowest raw / deviation</span>` : ""}${expired ? `<span class="badge red">Expired</span>` : ""}${deltaPercent > 0 ? `<span class="delta">+${num(deltaPercent)}%</span>` : ""}</div>${line.deviation ? `<p>${esc(line.deviation)}</p>` : ""}${compliant && evaluated.rawUnit > 0 ? `<button class="${selected ? "selected-btn" : "select-quote-btn"}" data-action="adopt-quote" data-type="${target.targetType}" data-target="${target.targetId}" data-quote="${quote.id}">${selected ? "Selected ✓" : "Select This Offer"}</button>` : ""}</td>`
            }).join("")}<td class="benchmark-cell">${best ? `<strong>${money(best.evaluatedUnit, best.quoteId ? (quotes.find((entry) => entry.id === best.quoteId)?.currency || project.currency) : project.currency)}</strong><span>Best evaluated offer</span><small>${esc(state.suppliers.find((entry) => entry.id === best.supplierId)?.name || "Supplier")}</small>${lowest ? `<small>Lowest raw: ${money(lowest)}</small>` : ""}${lowestCompliant ? `<small>Lowest compliant: ${money(lowestCompliant.rawUnit)}</small>` : ""}` : `<span>No compliant quote</span>`}</td></tr>`
          }).join("") || `<tr><td colspan="${5 + quotes.length}"><div class="empty-state"><div class="empty-icon">${icon("users")}</div><h3>لا توجد أسعار للمقارنة</h3><p>أضف سعرًا من أحد العروض واربطه ببند BOQ أو Resource.</p><button class="primary-btn" data-action="add-quote-line">إضافة سعر</button></div></td></tr>`}
        </tbody></table></div></section>
    </div>`
  }

  function renderMarkup() {
    const project = currentProject()
    if (!C.can(state, "markup.view", project)) return `<div class="card empty-state"><div class="empty-icon">${icon("lock")}</div><h3>Commercial access required</h3><p>Direct Cost متاح لك، لكن الـMarkup والربح النهائي لا يظهران إلا للمستخدم المصرح له.</p></div>`
    const scenario = currentScenario(project)
    const totals = C.calculateProject(project, state.resources, scenario)
    const breakdown = C.projectCostBreakdown(project, state.resources, "system")
    const editable = C.can(state, "markup.edit", project) && !scenario.locked
    const minimum = Math.min(...project.scenarios.map((item) => C.calculateProject(project, state.resources, item).beforeVat))
    return `<div class="markup-pro-shell">
      <div class="workbench-head"><div><h1>Pricing &amp; Markup Control</h1><p>${esc(project.name)} · Direct Cost → Risk → Profit → Management Final Price</p></div><div class="page-actions"><button class="secondary-btn small-btn" data-action="add-scenario">${icon("plus")} New Scenario</button><button class="secondary-btn small-btn" data-action="save-revision">${icon("history")} Save Revision</button><button class="${scenario.locked ? "secondary-btn" : "primary-btn"} small-btn" data-action="toggle-scenario-lock">${icon(scenario.locked ? "unlock" : "lock")} ${scenario.locked ? "Reopen Scenario" : "Approve & Lock"}</button></div></div>
      <div class="markup-workbench">
        <aside class="scenario-rail"><header><span>PRICING SCENARIOS</span><strong>${project.scenarios.length}</strong></header>${project.scenarios.map((entry) => {
          const value = C.calculateProject(project, state.resources, entry)
          return `<button class="${entry.id === scenario.id ? "active" : ""}" data-action="select-scenario" data-id="${entry.id}"><span>${esc(entry.name)}${entry.locked ? ` ${icon("lock")}` : ""}</span><strong>${money(value.beforeVat)}</strong><small>Margin ${num(value.trueMargin)}% · Factor ${num(value.sellingFactor, 4)}</small></button>`
        }).join("")}</aside>
        <main class="markup-sheet"><header class="sheet-title"><div><span>SCENARIO SETTINGS</span><h2>${esc(scenario.name)}</h2><p>${scenario.locked ? `Approved by ${esc(scenario.approvedBy || "Management")} · ${dateLabel(scenario.approvedAt)}` : "Live calculation — changes update the selling price immediately"}</p></div><span class="badge ${scenario.locked ? "green" : "amber"}">${scenario.locked ? "Locked" : "Working"}</span></header>
          <section class="scenario-input-grid">
            ${scenarioField("Indirect / Overhead", "indirectPercent", scenario.indirectPercent, editable)}
            ${scenarioField("Risk / Contingency", "contingencyPercent", scenario.contingencyPercent, editable)}
            ${scenarioField("Escalation", "escalationPercent", scenario.escalationPercent, editable)}
            ${scenarioSelectField("Profit Method", "profitBasis", scenario.profitBasis, [["cost", "Markup on Cost"], ["margin", "Target Margin"]], editable)}
            ${scenarioField(scenario.profitBasis === "margin" ? "Target Margin" : "Profit on Cost", "profitPercent", scenario.profitPercent, editable)}
            ${scenarioField("Discount", "discountPercent", scenario.discountPercent, editable)}
            ${scenarioField("VAT", "vatPercent", scenario.vatPercent, editable)}
            ${scenarioField("Management Adjustment", "managementAdjustment", scenario.managementAdjustment, editable, false)}
            ${scenarioSelectField("Price Rounding", "roundingStep", String(scenario.roundingStep || 0), [["0", "No rounding"], ["1", "Nearest 1"], ["10", "Nearest 10"], ["100", "Nearest 100"], ["1000", "Nearest 1,000"]], editable)}
          </section>
          <section class="cost-breakdown"><header><strong>Direct Cost by System</strong><span>${breakdown.length} cost groups</span></header><div class="table-wrap"><table class="data-table"><thead><tr><th>System</th><th>Priced Items</th><th>Progress</th><th>Share</th><th>Direct Cost</th></tr></thead><tbody>${breakdown.map((row) => `<tr><td><strong>${esc(row.key)}</strong></td><td>${row.priced}/${row.items}</td><td><div class="mini-progress"><span style="width:${row.progress}%"></span></div><small>${num(row.progress)}%</small></td><td>${num(row.sharePercent)}%</td><td class="num"><strong>${money(row.direct)}</strong></td></tr>`).join("") || `<tr><td colspan="5">No priced systems</td></tr>`}</tbody></table></div></section>
        </main>
        <aside class="selling-panel"><header><span>SELLING PRICE SUMMARY</span><strong>${esc(project.currency)}</strong></header><div class="selling-hero"><span>Offer Before VAT</span><strong>${money(totals.beforeVat)}</strong><small>True margin ${num(totals.trueMargin)}% · Selling factor ${num(totals.sellingFactor, 4)}</small></div><div class="totals-table compact-totals">
          ${totalRow("Direct Cost", totals.direct)}${totalRow(`Indirect (${scenario.indirectPercent}%)`, totals.indirect)}${totalRow(`Risk (${scenario.contingencyPercent}%)`, totals.contingency)}${totalRow(`Escalation (${scenario.escalationPercent}%)`, totals.escalation)}${totalRow("Total Cost", totals.totalCost, "emphasis")}${totalRow(scenario.profitBasis === "margin" ? `Profit for ${scenario.profitPercent}% margin` : `Profit on cost (${scenario.profitPercent}%)`, totals.profit)}${totalRow(`Discount (${scenario.discountPercent}%)`, -totals.discount)}${totals.managementAdjustment ? totalRow("Management Adjustment", totals.managementAdjustment) : ""}${totals.roundingAdjustment ? totalRow("Rounding Adjustment", totals.roundingAdjustment) : ""}${totalRow("Before VAT", totals.beforeVat, "emphasis")}${totalRow(`VAT (${totals.vatPercent}%)`, totals.vat)}${totalRow("Grand Total", totals.total, "final")}
        </div><footer><span>Scenario delta from lowest</span><strong>+${money(totals.beforeVat - minimum)}</strong></footer></aside>
      </div>
      <section class="scenario-matrix"><header><div><strong>Scenario Comparison</strong><span>Compare price, profit and real margin before management approval</span></div></header><div class="table-wrap"><table class="data-table"><thead><tr><th>Scenario</th><th>Total Cost</th><th>Profit</th><th>Profit Method</th><th>True Margin</th><th>Before VAT</th><th>Difference</th><th>Status</th></tr></thead><tbody>${project.scenarios.map((entry) => {
        const value = C.calculateProject(project, state.resources, entry)
        return `<tr class="${entry.id === scenario.id ? "selected-scenario-row" : ""}" data-action="select-scenario" data-id="${entry.id}"><td><strong>${esc(entry.name)}</strong></td><td class="num">${money(value.totalCost)}</td><td class="num">${money(value.profit)}</td><td>${entry.profitBasis === "margin" ? "Target Margin" : "Markup on Cost"}</td><td>${num(value.trueMargin)}%</td><td class="num"><strong>${money(value.beforeVat)}</strong></td><td class="num">+${money(value.beforeVat - minimum)}</td><td><span class="badge ${entry.locked ? "green" : "amber"}">${entry.locked ? "Approved" : "Working"}</span></td></tr>`
      }).join("")}</tbody></table></div></section>
    </div>`
  }

  function scenarioField(label, field, value, editable = true, percent = true) {
    return `<div class="field"><label>${esc(label)}</label><div class="${percent ? "percent-input" : ""}"><input type="number" ${percent ? 'min="0" step="0.25"' : 'step="1"'} data-scenario-field="${field}" value="${C.number(value)}" ${editable ? "" : "disabled"} />${percent ? "<span>%</span>" : ""}</div></div>`
  }

  function scenarioSelectField(label, field, value, options, editable = true) {
    return `<div class="field"><label>${esc(label)}</label><select data-scenario-field="${field}" ${editable ? "" : "disabled"}>${options.map(([key, text]) => `<option value="${esc(key)}" ${String(key) === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></div>`
  }

  function totalRow(label, value, className = "") {
    return `<div class="total-row ${className}"><span>${esc(label)}</span><strong>${money(value)}</strong></div>`
  }

  function reportMoney(value, pack, sensitive = true) {
    if (!sensitive || value == null) return `<span class="restricted-value">${pack.language === "ar" ? "محجوب حسب الصلاحية" : "Restricted"}</span>`
    return money(value, pack.project.currency)
  }

  function reportSource(sourceMeta, fallback = "—") {
    const quantity = sourceMeta?.quantity || sourceMeta?.price || sourceMeta
    if (!quantity || typeof quantity !== "object") return esc(fallback)
    const parts = [quantity.file, quantity.sheet, quantity.cell, quantity.page].filter(Boolean)
    return esc(parts.join(" · ") || fallback)
  }

  function renderReports() {
    const project = currentProject()
    const pack = C.buildReportPack(project, state, { language: reportLanguage || state.settings.language || "ar" })
    const health = C.projectHealth(project, state.resources)
    const tender = C.tenderHealth(project, state.resources)
    const companyLogo = String(pack.brand.logoDataUrl || "").startsWith("data:image/") ? esc(pack.brand.logoDataUrl) : ""
    const activeKey = reportSectionMeta.some(([key]) => key === activeReportTab) ? activeReportTab : "managementSummary"
    const activeMeta = reportSectionMeta.find(([key]) => key === activeKey) || reportSectionMeta[0]
    return `<div class="report-center-shell">
      ${pageHead("Report Center", "مركز إخراج احترافي للتقارير، Excel المنسق وحزمة التقديم النهائية.", `<label class="report-language-select"><span>Template</span><select data-report-language><option value="ar" ${pack.language === "ar" ? "selected" : ""}>العربية</option><option value="en" ${pack.language === "en" ? "selected" : ""}>English</option></select></label><button class="secondary-btn" data-action="report-company-profile">${icon("edit")} Company Branding</button><button class="secondary-btn" data-action="export-report-excel">${icon("download")} Formatted Excel</button><button class="primary-btn" data-action="export-report-pack">${icon("report")} Tender Submission Pack</button>`)}
      ${health.unpriced.length ? `<div class="alert-strip danger no-print">${icon("alert")}<div><strong>${health.unpriced.length} Unpriced Items</strong><small>ستظهر في تقرير مستقل ولا تمنع المراجعة، لكن Quality Gate يظل هو بوابة التقديم.</small></div><button class="secondary-btn small-btn" data-view="boq">مراجعة BOQ</button></div>` : ""}
      ${!tender.reviewComplete ? `<div class="alert-strip no-print">${icon("alert")}<div><strong>Tender Documents Review Incomplete</strong><small>يمكن إنشاء مخرجات للمراجعة، لكن الاعتماد النهائي يحتاج إغلاق Tender Review.</small></div><button class="secondary-btn small-btn" data-view="tender_review">فتح المراجعة</button></div>` : ""}
      <section class="report-hero card">
        <div class="report-hero-brand">${companyLogo ? `<img src="${companyLogo}" alt="Company logo" />` : `<span class="report-logo-fallback">Q</span>`}<div><span class="eyebrow">${esc(pack.brand.tagline || "MEP ESTIMATING SYSTEM")}</span><h2>${esc(pack.brand.name || "QESTIMA")}</h2><p>${esc(pack.project.code)} · ${esc(pack.project.name)} · ${esc(pack.project.client || "")}</p></div></div>
        <div class="report-hero-meta"><span>Revision <b>R${pack.project.revisionNo}</b></span><span>Scenario <b>${esc(pack.scenario.name)}</b></span><span>Role <b>${esc(pack.permissions.role)}</b></span><span class="report-visibility"><i class="status-dot ${pack.permissions.showCost ? "priced" : "unpriced"}"></i> ${pack.permissions.showCost ? "Cost visible" : "Cost restricted"} · ${pack.permissions.showMarkup ? "Markup visible" : "Markup restricted"}</span></div>
      </section>
      <section class="report-kpi-grid"><article><span>Readiness Score</span><strong>${num(pack.readiness.score, 0)}%</strong><small>${pack.readiness.unpricedCount} unpriced · ${pack.readiness.pendingQuotes} pending quotes</small></article><article><span>Pricing Progress</span><strong>${num(pack.readiness.pricingProgress, 0)}%</strong><small>${pack.readiness.qualityScore}% quality score</small></article><article><span>Documents / Gaps</span><strong>${pack.project.revisionNo} · ${pack.readiness.missingDocuments}</strong><small>revision · missing categories</small></article><article><span>Output Access</span><strong>${pack.permissions.showMarkup ? "Full" : pack.permissions.showCost ? "Cost" : "Restricted"}</strong><small>based on current role</small></article></section>
      <nav class="report-section-tabs no-print">${reportSectionMeta.map(([key, en, ar, detail]) => `<button class="${key === activeKey ? "active" : ""}" data-report-tab="${key}"><span>${esc(en)} <em>${esc(ar)}</em></span><small>${esc(detail)}</small></button>`).join("")}</nav>
      <section class="report-panel card"><header class="report-panel-head"><div><span class="eyebrow">REPORT CENTER / ${esc(activeMeta[1])}</span><h2>${esc(pack.language === "ar" ? activeMeta[2] : activeMeta[1])}</h2><p>${esc(activeMeta[3])}</p></div><span class="badge teal">${esc(activeKey)}</span></header><div class="report-panel-body">${renderReportPanel(pack, activeKey)}</div></section>
      <footer class="report-center-footer"><span>${esc(pack.brand.name || "QESTIMA")} · ${esc(pack.project.code)} · R${pack.project.revisionNo}</span><span>Generated ${dateLabel(pack.generatedAt)} · ${pack.permissions.showCost ? "Cost" : "No cost"} · ${pack.permissions.showMarkup ? "Markup" : "No markup"}</span></footer>
    </div>`
  }

  function renderReportPanel(pack, key) {
    const sections = pack.sections
    const restricted = (label = "Restricted") => `<span class="restricted-value">${esc(label)}</span>`
    if (key === "managementSummary") {
      const summary = sections.managementSummary
      const total = summary.totals || {}
      return `<div class="report-summary-layout"><div class="report-readiness-card"><div class="progress-ring" style="--p:${pack.readiness.score}"><div><strong>${pack.readiness.score}%</strong><span>Ready</span></div></div><h3>Tender Readiness</h3><p>${pack.readiness.unpricedCount} Unpriced Items · ${pack.readiness.pendingQuotes} Pending Quotations · ${pack.readiness.missingDocuments} Missing Categories</p><div class="report-check-mini"><span class="${summary.gate.canSubmit ? "done" : ""}">${summary.gate.completed}/${summary.gate.total}</span><div><b>${summary.gate.canSubmit ? "Ready for Final Review" : "Gate items remain"}</b><small>Quality ${summary.quality.score}% · ${summary.quality.openFindings} open findings</small></div></div></div><div class="report-total-card"><h3>Commercial Snapshot</h3><div class="report-total-grid"><div><span>Direct Cost</span><strong>${pack.permissions.showCost ? reportMoney(total.direct, pack) : restricted()}</strong></div><div><span>Total Cost</span><strong>${pack.permissions.showCost ? reportMoney(total.totalCost, pack) : restricted()}</strong></div><div><span>Profit</span><strong>${pack.permissions.showMarkup ? reportMoney(total.profit, pack) : restricted()}</strong></div><div><span>True Margin</span><strong>${pack.permissions.showMarkup && total.trueMargin != null ? `${num(total.trueMargin)}%` : restricted()}</strong></div><div><span>Before VAT</span><strong>${pack.permissions.showMarkup ? reportMoney(total.beforeVat, pack) : restricted()}</strong></div><div><span>Grand Total</span><strong>${pack.permissions.showMarkup ? reportMoney(total.grandTotal, pack) : restricted()}</strong></div></div></div></div><div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Metric</th><th>Value</th><th>Status</th></tr></thead><tbody><tr><td>Submission Deadline</td><td>${dateLabel(pack.project.deadline)}</td><td>${pack.readiness.daysLeft == null ? "Not set" : `${pack.readiness.daysLeft} days`}</td></tr><tr><td>Latest Revision Used</td><td>R${pack.project.revisionNo}</td><td>${esc(pack.scenario.name)}</td></tr><tr><td>Scope Gaps</td><td>${sections.scopeGaps.length}</td><td>${sections.scopeGaps.length ? "Review required" : "Closed"}</td></tr><tr><td>Audit Events</td><td>${sections.auditTrail.length}</td><td>Immutable log</td></tr></tbody></table></div>`
    }
    if (key === "pricedBoq" || key === "unpricedItems") {
      const rows = key === "pricedBoq" ? sections.pricedBoq : sections.unpricedItems
      return `<div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Item</th><th>Description</th><th>Unit</th><th>Qty</th><th>Status</th>${pack.permissions.showCost ? "<th>Cost Rate</th><th>Cost Total</th>" : ""}${pack.permissions.showMarkup ? "<th>Selling Rate</th><th>Selling Total</th>" : ""}<th>Source</th></tr></thead><tbody>${rows.map((row) => `<tr><td><b>${esc(row.itemNo)}</b></td><td class="wide-cell">${esc(row.description)}</td><td>${esc(row.unit)}</td><td class="num">${num(row.pricingQuantity, 3)}</td><td><span class="badge ${row.status === "Priced" ? "green" : "red"}">${row.status}</span></td>${pack.permissions.showCost ? `<td class="num">${reportMoney(row.costUnitRate, pack)}</td><td class="num">${reportMoney(row.costTotal, pack)}</td>` : ""}${pack.permissions.showMarkup ? `<td class="num">${reportMoney(row.sellingUnitRate, pack)}</td><td class="num">${reportMoney(row.sellingTotal, pack)}</td>` : ""}<td><small class="price-source">${reportSource(row.sourceMeta, row.source)}</small></td></tr>`).join("") || `<tr><td colspan="9"><div class="empty-state">لا توجد بيانات.</div></td></tr>`}</tbody></table></div>`
    }
    if (key === "rateAnalysis") {
      return `<div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Item</th><th>Description</th><th>Material</th><th>Labor</th><th>Equipment</th><th>Subcontractor</th><th>Waste</th><th>Extras</th><th>Unit Cost</th>${pack.permissions.showMarkup ? "<th>Profit</th><th>Selling</th>" : ""}</tr></thead><tbody>${sections.rateAnalysis.map((row) => `<tr><td><b>${esc(row.itemNo)}</b></td><td class="wide-cell">${esc(row.description)}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.components?.material, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.components?.labor, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.components?.equipment, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.components?.subcontractor, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.waste, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney((row.transport || 0) + (row.accessories || 0) + (row.preliminaries || 0) + (row.escalation || 0) + (row.risk || 0) + (row.overhead || 0), pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.costUnit, pack) : restricted()}</td>${pack.permissions.showMarkup ? `<td class="num">${reportMoney(row.profit, pack)}</td><td class="num">${reportMoney(row.sellingBeforeVat, pack)}</td>` : ""}</tr>`).join("")}</tbody></table></div>`
    }
    if (key === "resourceBreakdown") {
      return `<div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Type</th><th>Code</th><th>Resource</th><th>Unit</th><th>Factor</th>${pack.permissions.showCost ? "<th>Rate</th><th>Total</th>" : ""}<th>Source</th></tr></thead><tbody>${sections.resourceBreakdown.map((row) => `<tr><td>${esc(resourceTypeLabels[row.type] || row.type)}</td><td><b>${esc(row.code)}</b></td><td>${esc(row.name)}</td><td>${esc(row.unit)}</td><td class="num">${num(row.factor, 4)}</td>${pack.permissions.showCost ? `<td class="num">${reportMoney(row.rate, pack)}</td><td class="num">${reportMoney(row.total, pack)}</td>` : ""}<td><small class="price-source">${esc(row.source)}</small></td></tr>`).join("")}</tbody></table></div>`
    }
    if (key === "supplierAdjudication") {
      return `<div class="adjudication-list">${sections.supplierAdjudication.map((row) => `<details class="adjudication-item"><summary><span><b>${esc(row.code)}</b> · ${esc(row.name)}</span><span>${row.offers.length} offers · ${row.bestEvaluated ? "Best evaluated" : "No compliant offer"}</span></summary><div class="report-table-wrap"><table class="report-grid compact"><thead><tr><th>Supplier / Ref</th><th>Compliance</th><th>Lowest Price</th><th>Best Evaluated</th><th>Delivery</th><th>Validity</th></tr></thead><tbody>${row.offers.map((offer) => { const supplier = state.suppliers.find((entry) => entry.id === offer.supplierId); const best = row.bestEvaluated?.quoteId === offer.quoteId; return `<tr class="${best ? "highlight-row" : ""}"><td><b>${esc(supplier?.name || offer.supplierId || "Supplier")}</b><small class="price-source">${esc(offer.reference)}</small></td><td><span class="badge ${offer.compliant && !offer.expired ? "green" : "red"}">${offer.expired ? "Expired" : offer.compliant ? "Compliant" : "Deviation"}</span></td><td class="num">${pack.permissions.showCost ? reportMoney(offer.rawUnit, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(offer.evaluatedUnit, pack) : restricted()}</td><td>${esc(offer.delivery || "—")}</td><td>${offer.expired ? "Expired" : "Valid"}</td></tr>` }).join("") || `<tr><td colspan="6">لا توجد عروض مرتبطة بهذا البند.</td></tr>`}</tbody></table></div></details>`).join("") || `<div class="empty-state">لا توجد أهداف مقارنة.</div>`}</div>`
    }
    if (key === "qualificationsExclusions") {
      const q = sections.qualificationsExclusions
      return `<div class="layout-even report-lists"><div class="report-list-card"><header><h3>Tender Qualifications</h3><span class="badge amber">${q.qualifications.length}</span></header><ul>${q.qualifications.map((entry) => `<li>${esc(entry)}</li>`).join("") || "<li>لا توجد توضيحات مسجلة.</li>"}</ul></div><div class="report-list-card"><header><h3>Exclusions</h3><span class="badge red">${q.exclusions.length}</span></header><ul>${q.exclusions.map((entry) => `<li>${esc(entry)}</li>`).join("") || "<li>لا توجد استثناءات مسجلة.</li>"}</ul></div></div>`
    }
    if (key === "scopeGaps") {
      return `<div class="report-table-wrap"><table class="report-grid"><thead><tr><th>System</th><th>Status</th><th>In Scope</th><th>BOQ</th><th>Drawings</th><th>Specs</th><th>Notes</th></tr></thead><tbody>${sections.scopeGaps.map((row) => `<tr><td><b>${esc(row.system)}</b></td><td><span class="badge red">${esc(row.status)}</span></td><td>${esc(row.inScope)}</td><td>${esc(row.boqStatus)}</td><td>${esc(row.drawingsStatus)}</td><td>${esc(row.specsStatus)}</td><td class="wide-cell">${esc(row.notes || "—")}</td></tr>`).join("") || `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">${icon("check")}</div><h3>Scope closed</h3><p>لا توجد فجوات مفتوحة.</p></div></td></tr>`}</tbody></table></div>`
    }
    if (key === "revisionImpact") {
      const impact = sections.revisionImpact
      return `<div class="revision-report-summary"><div><span>Baseline</span><strong>${esc(impact.baseline)}</strong></div><div><span>Added</span><strong>${impact.counts.added}</strong></div><div><span>Deleted</span><strong>${impact.counts.deleted}</strong></div><div><span>Changed</span><strong>${impact.counts.changed}</strong></div><div><span>Cost Delta</span><strong>${pack.permissions.showCost ? reportMoney(impact.delta, pack) : restricted()}</strong></div></div><div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Item</th><th>Change</th><th>Before Cost</th><th>After Cost</th><th>Delta</th></tr></thead><tbody>${impact.changed.map((row) => `<tr><td><b>${esc(row.itemNo)}</b></td><td>${row.differences.map((d) => `${esc(d.field)}: ${esc(d.before)} → ${esc(d.after)}`).join(" · ") || "Rate impact"}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.beforeCost, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.afterCost, pack) : restricted()}</td><td class="num">${pack.permissions.showCost ? reportMoney(row.delta, pack) : restricted()}</td></tr>`).join("") || `<tr><td colspan="5">لا توجد تغييرات مقارنة بالـbaseline.</td></tr>`}</tbody></table></div><p class="field-hint">${impact.rfqUpdates.length} RFQ(s) تحتاج مراجعة بعد التغيير.</p>`
    }
    if (key === "scenarioComparison") {
      return `<div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Scenario</th><th>Status</th><th>Total Cost</th><th>Profit</th><th>True Margin</th><th>Before VAT</th><th>Grand Total</th></tr></thead><tbody>${sections.scenarioComparison.map((row) => `<tr class="${row.id === pack.scenario.id ? "highlight-row" : ""}"><td><b>${esc(row.name)}</b></td><td><span class="badge ${row.locked ? "green" : "amber"}">${row.locked ? "Approved" : "Working"}</span></td><td class="num">${pack.permissions.showCost ? reportMoney(row.totalCost, pack) : restricted()}</td><td class="num">${pack.permissions.showMarkup ? reportMoney(row.profit, pack) : restricted()}</td><td class="num">${pack.permissions.showMarkup && row.trueMargin != null ? `${num(row.trueMargin)}%` : restricted()}</td><td class="num">${pack.permissions.showMarkup ? reportMoney(row.beforeVat, pack) : restricted()}</td><td class="num">${pack.permissions.showMarkup ? reportMoney(row.grandTotal, pack) : restricted()}</td></tr>`).join("")}</tbody></table></div>`
    }
    if (key === "auditTrail") {
      return `<div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Source</th></tr></thead><tbody>${sections.auditTrail.map((entry) => `<tr><td>${dateLabel(entry.date || entry.timestamp)}</td><td>${esc(entry.user || entry.actorId || "—")}</td><td class="wide-cell">${esc(entry.action || entry.description || "—")}</td><td>${esc(entry.source || "QESTIMA")}</td></tr>`).join("") || `<tr><td colspan="4">لا توجد أحداث.</td></tr>`}</tbody></table></div>`
    }
    if (key === "submissionPack") {
      const packInfo = pack.submissionPack
      return `<div class="submission-pack-card"><div class="submission-pack-hero"><div class="pack-icon">${icon("report")}</div><div><h3>${esc(packInfo.title)}</h3><p>Revision R${packInfo.revision} · ${packInfo.locked ? "Locked snapshot" : "Working snapshot"}</p></div><button class="primary-btn" data-action="export-report-pack">${icon("download")} Generate Pack</button></div><div class="pack-include-grid">${packInfo.includes.map((entry) => `<span>${icon("check")} ${esc(entry)}</span>`).join("")}</div><div class="report-table-wrap"><table class="report-grid"><thead><tr><th>Document</th><th>Category</th><th>Revision</th><th>Status</th></tr></thead><tbody>${packInfo.documents.map((document) => `<tr><td><b>${esc(document.number || document.title)}</b><small class="price-source">${esc(document.title)}</small></td><td>${esc(document.category)}</td><td>${esc(document.revision || "—")}</td><td><span class="badge ${document.current ? "green" : "amber"}">${document.current ? "Current" : "Superseded"}</span></td></tr>`).join("") || `<tr><td colspan="4">لا توجد مستندات مرفقة في الحزمة.</td></tr>`}</tbody></table></div></div>`
    }
    return `<div class="empty-state">اختر قسمًا من Report Center.</div>`
  }

  function renderQuantityReview() {
    const project = currentProject()
    const measurements = project.measurements || []
    const linked = project.boq.filter((item) => C.number(item.takeoffQuantity) > 0)
    return `${pageHead("Quantity Review", "راجع كميات BOQ مقابل الحصر، واعتمدها يدويًا قبل انتقالها إلى التسعير.", `<button class="secondary-btn" data-view="drawings">${icon("ruler")} Drawings &amp; Takeoff</button><button class="primary-btn" data-action="add-measurement">${icon("plus")} New Measurement</button>`)}
      <div class="alert-strip"><div><strong>Engineer approval required</strong><small>الكمية المقترحة لا تصبح Pricing Quantity إلا بعد الضغط على Approve.</small></div><span class="badge teal">${linked.length} linked · ${measurements.filter((m) => !m.approved).length} pending</span></div>
      <section class="card"><div class="card-head"><div><h2>Measurement Review Register</h2><p>Drawing → Page → Revision → System → Floor → BOQ Item → Measured By</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Measurement</th><th>Source</th><th>BOQ</th><th>Measured</th><th>Net</th><th>Measured By</th><th>Status</th><th></th></tr></thead><tbody>${measurements.map((m) => { const item = project.boq.find((entry) => entry.id === m.itemId); const drawing = project.documents.find((entry) => entry.id === m.drawingDocumentId); const net = C.measurementNetQuantity(m); return `<tr><td><strong>${esc(m.name)}</strong><small class="price-source">${esc(m.kind)} · ${esc(m.unit)} · Scale ${num(m.scale)}</small></td><td>${esc(drawing?.documentNumber || drawing?.title || "—")}<small class="price-source">Page ${num(m.drawingPage)} · Rev ${esc(m.drawingRevision || drawing?.revision || "—")}</small></td><td>${item ? `<strong>${esc(item.itemNo)}</strong><small class="price-source">BOQ ${num(item.quantity)} ${esc(item.unit)}</small>` : "—"}</td><td class="num">${num(m.quantity)} ${esc(m.unit)}</td><td class="num"><strong>${num(net)} ${esc(m.unit)}</strong></td><td>${esc(m.measuredBy || "—")}</td><td><span class="badge ${m.approved ? "green" : "amber"}">${m.approved ? "Approved" : "Pending Review"}</span></td><td>${item && !m.approved ? `<button class="primary-btn tiny-btn" data-action="approve-quantity" data-id="${esc(m.id)}">Approve</button>` : ""}</td></tr>` }).join("") || `<tr><td colspan="8"><div class="empty-state"><h3>No measurements yet</h3><p>ابدأ من Drawings &amp; Takeoff.</p></div></td></tr>`}</tbody></table></div></section>`
  }

  function drawingScaleKey(documentId, page = 1) { return `${documentId || ""}::${Math.max(1, C.number(page) || 1)}` }

  function drawingPageCount(document, project = currentProject()) {
    return Math.max(1, C.number(document?.pdfPageCount) || C.number(project?.pdfAnalyses?.[document?.id]?.pageCount) || 1)
  }

  function previousDrawingRevision(project, drawing) {
    if (!drawing) return null
    const key = C.normalizeHeader(drawing.documentNumber || drawing.title || drawing.originalName)
    return (project.documents || []).filter((entry) => entry.id !== drawing.id && entry.category === "drawings" && C.normalizeHeader(entry.documentNumber || entry.title || entry.originalName) === key).sort((a, b) => String(b.revision || "").localeCompare(String(a.revision || "")))[0] || null
  }

  function drawingScale(project, drawing, page = drawingPage) {
    return project?.drawingScales?.[drawingScaleKey(drawing?.id, page)] || null
  }

  function drawingCanvasPoint(event) {
    const canvas = $("#measurement-overlay")
    if (!canvas || !measurementCanvas.sourceWidth || !measurementCanvas.sourceHeight) return null
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    return { x: Math.max(0, Math.min(measurementCanvas.sourceWidth, (event.clientX - rect.left) / rect.width * measurementCanvas.sourceWidth)), y: Math.max(0, Math.min(measurementCanvas.sourceHeight, (event.clientY - rect.top) / rect.height * measurementCanvas.sourceHeight)) }
  }

  function drawingSegmentIntersection(a, b, c, d) {
    const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
    if (Math.abs(denominator) < 0.00001) return null
    const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denominator
    const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denominator
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null
    return { x: a.x + ua * (b.x - a.x), y: a.y + ua * (b.y - a.y) }
  }

  function snapDrawingPoint(pointValue) {
    if (!pointValue || !measurementCanvas.snap) return pointValue
    const project = currentProject()
    const candidates = []
    const segments = []
    ;(project.measurements || []).filter((entry) => entry.drawingDocumentId === measurementCanvas.drawingId && C.number(entry.drawingPage) === C.number(measurementCanvas.page)).forEach((entry) => {
      const rowPoints = entry.points || []
      rowPoints.forEach((candidate) => candidates.push(candidate))
      for (let index = 1; index < rowPoints.length; index += 1) segments.push([rowPoints[index - 1], rowPoints[index]])
      if (["area", "perimeter"].includes(entry.kind) && rowPoints.length > 2) segments.push([rowPoints[rowPoints.length - 1], rowPoints[0]])
    })
    measurementCanvas.points.forEach((candidate) => candidates.push(candidate))
    for (let left = 0; left < segments.length; left += 1) for (let right = left + 1; right < segments.length; right += 1) {
      const intersection = drawingSegmentIntersection(segments[left][0], segments[left][1], segments[right][0], segments[right][1])
      if (intersection) candidates.push(intersection)
    }
    const tolerance = 18 / Math.max(.2, measurementCanvas.zoom)
    let closest = null; let distance = tolerance
    candidates.forEach((candidate) => { const next = Math.hypot(C.number(candidate.x) - pointValue.x, C.number(candidate.y) - pointValue.y); if (next < distance) { distance = next; closest = candidate } })
    if (closest) return { x: C.number(closest.x), y: C.number(closest.y) }
    const previous = measurementCanvas.points[measurementCanvas.points.length - 1]
    if (previous && Math.abs(previous.x - pointValue.x) < tolerance) return { x: previous.x, y: pointValue.y }
    if (previous && Math.abs(previous.y - pointValue.y) < tolerance) return { x: pointValue.x, y: previous.y }
    return pointValue
  }

  function drawMeasurementShape(context, measurement, options = {}) {
    const points = (measurement?.points || []).map((entry) => ({ x: C.number(entry.x), y: C.number(entry.y) }))
    if (!points.length) return
    context.save()
    context.lineWidth = options.active ? 3 : 2
    context.strokeStyle = options.color || measurement.color || "#28c7b7"
    context.fillStyle = options.fill || `${options.color || measurement.color || "#28c7b7"}22`
    context.setLineDash(options.dashed ? [9, 6] : [])
    if (measurement.kind === "count") {
      points.forEach((pointValue, index) => { context.beginPath(); context.arc(pointValue.x, pointValue.y, 7, 0, Math.PI * 2); context.stroke(); context.fillText(String(index + 1), pointValue.x + 10, pointValue.y - 8) })
    } else {
      context.beginPath(); context.moveTo(points[0].x, points[0].y); points.slice(1).forEach((pointValue) => context.lineTo(pointValue.x, pointValue.y)); if (measurement.kind === "area" || measurement.kind === "perimeter") context.closePath(); context.stroke(); if (measurement.kind === "area") context.fill()
      points.forEach((pointValue) => { context.beginPath(); context.arc(pointValue.x, pointValue.y, 3, 0, Math.PI * 2); context.fillStyle = options.color || measurement.color || "#28c7b7"; context.fill() })
    }
    if (!options.active) { const first = points[0]; context.font = "bold 18px Segoe UI"; context.fillStyle = options.color || measurement.color || "#28c7b7"; context.fillText(`${C.number(measurement.quantity).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${measurement.unit || ""}`, first.x + 10, first.y + 18) }
    context.restore()
  }

  function drawMeasurementOverlay() {
    const canvas = $("#measurement-overlay")
    if (!canvas || !measurementCanvas.sourceWidth) return
    const context = canvas.getContext("2d")
    context.clearRect(0, 0, canvas.width, canvas.height)
    const project = currentProject()
    const groups = project.measurementGroups || []
    const rows = (project.measurements || []).filter((entry) => entry.drawingDocumentId === measurementCanvas.drawingId && C.number(entry.drawingPage) === C.number(measurementCanvas.page))
    rows.forEach((entry) => { const group = groups.find((candidate) => candidate.id === entry.groupId); drawMeasurementShape(context, entry, { dashed: entry.revisionCarryForward, color: entry.approved ? "#42d39e" : group?.color || entry.color }) })
    if (measurementCanvas.revisionOverlayId) {
      ;(project.measurements || []).filter((entry) => entry.drawingDocumentId === measurementCanvas.revisionOverlayId && C.number(entry.drawingPage) === C.number(measurementCanvas.page)).forEach((entry) => drawMeasurementShape(context, entry, { dashed: true, color: "#e7ad51" }))
    }
    if (measurementCanvas.points.length) drawMeasurementShape(context, { kind: measurementCanvas.kind === "calibrate" ? "length" : measurementCanvas.kind, points: measurementCanvas.points, color: "#ffffff" }, { active: true, color: "#ffffff" })
  }

  // DXF (and DWG converted to DXF) is rendered locally from the audited CAD
  // index.  This is intentionally a review canvas, not a CAD editor: it keeps
  // the geometry visible, preserves the source coordinates and lets the same
  // measurement overlay/approval workflow work on CAD and PDF pages.
  function cadBounds(model) {
    const points = []
    const add = (pointValue) => { if (pointValue && Number.isFinite(Number(pointValue.x)) && Number.isFinite(Number(pointValue.y))) points.push({ x: Number(pointValue.x), y: Number(pointValue.y) }) }
    ;(model?.entities || []).forEach((entity) => {
      const geometry = entity.geometry || {}
      if (geometry.kind === "circle" || geometry.kind === "arc") {
        const center = geometry.center || entity.points?.[0]; add(center)
        const radius = Math.abs(Number(geometry.radius) || 0)
        if (center && radius) { add({ x: Number(center.x) - radius, y: Number(center.y) - radius }); add({ x: Number(center.x) + radius, y: Number(center.y) + radius }) }
      } else if (geometry.kind === "ellipse") {
        const center = geometry.center || entity.points?.[0]; add(center)
        const major = Math.abs(Number(geometry.major) || 0); const minor = Math.abs(Number(geometry.minor) || 0)
        if (center && (major || minor)) { add({ x: Number(center.x) - major, y: Number(center.y) - minor }); add({ x: Number(center.x) + major, y: Number(center.y) + minor }) }
      }
      ;(geometry.points || entity.points || []).forEach(add)
    })
    if (!points.length) return { minX: 0, minY: 0, maxX: 100, maxY: 70, spanX: 100, spanY: 70 }
    const xs = points.map((pointValue) => pointValue.x); const ys = points.map((pointValue) => pointValue.y)
    const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys)
    return { minX, minY, maxX, maxY, spanX: Math.max(maxX - minX, 1), spanY: Math.max(maxY - minY, 1) }
  }

  function cadLayerColor(layer, index = 0) {
    const palette = ["#44d3c2", "#e9b35d", "#75a7ff", "#dc7bff", "#73d38c", "#ff8c7a", "#a9c7d5", "#e7e7e7"]
    let hash = 0; for (const character of String(layer || "0")) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
    return palette[(hash + index) % palette.length]
  }

  function drawCadModel(model) {
    const pageCanvas = $("#pdf-page-canvas")
    const overlay = $("#measurement-overlay")
    if (!pageCanvas || !overlay) return
    const sourceWidth = 1600; const sourceHeight = 1000
    const bounds = cadBounds(model)
    const margin = 70
    const fit = Math.min((sourceWidth - margin * 2) / bounds.spanX, (sourceHeight - margin * 2) / bounds.spanY)
    const transform = { ...bounds, scale: Math.max(.00001, fit), offsetX: (sourceWidth - bounds.spanX * fit) / 2, offsetY: (sourceHeight - bounds.spanY * fit) / 2 }
    const mapPoint = (pointValue) => ({ x: transform.offsetX + (Number(pointValue.x) - transform.minX) * transform.scale, y: transform.offsetY + (transform.maxY - Number(pointValue.y)) * transform.scale })
    measurementCanvas = { ...measurementCanvas, sourceWidth, sourceHeight, cadTransform: transform, image: null }
    pageCanvas.width = sourceWidth; pageCanvas.height = sourceHeight; overlay.width = sourceWidth; overlay.height = sourceHeight
    const context = pageCanvas.getContext("2d")
    context.clearRect(0, 0, sourceWidth, sourceHeight); context.fillStyle = "#0c1820"; context.fillRect(0, 0, sourceWidth, sourceHeight)
    context.save(); context.strokeStyle = "#ffffff0b"; context.lineWidth = 1
    const grid = Math.max(20, Math.min(80, Math.round(Math.min(transform.spanX, transform.spanY) * transform.scale / 12)))
    for (let x = 0; x <= sourceWidth; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, sourceHeight); context.stroke() }
    for (let y = 0; y <= sourceHeight; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(sourceWidth, y); context.stroke() }
    context.restore()
    const layerColors = new Map((model?.layers || []).map((layer, index) => [String(layer.name || "0"), cadLayerColor(layer.name, index)]))
    const linePoints = (points, close = false) => {
      const mapped = (points || []).filter((pointValue) => pointValue && Number.isFinite(Number(pointValue.x)) && Number.isFinite(Number(pointValue.y))).map(mapPoint)
      if (!mapped.length) return
      context.beginPath(); context.moveTo(mapped[0].x, mapped[0].y); mapped.slice(1).forEach((pointValue) => context.lineTo(pointValue.x, pointValue.y)); if (close && mapped.length > 2) context.closePath(); context.stroke()
    }
    ;(model?.entities || []).forEach((entity, index) => {
      const geometry = entity.geometry || {}; const color = layerColors.get(String(entity.layer || "0")) || cadLayerColor(entity.layer, index)
      context.save(); context.strokeStyle = color; context.fillStyle = color; context.lineWidth = Math.max(1, Math.min(4, 1.25 / Math.max(.35, measurementCanvas.zoom || 1)))
      if (geometry.kind === "line") linePoints([geometry.start, geometry.end])
      else if (geometry.kind === "polyline") linePoints(geometry.points || entity.points, geometry.closed)
      else if (geometry.kind === "circle") { const center = mapPoint(geometry.center || entity.points?.[0] || { x: 0, y: 0 }); context.beginPath(); context.arc(center.x, center.y, Math.max(1, Number(geometry.radius || 0) * transform.scale), 0, Math.PI * 2); context.stroke() }
      else if (geometry.kind === "arc") {
        const center = geometry.center || entity.points?.[1] || entity.points?.[0] || { x: 0, y: 0 }; const radius = Math.abs(Number(geometry.radius) || 0); const start = Number(geometry.startAngle || 0) * Math.PI / 180; const delta = (Number(geometry.endAngle || 360) - Number(geometry.startAngle || 0)) * Math.PI / 180; const steps = Math.max(8, Math.ceil(Math.abs(delta) * 16 / Math.PI)); const points = []
        for (let step = 0; step <= steps; step += 1) { const angle = start + delta * step / steps; points.push({ x: Number(center.x) + radius * Math.cos(angle), y: Number(center.y) + radius * Math.sin(angle) }) }
        linePoints(points)
      } else if (geometry.kind === "ellipse") {
        const center = mapPoint(geometry.center || entity.points?.[0] || { x: 0, y: 0 }); const major = Math.abs(Number(geometry.major) || 0) * transform.scale; const minor = Math.abs(Number(geometry.minor) || 0) * transform.scale; const angle = -Math.atan2(Number(geometry.majorY) || 0, Number(geometry.majorX) || 0); context.save(); context.translate(center.x, center.y); context.rotate(angle); context.beginPath(); context.ellipse(0, 0, Math.max(1, major), Math.max(1, minor), 0, Number(geometry.startParam || 0), Number(geometry.endParam || Math.PI * 2)); context.stroke(); context.restore()
      } else {
        const pointValue = mapPoint(entity.points?.[0] || { x: 0, y: 0 }); context.beginPath(); context.arc(pointValue.x, pointValue.y, 3, 0, Math.PI * 2); context.fill()
      }
      context.restore()
    })
    context.save(); context.fillStyle = "#d9e9ed"; context.font = "600 18px Segoe UI"; context.fillText(`${model?.format || "CAD"} · ${Number(model?.entityCount || 0).toLocaleString()} entities`, 24, 34); context.fillStyle = "#8daab2"; context.font = "13px Segoe UI"; context.fillText(`${model?.units || "Unitless"} · ${Number(model?.layers?.length || 0)} layers · review canvas`, 24, 56); context.restore()
    applyDrawingCanvasLayout(); drawMeasurementOverlay()
  }

  function applyDrawingCanvasLayout() {
    const stage = $("#stage-canvas")
    const layer = $("#pdf-canvas-stage")
    if (!stage || !layer || !measurementCanvas.sourceWidth || !measurementCanvas.sourceHeight) return
    const availableWidth = Math.max(280, stage.clientWidth - 32)
    const availableHeight = Math.max(220, stage.clientHeight - 32)
    const fit = Math.min(availableWidth / measurementCanvas.sourceWidth, availableHeight / measurementCanvas.sourceHeight)
    const width = Math.max(160, measurementCanvas.sourceWidth * fit * Math.max(.2, measurementCanvas.zoom))
    const height = Math.max(120, measurementCanvas.sourceHeight * fit * Math.max(.2, measurementCanvas.zoom))
    layer.style.width = `${width}px`; layer.style.height = `${height}px`
    $("#pdf-page-canvas").style.width = "100%"; $("#pdf-page-canvas").style.height = "100%"
    $("#measurement-overlay").style.width = "100%"; $("#measurement-overlay").style.height = "100%"
  }

  function bindDrawingCanvas() {
    const canvas = $("#measurement-overlay")
    if (!canvas) return
    canvas.onclick = handleMeasurementCanvasClick
    canvas.ondblclick = (event) => { event.preventDefault(); if (measurementCanvas.mode === "measure") finishCanvasMeasurement() }
  }

  async function loadDrawingPage() {
    const project = currentProject()
    const drawing = (project.documents || []).find((entry) => entry.id === activeDrawingId)
    const pageCanvas = $("#pdf-page-canvas")
    const overlay = $("#measurement-overlay")
    bindDrawingCanvas()
    if (!pageCanvas || !overlay) return
    measurementCanvas = { ...measurementCanvas, drawingId: drawing?.id || null, page: drawingPage }
    if (!drawing) {
      measurementCanvas = { ...measurementCanvas, image: null, cadTransform: null, sourceWidth: 0, sourceHeight: 0 }
      pageCanvas.width = 1; pageCanvas.height = 1; overlay.width = 1; overlay.height = 1
      const hint = $("#canvas-loading-hint")
      if (hint) hint.textContent = "Select a PDF or indexed CAD drawing to begin."
      return
    }
    if (String(drawing.fileType || "").toUpperCase() !== "PDF") {
      const model = drawing.cadInspection?.model
      if (model?.entities?.length) drawCadModel(model)
      else {
        measurementCanvas = { ...measurementCanvas, image: null, cadTransform: null, sourceWidth: 0, sourceHeight: 0 }
        pageCanvas.width = 1; pageCanvas.height = 1; overlay.width = 1; overlay.height = 1
      }
      return
    }
    if (!drawing.attachment?.id || !window.qestimaDesktop?.renderPdfPage || typeof Image === "undefined") {
      measurementCanvas = { ...measurementCanvas, image: null, cadTransform: null, sourceWidth: 0, sourceHeight: 0 }
      pageCanvas.width = 1; pageCanvas.height = 1; overlay.width = 1; overlay.height = 1
      const hint = $("#canvas-loading-hint")
      if (hint) hint.textContent = "PDF viewer is available in the Windows desktop build."
      return
    }
    const token = C.id("pdf-render")
    measurementCanvas.renderToken = token
    let result
    try {
      result = window.qestimaDesktop.readPdfBytes && window.QESTIMAPdf ? await window.QESTIMAPdf.render(drawing.attachment.id, drawingPage) : await window.qestimaDesktop.renderPdfPage({ attachmentId: drawing.attachment.id, page: drawingPage, dpi: 144 })
    } catch (error) { return toast("تعذر عرض صفحة PDF", error.message, "warning") }
    if (measurementCanvas.renderToken !== token || activeDrawingId !== drawing.id || drawingPage !== Number(result?.page || drawingPage)) return
    if (!result?.ok || !result.dataUrl) { const hint = $("#canvas-loading-hint"); if (hint) hint.textContent = "PDF render engine unavailable — install the bundled Poppler runtime."; return toast("تعذر عرض صفحة PDF", result?.error || "محرك PDF غير متاح.", "warning") }
    const remotePageCount = C.number(result.pageCount)
    if (remotePageCount > 0 && remotePageCount !== C.number(drawing.pdfPageCount)) {
      // Rendering is also allowed to discover page count. Store only this
      // non-financial document metadata, then redraw the pager once.
      drawing.pdfPageCount = remotePageCount
      scheduleSave()
      render()
      return
    }
    const image = new Image()
    image.onload = () => {
      if (measurementCanvas.renderToken !== token) return
      measurementCanvas = { ...measurementCanvas, image, sourceWidth: image.naturalWidth || image.width, sourceHeight: image.naturalHeight || image.height }
      pageCanvas.width = measurementCanvas.sourceWidth; pageCanvas.height = measurementCanvas.sourceHeight; overlay.width = measurementCanvas.sourceWidth; overlay.height = measurementCanvas.sourceHeight
      pageCanvas.getContext("2d").drawImage(image, 0, 0, pageCanvas.width, pageCanvas.height)
      const hint = $("#canvas-loading-hint"); if (hint) hint.textContent = ""
      applyDrawingCanvasLayout(); drawMeasurementOverlay()
    }
    image.onerror = () => toast("تعذر تحميل صورة صفحة PDF", "جرّب Fit أو افتح المستند من Tender Documents.", "warning")
    image.src = result.dataUrl
  }

  function startCanvasMeasurement(kind = "length") {
    const project = currentProject()
    const drawing = (project.documents || []).find((entry) => entry.id === activeDrawingId)
    if (!drawing) return toast("اختر رسمًا أولًا", "ارفع PDF أو DXF من Tender Documents ثم اختره من القائمة.", "warning")
    const format = String(drawing.fileType || "").toUpperCase()
    if (format !== "PDF" && !drawing.cadInspection?.model?.entities?.length) return toast("الرسم غير مفهرس", "شغّل Inspect CAD أولًا أو اختر رسمًا مفهرسًا.", "warning")
    measurementCanvas = { ...measurementCanvas, mode: "measure", kind, points: [], drawingId: drawing.id, page: drawingPage }
    render()
    toast(`وضع القياس: ${kind}`, "اضغط نقاط الرسم؛ Double-click أو Finish لحفظ القياس كمقترح.")
  }

  function handleMeasurementCanvasClick(event) {
    if (!measurementCanvas.mode) return
    const pointValue = snapDrawingPoint(drawingCanvasPoint(event))
    if (!pointValue) return
    measurementCanvas.points = [...measurementCanvas.points, pointValue]
    drawMeasurementOverlay()
    const needed = measurementCanvas.mode === "calibrate" ? 2 : measurementCanvas.kind === "count" ? 1 : measurementCanvas.kind === "length" ? 2 : 3
    if (measurementCanvas.points.length === needed && measurementCanvas.mode === "calibrate") toast("تم تحديد خط المعايرة", "اضغط Finish ثم أدخل البعد الحقيقي.")
  }

  function finishCanvasMeasurement() {
    const project = currentProject()
    if (!measurementCanvas.mode) return
    const points = measurementCanvas.points || []
    if (measurementCanvas.mode === "calibrate") {
      if (points.length < 2) return toast("المعايرة تحتاج نقطتين", "حدد بعدًا معروفًا على الرسم.", "warning")
      const pixelDistance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
      const knownDistance = window.prompt ? window.prompt("البعد الحقيقي بين النقطتين", "1") : "1"
      const unit = window.prompt ? window.prompt("وحدة القياس", "m") : "m"
      const result = C.calibrateScale(pixelDistance, knownDistance)
      if (!result.ok || !unit) return toast("المعايرة غير مكتملة", "أدخل بعدًا ووحدة صحيحة.", "warning")
      const key = drawingScaleKey(measurementCanvas.drawingId, measurementCanvas.page)
      const user = C.activeUser(state)?.name || state.user.name
      const ok = commit("معايرة مقياس الرسم", () => { project.drawingScales ||= {}; project.drawingScales[key] = { ...result, unit: String(unit).trim(), documentId: measurementCanvas.drawingId, page: measurementCanvas.page, revision: (project.documents.find((entry) => entry.id === measurementCanvas.drawingId) || {}).revision || "", updatedAt: new Date().toISOString(), updatedBy: user } })
      if (!ok) return
      measurementCanvas = { ...measurementCanvas, mode: "", points: [] }; render(); toast("تم حفظ المقياس", `${result.unitsPerPixel.toFixed(6)} ${String(unit).trim()}/pixel`)
      return
    }
    const kind = measurementCanvas.kind
    const minimum = kind === "count" ? 1 : kind === "length" ? 2 : 3
    if (points.length < minimum) return toast("القياس غير مكتمل", kind === "count" ? "حدد عنصرًا واحدًا على الأقل." : `حدد ${minimum} نقاط على الرسم.`, "warning")
    const drawing = project.documents.find((entry) => entry.id === measurementCanvas.drawingId)
    const item = project.boq.find((entry) => entry.id === $("#measurement-boq-item")?.value) || project.boq.find((entry) => entry.id === activeItemId)
    const scaleRecord = drawingScale(project, drawing, measurementCanvas.page)
    if (kind !== "count" && !(C.number(scaleRecord?.unitsPerPixel) > 0)) return toast("المقياس غير معتمد", "عاير هذه الصفحة ببعد معروف قبل حفظ طول أو مساحة؛ لا يمكن اعتبار البكسل مترًا.", "warning")
    // The CAD review canvas is fitted from model units to pixels. Until the
    // engineer calibrates a page explicitly, use that audited transform so a
    // manually drawn length is expressed in the CAD file's native units.
    const cadFallback = measurementCanvas.cadTransform?.scale ? 1 / Number(measurementCanvas.cadTransform.scale) : 0
    const scale = C.number(scaleRecord?.unitsPerPixel) || cadFallback || 1
    const geometry = C.measurementGeometry(kind, points, scale, points.length)
    const cadUnit = String(drawing?.cadInspection?.model?.units || "").trim()
    const groupId = $("#measurement-group-select")?.value || ""
    const group = (project.measurementGroups || []).find((entry) => entry.id === groupId)
    const measurement = C.createMeasurement({ kind, name: `${kind[0].toUpperCase()}${kind.slice(1)} · ${drawing?.documentNumber || drawing?.title || "Drawing"} · P${measurementCanvas.page}`, quantity: geometry.quantity, pixelQuantity: geometry.pixelQuantity, unit: item?.unit || scaleRecord?.unit || (cadUnit && cadUnit !== "Unitless" ? cadUnit : geometry.unit), scale, points, drawingDocumentId: drawing?.id || "", drawingPage: measurementCanvas.page, drawingRevision: drawing?.revision || "", itemId: item?.id || "", groupId, system: item?.system || drawing?.discipline || "MEP", floor: item?.floor || "", measuredBy: C.activeUser(state)?.name || state.user.name, color: group?.color || (kind === "area" ? "#6d9df5" : kind === "count" ? "#efbe5c" : "#28c7b7") })
    const ok = commit(`إضافة قياس مرئي ${measurement.name}`, () => { project.measurements ||= []; project.measurements.unshift(measurement) })
    if (!ok) return
    measurementCanvas = { ...measurementCanvas, mode: "", points: [] }; render(); toast("تم حفظ القياس كمقترح", item ? `مرتبط بالبند ${item.itemNo}. اعتمده من Quantity Review قبل تحديث التسعير.` : "اربطه ببند BOQ ثم اعتمده من Quantity Review.")
  }

  function changeDrawingPage(value) {
    const project = currentProject(); const drawing = project.documents.find((entry) => entry.id === activeDrawingId); const total = drawingPageCount(drawing, project)
    drawingPage = Math.max(1, Math.min(total, C.number(value) || 1)); measurementCanvas = { ...measurementCanvas, page: drawingPage, points: [], mode: "", image: null, cadTransform: null }; render()
  }

  function renderDrawings() {
    const project = currentProject()
    const drawingDocs = (project.documents || []).filter((document) => document.category === "drawings")
    const currentDrawing = drawingDocs.find((document) => document.id === activeDrawingId) || (!drawingClosed ? drawingDocs.find((document) => document.latestRevision) || drawingDocs[0] : null)
    activeDrawingId = currentDrawing?.id || null
    const totalPages = drawingPageCount(currentDrawing, project)
    drawingPage = Math.max(1, Math.min(totalPages, drawingPage || 1))
    measurementCanvas = { ...measurementCanvas, drawingId: activeDrawingId, page: drawingPage }
    const scale = drawingScale(project, currentDrawing, drawingPage)
    const groups = project.measurementGroups || []
    const linked = project.boq.filter((item) => item.drawingDocumentId || C.number(item.takeoffQuantity)).length
    const variances = project.boq.filter((item) => C.number(item.takeoffQuantity) && C.number(item.takeoffQuantity) !== C.number(item.quantity)).length
    const currentMeasurements = (project.measurements || []).filter((entry) => (!currentDrawing || entry.drawingDocumentId === currentDrawing.id) && C.number(entry.drawingPage) === drawingPage)
    const prior = previousDrawingRevision(project, currentDrawing)
    const pageState = currentDrawing ? `Page ${drawingPage} / ${totalPages}` : "No drawing selected"
    const itemOptions = project.boq.map((item) => `<option value="${esc(item.id)}" ${item.id === activeItemId ? "selected" : ""}>${esc(item.itemNo)} · ${esc(item.description).slice(0, 55)}</option>`).join("")
    const revisionOptions = drawingDocs.filter((entry) => entry.id !== currentDrawing?.id && C.normalizeHeader(entry.documentNumber || entry.title || entry.originalName) === C.normalizeHeader(currentDrawing?.documentNumber || currentDrawing?.title || currentDrawing?.originalName)).map((entry) => `<option value="${esc(entry.id)}" ${entry.id === measurementCanvas.revisionOverlayId ? "selected" : ""}>${esc(entry.documentNumber || entry.title)} · Rev ${esc(entry.revision)}</option>`).join("")
    return `<div class="drawing-workspace-shell">
      <header class="workbench-head drawing-workbench-head"><div><h1>Drawings &amp; Dimensions</h1><p>${esc(project.name)} · ${drawingDocs.length} drawing files · ${linked}/${project.boq.length} BOQ links · ${pageState}</p></div><div class="page-actions no-print"><button class="secondary-btn tiny-btn" data-action="open-building-selector">${icon("folder")} Select Building</button><button class="secondary-btn tiny-btn" data-action="upload-tender-files">${icon("upload")} Import Drawing</button><button class="primary-btn tiny-btn" data-view="boq">${icon("link")} Link to BOQ</button></div></header>
      <div class="drawing-toolbar no-print"><div class="drawing-tool-group"><button class="drawing-tool active" data-action="drawing-fit">${icon("grid")} Fit</button><button class="drawing-tool" data-action="drawing-zoom-out">${icon("minus")} −</button><span class="zoom-readout">${Math.round(C.number(measurementCanvas.zoom || 1) * 100)}%</span><button class="drawing-tool" data-action="drawing-zoom-in">${icon("plus")} +</button><button class="drawing-tool ${measurementCanvas.snap ? "active" : ""}" data-action="toggle-snap">⌁ Snap</button></div><div class="drawing-file-label"><span class="status-dot ${currentDrawing ? "priced" : "unpriced"}"></span><strong>${esc(currentDrawing ? (currentDrawing.documentNumber || currentDrawing.title) : "No drawing selected")}</strong>${currentDrawing ? `<small>Rev ${esc(currentDrawing.revision)} · ${esc(currentDrawing.fileType || "PDF")} · ${pageState}</small>` : ""}</div><div class="drawing-tool-group"><button class="drawing-tool ${measurementCanvas.mode === "calibrate" ? "active" : ""}" data-action="calibrate-scale">${icon("ruler")} Scale</button><button class="drawing-tool ${measurementCanvas.kind === "length" && measurementCanvas.mode === "measure" ? "active" : ""}" data-action="start-measure" data-kind="length">${icon("ruler")} Length</button><button class="drawing-tool ${measurementCanvas.kind === "polyline" && measurementCanvas.mode === "measure" ? "active" : ""}" data-action="start-measure" data-kind="polyline">⌁ Polyline</button><button class="drawing-tool ${measurementCanvas.kind === "area" && measurementCanvas.mode === "measure" ? "active" : ""}" data-action="start-measure" data-kind="area">${icon("grid")} Area</button><button class="drawing-tool ${measurementCanvas.kind === "perimeter" && measurementCanvas.mode === "measure" ? "active" : ""}" data-action="start-measure" data-kind="perimeter">⌒ Perimeter</button><button class="drawing-tool ${measurementCanvas.kind === "count" && measurementCanvas.mode === "measure" ? "active" : ""}" data-action="start-measure" data-kind="count">${icon("plus")} Count</button>${measurementCanvas.mode ? `<button class="primary-btn tiny-btn" data-action="finish-measurement">Finish</button><button class="ghost-btn tiny-btn" data-action="cancel-measurement">Cancel</button>` : ""}</div></div>
      <div class="drawing-page-controls no-print"><div class="drawing-page-nav"><button class="drawing-tool" data-action="drawing-page-prev" ${drawingPage <= 1 ? "disabled" : ""}>‹</button><label>Page <input id="drawing-page-input" data-drawing-page type="number" min="1" max="${totalPages}" value="${drawingPage}" /></label><span>/ ${totalPages}</span><button class="drawing-tool" data-action="drawing-page-next" ${drawingPage >= totalPages ? "disabled" : ""}>›</button><span class="drawing-scale-badge">${scale ? `Scale ${num(scale.unitsPerPixel, 6)} ${esc(scale.unit || "m")}/pixel` : "Scale not calibrated"}</span></div><div class="drawing-link-controls"><label>Link new measurement to <select id="measurement-boq-item"><option value="">Unlinked measurement</option>${itemOptions}</select></label><label>Group <select id="measurement-group-select"><option value="">Default</option>${groups.map((group) => `<option value="${esc(group.id)}">${esc(group.name)}</option>`).join("")}</select></label>${prior ? `<label class="revision-overlay-control">Overlay <select id="revision-overlay-select"><option value="">Off</option>${revisionOptions}</select></label><button class="secondary-btn tiny-btn" data-action="carry-drawing-measurements" data-before="${esc(prior.id)}">Carry from Rev ${esc(prior.revision)}</button>` : ""}</div></div>
      <div class="drawing-dock-layout">
        <aside class="drawing-left-dock">
          <section class="dock-panel drawing-doc-panel"><header><strong>Drawings</strong><button class="icon-btn tiny-icon" data-action="upload-tender-files" title="Import">${icon("plus")}</button></header><div class="dock-tabs"><button class="active">Drawings</button><button>Layers</button><button>Model</button><button>Views</button></div><div class="drawing-list">${drawingDocs.map((document) => `<button class="drawing-list-item ${document.id === activeDrawingId ? "active" : ""}" data-action="select-drawing" data-id="${esc(document.id)}"><span class="drawing-file-icon">${esc(document.fileType || "PDF")}</span><span><strong>${esc(document.documentNumber || document.title)}</strong><small>Rev ${esc(document.revision)} · ${esc(document.discipline || "MEP")} · ${document.status === "superseded" ? "Superseded" : "Current"}</small></span></button>`).join("") || `<div class="dock-empty">No drawing files yet.<br /><button class="secondary-btn tiny-btn" data-action="upload-tender-files">Import files</button></div>`}</div></section>
          <section class="dock-panel dimension-panel"><header><strong>Dimension Groups</strong><button class="icon-btn tiny-icon" data-action="add-measurement" title="New group">${icon("plus")}</button></header><div class="dock-tabs"><button class="active">Dimensions</button><button>Auto Count</button></div><div class="dimension-list">${groups.length ? `<div class="dimension-group-list">${groups.map((group) => { const count = currentMeasurements.filter((entry) => entry.groupId === group.id).length; return `<div class="dimension-group-chip"><span class="group-color-dot" style="background:${esc(group.color)}"></span><span><strong>${esc(group.name)}</strong><small>${esc(group.system || "General")} · ${count} on page</small></span></div>` }).join("")}</div>` : ""}${currentMeasurements.map((entry) => { const group = groups.find((candidate) => candidate.id === entry.groupId); return `<div class="dimension-row"><span class="dimension-mark ${esc(entry.kind || "length")}" style="${group ? `background:${esc(group.color)}` : ""}">${entry.kind === "area" ? "A" : entry.kind === "count" ? "#" : entry.kind === "perimeter" ? "P" : "L"}</span><div><strong>${esc(entry.name)}</strong><small>${num(entry.quantity)} ${esc(entry.unit || "m")} · ${entry.approved ? "Approved" : "Pending Review"} · ${group ? esc(group.name) : "Default"} · ${entry.itemId ? "BOQ linked" : "Unlinked"}</small></div></div>` }).join("") || `<div class="dock-empty">No measurements on this page.<br /><button class="ghost-btn tiny-btn" data-action="start-measure" data-kind="length">New length</button></div>`}</div></section>
        </aside>
        <section class="drawing-stage" aria-label="PDF drawing workspace"><div id="stage-canvas" class="stage-canvas"><div id="pdf-canvas-stage" class="pdf-canvas-stage"><canvas id="pdf-page-canvas" aria-label="PDF page"></canvas><canvas id="measurement-overlay" aria-label="Measurement overlay"></canvas></div>${!currentDrawing ? `<div class="canvas-watermark"><span>Q</span><strong>QESTIMA DRAWING VIEW</strong><small>Import a PDF or DXF to begin review</small></div>` : String(currentDrawing.fileType || "").toUpperCase() !== "PDF" ? (currentDrawing.cadInspection?.model?.entities?.length ? "" : `<div class="canvas-watermark"><span>${esc(currentDrawing.fileType || "CAD")}</span><strong>${esc(currentDrawing.documentNumber || currentDrawing.title)}</strong><small>Inspect the CAD file to build a layer and geometry index.</small></div>`) : `<div id="canvas-loading-hint" class="canvas-loading-hint">${measurementCanvas.image ? "" : "Loading PDF page…"}</div>`}<div class="canvas-crosshair"></div><div class="canvas-rulers top-ruler"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div><div class="canvas-rulers side-ruler"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div><div class="stage-status"><span>${currentDrawing ? `${String(currentDrawing.fileType || "").toUpperCase() === "PDF" ? "PDF page ready" : "CAD review canvas ready"} · ${pageState}` : "Waiting for drawing"}</span><span>Scale: <b>${scale ? `${num(scale.unitsPerPixel, 6)} ${esc(scale.unit || "m")}/px` : "Not set"}</b></span><span>Snap: <b>${measurementCanvas.snap ? "On" : "Off"}</b></span><span>Measurements: <b>${currentMeasurements.length}</b></span></div></section>
        <aside class="drawing-right-dock" aria-label="Drawing properties and rate inspector">
          <section class="dock-panel property-panel"><header><strong>Properties</strong><span class="status-dot ${currentDrawing ? "priced" : "unpriced"}"></span></header><div class="property-list"><div class="property-row"><span>Drawing</span><strong>${esc(currentDrawing?.documentNumber || currentDrawing?.title || "No selection")}</strong></div><div class="property-row"><span>Revision</span><strong>${esc(currentDrawing?.revision || "—")}</strong></div><div class="property-row"><span>Discipline</span><strong>${esc(currentDrawing?.discipline || "MEP")}</strong></div><div class="property-row"><span>Page</span><strong>${currentDrawing ? `${num(drawingPage)} / ${num(totalPages)}` : "—"}</strong></div><div class="property-row"><span>Scale</span><strong>${scale ? `${num(scale.unitsPerPixel, 6)} ${esc(scale.unit || "m")}/px` : "Not calibrated"}</strong></div><div class="property-row"><span>Source</span><strong>${esc(currentDrawing?.originalName || currentDrawing?.attachment?.name || "—")}</strong></div></div><footer><button class="secondary-btn tiny-btn" data-action="drawing-properties" ${currentDrawing ? "" : "disabled"}>Open full properties</button></footer></section>
          <section class="dock-panel inspector-panel"><header><strong>Rate Inspector</strong><span class="badge teal">${activeItemId ? "BOQ linked" : "Unlinked"}</span></header><div class="property-list">${(() => { const item = project.boq.find((entry) => entry.id === activeItemId); return item ? `<div class="property-row"><span>Item</span><strong>${esc(item.itemNo)}</strong></div><div class="property-row"><span>Description</span><strong>${esc(item.description)}</strong></div><div class="property-row"><span>BOQ Qty</span><strong>${num(item.quantity)} ${esc(item.unit)}</strong></div><div class="property-row"><span>Takeoff Qty</span><strong>${C.number(item.takeoffQuantity) ? `${num(item.takeoffQuantity)} ${esc(item.unit)}` : "—"}</strong></div><div class="property-row"><span>Rate</span><strong>${money(C.itemCostUnit(project, item, state.resources))}</strong></div>` : `<div class="dock-empty">اختر بندًا من BOQ لعرض التحليل والسعر هنا.</div>` })()}</div><footer><button class="secondary-btn tiny-btn" data-view="boq">Open BOQ</button><button class="primary-btn tiny-btn" data-view="analysis" ${activeItemId ? "" : "disabled"}>Rate Analysis</button></footer></section>
        </aside>
      </div>
      <div class="drawing-notice"><span>${icon("alert")}</span><div><strong>PDF measurement + DXF index are ready</strong><small>القياس المرئي داخل PDF يحفظ الصفحة والمقياس والـRevision والمستخدم وBOQ المقترح. DXF يُفهرس طبقات وعناصر وأطوالًا ومساحات كاقتراحات قابلة للمراجعة. لا تنتقل أي كمية إلى التسعير إلا بعد اعتماد المهندس. DWG يحتاج محوّلًا معتمدًا أو CAD SDK.</small></div><button class="secondary-btn tiny-btn" data-view="quantity_review">Quantity Review</button></div>
      <div class="drawing-summary-strip"><div><span>Current drawing</span><strong>${esc(currentDrawing ? (currentDrawing.documentNumber || currentDrawing.title) : "—")}</strong></div><div><span>Linked items</span><strong>${linked}</strong></div><div><span>Quantity variances</span><strong class="${variances ? "text-danger" : "text-success"}">${variances}</strong></div><div><span>Measurement sheets</span><strong>${project.measurements.length}</strong></div></div>
    </div>`
  }

  function openModal(title, subtitle, body, footer, large = false) {
    $("#modal-root").innerHTML = `<div class="modal-backdrop"><section class="modal ${large ? "large" : ""}"><header class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle || "")}</p></div><button data-action="close-modal">${icon("x")}</button></header><div class="modal-body">${body}</div><footer class="modal-foot">${footer || `<button class="secondary-btn" data-action="close-modal">إغلاق</button>`}</footer></section></div>`
  }

  function closeModal() {
    $("#modal-root").innerHTML = ""
  }

  function projectModal(project = null) {
    const editing = Boolean(project)
    const value = project || { name: "", client: "", consultant: "", mainContractor: "", location: "", tenderNumber: "", deadline: "", pricingBaseDate: new Date().toISOString().slice(0, 10), currency: "SAR", tax: 15, projectType: "Commercial", disciplines: ["HVAC", "Fire Fighting", "Plumbing"], workflowMode: "standard", status: "draft" }
    const createChoices = editing ? "" : `<div class="field full"><label>طريقة البدء</label><div class="mode-cards"><label class="mode-card"><input type="radio" name="creationMode" value="blank" checked/><strong>مشروع فارغ</strong><span>ابدأ Tender Intake يدويًا.</span></label><label class="mode-card"><input type="radio" name="creationMode" value="package"/><strong>استيراد Tender Package</strong><span>أنشئ المشروع ثم ارفع Folder أو ZIP.</span></label><label class="mode-card"><input type="radio" name="creationMode" value="copy"/><strong>نسخ مشروع سابق</strong><span>استخدم الأسعار والتحليلات كنقطة بداية.</span></label></div></div><div class="field full"><label>المشروع المصدر للنسخ</label><select name="sourceProjectId"><option value="">— اختر عند استخدام نسخ مشروع سابق —</option>${state.projects.filter((entry) => entry.id !== project?.id).map((entry) => `<option value="${esc(entry.id)}">${esc(entry.name)} · ${esc(entry.tenderCode)}</option>`).join("")}</select></div>`
    openModal(editing ? "تعديل بيانات المشروع" : "إنشاء مشروع جديد", "بعد الإنشاء ينتقل Standard Mode إلى Tender Documents، بينما يبدأ Quick Mode من BOQ مع تحذير مستمر.", `
      <form id="project-form" data-id="${esc(project?.id || "")}"><div class="field-grid cols-3">
        ${createChoices}
        <div class="field full"><label>Project Name *</label><input name="name" required value="${esc(value.name)}" placeholder="مثال: مشروع مجمع طبي" /></div>
        <div class="field"><label>Client</label><input name="client" value="${esc(value.client)}" /></div>
        <div class="field"><label>Consultant</label><input name="consultant" value="${esc(value.consultant)}" /></div>
        <div class="field"><label>Main Contractor</label><input name="mainContractor" value="${esc(value.mainContractor)}" /></div>
        <div class="field"><label>Project Location</label><input name="location" value="${esc(value.location)}" /></div>
        <div class="field"><label>Tender Number</label><input name="tenderNumber" value="${esc(value.tenderNumber)}" /></div>
        <div class="field"><label>Submission Deadline</label><input type="date" name="deadline" value="${esc(value.deadline)}" /></div>
        <div class="field"><label>Pricing Base Date</label><input type="date" name="pricingBaseDate" value="${esc(value.pricingBaseDate)}" /></div>
        <div class="field"><label>Project Type</label><select name="projectType">${["Hospital","School","Mall","Residential","Commercial","Industrial","Infrastructure","Other"].map((type) => `<option value="${type}" ${type === value.projectType ? "selected" : ""}>${type}</option>`).join("")}</select></div>
        <div class="field"><label>Currency</label><select name="currency">${Object.keys(currencyLabels).map((currency) => `<option value="${currency}" ${currency === value.currency ? "selected" : ""}>${currency}</option>`).join("")}</select></div>
        <div class="field"><label>VAT %</label><input type="number" name="tax" min="0" step=".5" value="${C.number(value.tax)}" /></div>
        <div class="field"><label>Project Status</label><select name="status">${["draft", "pricing", "review", "submitted", "awarded", "lost"].map((status) => `<option value="${status}" ${status === value.status ? "selected" : ""}>${statusLabels[status]}</option>`).join("")}</select></div>
        <div class="field full"><label>Disciplines</label><div class="check-grid">${["HVAC","Fire Fighting","Plumbing","Electrical","Civil"].map((discipline) => `<label><input type="checkbox" name="disciplines" value="${discipline}" ${(value.disciplines || []).includes(discipline) ? "checked" : ""}/> ${discipline}</label>`).join("")}</div></div>
        <div class="field full"><label>Workflow Mode</label><div class="mode-cards"><label class="mode-card"><input type="radio" name="workflowMode" value="standard" ${value.workflowMode !== "quick" ? "checked" : ""}/><strong>Standard Tender Workflow</strong><span>Documents → Review → Scope → BOQ → Pricing</span></label><label class="mode-card"><input type="radio" name="workflowMode" value="quick" ${value.workflowMode === "quick" ? "checked" : ""}/><strong>Quick Pricing Mode</strong><span>BOQ مباشرة مع Tender Review Incomplete</span></label></div></div>
      </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="project-form">${editing ? "حفظ التعديلات" : "إنشاء وبدء المشروع"}</button>`, true)
  }

  function boqModal() {
    openModal("إضافة بند BOQ", "يمكنك تعديله لاحقًا مباشرةً داخل Pricing Sheet.", `
      <form id="boq-form"><div class="field-grid">
        <div class="field"><label>Item No *</label><input name="itemNo" required /></div><div class="field"><label>الوحدة *</label><input name="unit" required placeholder="م.ط / عدد / م²" /></div>
        <div class="field full"><label>الوصف *</label><textarea name="description" required></textarea></div>
        <div class="field"><label>الكمية</label><input type="number" step=".001" name="quantity" value="0" /></div><div class="field"><label>القسم</label><input name="section" value="HVAC" /></div>
        <div class="field"><label>السيستم</label><input name="system" value="MEP" /></div><div class="field"><label>الدور</label><input name="floor" value="عام" /></div>
      </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="boq-form">إضافة البند</button>`)
  }

  function boqLinkModal(item) {
    const project = currentProject()
    const variance = C.number(item.takeoffQuantity) - C.number(item.quantity)
    openModal(`ربط البند ${item.itemNo}`, "اربط الكمية بمصدرها وحدد قرار التسعير. أي فرق يظل ظاهرًا في BOQ والتقارير.", `
      <form id="boq-link-form" data-id="${item.id}"><div class="field-grid cols-3">
        <div class="field full"><label>BOQ Item</label><input disabled value="${esc(item.description)}" /></div>
        <div class="field"><label>Drawing Number / Revision</label><select name="drawingDocumentId">${documentOptions(project, item.drawingDocumentId, "drawings")}</select></div>
        <div class="field"><label>Specification Document</label><select name="specificationDocumentId">${documentOptions(project, item.specificationDocumentId, "specifications")}</select></div>
        <div class="field"><label>Specification Section</label><input name="specificationSection" value="${esc(item.specificationSection)}" placeholder="23 21 13" /></div>
        <div class="field"><label>Building</label><input name="building" value="${esc(item.building)}" /></div>
        <div class="field"><label>Floor / Zone</label><input name="floorZone" value="${esc(item.floorZone || item.floor)}" /></div>
        <div class="field"><label>Supplier RFQ</label><select name="linkedRfqId"><option value="">— غير مرتبط —</option>${project.rfqs.map((rfq) => `<option value="${rfq.id}" ${rfq.id === item.linkedRfqId ? "selected" : ""}>${esc(rfq.title)}</option>`).join("")}</select></div>
        <div class="field"><label>BOQ Quantity</label><input disabled value="${C.number(item.quantity)} ${esc(item.unit)}" /></div>
        <div class="field"><label>Takeoff Quantity</label><input type="number" step=".001" name="takeoffQuantity" value="${C.number(item.takeoffQuantity)}" /></div>
        <div class="field"><label>Quantity Used for Pricing</label><select name="quantityBasis"><option value="boq" ${item.quantityBasis !== "takeoff" ? "selected" : ""}>Use BOQ Quantity</option><option value="takeoff" ${item.quantityBasis === "takeoff" ? "selected" : ""}>Use Takeoff Quantity</option></select></div>
        <div class="field full"><div class="variance-box ${variance ? "has-variance" : ""}"><span>Current Variance</span><strong>${variance > 0 ? "+" : ""}${num(variance)} ${esc(item.unit)}</strong><small>بعد الحفظ يمكنك إنشاء Clarification أو Tender Qualification تلقائيًا.</small></div></div>
        <div class="field full"><label>Variance Action</label><select name="varianceAction"><option value="none">No additional action</option><option value="clarification">Create Tender Clarification</option><option value="assumption">Create Tender Qualification / Assumption</option></select></div>
      </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="boq-link-form">حفظ الربط والقرار</button>`, true)
  }

  function scopeModal() {
    openModal("إضافة System إلى Scope Matrix", "أضف النظام ثم راجع توافر BOQ والرسومات والمواصفات.", `<form id="scope-form"><div class="field-grid"><div class="field full"><label>System *</label><input name="system" required placeholder="مثال: BMS Controls" /></div><div class="field"><label>داخل النطاق؟</label><select name="inScope"><option value="yes">Yes</option><option value="partial">Partial</option><option value="no">No</option></select></div><div class="field"><label>Notes</label><input name="notes" /></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="scope-form">إضافة</button>`)
  }

  function riskModal() {
    const project = currentProject()
    openModal("إضافة Clarification أو Risk", "سجل النوع والإجراء والمصدر حتى يظهر في المراجعة والتقارير.", `<form id="risk-form"><div class="field-grid cols-3">
      <div class="field"><label>Type</label><select name="type">${Object.entries(riskTypeLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select></div>
      <div class="field"><label>Severity</label><select name="severity"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></div>
      <div class="field"><label>Status</label><select name="status"><option value="open">Open</option><option value="sent">Sent</option><option value="answered">Answered</option><option value="closed">Closed</option></select></div>
      <div class="field full"><label>Title *</label><input name="title" required /></div><div class="field full"><label>Description / Required Action</label><textarea name="description"></textarea></div>
      <div class="field"><label>Source Document</label><select name="sourceDocumentId">${documentOptions(project)}</select></div><div class="field"><label>Source Page</label><input name="sourcePage" /></div><div class="field"><label>Owner</label><input name="owner" /></div><div class="field"><label>Due Date</label><input type="date" name="dueDate" /></div>
    </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="risk-form">حفظ</button>`, true)
  }

  function resourceModal() {
    openModal("إضافة مورد للمكتبة", "السعر سيظل مرتبطًا بتاريخ ومصدر ويمكن تحديثه من عرض مورد.", `
      <form id="resource-form"><div class="field-grid">
        <div class="field"><label>الكود *</label><input name="code" required placeholder="MAT-CHW-001" /></div><div class="field"><label>اسم المورد / المورد المادي *</label><input name="name" required /></div>
        <div class="field"><label>نوع التكلفة</label><select name="type">${Object.entries(resourceTypeLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div><div class="field"><label>تصنيف MEP</label><input name="category" value="HVAC" /></div>
        <div class="field"><label>الوحدة *</label><input name="unit" required /></div><div class="field"><label>السعر الحالي</label><input type="number" step=".01" name="rate" value="0" /></div>
        <div class="field"><label>المورد</label><select name="supplierId"><option value="">معدل داخلي / غير محدد</option>${state.suppliers.map((entry) => `<option value="${entry.id}">${esc(entry.name)}</option>`).join("")}</select></div><div class="field"><label>المنطقة</label><input name="region" value="الرياض" /></div>
        <div class="field full"><label>مصدر السعر</label><input name="sourceProject" value="${esc(currentProject().name)}" /></div>
      </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="resource-form">إضافة للمكتبة</button>`)
  }

  function analysisLineModal() {
    if (!state.resources.length) return toast("مكتبة الموارد فارغة", "أضف موردًا أولًا.", "warning")
    openModal("إضافة مورد لتحليل السعر", "حدد المورد ومعامل الاستهلاك لكل وحدة من بند BOQ.", `
      <form id="analysis-line-form"><div class="field-grid">
        <div class="field full"><label>المورد</label><select name="resourceId">${state.resources.map((resource) => `<option value="${resource.id}">${esc(resource.code)} — ${esc(resource.name)} (${money(resource.rate)} / ${esc(resource.unit)})</option>`).join("")}</select></div>
        <div class="field"><label>المعامل لكل وحدة</label><input type="number" name="factor" min=".0001" step=".001" value="1" /></div>
      </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="analysis-line-form">إضافة للتحليل</button>`)
  }

  function rateAssemblyModal(itemId = activeItemId, assemblyId = "") {
    const project = currentProject()
    const assemblies = state.rateAssemblies || C.defaultRateAssemblies()
    if (!assemblies.length) return toast("لا توجد قوالب Rate Assembly", "أضف قالبًا أو استخدم Add Resource.", "warning")
    const assembly = assemblies.find((entry) => entry.id === assemblyId) || assemblies[0]
    const resourceOptions = (type, search) => {
      const byType = state.resources.filter((resource) => resource.type === type || !type)
      const query = C.normalizeHeader(search)
      const matches = query ? byType.filter((resource) => C.normalizeHeader(`${resource.code} ${resource.name} ${resource.category}`).includes(query)) : byType
      return (matches.length ? matches : byType).map((resource) => `<option value="${resource.id}">${esc(resource.code)} — ${esc(resource.name)} (${money(resource.rate)})</option>`).join("")
    }
    openModal("Dynamic Rate Assembly", "قالب قابل للتعديل — راجع الموارد والمعدلات قبل إضافتها لتحليل البند.", `<form id="assembly-form"><input type="hidden" name="itemId" value="${esc(itemId)}" /><div class="field-grid"><div class="field full"><label>Assembly Template</label><select name="assemblyId" id="assembly-select">${assemblies.map((entry) => `<option value="${entry.id}" ${entry.id === assembly.id ? "selected" : ""}>${esc(entry.name)} · ${esc(entry.discipline)} · ${esc(entry.unit)}</option>`).join("")}</select></div><div class="field full"><p class="field-hint">يمكنك تغيير كل Resource أو معامل الاستهلاك. القالب لا يفرض سعرًا ثابتًا.</p></div>${assembly.components.map((component, index) => `<div class="field"><label>${esc(component.label)} · ${esc(component.type)}</label><select name="resource-${index}"><option value="">— Skip component —</option>${resourceOptions(component.type, component.search)}</select></div><div class="field"><label>Consumption / Unit</label><input type="number" step="0.001" min="0" name="factor-${index}" value="${C.number(component.factor)}" /></div>`).join("")}</div></form>`, `<button class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn" type="submit" form="assembly-form">Add to Analysis</button>`, true)
  }

  function copyAnalysisModal() {
    const project = currentProject()
    const sources = project.boq.filter((item) => item.id !== activeItemId && (project.analyses[item.id]?.lines || []).length)
    if (!sources.length) return toast("لا يوجد تحليل سابق", "أنشئ تحليلًا لبند آخر أولًا ثم أعد استخدامه.", "warning")
    openModal("Copy Previous Unit Rate Analysis", "سيتم نسخ الموارد والمعاملات ولقطات الأسعار إلى البند الحالي، ويمكن تعديل النسخة بصورة مستقلة.", `<form id="copy-analysis-form"><div class="field-grid"><div class="field full"><label>Source BOQ Item</label><select name="sourceItemId">${sources.map((item) => `<option value="${item.id}">${esc(item.itemNo)} — ${esc(item.description)} · ${project.analyses[item.id].lines.length} resources</option>`).join("")}</select></div><div class="field full"><label class="badge amber"><input type="checkbox" name="replaceExisting" ${project.analyses[activeItemId]?.lines?.length ? "" : "checked"} /> Replace current analysis if it already contains resources</label></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn" type="submit" form="copy-analysis-form">Copy Analysis</button>`)
  }

  function supplierModal() {
    openModal("إضافة مورد أو مقاول", "يظهر في طلبات الأسعار والمقارنة الفنية والتجارية.", `<form id="supplier-form"><div class="field-grid"><div class="field full"><label>اسم الشركة *</label><input name="name" required /></div><div class="field"><label>جهة الاتصال</label><input name="contact" /></div><div class="field"><label>المنطقة</label><input name="region" value="الرياض" /></div><div class="field"><label>البريد</label><input type="email" name="email" /></div><div class="field"><label>الهاتف</label><input name="phone" /></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="supplier-form">إضافة المورد</button>`)
  }

  function rfqModal() {
    const project = currentProject()
    openModal("إنشاء طلب أسعار RFQ", "اختر الموردين والبنود وسجل موعد المتابعة.", `<form id="rfq-form"><div class="field-grid">
      <div class="field full"><label>عنوان الطلب *</label><input name="title" required value="RFQ ${esc(project.name)}" /></div>
      <div class="field full"><label>الموردون</label><div style="display:flex;flex-wrap:wrap;gap:8px">${state.suppliers.map((supplier) => `<label class="badge"><input type="checkbox" name="supplierIds" value="${supplier.id}" /> ${esc(supplier.name)}</label>`).join("")}</div></div>
      <div class="field full"><label>بنود BOQ</label><select name="targetIds" multiple size="6">${project.boq.map((item) => `<option value="${item.id}">${esc(item.itemNo)} — ${esc(item.description)}</option>`).join("")}</select><span class="field-hint">استخدم Ctrl لاختيار أكثر من بند، أو اتركها بدون اختيار لإرسال جميع البنود.</span></div>
      <div class="field"><label>تاريخ الإرسال</label><input type="date" name="sentAt" value="${new Date().toISOString().slice(0, 10)}" /></div><div class="field"><label>موعد الرد</label><input type="date" name="dueAt" /></div>
      <div class="field full"><label>ملاحظات</label><textarea name="notes"></textarea></div>
    </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="rfq-form">حفظ RFQ</button>`, true)
  }

  function quoteModal() {
    if (!state.suppliers.length) return toast("أضف موردًا أولًا", "لا يمكن تسجيل عرض بدون مورد.", "warning")
    openModal("تسجيل عرض مورد / مقاول", "سجل البيانات التجارية ثم أضف أسعار البنود إلى المقارنة.", `<form id="quote-form"><div class="field-grid cols-3">
      <div class="field"><label>المورد *</label><select name="supplierId">${state.suppliers.map((supplier) => `<option value="${supplier.id}">${esc(supplier.name)}</option>`).join("")}</select></div><div class="field"><label>مرجع العرض</label><input name="reference" /></div><div class="field"><label>تاريخ العرض</label><input type="date" name="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
      <div class="field"><label>العملة</label><select name="currency">${Object.keys(currencyLabels).map((currency) => `<option value="${currency}" ${currency === currentProject().currency ? "selected" : ""}>${currency}</option>`).join("")}</select></div><div class="field"><label>VAT %</label><input type="number" name="vat" value="15" /></div><div class="field"><label>Validity (days)</label><input type="number" name="validityDays" value="30" min="0" /></div>
      <div class="field"><label>Discount %</label><input type="number" step=".25" name="discountPercent" value="0" min="0" /></div><div class="field"><label>Freight / Unit</label><input type="number" step=".01" name="freightUnit" value="0" min="0" /></div><div class="field"><label>Risk %</label><input type="number" step=".25" name="riskPercent" value="0" min="0" /></div>
      <div class="field"><label>مدة التوريد</label><input name="delivery" /></div><div class="field"><label>شروط الدفع</label><input name="payment" /></div><div class="field"><label>الضمان</label><input name="warranty" /></div><div class="field"><label>الملف الأصلي</label><label class="badge teal"><input type="checkbox" name="attachNow" /> إرفاق بعد الحفظ</label></div>
    </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="quote-form">تسجيل العرض</button>`)
  }

  function quoteLineModal() {
    const project = currentProject()
    if (!project.quotes.length) return toast("سجل عرضًا أولًا", "أضف بيانات المورد والعرض قبل إدخال الأسعار.", "warning")
    openModal("إضافة سعر إلى المقارنة", "يمكن ربط السعر ببند BOQ أو Resource؛ اعتماد Resource يحدث كل التحليلات المرتبطة.", `<form id="quote-line-form"><div class="field-grid">
      <div class="field full"><label>العرض</label><select name="quoteId">${project.quotes.map((quote) => `<option value="${quote.id}">${esc(state.suppliers.find((supplier) => supplier.id === quote.supplierId)?.name || "مورد")} — ${esc(quote.reference || dateLabel(quote.date))}</option>`).join("")}</select></div>
      <div class="field"><label>نوع العنصر</label><select name="targetType" id="quote-target-type"><option value="boq">بند BOQ</option><option value="resource">Resource من المكتبة</option></select></div>
      <div class="field"><label>العنصر</label><select name="targetId" id="quote-target-id">${project.boq.map((item) => `<option value="${item.id}" data-type="boq">${esc(item.itemNo)} — ${esc(item.description)}</option>`).join("")}${state.resources.map((resource) => `<option value="${resource.id}" data-type="resource" hidden>${esc(resource.code)} — ${esc(resource.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Brand</label><input name="brand" /></div><div class="field"><label>Model</label><input name="model" /></div><div class="field"><label>Quoted Unit</label><input name="unit" placeholder="m, m², nr" /></div><div class="field"><label>Unit Price *</label><input type="number" step=".01" min="0" name="unitPrice" required /></div><div class="field"><label>Discount %</label><input type="number" step=".25" min="0" name="discountPercent" value="0" /></div><div class="field"><label>Freight / Unit</label><input type="number" step=".01" min="0" name="freightUnit" value="0" /></div><div class="field"><label>Risk %</label><input type="number" step=".25" min="0" name="riskPercent" value="0" /></div><div class="field"><label>Compliance</label><select name="compliant"><option value="true">Compliant</option><option value="false">Deviation</option></select></div>
      <div class="field"><label>Deviation</label><textarea name="deviation"></textarea></div><div class="field"><label>Notes</label><textarea name="notes"></textarea></div>
    </div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="quote-line-form">إضافة السعر</button>`, true)
  }

  function scenarioModal() {
    openModal("سيناريو تسعير جديد", "انسخ القيم الأساسية ثم عدلها للمقارنة.", `<form id="scenario-form"><div class="field-grid"><div class="field full"><label>اسم السيناريو *</label><input name="name" required placeholder="Tender Revision A" /></div>${["indirectPercent", "contingencyPercent", "escalationPercent", "profitPercent", "discountPercent", "vatPercent"].map((field) => `<div class="field"><label>${field}</label><input type="number" step=".25" name="${field}" value="${C.number(currentScenario()[field])}" /></div>`).join("")}</div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="scenario-form">إضافة السيناريو</button>`)
  }

  function commentModal() {
    const project = currentProject()
    openModal("إضافة تعليق ومهمة", "اربط الملاحظة ببند وحدد الشخص أو الموعد عند الحاجة.", `<form id="comment-form"><div class="field-grid"><div class="field full"><label>التعليق *</label><textarea name="text" required placeholder="@Procurement نحتاج عرضًا محدثًا للبند…"></textarea></div><div class="field"><label>البند</label><select name="itemId"><option value="">على مستوى المشروع</option>${project.boq.map((item) => `<option value="${item.id}">${esc(item.itemNo)} — ${esc(item.description)}</option>`).join("")}</select></div><div class="field"><label>المسؤول / Mention</label><input name="mention" placeholder="Procurement" /></div><div class="field"><label>موعد المتابعة</label><input type="date" name="dueDate" /></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="comment-form">حفظ التعليق</button>`)
  }

  function backupModal() {
    openModal("النسخ الاحتياطي والاستعادة", "حزمة المشروع تشمل قاعدة البيانات والمرفقات والإصدارات، مع الإبقاء على النسخة الأصلية.", `<div class="layout-even"><button class="project-card" data-action="export-project-package"><div class="empty-icon">${icon("download")}</div><h3>تصدير Project Package</h3><p>بيانات + مستندات + مرفقات + Manifest.</p></button><button class="project-card" data-action="import-project-package"><div class="empty-icon">${icon("upload")}</div><h3>استعادة Project Package</h3><p>استعادة كاملة بعد التحقق من الحزمة.</p></button><button class="project-card" data-action="export-backup"><div class="empty-icon">${icon("download")}</div><h3>JSON Legacy</h3><p>للتوافق مع الإصدارات القديمة.</p></button></div>`, `<button class="secondary-btn" data-action="close-modal">إغلاق</button>`)
  }

  function companyProfileModal() {
    const company = state.companyProfile || {}
    if (!C.can(state, "project.edit", currentProject())) return toast("الصلاحية غير متاحة", "تعديل بيانات الشركة يحتاج System Admin أو Estimation Manager.", "warning")
    openModal("Company Branding & Report Templates", "هذه البيانات تظهر في Header وFooter وملفات PDF/Excel المصدّرة.", `<form id="company-profile-form"><div class="field-grid cols-2"><div class="field full"><label>Company Name *</label><input name="name" required value="${esc(company.name || "QESTIMA")}" /></div><div class="field full"><label>Tagline</label><input name="tagline" value="${esc(company.tagline || "MEP Estimating System")}" /></div><div class="field"><label>Address</label><input name="address" value="${esc(company.address || "")}" /></div><div class="field"><label>Tax / VAT Number</label><input name="taxNumber" value="${esc(company.taxNumber || "")}" /></div><div class="field"><label>Phone</label><input name="phone" value="${esc(company.phone || "")}" /></div><div class="field"><label>Email</label><input type="email" name="email" value="${esc(company.email || "")}" /></div><div class="field full"><label>Logo Data URL (optional)</label><input name="logoDataUrl" value="${esc(company.logoDataUrl || "")}" placeholder="data:image/png;base64,..." /><small class="field-hint">يمكن إدخال Data URL للصورة؛ سيبقى الشعار محليًا داخل بيانات QESTIMA.</small></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="company-profile-form">حفظ بيانات الشركة</button>`)
  }

  function drawingPropertiesModal(drawing) {
    const project = currentProject()
    const analysis = project.pdfAnalyses?.[drawing.id]
    const pages = C.number(drawing.pdfPageCount) || C.number(analysis?.pageCount) || 1
    const revisionLabel = drawing.status === "superseded" ? "Superseded" : "Current"
    openModal(`Drawing Properties · ${drawing.documentNumber || drawing.title}`, "بيانات للقراءة فقط من Document Register؛ لا يتم الكتابة فوق المستند الأصلي.", `<div class="property-inspector-grid">
      <div><span>Document No</span><strong>${esc(drawing.documentNumber || "—")}</strong></div>
      <div><span>Title</span><strong>${esc(drawing.title || drawing.originalName || "—")}</strong></div>
      <div><span>Discipline</span><strong>${esc(drawing.discipline || "MEP")}</strong></div>
      <div><span>Revision</span><strong>${esc(drawing.revision || "—")}</strong></div>
      <div><span>Status</span><strong>${esc(revisionLabel)}</strong></div>
      <div><span>File</span><strong>${esc(drawing.fileType || "PDF")}</strong></div>
      <div><span>Pages</span><strong>${num(pages)}</strong></div>
      <div><span>Issue / Received</span><strong>${esc(dateLabel(drawing.issueDate || drawing.receivedDate || drawing.createdAt))}</strong></div>
      <div class="full"><span>Source attachment</span><strong>${esc(drawing.originalName || drawing.attachment?.name || "—")}</strong></div>
      <div class="full"><span>Notes</span><strong>${esc(drawing.notes || "—")}</strong></div>
    </div>`, `<button class="secondary-btn" data-action="close-modal">إغلاق</button>`, true)
  }

  function buildingSelectorModal() {
    const workspace = C.activeWorkspace(state)
    const projects = state.projects.filter((entry) => !workspace || entry.workspaceId === workspace.id)
    openModal("Select Project / Building", "اختر مشروعًا لفتح مساحة العمل. نفس النافذة ستتحول لاحقًا إلى Building Properties وTemplates.", `<div class="building-selector-shell">
      <div class="building-selector-toolbar"><label class="global-search"><svg><use href="#i-search"/></svg><input id="building-search" placeholder="Search project, client or code…" /></label><span class="badge teal">${projects.length} Projects</span></div>
      <div class="building-table-wrap"><table class="data-table building-table"><thead><tr><th>Project</th><th>Type</th><th>Client</th><th>Location</th><th>Revision</th><th>Added</th><th></th></tr></thead><tbody>${projects.map((entry) => `<tr class="${entry.id === state.activeProjectId ? "selected" : ""}"><td><strong>${esc(entry.name)}</strong><small class="price-source">${esc(entry.tenderCode)}</small></td><td>${esc(entry.projectType || "Commercial")}</td><td>${esc(entry.client || "—")}</td><td>${esc(entry.location || "—")}</td><td>R${entry.revisionNo || 0}</td><td>${dateLabel(entry.createdAt)}</td><td><button class="primary-btn tiny-btn" data-action="select-building" data-id="${esc(entry.id)}">Select</button></td></tr>`).join("") || `<tr><td colspan="7"><div class="empty-state"><h3>No projects</h3><p>أنشئ مشروعًا جديدًا أولًا.</p></div></td></tr>`}</tbody></table></div>
      <div class="building-selector-foot"><span class="field-hint">Recent projects are kept in your workspace; revisions are never overwritten.</span><button class="secondary-btn small-btn" data-action="new-project">New Project</button></div>
    </div>`, `<button class="secondary-btn" data-action="close-modal">Cancel</button>`, true)
  }

  function measurementModal(kind = "length") {
    const project = currentProject()
    const labels = { length: "Length", area: "Area", count: "Count", perimeter: "Perimeter", group: "Dimension Group" }
    const defaultUnit = kind === "area" ? "m²" : kind === "count" ? "nr" : "m"
    openModal(`New ${labels[kind] || "Measurement"}`, "تسجيل حصر يدوي وربطه ببند BOQ مع مصدر الرسم واعتماد المهندس.", `<form id="measurement-form"><input type="hidden" name="kind" value="${esc(kind)}" /><div class="field-grid cols-3">
      <div class="field full"><label>Name / Description *</label><input name="name" required placeholder="مثال: CHW Pipe 100 mm — Zone A" /></div>
      <div class="field"><label>Quantity *</label><input type="number" min="0" step=".001" name="quantity" value="1" required /></div><div class="field"><label>Scale</label><input type="number" min="0.0001" step=".0001" name="scale" value="1" /></div><div class="field"><label>Layer / Color</label><input name="layer" value="Default" /></div>
      <div class="field"><label>Unit</label><input name="unit" value="${defaultUnit}" /></div>
      <div class="field"><label>Drawing</label><select name="drawingDocumentId"><option value="">— Not linked —</option>${project.documents.filter((document) => document.category === "drawings").map((document) => `<option value="${esc(document.id)}">${esc(document.documentNumber || document.title)} · Rev ${esc(document.revision)}</option>`).join("")}</select></div>
      <div class="field full"><label>Link to BOQ Item</label><select name="itemId"><option value="">— Measurement only —</option>${project.boq.map((item) => `<option value="${esc(item.id)}" ${item.id === activeItemId ? "selected" : ""}>${esc(item.itemNo)} — ${esc(item.description)}</option>`).join("")}</select></div>
      <div class="field full"><label>Dimension Group</label><select name="groupId"><option value="">— Default overlay color —</option>${(project.measurementGroups || []).map((group) => `<option value="${esc(group.id)}">${esc(group.name)} · ${esc(group.system || "General")}</option>`).join("")}</select></div>
      <div class="field"><label>Page</label><input type="number" min="1" name="drawingPage" value="1" /></div><div class="field"><label>System</label><input name="system" placeholder="HVAC / Plumbing / Fire" /></div><div class="field"><label>Floor / Zone</label><input name="floor" /></div><div class="field full"><label>Opening deductions (m², comma separated)</label><input name="openings" placeholder="0.8, 1.2" /></div><div class="field full"><label>Notes</label><textarea name="notes" placeholder="Sheet reference or review note…"></textarea></div>
    </div></form>`, `<button class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn" type="submit" form="measurement-form">Save Measurement</button>`, true)
  }

  function dimensionGroupModal() {
    const project = currentProject()
    const groups = project.measurementGroups || []
    openModal("New Dimension Group", "أنشئ طبقة حصر بلون واضح؛ كل قياس جديد يمكن ربطه بها لتسهيل المراجعة.", `<form id="measurement-group-form"><div class="field-grid cols-2"><div class="field full"><label>Group name *</label><input name="name" required placeholder="HVAC · CHW Pipes · Level 01" /></div><div class="field"><label>System</label><select name="system"><option value="">General</option>${unique([...project.disciplines, ...project.boq.map((item) => item.system).filter(Boolean)]).map((system) => `<option value="${esc(system)}">${esc(system)}</option>`).join("")}</select></div><div class="field"><label>Overlay color</label><input type="color" name="color" value="#28c7b7" /></div><div class="field full"><label>Notes</label><textarea name="notes" placeholder="ما الذي تتضمنه هذه المجموعة؟"></textarea></div></div>${groups.length ? `<p class="field-hint">${groups.length} مجموعات موجودة؛ الألوان السابقة محفوظة ولا تتغير تلقائيًا.</p>` : ""}</form>`, `<button class="secondary-btn" data-action="close-modal">Cancel</button><button class="primary-btn" type="submit" form="measurement-group-form">Create Group</button>`, true)
  }

  function feedbackModal() {
    openModal("Report a Problem", "ملف التشخيص لا يحتوي على أسعار أو مستندات المشروع.", `<form id="feedback-form"><div class="field-grid"><div class="field full"><label>وصف المشكلة *</label><textarea name="description" required placeholder="ما الخطوة التي سببت المشكلة؟ وما المتوقع أن يحدث؟"></textarea></div><div class="field"><label>المسار / الشاشة</label><input name="view" value="${esc(viewTitles[activeView] || activeView)}" /></div><div class="field"><label>الخطوات السابقة</label><input name="steps" placeholder="مثال: Import BOQ ثم Preview" /></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="feedback-form">Download Diagnostic</button>`)
  }

  function revisionsModal(project) {
    openModal(`Revisions — ${project.name}`, "كل Revision لقطة كاملة للتسعير في تاريخ حفظه.", `<div class="timeline">${project.revisions.length ? project.revisions.map((revision) => `<div class="timeline-item"><strong>${esc(revision.label)}</strong><span>${dateLabel(revision.date)} · ${esc(revision.user)}</span><button class="secondary-btn small-btn" style="margin-top:7px" data-action="restore-revision" data-project="${project.id}" data-id="${revision.id}">استعادة كنسخة عمل جديدة</button></div>`).join("") : `<div class="empty-state"><h3>لا توجد Revisions محفوظة</h3><p>استخدم «حفظ Revision» قبل تغييرات الإدارة أو إصدار العرض.</p></div>`}</div>`, `<button class="secondary-btn" data-action="close-modal">إغلاق</button>${project.id === state.activeProjectId ? `<button class="primary-btn" data-action="save-revision">حفظ Revision الآن</button>` : ""}`)
  }

  function revisionImpactModal(revision) {
    const project = currentProject()
    if (!revision?.snapshot) return toast("لا توجد لقطة للمقارنة", "احفظ Revision جديدًا أولًا.", "warning")
    const impact = C.revisionImpact(revision.snapshot, project, state.resources)
    openModal(`Revision Impact · ${revision.label || "Snapshot"}`, "مقارنة النسخة المختارة مع نسخة العمل الحالية — لا يتم تعديل أي سعر تلقائيًا.", `<div class="revision-impact-summary"><div><span>Added</span><strong>${impact.counts.added}</strong></div><div><span>Deleted</span><strong>${impact.counts.deleted}</strong></div><div><span>Changed</span><strong>${impact.counts.changed}</strong></div><div><span>Cost delta</span><strong>${money(impact.delta)}</strong></div></div>${impact.rfqUpdates?.length ? `<div class="alert-strip"><div><strong>${impact.rfqUpdates.length} RFQ needs an update</strong><small>${esc(impact.rfqUpdates.map((entry) => entry.title).join(" · "))}</small></div></div>` : ""}<div class="table-wrap"><table class="data-table"><thead><tr><th>Type</th><th>Item</th><th>Description</th><th>Difference</th><th>Cost Δ</th></tr></thead><tbody>${impact.added.map((entry) => `<tr><td><span class="badge green">Added</span></td><td>${esc(entry.item.itemNo)}</td><td class="desc">${esc(entry.item.description)}</td><td>New item</td><td>${money(entry.cost)}</td></tr>`).join("")}${impact.deleted.map((entry) => `<tr><td><span class="badge red">Deleted</span></td><td>${esc(entry.item.itemNo)}</td><td class="desc">${esc(entry.item.description)}</td><td>Removed item</td><td>-${money(entry.cost)}</td></tr>`).join("")}${impact.changed.map((entry) => `<tr><td><span class="badge amber">Changed</span></td><td>${esc(entry.after.itemNo)}</td><td class="desc">${esc(entry.after.description)}</td><td>${esc(entry.differences.map((d) => `${d.field}: ${d.before} → ${d.after}`).join(" · ") || "Price impact")}</td><td>${money(entry.delta)}</td></tr>`).join("") || `<tr><td colspan="5"><div class="empty-state"><h3>No BOQ differences</h3></div></td></tr>`}</tbody></table></div>`, `<button class="secondary-btn" data-action="close-modal">Close</button>`, true)
  }

  function resourceHistoryModal(resource) {
    const impact = C.resourceImpact(state, resource.id)
    openModal(`سجل السعر — ${resource.code}`, "التاريخ والمصدر والبنود المتأثرة في جميع المشاريع.", `<div class="layout-even"><div><h3 style="font-size:12px">Price History</h3><div class="timeline">${(resource.history || []).slice().reverse().map((entry) => `<div class="timeline-item"><strong>${money(entry.rate)}</strong><span>${dateLabel(entry.date)} · ${esc(entry.source || "بدون مصدر")}</span></div>`).join("")}</div></div><div><h3 style="font-size:12px">الأثر على المشاريع</h3>${impact.map((entry) => `<div class="alert-strip" style="margin-bottom:7px"><div><strong>${esc(entry.projectName)} — ${esc(entry.itemNo)}</strong><small>${esc(entry.description)}</small></div></div>`).join("") || `<p class="field-hint">غير مستخدم في أي تحليل.</p>`}</div></div>`, `<button class="secondary-btn" data-action="close-modal">إغلاق</button>`, true)
  }

  function renderImportWizard(step = 1) {
    const steps = `<div class="wizard-steps"><div class="wizard-step ${step === 1 ? "active" : ""}"><b>1</b>اختيار الملف</div><div class="wizard-step ${step === 2 ? "active" : ""}"><b>2</b>ربط الأعمدة</div><div class="wizard-step ${step === 3 ? "active" : ""}"><b>3</b>تنظيف ومعاينة</div></div>`
    if (step === 1) {
      openModal("BOQ Import Wizard", "استيراد Excel غير مرتب مع اختيار الأعمدة قبل إضافة أي بيانات.", `${steps}<label class="upload-zone"><input id="boq-file-input" type="file" accept=".xlsx,.xls,.csv" hidden /><div>${icon("upload")}<h3>اختر ملف BOQ من جهازك</h3><p>Excel أو CSV — لن يتم تعديل المشروع قبل المعاينة</p></div></label>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button>`, true)
      return
    }
    if (step === 2) {
      const fields = [
        ["itemNo", "Item No *"], ["description", "Description *"], ["unit", "Unit *"], ["quantity", "Quantity *"],
        ["section", "Section"], ["system", "System"], ["floor", "Floor / Level"],
      ]
      openModal("BOQ Import Wizard", `${importDraft.fileName} · ${importDraft.rows.length} صفًا`, `${steps}
        <div class="field-grid cols-3"><div class="field full"><label>ورقة العمل</label><select id="import-sheet">${importDraft.sheetNames.map((name) => `<option value="${esc(name)}" ${name === importDraft.sheetName ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></div>
        ${importDraft.templateMatch?.score >= 0.7 ? `<div class="alert-strip success full">${icon("check")}<div><strong>تم التعرف على نموذج ${esc(importDraft.templateMatch.template.name)}</strong><small>${importDraft.templateMatch.matched}/${importDraft.templateMatch.total} أعمدة مطابقة — راجعها قبل المتابعة.</small></div></div>` : `<div class="alert-strip full">${icon("history")}<div><strong>Smart Template</strong><small>بعد الاستيراد يمكن حفظ هذا التخطيط ليتعرف عليه QESTIMA تلقائيًا في المرة القادمة.</small></div></div>`}
        ${fields.map(([field, label]) => `<div class="field"><label>${label}</label><select data-import-map="${field}"><option value="">— غير مستخدم —</option>${importDraft.headers.map((header) => `<option value="${esc(header)}" ${importDraft.mapping[field] === header ? "selected" : ""}>${esc(header)}</option>`).join("")}</select></div>`).join("")}</div>`, `<button class="secondary-btn" data-action="import-back-step">رجوع</button><button class="primary-btn" data-action="import-preview">متابعة للمعاينة</button>`, true)
      return
    }
    const preview = importDraft.cleaned.rows.slice(0, 12)
    const comparison = importDraft.comparison || { counts: { added: 0, deleted: 0, changed: 0 }, delta: 0, rfqUpdates: [] }
    openModal("معاينة وتنظيف BOQ", `سيتم استيراد ${importDraft.cleaned.rows.length} بند واستبعاد ${importDraft.cleaned.duplicates.length} مكرر.`, `${steps}
      <div class="alert-strip ${importDraft.cleaned.duplicates.length ? "" : "success"}">${icon(importDraft.cleaned.duplicates.length ? "alert" : "check")}<div><strong>${importDraft.cleaned.duplicates.length ? `${importDraft.cleaned.duplicates.length} صفوف مكررة تم اكتشافها` : "لم يتم اكتشاف تكرارات"}</strong><small>تم حذف الصفوف الفارغة وتوحيد القيم الرقمية تلقائيًا.</small></div></div>
      <div class="import-diagnostics"><span>Blank ${importDraft.cleaned.diagnostics?.blankRows || 0}</span><span>Text numbers ${importDraft.cleaned.diagnostics?.textNumbers || 0}</span><span>Unit normalized ${importDraft.cleaned.diagnostics?.normalizedUnits || 0}</span><span>Zero quantity ${importDraft.cleaned.diagnostics?.zeroQuantities || 0}</span><span>Formula errors ${importDraft.cleaned.diagnostics?.formulaErrors || 0}</span></div>
      <div class="revision-impact-summary compact"><div><span>Added</span><strong>${comparison.counts.added}</strong></div><div><span>Deleted</span><strong>${comparison.counts.deleted}</strong></div><div><span>Changed</span><strong>${comparison.counts.changed}</strong></div><div><span>Cost Δ</span><strong>${money(comparison.delta)}</strong></div></div>
      ${comparison.rfqUpdates?.length ? `<div class="alert-strip"><div><strong>${comparison.rfqUpdates.length} RFQ يحتاج تحديثًا</strong><small>تم ربط التغيير بطلبات أسعار موجودة وسيظهر أثره بعد الاستيراد.</small></div><button class="ghost-btn tiny-btn" data-view="suppliers">Open RFQ</button></div>` : `<p class="field-hint">Revision impact يقارن الملف بالـBOQ الحالي قبل الحفظ.</p>`}
      <label class="badge"><input id="import-skip-duplicates" type="checkbox" checked /> استبعاد البنود المكررة</label>
      <label class="badge"><input id="import-replace" type="checkbox" /> استبدال BOQ الحالي بدل الإضافة</label>
      <div class="import-preview" style="margin-top:12px"><table class="data-table"><thead><tr><th>Item</th><th>Description</th><th>Unit</th><th>Qty</th><th>Section</th><th>System</th><th>Floor</th></tr></thead><tbody>${preview.map((item) => `<tr><td>${esc(item.itemNo)}</td><td class="desc">${esc(item.description)}</td><td>${esc(item.unit)}</td><td class="num">${num(item.quantity)}</td><td>${esc(item.section)}</td><td>${esc(item.system)}</td><td>${esc(item.floor)}</td></tr>`).join("")}</tbody></table></div>
      ${importDraft.cleaned.rows.length > preview.length ? `<p class="field-hint">المعاينة تعرض أول ${preview.length} صفًا فقط.</p>` : ""}`, `<button class="secondary-btn" data-action="import-map-step">رجوع</button><button class="primary-btn" data-action="import-confirm">استيراد ${importDraft.cleaned.rows.length} بند</button>`, true)
  }

  async function loadBoqFile(file) {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false })
      const headers = rows.length ? Object.keys(rows[0]) : []
      if (!rows.length || !headers.length) throw new Error("الملف لا يحتوي بيانات قابلة للقراءة")
      importDraft = {
        fileName: file.name,
        workbook,
        sheetNames: workbook.SheetNames,
        sheetName,
        rows,
        headers,
        mapping: Object.fromEntries(Object.keys(C.headerCandidates).map((field) => [field, C.guessColumn(headers, field)])),
        templateMatch: C.detectImportTemplate(state.importTemplates || [], headers, currentProject()?.client || ""),
        cleaned: null,
      }
      if (importDraft.templateMatch?.score >= 0.7) importDraft.mapping = { ...importDraft.mapping, ...importDraft.templateMatch.template.mapping }
      renderImportWizard(2)
    } catch (error) {
      toast("تعذر قراءة ملف Excel", error.message, "error")
    }
  }

  function switchImportSheet(name) {
    const rows = XLSX.utils.sheet_to_json(importDraft.workbook.Sheets[name], { defval: "", raw: false })
    const headers = rows.length ? Object.keys(rows[0]) : []
    importDraft.sheetName = name
    importDraft.rows = rows
    importDraft.headers = headers
    importDraft.mapping = Object.fromEntries(Object.keys(C.headerCandidates).map((field) => [field, C.guessColumn(headers, field)]))
    importDraft.templateMatch = C.detectImportTemplate(state.importTemplates || [], headers, currentProject()?.client || "")
    if (importDraft.templateMatch?.score >= 0.7) importDraft.mapping = { ...importDraft.mapping, ...importDraft.templateMatch.template.mapping }
    renderImportWizard(2)
  }

  function validateImportMapping() {
    if (!importDraft.mapping.description || !importDraft.mapping.unit || !importDraft.mapping.quantity) {
      toast("أكمل الأعمدة الأساسية", "Description وUnit وQuantity مطلوبة.", "warning")
      return false
    }
    importDraft.cleaned = C.cleanBoqRows(importDraft.rows, importDraft.mapping, { skipDuplicates: true, fileName: importDraft.fileName, importedBy: C.activeUser(state)?.name || state.user.name })
    if (!importDraft.cleaned.rows.length) {
      toast("لم يتم العثور على بنود صالحة", "راجع ربط الأعمدة أو بيانات الملف.", "error")
      return false
    }
    const project = currentProject()
    importDraft.comparison = C.compareBoqRows(project, importDraft.cleaned.rows, state.resources)
    return true
  }

  function downloadWorkbook(workbook, filename) {
    XLSX.writeFile(workbook, filename, { compression: true })
  }

  function downloadTemplate() {
    const rows = [
      { "Item No": "HV-001", Description: "توريد وتركيب دكت صاج مجلفن شامل الإكسسوارات", Unit: "m2", Quantity: 100, Section: "HVAC", System: "Ventilation", Floor: "Ground" },
      { "Item No": "PL-001", Description: "توريد وتركيب مواسير صرف UPVC", Unit: "m", Quantity: 150, Section: "Plumbing", System: "Drainage", Floor: "Ground" },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "BOQ")
    downloadWorkbook(workbook, "QESTIMA-BOQ-Import-Template.xlsx")
    toast("تم تنزيل نموذج BOQ")
  }

  function exportResources() {
    const rows = state.resources.map((resource) => ({ Code: resource.code, Name: resource.name, Type: resourceTypeLabels[resource.type], Category: resource.category, Unit: resource.unit, Rate: resource.rate, Supplier: state.suppliers.find((supplier) => supplier.id === resource.supplierId)?.name || "", Region: resource.region, Source: resource.sourceProject, Updated: resource.updatedAt }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Resource Library")
    downloadWorkbook(workbook, "QESTIMA-Resource-Library.xlsx")
    toast("تم تصدير مكتبة الموارد")
  }

  function excelColumnLetter(index) {
    let value = index + 1
    let output = ""
    while (value > 0) { const remainder = (value - 1) % 26; output = String.fromCharCode(65 + remainder) + output; value = Math.floor((value - 1) / 26) }
    return output
  }

  function addFormattedSheet(workbook, name, columns, rows, pack) {
    const safeColumns = columns.map((column) => typeof column === "string" ? { key: column, label: column, width: Math.max(12, Math.min(34, column.length + 4)) } : column)
    const values = [
      [pack.brand.name || "QESTIMA", pack.brand.tagline || "MEP Estimating System"],
      [`${pack.project.code} · ${pack.project.name}`, `${reportT(pack, "revision")} R${pack.project.revisionNo} · ${pack.language === "ar" ? "العربية" : "English"}`],
      [],
      safeColumns.map((column) => column.label),
      ...(rows.length ? rows.map((row) => safeColumns.map((column) => row[column.key] == null ? "" : row[column.key])) : [safeColumns.map(() => reportT(pack, "noData"))]),
    ]
    const sheet = XLSX.utils.aoa_to_sheet(values)
    const endColumn = excelColumnLetter(safeColumns.length - 1)
    const endRow = Math.max(4, values.length)
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, safeColumns.length - 1) } }, { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, safeColumns.length - 1) } }]
    sheet["!cols"] = safeColumns.map((column) => ({ wch: column.width || 16 }))
    sheet["!autofilter"] = { ref: `A4:${endColumn}${endRow}` }
    sheet["!freeze"] = { xSplit: 0, ySplit: 4 }
    const titleCell = sheet.A1
    const subtitleCell = sheet.A2
    if (titleCell) titleCell.s = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 15 }, fill: { fgColor: { rgb: "0B1D26" } }, alignment: { horizontal: "right" } }
    if (subtitleCell) subtitleCell.s = { font: { color: { rgb: "FFFFFF" }, sz: 10 }, fill: { fgColor: { rgb: "0B1D26" } }, alignment: { horizontal: "right" } }
    safeColumns.forEach((column, index) => {
      const cell = sheet[`${excelColumnLetter(index)}4`]
      if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "0D7F7B" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } }
      for (let rowIndex = 5; rowIndex <= endRow; rowIndex += 1) {
        const rowCell = sheet[`${excelColumnLetter(index)}${rowIndex}`]
        if (!rowCell) continue
        const rowType = rows[rowIndex - 5]?.[`${column.key}Type`] || column.type
        if (rowType === "currency" && typeof rowCell.v === "number") rowCell.z = `"${pack.project.currency}" #,##0.00`
        else if (rowType === "number" && typeof rowCell.v === "number") rowCell.z = "#,##0.000"
        else if (rowType === "percent" && typeof rowCell.v === "number") rowCell.z = "0.00%"
        if (rowIndex % 2 === 0) rowCell.s = { fill: { fgColor: { rgb: "F3F8F7" } } }
      }
    })
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31))
  }

  function buildReportWorkbook(pack) {
    const workbook = XLSX.utils.book_new()
    const sections = pack.sections
    const cost = pack.permissions.showCost
    const markup = pack.permissions.showMarkup
    const t = (key) => reportT(pack, key)
    const sheet = (key, columns, rows) => addFormattedSheet(workbook, t(key), columns, rows, pack)
    const pricedColumns = [
      { key: "itemNo", label: `${t("item")} No`, width: 14 }, { key: "description", label: t("description"), width: 46 }, { key: "unit", label: t("unit"), width: 10 }, { key: "pricingQuantity", label: `${t("qty")} (pricing)`, width: 13, type: "number" }, { key: "section", label: t("section"), width: 18 }, { key: "system", label: t("system"), width: 20 }, { key: "floor", label: t("floor"), width: 16 }, { key: "status", label: t("status"), width: 14 },
      ...(cost ? [{ key: "costUnitRate", label: t("costRate"), width: 16, type: "currency" }, { key: "costTotal", label: t("costTotal"), width: 16, type: "currency" }] : []),
      ...(markup ? [{ key: "sellingUnitRate", label: t("sellingRate"), width: 17, type: "currency" }, { key: "sellingTotal", label: t("sellingTotal"), width: 17, type: "currency" }] : []),
      { key: "source", label: t("rateSource"), width: 30 },
    ]
    sheet("pricedBoq", pricedColumns, sections.pricedBoq.map((row) => ({ ...row, status: t(row.status.toLowerCase()), source: row.source || t("noData") })))
    sheet("unpricedItems", pricedColumns.filter((column) => !["costUnitRate", "costTotal", "sellingUnitRate", "sellingTotal"].includes(column.key)), sections.unpricedItems.map((row) => ({ ...row, status: t("unpriced"), source: row.source || t("noData") })))
    const analysisColumns = [{ key: "itemNo", label: `${t("item")} No`, width: 14 }, { key: "description", label: t("description"), width: 44 }, ...(cost ? [{ key: "material", label: t("material"), width: 15, type: "currency" }, { key: "labor", label: t("labor"), width: 15, type: "currency" }, { key: "equipment", label: t("equipment"), width: 15, type: "currency" }, { key: "subcontractor", label: t("subcontractor"), width: 15, type: "currency" }, { key: "waste", label: t("waste"), width: 15, type: "currency" }, { key: "extras", label: t("extras"), width: 16, type: "currency" }, { key: "costUnit", label: t("unitCost"), width: 16, type: "currency" }] : []), ...(markup ? [{ key: "profit", label: t("profit"), width: 15, type: "currency" }, { key: "sellingBeforeVat", label: t("sellingBeforeVat"), width: 18, type: "currency" }] : [])]
    sheet("rateAnalysis", analysisColumns, sections.rateAnalysis.map((row) => ({ ...row, material: row.components?.material, labor: row.components?.labor, equipment: row.components?.equipment, subcontractor: row.components?.subcontractor, extras: (row.transport || 0) + (row.accessories || 0) + (row.preliminaries || 0) + (row.escalation || 0) + (row.risk || 0) + (row.overhead || 0) })))
    const resourceColumns = [{ key: "type", label: t("type"), width: 18 }, { key: "code", label: t("code"), width: 16 }, { key: "name", label: t("resource"), width: 42 }, { key: "unit", label: t("unit"), width: 10 }, { key: "factor", label: t("factor"), width: 12, type: "number" }, ...(cost ? [{ key: "rate", label: t("rate"), width: 16, type: "currency" }, { key: "total", label: t("total"), width: 16, type: "currency" }] : []), { key: "source", label: t("source"), width: 30 }]
    sheet("resourceBreakdown", resourceColumns, sections.resourceBreakdown.map((row) => ({ ...row, type: resourceTypeLabels[row.type] || row.type })))
    const supplierRows = []
    sections.supplierAdjudication.forEach((target) => target.offers.forEach((offer) => { const supplier = state.suppliers.find((entry) => entry.id === offer.supplierId); supplierRows.push({ itemNo: target.code, description: target.name, supplier: supplier?.name || offer.supplierId, reference: offer.reference, compliance: offer.expired ? t("expired") : offer.compliant ? t("compliant") : t("deviationStatus"), rawUnit: offer.rawUnit, evaluatedUnit: offer.evaluatedUnit, delivery: offer.delivery, payment: offer.payment, warranty: offer.warranty, validity: offer.expired ? t("expired") : t("valid"), deviation: offer.deviation }) }))
    sheet("supplierAdjudication", [{ key: "itemNo", label: `${t("item")} No`, width: 14 }, { key: "description", label: t("description"), width: 38 }, { key: "supplier", label: t("supplier"), width: 24 }, { key: "reference", label: t("reference"), width: 16 }, { key: "compliance", label: t("compliance"), width: 15 }, ...(cost ? [{ key: "rawUnit", label: t("quotedUnit"), width: 15, type: "currency" }, { key: "evaluatedUnit", label: t("evaluatedUnit"), width: 18, type: "currency" }] : []), { key: "delivery", label: t("delivery"), width: 17 }, { key: "payment", label: t("payment"), width: 22 }, { key: "warranty", label: t("warranty"), width: 16 }, { key: "validity", label: t("validity"), width: 14 }, { key: "deviation", label: t("deviation"), width: 34 }], supplierRows)
    const summaryLabels = { "Direct Cost": "directCost", "Indirect Cost": "indirectCost", "Contingency / Risk": "contingencyRisk", Escalation: "escalation", "Total Cost": "totalCost", Profit: "profit", Discount: "discount", "Selling Before VAT": "sellingBeforeVat", VAT: "vat", "Grand Total": "grandTotal", "True Margin %": "trueMargin" }
    const summaryRows = sections.costSummary.map((row) => { const margin = row.label === "True Margin %"; return { metric: t(summaryLabels[row.label] || "metric"), value: margin && row.value != null ? row.value / 100 : row.value, valueType: margin ? "percent" : "currency", visibility: row.value == null ? t("restricted") : t("visible") } })
    sheet("managementSummary", [{ key: "metric", label: t("metric"), width: 28 }, { key: "value", label: t("value"), width: 20, type: "currency" }, { key: "visibility", label: t("access"), width: 16 }], summaryRows)
    sheet("qualificationsExclusions", [{ key: "type", label: t("type"), width: 24 }, { key: "entry", label: `${t("requirement")} / ${t("deviation")}`, width: 72 }], [...sections.qualificationsExclusions.qualifications.map((entry) => ({ type: pack.language === "ar" ? "توضيح" : "Qualification", entry })), ...sections.qualificationsExclusions.exclusions.map((entry) => ({ type: pack.language === "ar" ? "استثناء" : "Exclusion", entry }))])
    sheet("scopeGaps", [{ key: "system", label: t("system"), width: 24 }, { key: "status", label: t("status"), width: 18 }, { key: "inScope", label: t("inScope"), width: 14 }, { key: "boqStatus", label: t("boq"), width: 14 }, { key: "drawingsStatus", label: t("drawings"), width: 14 }, { key: "specsStatus", label: t("specifications"), width: 18 }, { key: "notes", label: t("notes"), width: 50 }], sections.scopeGaps)
    const revisionRows = [...sections.revisionImpact.added.map((row) => ({ itemNo: row.itemNo, change: t("added"), beforeCost: "", afterCost: row.cost, delta: row.cost })), ...sections.revisionImpact.deleted.map((row) => ({ itemNo: row.itemNo, change: t("deleted"), beforeCost: row.cost, afterCost: "", delta: row.cost == null ? null : -row.cost })), ...sections.revisionImpact.changed.map((row) => ({ itemNo: row.itemNo, change: row.differences.map((diff) => `${diff.field}: ${diff.before} → ${diff.after}`).join(" · ") || t("changed"), beforeCost: row.beforeCost, afterCost: row.afterCost, delta: row.delta }))]
    sheet("revisionImpact", [{ key: "itemNo", label: `${t("item")} No`, width: 14 }, { key: "change", label: t("change"), width: 54 }, ...(cost ? [{ key: "beforeCost", label: `${t("before")} Cost`, width: 17, type: "currency" }, { key: "afterCost", label: `${t("after")} Cost`, width: 17, type: "currency" }, { key: "delta", label: t("delta"), width: 17, type: "currency" }] : [])], revisionRows)
    sheet("scenarioComparison", [{ key: "name", label: t("scenario"), width: 24 }, { key: "status", label: t("status"), width: 14 }, ...(cost ? [{ key: "totalCost", label: t("totalCost"), width: 17, type: "currency" }] : []), ...(markup ? [{ key: "profit", label: t("profit"), width: 17, type: "currency" }, { key: "trueMargin", label: t("trueMargin"), width: 15, type: "percent" }, { key: "beforeVat", label: t("beforeVat"), width: 17, type: "currency" }, { key: "grandTotal", label: t("grandTotal"), width: 17, type: "currency" }] : [])], sections.scenarioComparison.map((row) => ({ ...row, status: row.locked ? t("approved") : t("working"), trueMargin: row.trueMargin == null ? null : row.trueMargin / 100 })))
    sheet("auditTrail", [{ key: "date", label: t("date"), width: 22 }, { key: "user", label: t("user"), width: 24 }, { key: "action", label: t("action"), width: 68 }, { key: "source", label: t("source"), width: 24 }], sections.auditTrail.map((entry) => ({ date: entry.date || entry.timestamp, user: entry.user || entry.actorId, action: entry.action || entry.description, source: entry.source || "QESTIMA" })))
    sheet("documentRegister", [{ key: "number", label: t("documentNo"), width: 20 }, { key: "title", label: t("title"), width: 42 }, { key: "category", label: t("category"), width: 22 }, { key: "discipline", label: t("discipline"), width: 18 }, { key: "revision", label: t("revision"), width: 14 }, { key: "status", label: t("status"), width: 16 }, { key: "source", label: t("file"), width: 38 }], sections.documentRegister)
    sheet("tenderReview", [{ key: "requirement", label: t("requirement"), width: 32 }, { key: "summary", label: t("summary"), width: 60 }, { key: "source", label: t("source"), width: 35 }, { key: "page", label: t("page"), width: 10 }, { key: "verified", label: t("verified"), width: 12 }], sections.tenderReview.summary.map((field) => ({ requirement: field.label, summary: field.value, source: pack.sections.documentRegister.find((doc) => doc.id === field.sourceDocumentId)?.title || "", page: field.sourcePage, verified: field.verified ? (pack.language === "ar" ? "نعم" : "Yes") : (pack.language === "ar" ? "لا" : "No") })))
    sheet("submissionPack", [{ key: "include", label: t("include"), width: 42 }, { key: "status", label: t("status"), width: 18 }, { key: "revision", label: t("revision"), width: 14 }], pack.submissionPack.includes.map((include) => ({ include: reportT(pack, include.replace(/[^A-Za-z]+/g, "").replace(/ /g, "").charAt(0).toLowerCase() + include.replace(/[^A-Za-z]+/g, "").replace(/ /g, "").slice(1), include), status: t("ready"), revision: `R${pack.project.revisionNo}` })))
    return workbook
  }

  function exportExcel() {
    const project = currentProject()
    const pack = C.buildReportPack(project, state, { language: reportLanguage || state.settings.language || "ar" })
    const workbook = buildReportWorkbook(pack)
    downloadWorkbook(workbook, `${project.name.replace(/[\\/:*?"<>|]+/g, "-")}-QESTIMA-Report-Center-R${project.revisionNo || 0}.xlsx`)
    toast("تم تصدير Excel منسق", "Report Center · الجداول والعناوين والمصادر والصلاحيات محفوظة.")
  }

  function pdfTextValue(value, pack, sensitive = false) {
    if (sensitive && value == null) return pack.language === "ar" ? "محجوب حسب الصلاحية" : "Restricted"
    if (value == null || value === "") return "—"
    if (sensitive) return money(value, pack.project.currency).replace(/\u00a0/g, " ")
    return String(value)
  }

  function pdfTable(headers, rows, emptyLabel = "No data") {
    return `<table class="pdf-table"><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map((row) => `<tr>${row.map((cell) => `<td>${cell == null ? "—" : cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">${esc(emptyLabel)}</td></tr>`}</tbody></table>`
  }

  function buildReportPdfHtml(pack) {
    const cost = pack.permissions.showCost
    const markup = pack.permissions.showMarkup
    const sections = pack.sections
    const t = (key) => reportT(pack, key)
    const companyLogo = String(pack.brand.logoDataUrl || "").startsWith("data:image/") ? `<img src="${esc(pack.brand.logoDataUrl)}" alt="Logo" />` : `<span class="pdf-logo-fallback">Q</span>`
    let page = 0
    const pageWrap = (title, body) => { page += 1; return `<section class="pdf-page"><header class="pdf-header"><div class="pdf-brand">${companyLogo}<div><strong>${esc(pack.brand.name || "QESTIMA")}</strong><small>${esc(pack.brand.tagline || "MEP Estimating System")}</small></div></div><div class="pdf-project-code">${esc(pack.project.code)} · R${pack.project.revisionNo}</div></header><div class="pdf-body"><span class="pdf-kicker">${esc(t("reportCenter"))}</span><h1>${esc(title)}</h1>${body}</div><footer class="pdf-footer"><span>${esc(pack.brand.name || "QESTIMA")} · ${esc(pack.project.name)}</span><span>${esc(t("page"))} ${page} · ${esc(pack.generatedAt.slice(0, 10))}</span></footer></section>` }
    const management = sections.managementSummary
    const total = management.totals || {}
    const managementValue = (value, visible = cost) => visible ? pdfTextValue(value, pack, true) : (pack.language === "ar" ? "محجوب حسب الصلاحية" : "Restricted")
    const managementBody = `
      <div class="pdf-cover-grid"><div><p class="pdf-lead">${esc(pack.project.name)}</p><p>${esc(pack.project.client || "")} · ${esc(pack.project.consultant || "")} · ${esc(pack.project.location || "")}</p><div class="pdf-meta"><span>${esc(t("submissionDeadline"))}<b>${esc(pack.project.deadline || "Not set")}</b></span><span>${esc(t("scenario"))}<b>${esc(pack.scenario.name)}</b></span><span>${esc(t("currencyVat"))}<b>${esc(pack.project.currency)} / ${pack.project.vat}%</b></span><span>${esc(t("readiness"))}<b>${pack.readiness.score}%</b></span></div></div><div class="pdf-score"><strong>${pack.readiness.score}%</strong><span>${esc(t("readiness"))}</span><small>${pack.readiness.unpricedCount} ${esc(t("unpriced"))} · ${pack.readiness.pendingQuotes} ${esc(t("supplier"))}</small></div></div>
      <div class="pdf-total-grid"><div><span>${esc(t("directCost"))}</span><strong>${managementValue(total.direct)}</strong></div><div><span>${esc(t("totalCost"))}</span><strong>${managementValue(total.totalCost)}</strong></div><div><span>${esc(t("profit"))}</span><strong>${managementValue(total.profit, markup)}</strong></div><div><span>${esc(t("beforeVat"))}</span><strong>${managementValue(total.beforeVat, markup)}</strong></div><div><span>${esc(t("grandTotal"))}</span><strong>${managementValue(total.grandTotal, markup)}</strong></div><div><span>${esc(t("trueMargin"))}</span><strong>${markup && total.trueMargin != null ? `${num(total.trueMargin)}%` : esc(t("restricted"))}</strong></div></div>
      <h2>${esc(t("gateQuality"))}</h2>${pdfTable([t("metric"), t("value"), t("status")], [[t("tenderReviewGate"), `${management.gate.completed}/${management.gate.total}`, management.gate.canSubmit ? t("ready") : t("openItems")], [t("qualityScore"), `${management.quality.score}%`, `${management.quality.openFindings} ${t("openFindings")}`], [t("scopeGaps"), String(sections.scopeGaps.length), sections.scopeGaps.length ? t("review") : t("closed")], [t("outputAccess"), cost ? (markup ? t("full") : t("costOnly")) : t("restricted"), pack.permissions.role]], t("noData"))}`
    const pricedHeaders = [t("item"), t("description"), t("unit"), t("qty"), t("status")]
    if (cost) pricedHeaders.push(t("costRate"), t("costTotal"))
    if (markup) pricedHeaders.push(t("sellingRate"), t("sellingTotal"))
    pricedHeaders.push(t("source"))
    const pricedRows = sections.pricedBoq.map((row) => { const values = [esc(row.itemNo), esc(row.description), esc(row.unit), num(row.pricingQuantity, 3), esc(row.status === "Priced" ? t("priced") : t("unpriced"))]; if (cost) values.push(pdfTextValue(row.costUnitRate, pack, true), pdfTextValue(row.costTotal, pack, true)); if (markup) values.push(pdfTextValue(row.sellingUnitRate, pack, true), pdfTextValue(row.sellingTotal, pack, true)); values.push(esc(row.source || "—")); return values })
    const unpricedRows = sections.unpricedItems.map((row) => [esc(row.itemNo), esc(row.description), esc(row.unit), num(row.pricingQuantity, 3), esc(row.section), esc(row.system), esc(row.source || t("noData"))])
    const analysisRows = sections.rateAnalysis.map((row) => { const values = [esc(row.itemNo), esc(row.description)]; if (cost) values.push(pdfTextValue(row.components?.material, pack, true), pdfTextValue(row.components?.labor, pack, true), pdfTextValue(row.components?.equipment, pack, true), pdfTextValue(row.components?.subcontractor, pack, true), pdfTextValue(row.waste, pack, true), pdfTextValue((row.transport || 0) + (row.accessories || 0) + (row.preliminaries || 0) + (row.escalation || 0) + (row.risk || 0) + (row.overhead || 0), pack, true), pdfTextValue(row.costUnit, pack, true)); if (markup) values.push(pdfTextValue(row.profit, pack, true), pdfTextValue(row.sellingBeforeVat, pack, true)); return values })
    const analysisHeaders = [t("item"), t("description")]; if (cost) analysisHeaders.push(t("material"), t("labor"), t("equipment"), t("subcontractor"), t("waste"), t("extras"), t("unitCost")); if (markup) analysisHeaders.push(t("profit"), t("sellingBeforeVat"))
    const resourceHeaders = [t("type"), t("code"), t("resource"), t("unit"), t("factor")]; if (cost) resourceHeaders.push(t("rate"), t("total")); resourceHeaders.push(t("source"))
    const resourceRows = sections.resourceBreakdown.map((row) => { const values = [esc(resourceTypeLabels[row.type] || row.type), esc(row.code), esc(row.name), esc(row.unit), num(row.factor, 4)]; if (cost) values.push(pdfTextValue(row.rate, pack, true), pdfTextValue(row.total, pack, true)); values.push(esc(row.source)); return values })
    const supplierRows = []; sections.supplierAdjudication.forEach((target) => target.offers.forEach((offer) => { const supplier = state.suppliers.find((entry) => entry.id === offer.supplierId); supplierRows.push([esc(target.code), esc(supplier?.name || offer.supplierId || "Supplier"), esc(offer.reference || "—"), offer.compliant && !offer.expired ? t("compliant") : offer.expired ? t("expired") : t("deviationStatus"), cost ? pdfTextValue(offer.rawUnit, pack, true) : t("restricted"), cost ? pdfTextValue(offer.evaluatedUnit, pack, true) : t("restricted"), esc(offer.delivery || "—"), esc(offer.payment || "—")]) }))
    const revisionRows = [...sections.revisionImpact.added.map((row) => [esc(row.itemNo), t("added"), "—", cost ? pdfTextValue(row.cost, pack, true) : t("restricted"), cost ? pdfTextValue(row.cost, pack, true) : t("restricted")]), ...sections.revisionImpact.deleted.map((row) => [esc(row.itemNo), t("deleted"), cost ? pdfTextValue(row.cost, pack, true) : t("restricted"), "—", cost ? pdfTextValue(row.cost == null ? null : -row.cost, pack, true) : t("restricted")]), ...sections.revisionImpact.changed.map((row) => [esc(row.itemNo), esc(row.differences.map((diff) => `${diff.field}: ${diff.before} → ${diff.after}`).join(" · ") || t("changed")), cost ? pdfTextValue(row.beforeCost, pack, true) : t("restricted"), cost ? pdfTextValue(row.afterCost, pack, true) : t("restricted"), cost ? pdfTextValue(row.delta, pack, true) : t("restricted")])]
    const scenarioRows = sections.scenarioComparison.map((row) => [esc(row.name), row.locked ? t("approved") : t("working"), cost ? pdfTextValue(row.totalCost, pack, true) : t("restricted"), markup ? pdfTextValue(row.profit, pack, true) : t("restricted"), markup && row.trueMargin != null ? `${num(row.trueMargin)}%` : t("restricted"), markup ? pdfTextValue(row.beforeVat, pack, true) : t("restricted"), markup ? pdfTextValue(row.grandTotal, pack, true) : t("restricted")])
    const auditRows = sections.auditTrail.map((entry) => [esc(entry.date || entry.timestamp || ""), esc(entry.user || entry.actorId || "—"), esc(entry.action || entry.description || "—"), esc(entry.source || "QESTIMA")])
    const docsRows = sections.documentRegister.map((doc) => [esc(doc.number || "—"), esc(doc.title), esc(doc.category), esc(doc.discipline || "—"), esc(doc.revision || "—"), esc(doc.status || "—")])
    const pages = [
      pageWrap(t("managementSummary"), managementBody),
      pageWrap(t("pricedBoq"), pdfTable(pricedHeaders, pricedRows, t("noData"))),
      pageWrap(t("unpricedItems"), pdfTable([t("item"), t("description"), t("unit"), t("qty"), t("section"), t("system"), t("source")], unpricedRows, t("noData"))),
      pageWrap(t("rateAnalysis"), pdfTable(analysisHeaders, analysisRows, t("noData"))),
      pageWrap(t("resourceBreakdown"), pdfTable(resourceHeaders, resourceRows, t("noData"))),
      pageWrap(t("supplierAdjudication"), pdfTable([t("item"), t("supplier"), t("reference"), t("compliance"), t("quotedUnit"), t("evaluatedUnit"), t("delivery"), t("payment")], supplierRows, t("noOffers"))),
      pageWrap(t("qualificationsExclusions"), `<div class="pdf-two-col"><div><h2>${esc(t("requirement"))}</h2><ul>${sections.qualificationsExclusions.qualifications.map((entry) => `<li>${esc(entry)}</li>`).join("") || `<li>${esc(t("noRecorded"))}</li>`}</ul></div><div><h2>${esc(t("deviation"))}</h2><ul>${sections.qualificationsExclusions.exclusions.map((entry) => `<li>${esc(entry)}</li>`).join("") || `<li>${esc(t("noRecorded"))}</li>`}</ul></div></div>`),
      pageWrap(t("scopeGaps"), pdfTable([t("system"), t("status"), t("inScope"), t("boq"), t("drawings"), t("specifications"), t("notes")], sections.scopeGaps.map((row) => [esc(row.system), esc(row.status), esc(row.inScope), esc(row.boqStatus), esc(row.drawingsStatus), esc(row.specsStatus), esc(row.notes || "—")]), t("noOpenGaps"))),
      pageWrap(t("revisionImpact"), `<div class="pdf-summary-strip"><span>${esc(t("baseline"))}<b>${esc(sections.revisionImpact.baseline)}</b></span><span>${esc(t("added"))}<b>${sections.revisionImpact.counts.added}</b></span><span>${esc(t("deleted"))}<b>${sections.revisionImpact.counts.deleted}</b></span><span>${esc(t("changed"))}<b>${sections.revisionImpact.counts.changed}</b></span><span>${esc(t("delta"))}<b>${cost ? pdfTextValue(sections.revisionImpact.delta, pack, true) : t("restricted")}</b></span></div>${pdfTable([t("item"), t("change"), t("before"), t("after"), t("delta")], revisionRows, t("noData"))}`),
      pageWrap(t("scenarioComparison"), pdfTable([t("scenario"), t("status"), t("totalCost"), t("profit"), t("trueMargin"), t("beforeVat"), t("grandTotal")], scenarioRows, t("noData"))),
      pageWrap(t("auditTrail"), pdfTable([t("date"), t("user"), t("action"), t("source")], auditRows, t("noRecorded"))),
      pageWrap(t("tenderDocuments"), pdfTable([t("documentNo"), t("title"), t("category"), t("discipline"), t("revision"), t("status")], docsRows, t("noDocuments"))),
    ]
    return `<!doctype html><html lang="${pack.language === "ar" ? "ar" : "en"}" dir="${pack.language === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(pack.submissionPack.title)}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e8eeee;color:#132830;font-family:Segoe UI,Tahoma,Arial,sans-serif}body{font-size:10px}.pdf-page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:16mm 15mm 18mm;position:relative;page-break-after:always;overflow:hidden}.pdf-header{height:24mm;border-bottom:1px solid #d7e2e1;display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.pdf-brand{display:flex;align-items:center;gap:9px}.pdf-brand img,.pdf-logo-fallback{width:30px;height:30px;object-fit:contain;border-radius:8px}.pdf-logo-fallback{display:grid;place-items:center;background:#0d7f7b;color:#fff;font-weight:900;font-size:18px}.pdf-brand strong,.pdf-brand small{display:block}.pdf-brand strong{font-size:14px;letter-spacing:.4px}.pdf-brand small{margin-top:3px;color:#6c8185;font-size:8px}.pdf-project-code{color:#557076;font-size:9px}.pdf-body{padding-top:10mm}.pdf-kicker{color:#0d7f7b;font-size:8px;font-weight:900;letter-spacing:1.1px}.pdf-body h1{margin:5px 0 12px;font-size:21px;color:#0b1d26}.pdf-body h2{margin:16px 0 7px;font-size:12px;color:#0b1d26}.pdf-body p{margin:4px 0;line-height:1.55}.pdf-lead{font-size:15px;font-weight:800}.pdf-cover-grid{display:grid;grid-template-columns:1fr 44mm;gap:10mm;padding:10mm 0 7mm;border-bottom:1px solid #e0e8e7}.pdf-meta{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-top:10mm}.pdf-meta span{padding:7px;border:1px solid #dfe8e7;border-radius:5px;background:#f6faf9;color:#60757a;font-size:8px}.pdf-meta b{display:block;margin-top:3px;color:#162f37;font-size:9px}.pdf-score{display:grid;place-items:center;align-content:center;border:1px solid #b9ded8;border-radius:12px;background:#eefaf8;text-align:center}.pdf-score strong{color:#0d7f7b;font-size:30px}.pdf-score span{font-weight:800;font-size:9px}.pdf-score small{margin-top:7px;color:#71868a;font-size:8px}.pdf-total-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:10mm}.pdf-total-grid div{padding:8px;border:1px solid #e0e8e7;border-radius:5px;background:#fbfcfc}.pdf-total-grid span,.pdf-total-grid strong{display:block}.pdf-total-grid span{color:#708388;font-size:8px}.pdf-total-grid strong{margin-top:4px;font-size:11px;direction:ltr;text-align:right}.pdf-table{width:100%;border-collapse:collapse;font-size:8px;table-layout:fixed}.pdf-table thead{display:table-header-group}.pdf-table th,.pdf-table td{padding:5px 4px;border:1px solid #d7e2e1;vertical-align:top;word-wrap:break-word}.pdf-table th{background:#0d7f7b;color:#fff;font-weight:800}.pdf-table tr:nth-child(even) td{background:#f5faf9}.pdf-table td:nth-child(n+3){direction:ltr}.pdf-two-col{display:grid;grid-template-columns:1fr 1fr;gap:10mm}.pdf-two-col>div{padding:8mm;border:1px solid #dfe8e7;border-radius:8px;background:#fbfcfc}.pdf-two-col ul{margin:0;padding:0 15px;line-height:1.7}.pdf-summary-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:8mm}.pdf-summary-strip span{padding:7px;border:1px solid #dfe8e7;border-radius:5px;color:#6f8388;font-size:8px}.pdf-summary-strip b{display:block;margin-top:3px;color:#17323a;font-size:10px}.pdf-footer{position:absolute;right:15mm;left:15mm;bottom:8mm;display:flex;justify-content:space-between;padding-top:4px;border-top:1px solid #d7e2e1;color:#788b8f;font-size:8px}@media print{html,body{background:#fff}.pdf-page{margin:0;box-shadow:none}}</style></head><body>${pages.join("")}</body></html>`
  }

  async function exportReportPdf(options = {}) {
    const project = currentProject()
    const pack = C.buildReportPack(project, state, { language: reportLanguage || state.settings.language || "ar" })
    const html = buildReportPdfHtml(pack)
    const filename = `${project.name.replace(/[\\/:*?"<>|]+/g, "-")}-QESTIMA-Report-R${project.revisionNo || 0}.pdf`
    try {
      if (window.qestimaDesktop?.exportPdf) {
        const saved = await window.qestimaDesktop.exportPdf(html, filename)
        if (saved && !options.silent) toast("تم إنشاء PDF بمحرك QESTIMA", saved)
        return Boolean(saved)
      }
      const popup = window.open("", "_blank")
      if (popup) { popup.document.write(html); popup.document.close(); popup.focus(); setTimeout(() => popup.print(), 350) }
      else window.print()
      if (!options.silent) toast("تم فتح معاينة PDF", "المتصفح سيستخدم الطباعة كحل احتياطي خارج نسخة Windows.")
      return true
    } catch (error) {
      if (!options.silent) toast("تعذر إنشاء PDF", error.message, "error")
      return false
    }
  }

  async function exportReportPack() {
    const project = currentProject()
    const pack = C.buildReportPack(project, state, { language: reportLanguage || state.settings.language || "ar" })
    if (window.qestimaDesktop?.exportReportPack) {
      try {
        const workbook = buildReportWorkbook(pack)
        const workbookBase64 = XLSX.write(workbook, { bookType: "xlsx", type: "base64", compression: true })
        const attachmentIds = []
        ;(project.documents || []).filter((document) => document.status !== "superseded").forEach((document) => { if (document.attachment?.id) attachmentIds.push(document.attachment.id) })
        ;(project.quotes || []).forEach((quote) => { if (quote.attachment?.id) attachmentIds.push(quote.attachment.id) })
        const saved = await window.qestimaDesktop.exportReportPack({
          html: buildReportPdfHtml(pack),
          workbookBase64,
          suggestedName: `${project.name.replace(/[\\/:*?"<>|]+/g, "-")}-QESTIMA-Tender-Pack-R${project.revisionNo || 0}`,
          manifest: pack.submissionPack,
          attachmentIds: [...new Set(attachmentIds)],
          appVersion: state.appVersion,
        })
        if (saved) return toast("تم إنشاء Tender Submission Pack", `PDF + Excel + Manifest + ${attachmentIds.length} مستند داخل: ${saved}`)
      } catch (error) {
        toast("تعذر إنشاء الحزمة الكاملة", error.message, "error")
        return
      }
    }
    const pdf = await exportReportPdf({ silent: true })
    exportExcel()
    toast(pdf ? "تم إنشاء Tender Submission Pack" : "تم إنشاء Excel للحزمة", pdf ? "PDF بمحرك حقيقي + Excel منسق. أضف مرفقات المناقصة من Project Package عند الحاجة." : "تعذر حفظ PDF؛ تم تصدير Excel ويمكن إعادة المحاولة.")
  }

  async function importTenderDocuments(mode) {
    try {
      const picked = window.qestimaDesktop?.pickTenderDocuments ? await window.qestimaDesktop.pickTenderDocuments(mode) : await browserPickFiles(mode)
      if (!picked?.length) return
      const files = []
      for (const entry of picked) files.push(entry instanceof File ? await storeBrowserAttachment(entry) : entry)
      const project = currentProject()
      const receivedDate = new Date().toISOString().slice(0, 10)
      commit(`إضافة ${files.length} مستند للمناقصة`, () => {
        files.forEach((file) => {
          const suggestion = C.classifyTenderDocument(file.originalName || file.name)
          project.documents.push({ id: C.id("doc"), documentNumber: suggestion.documentNumber, title: suggestion.title, category: suggestion.category, discipline: suggestion.discipline, revision: suggestion.revision, issueDate: "", receivedDate, fileType: file.fileType || suggestion.fileType, status: "current", latestRevision: true, supersededBy: "", notes: "", originalName: file.originalName || file.name, size: file.size || 0, hash: file.hash || "", attachment: { id: file.id, name: file.name } })
        })
        C.recalculateDocumentRevisions(project)
        project.tenderReview.completedAt = ""
      })
      toast("تم فهرسة المستندات", `${files.length} ملف — راجع التصنيف وDocument Number وRevision.`)
    } catch (error) {
      toast("تعذر رفع المستندات", error.message, "error")
    }
  }

  async function inspectCadDocument(document) {
    if (!document?.attachment?.id) return toast("لا يوجد ملف CAD", "أعد رفع الرسم من Document Register.", "warning")
    if (!window.qestimaDesktop?.inspectCadDocument) return toast("محرك CAD متاح في تطبيق Windows", "نسخة المتصفح تحفظ الملف فقط؛ استخدم QESTIMA Desktop لفهرسة DXF أو تحويل DWG.", "warning")
    let result
    try { result = await window.qestimaDesktop.inspectCadDocument(document.attachment.id) } catch (error) { return toast("تعذر فحص CAD", error.message, "error") }
    if (!result?.ok) return toast("تعذر فحص ملف CAD", (result.warnings || [result.reason || "CAD inspection failed"]).join(" · "), "warning")
    const model = result.model || {}
    commit(`فحص ملف ${document.fileType || "CAD"} ${document.title || document.originalName}`, () => {
      document.cadInspection = { format: result.format, model, convertedFrom: result.convertedFrom || "", inspectedAt: new Date().toISOString(), inspectedBy: C.activeUser(state)?.name || state.user.name, warnings: result.warnings || [] }
    }, { audit: false })
    activeDrawingId = document.id; openView("drawings")
    toast(`تم فهرسة ${result.format}`, `${model.entityCount || 0} عنصر · ${model.layers?.length || 0} طبقة · الكميات إرشادية وتحتاج اعتماد المهندس.`)
  }

  async function importCadDocument(format = "DXF") {
    const normalized = String(format || "DXF").toUpperCase()
    if (!window.qestimaDesktop?.pickCadDocument || !window.qestimaDesktop?.inspectCadDocument) return toast("استيراد CAD متاح في تطبيق Windows", "استخدم نسخة سطح المكتب المضمنة لفحص DXF بأمان.", "warning")
    const picked = await window.qestimaDesktop.pickCadDocument(normalized)
    if (!picked) return
    const result = await window.qestimaDesktop.inspectCadDocument(picked.id)
    if (!result?.ok) return toast(`تعذر قراءة ${normalized}`, (result.warnings || [result.reason || "CAD inspection failed"]).join(" · "), "warning")
    const project = currentProject(); const suggestion = C.classifyTenderDocument(picked.originalName || picked.name || `${normalized}.cad`); const receivedDate = new Date().toISOString().slice(0, 10)
    const document = { id: C.id("doc"), documentNumber: suggestion.documentNumber, title: suggestion.title, category: "drawings", discipline: suggestion.discipline, revision: suggestion.revision, issueDate: "", receivedDate, fileType: normalized, status: "current", latestRevision: true, supersededBy: "", notes: "", originalName: picked.originalName || picked.name, size: picked.size || 0, hash: picked.hash || "", attachment: { id: picked.id, name: picked.name }, cadInspection: { format: result.format, model: result.model || {}, convertedFrom: result.convertedFrom || "", inspectedAt: new Date().toISOString(), inspectedBy: C.activeUser(state)?.name || state.user.name, warnings: result.warnings || [] } }
    commit(`استيراد ${normalized} ${document.title}`, () => { project.documents.push(document); C.recalculateDocumentRevisions(project); project.tenderReview.completedAt = "" })
    activeDrawingId = document.id; openView("drawings")
    toast(`تم استيراد ${normalized}`, `${result.model?.entityCount || 0} عنصر · تم حفظ الرسم والملخص دون اعتماد كميات تلقائيًا.`)
  }

  async function importIfcModel() {
    if (!Model.parseIfcText || !Model.upsertIfcModel) return toast("IFC غير متاح", "ملف ifc.js غير موجود في هذه النسخة.", "warning")
    try {
      let attachment = null; let text = ""; let fileName = "model.ifc"
      if (window.qestimaDesktop?.pickIfcModel) {
        attachment = await window.qestimaDesktop.pickIfcModel()
        if (!attachment) return
        fileName = attachment.originalName || attachment.name || fileName
        const result = await window.qestimaDesktop.extractIfcModel(attachment.id)
        if (!result?.ok) return toast("تعذر قراءة نموذج IFC", (result?.warnings || [result?.reason || "IFC read failed"]).join(" · "), "error")
        text = result.text
      } else {
        const [file] = await browserPickFiles("file", ".ifc,.json")
        if (!file) return
        attachment = await storeBrowserAttachment(file)
        fileName = file.name
        text = await file.text()
      }
      const revision = window.prompt ? window.prompt("رقم Revision للنموذج", "01") || "01" : "01"
      const model = (Model.parseModelSource || Model.parseIfcText)(text, { fileName, revision, modelVersion: revision, sourceAttachmentId: attachment.id, importedBy: C.activeUser(state)?.name || state.user.name })
      let result
      const ok = commit(`استيراد نموذج IFC ${fileName}`, () => { result = Model.upsertIfcModel(currentProject(), model) })
      if (!ok || !result?.ok) return toast("تعذر حفظ نموذج IFC", result?.reason || "راجع الملف.", "error")
      activeModelId = model.id; openView("models"); toast("تم استيراد نموذج IFC للمراجعة", `${model.elementCount} عنصر · Revision ${model.revision}. الكميات تظل مقترحة حتى اعتماد المهندس.`)
    } catch (error) { toast("تعذر استيراد IFC", error.message, "error") }
  }

  function compareIfcRevisions() {
    const project = currentProject(); const models = project.ifcModels || []
    if (models.length < 2 || !Model.compareIfcModels) return toast("لا توجد نسختان للمقارنة", "استورد Revision أخرى لنفس المشروع أولًا.", "warning")
    const after = models[0]; const before = models[1]; const result = Model.compareIfcModels(before, after)
    openModal("IFC Revision Impact", `${before.revision || before.modelVersion} → ${after.revision || after.modelVersion} · لا يتم اعتماد أي كمية تلقائيًا`, `<div class="revision-report-summary"><div><span>Added</span><strong>${result.counts.added}</strong></div><div><span>Deleted</span><strong>${result.counts.deleted}</strong></div><div><span>Changed</span><strong>${result.counts.changed}</strong></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Element</th><th>Type</th><th>Differences</th><th>Quantity changes</th></tr></thead><tbody>${result.changed.slice(0, 100).map((entry) => `<tr><td>${esc(entry.key)}</td><td>${esc(entry.after.ifcType || "IFC")}</td><td>${esc(entry.differences.map((change) => `${change.field}: ${change.before || "—"} → ${change.after || "—"}`).join(" · ") || "—")}</td><td>${esc(entry.quantityChanges.map((change) => `${change.field}: ${change.delta > 0 ? "+" : ""}${num(change.delta)}`).join(" · ") || "—")}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state compact-empty"><p>لا يوجد اختلاف في العناصر المشتركة.</p></div></td></tr>`}</tbody></table></div><div class="alert-strip"><strong>Review required</strong><small>العناصر المضافة والمحذوفة وتغير الكميات تحتاج ربطًا واعتمادًا يدويًا في BOQ قبل تحديث أي كمية.</small></div>`, `<button class="secondary-btn" data-action="close-modal">إغلاق</button>`, true)
  }

  async function centralRequest(payload = {}) {
    if (window.qestimaDesktop?.centralRequest) return window.qestimaDesktop.centralRequest(payload)
    try {
      const base = String(payload.baseUrl || "").replace(/\/+$/, "")
      const response = await fetch(new URL(String(payload.path || "/health"), `${base}/`), { method: String(payload.method || "GET"), headers: { Accept: "application/json", ...(payload.body ? { "Content-Type": "application/json" } : {}), ...(payload.token ? { Authorization: `Bearer ${payload.token}` } : {}) }, body: payload.body ? JSON.stringify(payload.body) : undefined })
      const data = await response.json().catch(() => ({})); return { ok: response.ok, status: response.status, data }
    } catch (error) { return { ok: false, status: 0, error: error.message } }
  }

  function centralLoginModal() {
    const central = state.central || {}
    openModal("Connect to Central API", "أدخل بيانات الشركة التي أنشأها مسؤول الترخيص. لا توجد بيانات دخول مركزية افتراضية.", `<form id="central-login-form"><div class="field-grid"><div class="field full"><label>Central API URL *</label><input name="baseUrl" required type="url" value="${esc(central.apiBaseUrl || "http://127.0.0.1:47600")}" placeholder="https://central.example.com" /></div><div class="field"><label>Tenant ID *</label><input name="tenantId" required value="${esc(central.tenantId || state.session?.tenantId || "tenant-company-pilot")}" /></div><div class="field"><label>Username *</label><input name="username" required autocomplete="username" /></div><div class="field"><label>Password *</label><input name="password" type="password" required autocomplete="current-password" /></div><div class="field full"><p class="field-hint">يتم حفظ رمز الجلسة داخل المخزن المحلي المشفر فقط، ويظل الخادم هو مصدر صلاحيات الشركة.</p></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="central-login-form">Connect</button>`)
  }

  async function centralSyncProject(options = {}) {
    const project = (state.projects || []).find((entry) => entry.id === (options.projectId || state.activeProjectId))
    const central = state.central || {}
    if (!project) return { ok: false, reason: "PROJECT_NOT_FOUND" }
    if (!central.apiBaseUrl || !central.accessToken) {
      if (!options.silent) centralLoginModal()
      return { ok: false, reason: "CENTRAL_LOGIN_REQUIRED" }
    }
    const currentTenant = project.tenantId || state.session?.tenantId || ""
    const authenticatedTenant = central.tenantId || state.session?.tenantId || ""
    if (authenticatedTenant && currentTenant && authenticatedTenant !== currentTenant) {
      if (!options.silent) toast("مساحة العمل مختلفة", "بدّل إلى مشروع الشركة المرتبط بتسجيل الدخول قبل المزامنة.", "warning")
      return { ok: false, reason: "TENANT_CONTEXT_MISMATCH" }
    }

    let changed = false
    let pullConflict = false
    const cursor = central.syncCursors?.[currentTenant] || (central.tenantId === currentTenant ? central.syncCursor : "") || (state.session?.tenantId === currentTenant ? state.session?.syncCursor : "")
    const pullPath = `/api/v1/sync/pull${cursor ? `?since=${encodeURIComponent(cursor)}` : ""}`
    const pulled = await centralRequest({ baseUrl: central.apiBaseUrl, path: pullPath, token: central.accessToken })
    if (!pulled?.ok) {
      if (!options.silent) toast("تعذرت المزامنة", pulled?.data?.reason || pulled?.error || "أعد الاتصال بالمركز.", "error")
      return { ok: false, reason: pulled?.data?.reason || pulled?.error || "CENTRAL_PULL_FAILED" }
    }

    const remoteProjects = Array.isArray(pulled.data?.projects) ? pulled.data.projects.slice(0, 500) : []
    remoteProjects.filter((remote) => remote?.tenantId === currentTenant || !remote?.tenantId).forEach((remote) => {
      const local = (state.projects || []).find((entry) => entry.id === remote.id)
      if (!local) {
        state.projects.push({ ...C.deepClone(remote), tenantId: remote.tenantId || currentTenant, serverVersion: Math.max(1, Number(remote.serverVersion || 1)), lastSyncedAt: new Date().toISOString(), syncBaseSnapshot: C.deepClone(remote) })
        changed = true
        return
      }
      if (Number(remote.serverVersion || 0) <= Number(local.serverVersion || 1) && String(remote.updatedAt || "") <= String(local.lastSyncedAt || "")) return
      const merged = Collab.applyRemoteProject?.(state, local.id, remote, { userId: C.activeUser(state)?.id || state.session?.userId || "" })
      if (merged?.ok) changed = true
      else if (merged?.reason === "SYNC_CONFLICT") pullConflict = true
    })

    const pending = (state.syncQueue || []).filter((entry) => entry.status === "pending" && entry.projectId === project.id)
    if (pullConflict && pending.length) {
      const conflict = (state.syncConflicts || []).find((entry) => entry.projectId === project.id && entry.status === "open")
      pending.forEach((entry) => { entry.status = "conflict"; if (conflict) entry.conflictId = conflict.id })
    }
    const shouldPush = !pullConflict && (pending.length > 0 || !project.lastSyncedAt)
    let pushResult = { ok: true, data: { applied: [], conflicts: [] } }
    if (shouldPush) {
      const latestProject = (state.projects || []).find((entry) => entry.id === project.id) || project
      const operation = {
        projectId: latestProject.id,
        baseVersion: Math.max(1, Number(latestProject.serverVersion || 1)),
        payload: C.deepClone(latestProject),
        changedPaths: [...new Set(pending.flatMap((entry) => entry.changedPaths || []))].slice(0, 500),
        actorId: C.activeUser(state)?.id || state.session?.userId || "",
        deviceId: state.session?.deviceId || "",
      }
      pushResult = await centralRequest({ baseUrl: central.apiBaseUrl, path: "/api/v1/sync/push", method: "POST", token: central.accessToken, body: { operations: [operation] } })
      if (!pushResult?.ok) {
        if (!options.silent) toast("تعذرت المزامنة", pushResult?.data?.reason || pushResult?.error || "أعد الاتصال بالمركز.", "error")
        return { ok: false, reason: pushResult?.data?.reason || pushResult?.error || "CENTRAL_PUSH_FAILED", pulled: remoteProjects.length }
      }
      const conflicts = Array.isArray(pushResult.data?.conflicts) ? pushResult.data.conflicts : []
      conflicts.forEach((conflict) => {
        const conflictId = C.id("conflict")
        state.syncConflicts ||= []
        state.syncConflicts.unshift({ id: conflictId, tenantId: latestProject.tenantId || currentTenant, projectId: latestProject.id, entityType: "project", baseVersion: operation.baseVersion, localVersion: latestProject.serverVersion || operation.baseVersion, remoteVersion: conflict.server?.serverVersion || 0, paths: operation.changedPaths.length ? operation.changedPaths : ["project"], local: conflict.local || operation.payload, remote: conflict.server || {}, status: "open", createdAt: new Date().toISOString(), detectedBy: C.activeUser(state)?.id || state.session?.userId || "" })
        pending.forEach((entry) => { entry.status = "conflict"; entry.conflictId = conflictId; entry.updatedAt = new Date().toISOString() })
      })
      const synced = pushResult.data?.applied?.[0]
      if (synced && !conflicts.length) {
        Object.assign(latestProject, { serverVersion: Number(synced.serverVersion || latestProject.serverVersion || 1), lastSyncedAt: new Date().toISOString(), syncBaseSnapshot: C.deepClone(synced) })
        pending.forEach((entry) => { entry.status = "synced"; entry.syncedAt = latestProject.lastSyncedAt; entry.serverVersion = latestProject.serverVersion })
        changed = true
      }
    }

    const at = new Date().toISOString()
    state.central.connectionState = "central"
    state.central.lastSyncAt = at
    const nextCursor = pulled.data?.cursor || pushResult.data?.serverTime || at
    state.central.syncCursors ||= {}
    state.central.syncCursors[currentTenant] = nextCursor
    state.central.syncCursor = nextCursor
    state.session = { ...(state.session || {}), connectionState: "central", lastConnectionAt: at, syncCursor: state.central.syncCursor }
    // Keep the queue as a compact audit trail while preventing unbounded local
    // growth. Conflict entries remain visible until explicitly resolved.
    if (state.syncQueue?.length > 2000) state.syncQueue = state.syncQueue.filter((entry) => entry.status === "pending" || entry.status === "conflict").slice(-1000)
    if (changed || shouldPush) { render(); scheduleSave() }
    const openConflicts = (state.syncConflicts || []).filter((entry) => entry.projectId === project.id && entry.status === "open").length
    if (!options.silent) toast(openConflicts ? "المزامنة تحتاج مراجعة" : "تمت مزامنة المشروع", `${remoteProjects.length} تحديثًا مركزيًا · ${openConflicts} تعارض مفتوح${openConflicts === 1 ? "" : "ات"}`, openConflicts ? "warning" : "success")
    return { ok: true, pulled: remoteProjects.length, conflicts: openConflicts, pushed: shouldPush }
  }

  async function centralSyncAllProjects(options = {}) {
    const tenantId = state.session?.tenantId || ""
    const projects = (state.projects || []).filter((entry) => !tenantId || entry.tenantId === tenantId)
    const results = []
    for (const project of projects) results.push(await centralSyncProject({ ...options, projectId: project.id, silent: true }))
    const conflicts = results.reduce((total, result) => total + Number(result?.conflicts || 0), 0)
    if (!options.silent) toast(conflicts ? "تمت المزامنة مع تعارضات" : "تمت مزامنة كل المشروعات", `${results.filter((result) => result?.ok).length}/${projects.length} مشروع · ${conflicts} تعارض` , conflicts ? "warning" : "success")
    return { ok: results.every((result) => result?.ok), results }
  }

  function startCentralSyncTimer() {
    if (typeof clearInterval === "function") clearInterval(centralSyncTimer)
    centralSyncTimer = null
    if (typeof setInterval !== "function" || !window.qestimaDesktop?.centralRequest || !state.central?.apiBaseUrl || !state.central?.accessToken) return
    centralSyncTimer = setInterval(() => { if (isAuthenticated && !document.hidden) centralSyncProject({ silent: true }).catch(() => {}) }, 90 * 1000)
  }

  function addGeneratedRisk(project, risk) {
    if (risk.sourceKey && project.risks.some((entry) => entry.sourceKey === risk.sourceKey && entry.status !== "closed")) return false
    project.risks.unshift({ id: C.id("risk"), type: "technical", title: "Risk", description: "", severity: "medium", status: "open", sourceDocumentId: "", sourcePage: "", owner: "", dueDate: "", createdAt: new Date().toISOString(), ...risk })
    return true
  }

  function detectTenderRisks(project) {
    let added = 0
    const health = C.tenderHealth(project, state.resources)
    health.missingCategories.forEach((category) => { if (addGeneratedRisk(project, { sourceKey: `missing-category-${category}`, type: "technical", title: `Missing ${documentCategoryLabels[category]}`, description: `لم يتم العثور على مستند Current ضمن تصنيف ${documentCategoryLabels[category]}.`, severity: ["boq", "drawings", "specifications"].includes(category) ? "high" : "medium" })) added += 1 })
    project.scopeMatrix.forEach((row) => {
      const status = C.scopeStatus(row)
      if (!["complete", "not_applicable"].includes(status) && addGeneratedRisk(project, { sourceKey: `scope-${row.id}-${status}`, type: status === "clarification" || status === "boq_gap" ? "clarification" : "technical", title: `${row.system} — ${status.replace(/_/g, " ")}`, description: row.notes || "راجع نطاق النظام وتوافر BOQ والرسومات والمواصفات وحدد المسؤولية.", severity: status === "boq_gap" ? "high" : "medium" })) added += 1
    })
    project.boq.forEach((item) => {
      if (C.number(item.quantity) <= 0 && addGeneratedRisk(project, { sourceKey: `zero-qty-${item.id}`, type: "clarification", title: `${item.itemNo} — BOQ quantity missing`, description: item.description, severity: "high" })) added += 1
      const variance = C.number(item.takeoffQuantity) ? C.number(item.takeoffQuantity) - C.number(item.quantity) : 0
      if (variance && addGeneratedRisk(project, { sourceKey: `qty-variance-${item.id}`, type: "clarification", title: `${item.itemNo} — Quantity variance ${variance > 0 ? "+" : ""}${C.round(variance, 3)}`, description: `BOQ ${item.quantity} ${item.unit} مقابل Takeoff ${item.takeoffQuantity} ${item.unit}.`, severity: "high", sourceDocumentId: item.drawingDocumentId || "" })) added += 1
    })
    return added
  }

  function exportClarifications() {
    const project = currentProject()
    const rows = project.risks.filter((risk) => risk.type === "clarification").map((risk, index) => ({ No: index + 1, Subject: risk.title, Clarification: risk.description, Source: project.documents.find((document) => document.id === risk.sourceDocumentId)?.documentNumber || "", Page: risk.sourcePage, Priority: risk.severity, Status: risk.status, Owner: risk.owner, "Due Date": risk.dueDate }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Tender Clarifications")
    downloadWorkbook(workbook, `${project.tenderCode}-Tender-Clarifications.xlsx`)
    toast("تم تصدير Tender Clarification List", `${rows.length} استفسار`)
  }

  function saveRevision() {
    const project = currentProject()
    const wasSubmitted = Boolean(project.submittedLockedAt)
    const ok = commit("حفظ Revision", () => {
      project.revisionNo = C.number(project.revisionNo) + 1
      project.revisions.unshift({ id: C.id("rev"), label: `Revision R${project.revisionNo}`, date: new Date().toISOString(), user: state.user.name, snapshot: C.projectSnapshot(project) })
      if (wasSubmitted) {
        project.submittedLockedAt = ""; project.submittedLockedBy = ""; project.status = "pricing"
        project.scenarios.forEach((scenario) => { scenario.locked = false; scenario.approvedBy = ""; scenario.approvedAt = "" })
      }
    }, { allowLocked: true })
    if (!ok) return
    if (wasSubmitted) { undoStack = []; redoStack = [] }
    closeModal()
    toast("تم حفظ Revision", `R${project.revisionNo} محفوظ ويمكن الرجوع إليه.`)
  }

  function renderLicenseIndicator() {
    const element = $("#license-indicator")
    if (!element || !state) return
    if (state.settings.openEdition) { element.innerHTML = '<span class="open-edition-label">نسخة مفتوحة · تخزين محلي</span>'; return }
    const license = C.licenseStatus(state)
    const tone = license.expired ? "expired" : license.expiringSoon ? "warning" : "active"
    const label = license.expired ? "License expired" : `${license.plan || "Preview"} · ${license.daysLeft ?? "—"} days`
    const expiry = license.expiresAt ? dateLabel(license.expiresAt) : "Not set"
    element.innerHTML = `<button type="button" class="license-pill ${tone}" data-action="reactivate-license" title="Activate or reactivate license"><span class="license-pill-icon">${icon(license.expired ? "alert" : "clock")}</span><span><strong>${esc(label)}</strong><small>Valid to ${esc(expiry)}</small></span></button>`
  }

  function renderLogin() {
    const element = $("#login-screen")
    if (!element || !state) return
    const license = C.licenseStatus(state)
    const tone = license.expired ? "expired" : license.expiringSoon ? "warning" : "active"
    const licenseLabel = license.expired ? "الترخيص منتهي" : `${license.daysLeft ?? "—"} يوم متاح`
    const expiry = license.expiresAt ? dateLabel(license.expiresAt) : "غير محدد"
    const message = authMessage ? `<div class="login-message error" role="alert">${esc(authMessage)}</div>` : ""
    const firstRun = window.qestimaDesktop?.commercialBuild && !(state.auth?.accounts || []).length
    const demoHint = window.qestimaDesktop?.commercialBuild
      ? "بيانات الدخول تُنشأ وتُدار بواسطة مسؤول الشركة. لا توجد كلمة مرور افتراضية."
      : "بيانات النسخة التجريبية: admin / Qestima@2026"
    element.innerHTML = `<div class="login-shell">
      <section class="login-card">
        <div class="login-brand"><span class="login-brand-mark">Q</span><div><strong>QESTIMA</strong><small>MEP Estimating System</small></div></div>
        <div class="login-copy"><span class="eyebrow">TENDER OPERATING SYSTEM</span><h1>تسجيل الدخول</h1><p>أدخل بياناتك للوصول إلى مشاريع التسعير والمكتبة المركزية.</p></div>
        ${firstRun ? `<form id="setup-form" class="login-form"><label class="login-field"><span>FULL NAME</span><input name="name" required placeholder="اسم المستخدم" /></label><label class="login-field"><span>USERNAME</span><input name="username" required placeholder="اسم الدخول" /></label><label class="login-field"><span>PASSWORD</span><input name="password" type="password" minlength="8" required placeholder="كلمة مرور قوية" /></label><button class="primary-btn login-submit" type="submit">إنشاء حساب المدير</button></form>` : `<form id="login-form" class="login-form">
          <label class="login-field"><span>USERNAME</span><input id="login-username" name="username" type="text" value="${esc(state.auth?.lastUsername || "")}" autocomplete="username" required placeholder="اسم المستخدم" /></label>
          <label class="login-field"><span>PASSWORD</span><input id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="كلمة المرور" /></label>
          <label class="login-remember"><input type="checkbox" name="rememberUsername" /> <span>تذكر اسم المستخدم على هذا الجهاز</span></label>
          ${message}
          <button class="primary-btn login-submit" type="submit">دخول إلى QESTIMA <span>↵</span></button>
        </form>`}
        <div class="login-demo-hint">${esc(firstRun ? "لا توجد بيانات دخول افتراضية في النسخة التجارية. أنشئ حساب المدير الأول." : demoHint)}</div>
      </section>
      <aside class="login-side">
        <div class="login-side-glow"></div>
        <div class="login-side-head"><span class="eyebrow">LICENSE CENTER</span><span class="login-status-dot ${tone}"></span></div>
        <h2>مساحة عمل آمنة<br /><span>لتسعير المناقصات</span></h2>
        <p>كل مشروع، Revision، عرض مورد وتحليل سعر محفوظ داخل مساحة QESTIMA الخاصة بك.</p>
        <div class="login-license-card ${tone}"><div><span>حالة الترخيص</span><strong>${esc(licenseLabel)}</strong></div><div><span>صالح حتى</span><strong>${esc(expiry)}</strong></div><small>${esc(license.plan || "Preview")} · ${esc(license.organization || "Personal Workspace")}</small></div>
        <button type="button" class="secondary-btn login-activate" data-action="reactivate-license">Activate / Reactivate</button>
        <small class="login-security-note">النسخة الحالية تعمل محليًا للمعاينة. التفعيل المركزي الموقّع يمكن ربطه لاحقًا بخادم الشركة.</small>
      </aside>
    </div>`
    setTimeout(() => $("#login-username")?.focus(), 0)
  }

  function licenseModal() {
    const license = C.licenseStatus(state)
    if (window.qestimaDesktop?.commercialBuild) {
      openModal("Activate License", "أدخل الترخيص الموقّع الصادر من مالك المنصة.", `<form id="license-form"><div class="field"><label>Signed License Token</label><textarea name="activationCode" required></textarea></div></form>`, `<button data-action="close-modal">إلغاء</button><button class="primary-btn" form="license-form" type="submit">تفعيل</button>`)
      return
    }
    openModal("Activate / Reactivate License", "أدخل مفتاح العميل وكود التفعيل. لا يتم تغيير أسعار المشاريع عند التفعيل.", `<form id="license-form"><div class="field-grid"><div class="field full"><label>License Key *</label><input name="licenseKey" required value="${esc(license.licenseKey || "QESTIMA-DEMO-LOCAL")}" placeholder="QESTIMA-DEMO-LOCAL" /></div><div class="field full"><label>Activation Code *</label><input name="activationCode" required placeholder="QESTIMA-DEMO-30" value="" /></div><div class="field full"><p class="field-hint">للمعاينة المحلية استخدم صيغة مثل <code>QESTIMA-DEMO-30</code> أو <code>QESTIMA-TRIAL-90</code>. التفعيل الحقيقي للشركات يحتاج كودًا صادرًا من مسؤول الترخيص.</p></div></div></form>`, `<button class="secondary-btn" data-action="close-modal">إلغاء</button><button class="primary-btn" type="submit" form="license-form">تفعيل الترخيص</button>`)
  }

  async function authenticateUser(values) {
    const username = String(values.username || "").trim()
    const password = String(values.password || "")
    const account = (state.auth?.accounts || []).find((entry) => entry.active !== false && String(entry.username || "").toLowerCase() === username.toLowerCase())
    if (state.auth.lockedUntil && Date.now() < state.auth.lockedUntil) { authMessage = "محاولات كثيرة. انتظر خمس دقائق ثم أعد المحاولة."; renderLogin(); return }
    const legacy = account?.passwordHash?.startsWith("fnv1a-")
    const passwordValid = account && (legacy ? C.credentialDigest(password) === account.passwordHash : await window.QESTIMAAuth.verify(password, account.passwordHash))
    if (!passwordValid) {
      state.auth.failedAttempts = (state.auth.failedAttempts || 0) + 1
      if (state.auth.failedAttempts >= 5) { state.auth.lockedUntil = Date.now() + 300000; state.auth.failedAttempts = 0 }
      scheduleSave()
      authMessage = "اسم المستخدم أو كلمة المرور غير صحيحة."
      renderLogin()
      return
    }
    const license = C.licenseStatus(state)
    state.auth.failedAttempts = 0; state.auth.lockedUntil = 0
    if (legacy) account.passwordHash = await window.QESTIMAAuth.hash(password)
    const now = new Date().toISOString()
    const user = state.users.find((entry) => entry.id === account.userId)
    if (!user || user.active === false) { authMessage = "الحساب موقوف أو غير صالح."; renderLogin(); return }
    isAuthenticated = true
    authMessage = ""
    state.session = { ...(state.session || {}), userId: user.id, authenticated: true, signedInAt: now, sessionId: state.session?.sessionId || C.id("session") }
    if (Collab.touchConnection) Collab.touchConnection(state, { userId: user.id, tenantId: state.session.tenantId, deviceId: state.session.deviceId, appVersion: state.appVersion, connectionState: state.central?.apiBaseUrl ? "central" : "local" })
    state.auth.lastUsername = username
    state.auth.lastLoginAt = now
    state.user = { name: user.name || state.user.name, initials: user.initials || state.user.initials }
    // Open the primary Cost Estimation workbench after sign-in.  This mirrors
    // the approved desktop concept: BOQ is the working canvas, while Drawings
    // and every other module remain one click away in the Ribbon/sidebar.
    activeView = state.projects.length ? "boq" : "projects"
    activeRibbonTab = "cost_estimation"
    openTabs = [activeView]
    activeModelId = currentProject().ifcModels?.[0]?.id || null
    state.auditLog ||= []
    state.auditLog.unshift({ id: C.id("audit"), date: now, actorId: user.id, action: `Login · ${username}`, immutable: true, source: "QESTIMA Auth" })
    $("#login-screen")?.classList.add("hidden")
    $("#app-shell")?.classList.remove("hidden")
    render()
    scheduleSave()
    toast("تم تسجيل الدخول", `مرحبًا ${state.user.name}`)
  }

  function logout() {
    if (state.settings.openEdition) return
    isAuthenticated = false
    authMessage = ""
    if (state?.session) state.session.authenticated = false
    closeModal()
    $("#app-shell")?.classList.add("hidden")
    $("#login-screen")?.classList.remove("hidden")
    renderLogin()
    scheduleSave()
  }

  async function handleClick(event) {
    if (handledClickEvents.has(event)) return
    handledClickEvents.add(event)
    const ribbonTab = closestElement(event.target, '[data-action="ribbon-tab"]')
    if (ribbonTab) {
      event.preventDefault()
      activeContextTab = ""
      activeRibbonTab = ribbonTab.dataset.tab || "home"
      renderRibbon()
      renderContextualRibbon()
      persistUiState()
      scheduleSave()
      return
    }
    const contextualTab = closestElement(event.target, '[data-action="contextual-tab"]')
    if (contextualTab) {
      event.preventDefault()
      activeContextTab = contextualTab.dataset.context || ""
      renderContextualRibbon()
      persistUiState()
      scheduleSave()
      return
    }
    // data-view on the workspace is styling metadata, not navigation.
    const viewButton = closestElement(event.target, "button[data-view], a[data-view]")
    if (viewButton && !viewButton.dataset.action) {
      event.preventDefault()
      const command = findRibbonCommand(viewButton.dataset.commandId)
      if (command && commandAvailability(command).blocked) return
      const reports = { "priced-boq-report": "pricedBoq", "rate-analysis-report": "rateAnalysis", "rate-analysis-output": "rateAnalysis", "resource-report": "resourceBreakdown", "cost-breakdown": "resourceBreakdown", "supplier-report": "supplierAdjudication", "scope-gaps-report": "scopeGaps", "audit-log": "auditTrail", "estimate-summary": "managementSummary", "management-summary": "managementSummary" }
      if (reports[command?.id]) activeReportTab = reports[command.id]
      const scenarios = { conservative: 0, competitive: 1, target: 2, "management-final": 3 }
      if (scenarios[command?.id] !== undefined) state.activeScenarioId = currentProject().scenarios[scenarios[command.id]]?.id || state.activeScenarioId
      openView(viewButton.dataset.view)
      const fields = { profit: "profitPercent", discount: "discountPercent", vat: "vatPercent", escalation: "escalationPercent", contingency: "contingencyPercent", "site-overhead": "indirectPercent", "final-adjustment": "managementAdjustment" }
      if (fields[command?.id]) { const field = $(`[data-scenario-field="${fields[command.id]}"]`); field?.scrollIntoView?.({ block: "center" }); field?.focus?.() }
      return
    }
    const tab = closestElement(event.target, ".workspace-tab[data-tab]")
    if (tab && !closestElement(event.target, "button")) {
      openView(tab.dataset.tab)
      return
    }
    const reportTab = closestElement(event.target, "button[data-report-tab]")
    if (reportTab && isAuthenticated) { activeReportTab = reportTab.dataset.reportTab; openView("reports"); return }
    const target = closestElement(event.target, "[data-action]")
    if (!target) return
    const action = target.dataset.action
    if (action === "reactivate-license") return licenseModal()
    if (action === "close-modal") return closeModal()
    if (action === "logout") return logout()
    if (!isAuthenticated) return
    const project = currentProject()

    if (action === "ribbon-unavailable") return toast("الأداة غير متاحة بعد", target.title || "سيتم تفعيلها في محرك الرسم القادم.", "warning")
    if (action === "toggle-navigator") { $("#app-shell").classList.toggle("navigator-hidden"); return }
    if (action === "model-page-prev" || action === "model-page-next") { modelPage = Math.max(0, modelPage + (action === "model-page-next" ? 1 : -1)); render(); return }
    if (action === "reset-ribbon") { ribbonHiddenCommands = []; ribbonLayout = {}; persistUiState(); renderRibbon(); scheduleSave(); toast("تمت استعادة الـRibbon", "ظهرت كل الأوامر وعاد حجم المجموعات الافتراضي."); return }
    if (action === "save-now") { await saveNow(); toast("تم حفظ البيانات", "آخر حالة للمشروع محفوظة."); return }
    if (action === "undo") return undo()
    if (action === "redo") return redo()
    if (action === "focus-search") { $("#global-search")?.focus(); $("#global-search")?.select?.(); return }
    if (action === "notifications") return toast("الإشعارات", "لا توجد إشعارات جديدة.")
    if (action === "close-project") { activeView = "projects"; activeRibbonTab = "home"; openTabs = ["projects"]; activeItemId = null; activeDrawingId = null; drawingClosed = true; persistUiState(); render(); return }
    if (action === "recalculate-analysis") {
      if (!activeItemId && project.boq?.[0]) activeItemId = project.boq[0].id
      openView("analysis")
      toast("تمت إعادة حساب التحليل", "راجع Direct Cost وSelling Rate في Rate Inspector.")
      return
    }
    if (action === "open-productivity") {
      if (!activeItemId && project.boq?.[0]) activeItemId = project.boq[0].id
      openView("analysis")
      toast("Crew & Productivity", "يمكنك تعديل أفراد الطاقم والإنتاجية وساعات العمل داخل تحليل البند.")
      return
    }

    if (action === "import-ifc-model") return importIfcModel()
    if (action === "compare-ifc-revisions") return compareIfcRevisions()
    if (action === "ifc-approve-mapping" || action === "ifc-reject-mapping") {
      if (!Model.setIfcMappingStatus) return
      const status = action === "ifc-approve-mapping" ? "approved" : "rejected"; let result
      const ok = commit(`${status === "approved" ? "اعتماد" : "رفض"} ربط IFC`, () => { result = Model.setIfcMappingStatus(project, target.dataset.id, status, C.activeUser(state)?.name || state.user.name) })
      if (!ok || !result?.ok) return toast("تعذر تحديث ربط IFC", result?.reason || "راجع العنصر.", "warning")
      toast(status === "approved" ? "تم اعتماد ربط IFC" : "تم رفض ربط IFC", "لن تتغير كمية BOQ إلا بعد الضغط على Apply qty.")
      return
    }
    if (action === "ifc-apply-quantity") {
      if (!Model.applyApprovedIfcQuantity) return
      let result
      const ok = commit("تطبيق كمية IFC معتمدة", () => { result = Model.applyApprovedIfcQuantity(project, target.dataset.id, C.activeUser(state)?.name || state.user.name) })
      if (!ok || !result?.ok) return toast("لا يمكن تطبيق كمية IFC", result?.reason === "MAPPING_NOT_APPROVED" ? "اعتمد الربط أولًا." : result?.reason || "راجع البند.", "warning")
      toast("تم تحديث Takeoff للبند", `${result.item.itemNo} · ${num(result.quantity)} ${result.item.unit} — مصدر IFC معتمد.`)
      return
    }
    if (action === "register-device") {
      if (!Collab.registerDevice) return
      let result
      const ok = commit("تسجيل جهاز QESTIMA", () => { result = Collab.registerDevice(state, { tenantId: state.session?.tenantId, userId: C.activeUser(state)?.id, name: "Windows device", platform: window.qestimaDesktop?.platform || navigator.platform || "windows", appVersion: state.appVersion }) }, { audit: false })
      if (!ok || !result?.ok) return toast("تعذر تسجيل الجهاز", result?.reason === "DEVICE_SEAT_LIMIT" ? "تم بلوغ حد الأجهزة في الترخيص." : result?.reason || "راجع مساحة الشركة.", "warning")
      toast("تم تسجيل الجهاز", `${result.usage.devices}/${result.usage.maxDevices} أجهزة مستخدمة.`)
      return
    }
    if (action === "central-health") {
      const baseUrl = state.central?.apiBaseUrl
      if (!baseUrl) return centralLoginModal()
      const result = window.qestimaDesktop?.centralRequest ? await window.qestimaDesktop.centralRequest({ baseUrl, path: "/health" }) : null
      if (!result?.ok) return toast("تعذر الاتصال بالمركز", result?.error || result?.data?.reason || "راجع عنوان الخادم.", "error")
      commit("فحص اتصال Central API", () => { state.central.connectionState = "central"; state.central.lastSyncAt = new Date().toISOString() }, { audit: false, allowExpired: true })
      toast("Central API متصل", `QESTIMA Central ${result.data?.version || ""}`)
      return
    }
    if (action === "central-login") return centralLoginModal()
    if (action === "owner-sync-project") return centralSyncProject()
    if (action === "owner-sync-all") return centralSyncAllProjects()
    if (action === "license-action") {
      const command = target.dataset.licenseAction || "activate"; let result
      if (state.central?.connectionState === "central" && state.central.apiBaseUrl && state.central.accessToken) {
        const response = await centralRequest({ baseUrl: state.central.apiBaseUrl, path: `/api/v1/licenses/${encodeURIComponent(state.central.tenantId || state.session?.tenantId || "")}/action`, method: "POST", token: state.central.accessToken, body: { action: command, days: 30, reason: "Owner Portal" } })
        if (!response?.ok) return toast("تعذر تنفيذ إجراء الترخيص", response?.data?.reason || response?.error || "راجع صلاحية المدير.", "warning")
        const remote = response.data || {}
        const ok = commit(`License ${command}`, () => { state.license = { ...(state.license || {}), ...(remote.license || {}), activationMode: "central", licenseToken: remote.licenseToken || state.central.licenseToken || "" }; state.central.licenseToken = remote.licenseToken || state.central.licenseToken || ""; state.central.licensePublicKeyId = remote.licensePublicKeyId || state.central.licensePublicKeyId || "" }, { allowExpired: true, audit: false })
        if (!ok) return
        result = remote
      } else {
        if (window.qestimaDesktop?.commercialBuild) return toast("يلزم خادم الترخيص", "إجراءات التمديد والإيقاف متاحة من الخادم المعتمد فقط.", "warning")
        const ok = commit(`License ${command}`, () => { result = Collab.licenseAction ? Collab.licenseAction(state, command, { tenantId: state.session?.tenantId, userId: C.activeUser(state)?.id, days: 30, reason: "Owner Portal" }) : null }, { allowExpired: true })
        if (!ok || !result?.ok) return toast("تعذر تنفيذ إجراء الترخيص", result?.reason || "راجع صلاحية المدير.", "warning")
      }
      toast("تم تحديث الترخيص", `${command} · ${result.entitlements?.status || result.license?.status || "active"}`)
      return
    }
    if (action === "request-support-access") {
      let record
      const ok = commit("طلب وصول دعم مؤقت", () => { record = Collab.requestSupportAccess ? Collab.requestSupportAccess(state, { tenantId: state.session?.tenantId, reason: "طلب دعم من Owner Portal", scopes: ["diagnostics", "sync-status"] }) : null }, { audit: false, allowExpired: true })
      if (!ok || !record) return
      toast("تم إرسال طلب الدعم", "لا يصبح فعالًا إلا بعد موافقة العميل وبمدة محددة.")
      return
    }

    if (action === "run-quality-check") {
      const quality = C.pricingQuality(project, state.resources, currentScenario(project), { state })
      render()
      toast(quality.canSubmit ? "Quality Gate Passed" : "Quality Gate يحتاج مراجعة", `${quality.counts.blocker} blockers · ${quality.counts.high} high · score ${quality.score}%`, quality.canSubmit ? "success" : "warning")
      return
    }
    if (action === "waive-quality" || action === "request-quality-waiver") {
      const code = target.dataset.code || "GENERAL_EXCEPTION"
      const itemId = target.dataset.item || ""
      const reason = window.prompt ? window.prompt("اكتب سبب الاستثناء واعتماده", "Reviewed by Estimation Manager") : "Reviewed exception"
      if (!reason) return
      commit(`طلب استثناء جودة ${code}`, () => { project.qualityWaivers ||= []; project.qualityWaivers.unshift({ id: C.id("waiver"), code, itemId, reason, status: C.can(state, "approval.manage", project) ? "approved" : "requested", requestedBy: C.activeUser(state)?.name || state.user.name, approvedBy: C.can(state, "approval.manage", project) ? C.activeUser(state)?.name || state.user.name : "", createdAt: new Date().toISOString() }) })
      toast(C.can(state, "approval.manage", project) ? "تم اعتماد الاستثناء" : "تم إرسال طلب الاستثناء", code)
      return
    }
    if (action === "freeze-submission") {
      const label = window.prompt ? window.prompt("اسم نسخة التسليم", `Final Submission · R${project.revisionNo || 0}`) : `Final Submission · R${project.revisionNo || 0}`
      if (!label) return
      let result
      commit("تجميد نسخة التسليم", () => { result = C.freezeSubmission(project, state, state.activeScenarioId, { label, user: C.activeUser(state)?.name || state.user.name }) })
      if (!result?.ok) {
        undo()
        const messages = { QUALITY_GATE_FAILED: "أغلق أخطاء الجودة أو اعتمد استثناءً رسميًا.", TENDER_REVIEW_GATE_FAILED: "أكمل Tender Review Gate أو اعتمد استثناءً رسميًا قبل التقديم.", SCENARIO_NOT_LOCKED: "اعتمد وقفل السيناريو النهائي أولًا.", SCENARIO_REQUIRED: "لا يوجد سيناريو للتجميد." }
        return toast("لا يمكن تجميد التسليم", messages[result?.reason] || result?.reason || "راجع البيانات.", "warning")
      }
      toast("تم تجميد نسخة التسليم", `${result.snapshot.label} · Quality ${result.quality.score}%`)
      return
    }
    if (action === "reset-decision-draft") {
      commit("إعادة ضبط What-If", () => { project.decisionDraft = {} }, { audit: false })
      return
    }
    if (action === "save-decision-scenario") {
      const draft = { materialPercent: 0, laborPercent: 0, equipmentPercent: 0, subcontractorPercent: 0, contingencyPercent: 0, supplierDiscountPercent: 0, currencyFactor: 1, alternateQuoteId: "", profitOverride: currentScenario(project).profitPercent, targetPrice: 0, ...(project.decisionDraft || {}) }
      const preview = C.applyWhatIf(project, state.resources, currentScenario(project), draft)
      const name = window.prompt ? window.prompt("اسم سيناريو What-If", `What-If ${new Date().toLocaleDateString("en-CA")}`) : `What-If ${new Date().toISOString()}`
      if (!name) return
      commit(`حفظ سيناريو What-If ${name}`, () => { project.decisionScenarios ||= []; project.decisionScenarios.unshift({ id: C.id("decision"), name, changes: C.deepClone(draft), totals: preview.totals, createdAt: new Date().toISOString(), createdBy: C.activeUser(state)?.name || state.user.name }) })
      toast("تم حفظ السيناريو", "نسخة مستقلة للمقارنة ولا تغيّر التسعير الأساسي.")
      return
    }
    if (action === "add-comment") return commentModal()

    if (action === "close-modal") return closeModal()
    if (action === "report-problem") return feedbackModal()
    if (action === "backup") return backupModal()
    if (action === "open-building-selector") return buildingSelectorModal()
    if (action === "select-building") {
      const selected = state.projects.find((entry) => entry.id === target.dataset.id)
      if (!selected) return
      state.activeProjectId = selected.id
      activeItemId = selected.boq[0]?.id || null
      activeDrawingId = selected.documents.find((document) => document.category === "drawings" && document.latestRevision)?.id || null
      closeModal()
      openView("drawings")
      scheduleSave()
      return
    }
    if (action === "select-drawing") {
      activeDrawingId = target.dataset.id || null
      drawingClosed = false
      drawingPage = 1
      measurementCanvas = { ...measurementCanvas, drawingId: activeDrawingId, page: 1, points: [], mode: "", revisionOverlayId: null, image: null, zoom: 1 }
      openView("drawings")
      return
    }
    if (action === "close-drawing") {
      if (!activeDrawingId) return toast("لا يوجد رسم مفتوح", "اختر رسمًا من القائمة أولًا.", "warning")
      const drawing = project.documents.find((entry) => entry.id === activeDrawingId)
      activeDrawingId = null
      drawingClosed = true
      measurementCanvas = { ...measurementCanvas, drawingId: null, mode: "", points: [], image: null, sourceWidth: 0, sourceHeight: 0, revisionOverlayId: null }
      persistUiState()
      render()
      toast("تم إغلاق الرسم", `${drawing?.documentNumber || drawing?.title || "Drawing"} ما زال محفوظًا داخل Document Register.`)
      return
    }
    if (action === "drawing-properties") {
      const drawing = project.documents.find((entry) => entry.id === activeDrawingId)
      if (!drawing) return toast("اختر رسمًا أولًا", "حدد رسمًا من القائمة لعرض خصائصه.", "warning")
      return drawingPropertiesModal(drawing)
    }
    if (["show-drawing-layers", "hide-drawing-layers", "filter-drawing-layers"].includes(action)) {
      if (!activeDrawingId) return toast("اختر رسمًا أولًا", "حدد رسمًا قبل إدارة الطبقات.", "warning")
      return toast("إدارة الطبقات قيد التجهيز", "طبقات PDF ستصبح قابلة للإظهار والإخفاء مع دعم DXF/DWG؛ لا يتم تغيير الرسم الحالي تلقائيًا.", "warning")
    }
    if (action === "change-scale-units") {
      const drawing = project.documents.find((entry) => entry.id === activeDrawingId)
      const scaleKey = drawingScaleKey(activeDrawingId, drawingPage)
      const scale = project.drawingScales?.[scaleKey]
      if (!drawing || !scale) return toast("لا يوجد مقياس محفوظ", "اضبط المقياس من Calibrate أولًا.", "warning")
      const unit = window.prompt ? window.prompt("وحدة القياس الجديدة", scale.unit || "m") : scale.unit || "m"
      if (!unit || !String(unit).trim()) return
      commit("تغيير وحدة مقياس الرسم", () => { project.drawingScales[scaleKey] = { ...scale, unit: String(unit).trim(), updatedAt: new Date().toISOString(), updatedBy: C.activeUser(state)?.name || state.user.name } })
      return
    }
    if (action === "toggle-drawing-overlay") {
      const drawing = project.documents.find((entry) => entry.id === activeDrawingId)
      const prior = previousDrawingRevision(project, drawing)
      if (!drawing || !prior) return toast("لا توجد Revision سابقة", "ارفع Revision أخرى بنفس رقم الرسم لاستخدام Overlay.", "warning")
      measurementCanvas.revisionOverlayId = measurementCanvas.revisionOverlayId === prior.id ? null : prior.id
      drawMeasurementOverlay()
      render()
      toast(measurementCanvas.revisionOverlayId ? "تم تشغيل Revision Overlay" : "تم إخفاء Revision Overlay", `الرسم الحالي: ${drawing.documentNumber || drawing.title} · Rev ${drawing.revision}`)
      return
    }
    if (action === "resource-filter") {
      filters.resourceType = target.dataset.type || ""
      return openView("resources")
    }
    if (action === "link-current-boq") {
      const item = project.boq.find((entry) => entry.id === activeItemId)
      if (!item) return toast("اختر بند BOQ أولًا", "افتح BOQ وحدد البند المراد ربطه.", "warning")
      return boqLinkModal(item)
    }
    if (action === "analyze-document" || action === "analyze-selected-pdf") {
      const selectedDocument = action === "analyze-document" ? project.documents.find((entry) => entry.id === target.dataset.id) : currentPdfDocuments(project)[0]
      if (!selectedDocument) return toast("لا يوجد PDF للتحليل", "ارفع Tender Instructions أو Specifications أو Drawing PDF أولًا.", "warning")
      return analyzePdfDocument(selectedDocument)
    }
    if (action === "ask-project-docs") return pdfAskModal()
    if (action === "compare-document-revisions") return documentRevisionCompareModal()
    if (action === "approve-insight" || action === "reject-insight") {
      const decision = action === "approve-insight" ? "approved" : "rejected"
      let result
      const ok = commit(`${decision === "approved" ? "اعتماد" : "رفض"} نتيجة PDF`, () => { result = C.setDocumentInsightStatus(project, target.dataset.id, decision, C.activeUser(state)?.name || state.user.name) }, { audit: true })
      if (!ok || !result?.ok) return toast("نتيجة القراءة غير موجودة", "أعد تحليل المستند.", "warning")
      toast(decision === "approved" ? "تم اعتماد نتيجة القراءة" : "تم رفض نتيجة القراءة", decision === "approved" ? "يمكنك الآن اختيار Apply to Tender Review بشكل صريح." : "لن تظهر ضمن النتائج المعتمدة.")
      return
    }
    if (action === "apply-insight") {
      let result
      const user = C.activeUser(state)?.name || state.user.name
      const ok = commit("تطبيق نتيجة PDF على Tender Review", () => { result = C.applyDocumentInsight(project, target.dataset.id, user) })
      if (!ok || !result?.ok) return toast("لا يمكن تطبيق النتيجة", result?.reason === "INSIGHT_NOT_APPROVED" ? "اعتمد النتيجة أولًا من Review Queue." : "راجع مصدر النتيجة.", "warning")
      toast("تم تطبيق نتيجة PDF", `${result.summary.label || result.summary.key} · Page ${result.summary.sourcePage}`)
      return
    }
    if (["measure-length", "measure-polyline", "measure-area", "measure-perimeter", "measure-count", "add-measurement"].includes(action)) {
      const kind = action === "measure-area" ? "area" : action === "measure-perimeter" ? "perimeter" : action === "measure-count" ? "count" : action === "measure-polyline" ? "polyline" : action === "add-measurement" ? "group" : "length"
      return kind === "group" ? dimensionGroupModal() : activeView === "drawings" ? startCanvasMeasurement(kind) : measurementModal(kind)
    }
    if (action === "start-measure") return startCanvasMeasurement(target.dataset.kind || "length")
    if (action === "calibrate-scale") {
      if (!activeDrawingId) return toast("اختر رسمًا أولًا", "اختر صفحة PDF قبل ضبط المقياس.", "warning")
      measurementCanvas = { ...measurementCanvas, mode: "calibrate", kind: "calibrate", points: [], page: drawingPage }
      render(); toast("وضع المعايرة", "حدد نقطتين لبعد معروف ثم اضغط Finish.")
      return
    }
    if (action === "finish-measurement") return finishCanvasMeasurement()
    if (action === "cancel-measurement") { measurementCanvas = { ...measurementCanvas, mode: "", points: [] }; render(); return }
    if (action === "drawing-page-prev") return changeDrawingPage(drawingPage - 1)
    if (action === "drawing-page-next") return changeDrawingPage(drawingPage + 1)
    if (action === "toggle-snap") { measurementCanvas.snap = !measurementCanvas.snap; render(); return }
    if (action === "toggle-revision-overlay") {
      measurementCanvas.revisionOverlayId = target.dataset.id || null
      drawMeasurementOverlay()
      return
    }
    if (action === "carry-drawing-measurements") {
      const beforeId = target.dataset.before || measurementCanvas.revisionOverlayId
      if (!beforeId || !activeDrawingId) return toast("لا توجد Revision سابقة", "اختر Revision سابقة لتحويل قياساتها إلى الصفحة الحالية.", "warning")
      let result
      const ok = commit("نقل قياسات Revision للرسم الحالي", () => { result = C.carryMeasurementsToRevision(project, beforeId, activeDrawingId, C.activeUser(state)?.name || state.user.name); if (result?.ok) { project.measurements ||= []; project.measurements.unshift(...result.measurements) } })
      if (!ok || !result?.ok) return toast("تعذر نقل القياسات", result?.reason || "راجع Revision الحالية والسابقة.", "warning")
      measurementCanvas.revisionOverlayId = beforeId
      render(); toast("تم نقل القياسات كمقترحات", `${result.measurements.length} قياسًا يحتاج مراجعة واعتمادًا على Revision الجديدة.`)
      return
    }
    if (action === "approve-quantity") {
      const measurement = (project.measurements || []).find((entry) => entry.id === target.dataset.id)
      const item = project.boq.find((entry) => entry.id === measurement?.itemId)
      if (!measurement || !item) return
      const user = C.activeUser(state)?.name || state.user.name
      let result
      const ok = commit(`اعتماد كمية ${item.itemNo}`, () => { Object.assign(measurement, C.approveMeasurement(measurement, user)); result = C.applyApprovedMeasurement(project, measurement.id, user) })
      if (!ok || !result?.ok) return toast("تعذر اعتماد الكمية", result?.reason || "راجع صلاحية القياس والبند.", "warning")
      toast("تم اعتماد الكمية", `${item.itemNo} يستخدم الآن إجمالي Takeoff المعتمد.`)
      return
    }
    if (["drawing-fit", "drawing-zoom-in", "drawing-zoom-out"].includes(action)) {
      measurementCanvas.zoom = action === "drawing-fit" ? 1 : Math.max(.25, Math.min(4, C.number(measurementCanvas.zoom || 1) + (action === "drawing-zoom-in" ? .15 : -.15)))
      applyDrawingCanvasLayout(); drawMeasurementOverlay(); return
    }
    if (action === "close-tab") return closeTab(target.dataset.view)
    if (action === "new-project") return projectModal()
    if (action === "edit-current-project") return projectModal(project)
    if (action === "edit-project") return projectModal(state.projects.find((entry) => entry.id === target.dataset.id))
    if (action === "toggle-inspector") { inspectorHidden = !inspectorHidden; render(); return }
    if (action === "upload-tender-files") return importTenderDocuments("files")
    if (action === "upload-tender-folder") return importTenderDocuments("folder")
    if (action === "upload-tender-zip") return importTenderDocuments("zip")
    if (action === "import-cad-document") return importCadDocument(target.dataset.format || target.dataset.cadFormat || "DXF")
    if (action === "inspect-cad") return inspectCadDocument(project.documents.find((entry) => entry.id === target.dataset.id))
    if (action === "open-document") {
      if (!target.dataset.id) return null
      if (window.qestimaDesktop?.openAttachment) return window.qestimaDesktop.openAttachment(target.dataset.id)
      return openBrowserAttachment(target.dataset.id)
    }
    if (action === "delete-document") {
      const document = project.documents.find((entry) => entry.id === target.dataset.id)
      if (!document || !confirm(`حذف ${document.title} من Document Register؟ لن تُحذف بقية الـRevisions.`)) return
      commit(`حذف مستند ${document.title}`, () => {
        project.documents = project.documents.filter((entry) => entry.id !== document.id)
        project.tenderSummary.forEach((field) => { if (field.sourceDocumentId === document.id) { field.sourceDocumentId = ""; field.sourcePage = ""; field.verified = false } })
        project.boq.forEach((item) => { if (item.drawingDocumentId === document.id) item.drawingDocumentId = ""; if (item.specificationDocumentId === document.id) item.specificationDocumentId = "" })
        C.recalculateDocumentRevisions(project)
        project.tenderReview.completedAt = ""
      })
      return
    }
    if (action === "complete-tender-review") {
      const sourced = project.tenderSummary.filter((field) => field.verified && field.value && field.sourceDocumentId).length
      commit("اعتماد Tender Review", () => { project.tenderReview.completedAt = new Date().toISOString(); project.tenderReview.completedBy = state.user.name })
      toast("تم اعتماد Tender Review", `${sourced} معلومة موثقة بمصدر. النواقص تظل ظاهرة كمخاطر ولا توقف العمل.`, sourced ? "success" : "warning")
      return
    }
    if (action === "reopen-tender-review") {
      commit("إعادة فتح Tender Review", () => { project.tenderReview.completedAt = "" })
      return
    }
    if (action === "add-scope") return scopeModal()
    if (action === "delete-scope") {
      commit("حذف System من Scope Matrix", () => { project.scopeMatrix = project.scopeMatrix.filter((row) => row.id !== target.dataset.id) })
      return
    }
    if (action === "generate-scope-risks" || action === "auto-detect-risks") {
      let added = 0
      commit("كشف فجوات المناقصة", () => { added = detectTenderRisks(project) })
      toast(added ? "تم إنشاء سجل للفجوات" : "لا توجد فجوات جديدة", added ? `${added} عنصر أُضيف إلى Clarifications & Risks.` : "العناصر الحالية مسجلة بالفعل.", added ? "success" : "warning")
      if (action === "generate-scope-risks") openView("risks")
      return
    }
    if (action === "add-risk") return riskModal()
    if (action === "delete-risk") {
      commit("حذف عنصر من سجل المخاطر", () => { project.risks = project.risks.filter((risk) => risk.id !== target.dataset.id) })
      return
    }
    if (action === "export-clarifications") return exportClarifications()
    if (action === "link-boq") return boqLinkModal(project.boq.find((item) => item.id === target.dataset.id))
    if (action === "select-project") {
      state.activeProjectId = target.dataset.id
      activeItemId = currentProject().boq[0]?.id || null
      render()
      scheduleSave()
      return
    }
    if (action === "open-project-workspace") {
      state.activeProjectId = target.dataset.id
      activeItemId = currentProject().boq[0]?.id || null
      openView("boq")
      scheduleSave()
      return
    }
    if (action === "copy-project") {
      const source = state.projects.find((entry) => entry.id === target.dataset.id)
      if (!source) return
      commit("نسخ مشروع سابق كبداية", () => {
        const copy = C.deepClone(source)
        copy.id = C.id("project")
        copy.tenderCode = C.nextTenderCode(state)
        copy.name = `${source.name} — نسخة`
        copy.status = "draft"
        copy.createdAt = new Date().toISOString()
        copy.updatedAt = copy.createdAt
        copy.revisionNo = 0
        copy.revisions = []
        copy.tenderReview = { completedAt: "", completedBy: "", notes: "" }
        copy.audit = [{ id: C.id("audit"), date: copy.createdAt, user: state.user.name, action: `نسخ من مشروع ${source.name}` }]
        state.projects.push(copy)
        state.activeProjectId = copy.id
      })
      toast("تم نسخ المشروع", "كل الأسعار والتحليلات نُسخت كبداية مستقلة.")
      return
    }
    if (action === "project-revisions") return revisionsModal(state.projects.find((entry) => entry.id === target.dataset.id))
    if (action === "revision-impact") {
      if (!target.dataset.id) return openView("revisions")
      const revision = project.revisions.find((entry) => entry.id === target.dataset.id)
      return revisionImpactModal(revision)
    }
    if (action === "save-revision") return saveRevision()
    if (action === "restore-revision") {
      const selectedProject = state.projects.find((entry) => entry.id === target.dataset.project)
      const revision = selectedProject?.revisions.find((entry) => entry.id === target.dataset.id)
      if (!revision || !confirm(`استعادة ${revision.label} كنسخة العمل الحالية؟`)) return
      commit(`استعادة ${revision.label}`, () => {
        const index = state.projects.findIndex((entry) => entry.id === selectedProject.id)
        const restored = C.deepClone(revision.snapshot)
        restored.revisions = selectedProject.revisions
        restored.revisionNo = selectedProject.revisionNo
        restored.updatedAt = new Date().toISOString()
        state.projects[index] = restored
      })
      closeModal()
      toast("تمت استعادة الـRevision", "النسخة السابقة محفوظة في السجل ولم تُحذف.")
      return
    }
    if (action === "add-boq") return boqModal()
    if (action === "delete-boq") {
      const item = project.boq.find((entry) => entry.id === target.dataset.id)
      if (!item || !confirm(`حذف البند ${item.itemNo} وتحليله وأسعاره المرتبطة؟`)) return
      commit(`حذف بند ${item.itemNo}`, () => {
        project.boq = project.boq.filter((entry) => entry.id !== item.id)
        delete project.analyses[item.id]
        project.quotes.forEach((quote) => { quote.items = quote.items.filter((line) => !(line.targetType === "boq" && line.targetId === item.id)) })
      })
      return
    }
    if (action === "open-analysis") {
      activeItemId = target.dataset.id
      return openView("analysis")
    }
    if (action === "copy-historical-rate") {
      const item = project.boq.find((entry) => entry.id === target.dataset.item)
      const rate = C.number(target.dataset.rate)
      if (!item || rate <= 0) return
      const approved = window.confirm ? window.confirm(`استخدام السعر التاريخي ${money(rate)} للبند ${item.itemNo}؟ سيتم تسجيله كسعر يدوي للمراجعة.`) : true
      if (!approved) return
      commit(`نسخ سعر تاريخي للبند ${item.itemNo}`, () => { item.pricingMethod = "manual"; item.manualRate = rate; item.notes = `${item.notes ? `${item.notes} · ` : ""}Historical match ${target.dataset.match || ""} — engineer reviewed` })
      toast("تم نسخ السعر التاريخي", "راجع المصدر قبل اعتماد العرض النهائي.")
      return
    }
    if (action === "open-rate-assembly") return rateAssemblyModal(target.dataset.item || activeItemId)
    if (action === "select-boq-inspector") {
      activeItemId = target.dataset.id
      inspectorHidden = false
      render()
      return
    }
    if (action === "select-analysis-item") {
      activeItemId = target.dataset.id
      return render()
    }
    if (action === "add-analysis-line") return analysisLineModal()
    if (action === "copy-analysis") return copyAnalysisModal()
    if (action === "clear-analysis") {
      const analysis = project.analyses[activeItemId]
      if (!analysis || (!analysis.lines.length && !Object.values(analysis.extras || {}).some(C.number))) return
      if (!confirm("مسح تحليل هذا البند بالكامل؟ يمكن الرجوع باستخدام Undo.")) return
      commit("مسح تحليل سعر الوحدة", () => { project.analyses[activeItemId] = { lines: [], extras: C.defaultExtras() } })
      return
    }
    if (action === "remove-analysis-line") {
      commit("حذف مورد من تحليل السعر", () => {
        const analysis = project.analyses[activeItemId]
        analysis.lines = analysis.lines.filter((line) => line.id !== target.dataset.id)
      })
      return
    }
    if (action === "update-rate-snapshot") {
      const analysis = project.analyses[target.dataset.item]
      const line = analysis?.lines.find((entry) => entry.id === target.dataset.line)
      const resource = state.resources.find((entry) => entry.id === line?.resourceId)
      if (!line || !resource) return
      commit(`اعتماد السعر الجديد ${resource.code}`, () => { line.rateSnapshot = C.resourceSnapshot(resource, { source: resource.sourceProject || "Resource Library", approvedBy: C.activeUser(state)?.name || state.user.name }) })
      toast("تم تحديث سعر المشروع", `${resource.code} = ${money(resource.rate)}. اللقطة السابقة باقية داخل سجل الـRevision.`)
      return
    }
    if (action === "add-resource") return resourceModal()
    if (action === "resource-history") return resourceHistoryModal(state.resources.find((entry) => entry.id === target.dataset.id))
    if (action === "delete-resource") {
      const resource = state.resources.find((entry) => entry.id === target.dataset.id)
      const impact = C.resourceImpact(state, resource.id)
      if (impact.length) return toast("لا يمكن حذف المورد", `مستخدم في ${impact.length} بنود. احذف الربط من التحليلات أولًا.`, "warning")
      if (!confirm(`حذف ${resource.name} من المكتبة؟`)) return
      commit(`حذف مورد ${resource.code}`, () => { state.resources = state.resources.filter((entry) => entry.id !== resource.id) })
      return
    }
    if (action === "export-resources") return exportResources()
    if (action === "open-import") { importDraft = null; return renderImportWizard(1) }
    if (action === "bulk-edit-boq") {
      const field = window.prompt("الحقل الجماعي: section أو system أو floor", "section")
      if (!field || !["section", "system", "floor"].includes(field)) return toast("حقل غير صالح", "اختر section أو system أو floor.", "warning")
      const value = window.prompt(`القيمة الجديدة لكل البنود الظاهرة — ${field}`, "")
      if (value == null) return
      const search = filters.boqSearch.toLowerCase()
      const rows = project.boq.filter((item) => (!search || `${item.itemNo} ${item.description}`.toLowerCase().includes(search)) && (!filters.section || item.section === filters.section) && (!filters.system || item.system === filters.system) && (!filters.floor || item.floor === filters.floor))
      commit(`تعديل جماعي لـ ${rows.length} بند`, () => { rows.forEach((item) => { item[field] = value; item.sources ||= {}; item.sources[field] = { type: "bulk", date: new Date().toISOString(), user: C.activeUser(state)?.name || state.user.name } }) })
      toast("تم التعديل الجماعي", `${rows.length} بند`)
      return
    }
    if (action === "import-back-step") return renderImportWizard(1)
    if (action === "import-map-step") return renderImportWizard(2)
    if (action === "import-preview") { if (validateImportMapping()) renderImportWizard(3); return }
    if (action === "import-confirm") {
      const skipDuplicates = $("#import-skip-duplicates")?.checked !== false
      const replace = $("#import-replace")?.checked === true
      const cleaned = C.cleanBoqRows(importDraft.rows, importDraft.mapping, { skipDuplicates, fileName: importDraft.fileName, importedBy: C.activeUser(state)?.name || state.user.name })
      commit(`استيراد ${cleaned.rows.length} بند من Excel`, () => {
        if (replace) { project.boq = []; project.analyses = {} }
        project.boq.push(...cleaned.rows)
        state.importTemplates ||= []
        const existingTemplate = state.importTemplates.find((template) => template.client && currentProject()?.client && C.normalizeHeader(template.client) === C.normalizeHeader(currentProject().client) && JSON.stringify(template.mapping) === JSON.stringify(importDraft.mapping))
        if (existingTemplate) { existingTemplate.lastUsedAt = new Date().toISOString(); existingTemplate.useCount = C.number(existingTemplate.useCount) + 1 }
        else state.importTemplates.push(C.createImportTemplate(`${project.client || "Client"} BOQ Layout`, importDraft.mapping, { client: project.client || "", headers: importDraft.headers, lastUsedAt: new Date().toISOString(), useCount: 1 }))
        C.ensureProjectV5(project, state, state.projects.indexOf(project))
      })
      closeModal()
      activeView = "boq"
      if (!openTabs.includes("boq")) openTabs.push("boq")
      render()
      toast("تم استيراد BOQ بنجاح", `${cleaned.rows.length} بند جاهز للتسعير.`)
      return
    }
    if (action === "download-template") return downloadTemplate()
    if (action === "show-unpriced") { filters.pricing = "unpriced"; return openView("boq") }
    if (action === "add-supplier") return supplierModal()
    if (action === "add-rfq") return rfqModal()
    if (action === "add-quote") return quoteModal()
    if (action === "add-quote-line") return quoteLineModal()
    if (action === "adopt-quote") {
      const quote = project.quotes.find((entry) => entry.id === target.dataset.quote)
      const line = quote?.items.find((entry) => entry.targetType === target.dataset.type && entry.targetId === target.dataset.target)
      if (!quote || !line) return
      const supplier = state.suppliers.find((entry) => entry.id === quote.supplierId)
      if (target.dataset.type === "resource") {
        const resource = state.resources.find((entry) => entry.id === target.dataset.target)
        const impact = C.resourceImpact(state, resource.id, project.id)
        commit(`اعتماد سعر ${resource.code} من ${supplier?.name || "مورد"}`, () => {
          resource.history ||= []
          resource.history.push({ rate: C.number(resource.rate), date: resource.updatedAt || new Date().toISOString(), source: resource.sourceProject || "السعر السابق" })
          resource.rate = C.number(line.unitPrice)
          resource.supplierId = quote.supplierId
          resource.selectedQuoteId = quote.id
          resource.sourceProject = `عرض ${quote.reference || supplier?.name || "مورد"}`
          resource.updatedAt = quote.date || new Date().toISOString()
        })
        toast("وصل سعر جديد للمكتبة", `${impact.length} بنود مرتبطة ستعرض New Rate Available بدون تغيير سعر المناقصة تلقائيًا.`)
      } else {
        const item = project.boq.find((entry) => entry.id === target.dataset.target)
        commit(`اعتماد عرض ${supplier?.name || "مورد"} للبند ${item.itemNo}`, () => {
          item.pricingMethod = "supplier"
          item.selectedQuoteId = quote.id
          item.manualRate = C.number(line.unitPrice)
        })
        toast("تم اعتماد عرض المورد للبند", `${item.itemNo} — ${money(line.unitPrice, quote.currency)}`)
      }
      return
    }
    if (action === "attach-quote") {
      let attachment = null
      if (window.qestimaDesktop?.pickAttachment) attachment = await window.qestimaDesktop.pickAttachment()
      else {
        const [file] = await browserPickFiles("file", ".pdf,.xlsx,.xls,.docx,.doc,.zip,.jpg,.jpeg,.png,.txt")
        if (file) attachment = await storeBrowserAttachment(file)
      }
      if (!attachment) return
      commit("إرفاق عرض السعر الأصلي", () => { project.quotes.find((quote) => quote.id === target.dataset.id).attachment = attachment })
      toast("تم حفظ المرفق", attachment.name)
      return
    }
    if (action === "open-attachment") {
      if (window.qestimaDesktop?.openAttachment) return window.qestimaDesktop.openAttachment(target.dataset.id)
      return openBrowserAttachment(target.dataset.id)
    }
    if (action === "select-scenario") { state.activeScenarioId = target.dataset.id; render(); scheduleSave(); return }
    if (action === "add-scenario") return scenarioModal()
    if (action === "toggle-scenario-lock") {
      const selected = currentScenario(project)
      if (!C.can(state, "approval.manage", project)) return toast("الصلاحية غير متاحة", "اعتماد السعر النهائي يحتاج Estimation Manager أو System Admin.", "warning")
      commit(selected.locked ? `إعادة فتح سيناريو ${selected.name}` : `اعتماد وقفل سيناريو ${selected.name}`, () => {
        selected.locked = !selected.locked
        selected.approvedAt = selected.locked ? new Date().toISOString() : ""
        selected.approvedBy = selected.locked ? (C.activeUser(state)?.name || state.user.name) : ""
      })
      toast(selected.locked ? "تم اعتماد السيناريو وقفل معادلاته" : "تمت إعادة فتح السيناريو", selected.name)
      return
    }
    if (action === "export-excel" || action === "export-report-excel") return exportExcel()
    if (action === "print-report") return exportReportPdf()
    if (action === "export-report-pack") return exportReportPack()
    if (action === "report-company-profile") return companyProfileModal()
    if (action === "export-backup") {
      if (window.qestimaDesktop?.exportBackup) {
        const path = await window.qestimaDesktop.exportBackup(state)
        if (path) { closeModal(); toast("تم حفظ النسخة الاحتياطية", path) }
      } else {
        browserDownload(`QESTIMA-Backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2))
        closeModal(); toast("تم تنزيل النسخة الاحتياطية", "ستجدها في Downloads.")
      }
      return
    }
    if (action === "export-project-package") {
      if (!window.qestimaDesktop?.exportProjectPackage) return toast("الحزمة متاحة داخل تطبيق Windows", "شغّل نسخة سطح المكتب لإدراج المرفقات.", "warning")
      const passphrase = typeof window.prompt === "function" ? (window.prompt("كلمة مرور حزمة المشروع (اختياري؛ اتركها فارغة لحزمة مرتبطة بهذا الجهاز)") || "") : ""
      const target = await window.qestimaDesktop.exportProjectPackage(state, passphrase)
      if (target) toast("تم تصدير حزمة المشروع", target)
      return
    }
    if (action === "import-project-package") {
      if (C.licenseStatus(state).expired || !C.can(state, "project.edit", currentProject()) || currentProject().submittedLockedAt) return toast("الاستيراد غير متاح", "راجع الترخيص والصلاحية وقفل المشروع.", "warning")
      if (!window.qestimaDesktop?.importProjectPackage) return toast("الاستعادة الكاملة متاحة داخل تطبيق Windows", "شغّل نسخة سطح المكتب لاستعادة المرفقات.", "warning")
      const passphrase = typeof window.prompt === "function" ? (window.prompt("أدخل كلمة مرور الحزمة؛ اتركها فارغة إذا كانت مرتبطة بهذا الجهاز") || "") : ""
      let restored
      try { restored = await window.qestimaDesktop.importProjectPackage(passphrase) } catch (error) { return toast("تعذر استعادة الحزمة", error.message || "تحقق من كلمة المرور وسلامة الملفات.", "error") }
      if (!restored) return
      if (!confirm("إضافة مشروعات الحزمة كنسخ جديدة إلى مساحة العمل الحالية؟ تبقى المشروعات الحالية محفوظة.")) return
      undoStack.push(C.deepClone(state))
      if (undoStack.length > 30) undoStack.shift()
      redoStack = []
      const resourceMap = new Map()
      for (const resource of restored.resources || []) {
        const id = C.id("resource")
        resourceMap.set(resource.id, id)
        state.resources.push({ ...resource, id })
      }
      const supplierMap = new Map()
      for (const supplier of restored.suppliers || []) { const id = C.id("supplier"); supplierMap.set(supplier.id, id); state.suppliers.push({ ...supplier, id }) }
      for (const imported of restored.projects || []) {
        const project = C.deepClone(imported)
        project.id = C.id("project"); project.workspaceId = state.session.workspaceId; project.tenantId = state.session.tenantId
        project.syncBaseSnapshot = null; project.serverVersion = 0; project.access = {}
        Object.values(project.analyses || {}).forEach((analysis) => (analysis.lines || []).forEach((line) => { line.resourceId = resourceMap.get(line.resourceId) || line.resourceId }))
        ;(project.quotes || []).forEach((quote) => { quote.supplierId = supplierMap.get(quote.supplierId) || quote.supplierId })
        C.ensureProjectV5(project, state, state.projects.length)
        state.projects.push(project); state.activeProjectId = project.id; state.activeScenarioId = project.scenarios[0]?.id
      }
      state.auditLog ||= []
      state.auditLog.unshift({ id: C.id("audit"), timestamp: new Date().toISOString(), action: "استعادة Project Package", actorId: C.activeUser(state)?.id || "", immutable: true, source: "QESTIMA" })
      restoreUiState()
      activeItemId = currentProject().boq[0]?.id || null
      activeDrawingId = currentProject().documents.find((document) => document.category === "drawings" && document.latestRevision)?.id || null
      render()
      scheduleSave()
      toast("تمت استعادة حزمة المشروع")
      return
    }
    if (action === "import-backup") {
      try {
        const backup = window.qestimaDesktop?.importBackup ? await window.qestimaDesktop.importBackup() : await browserImportBackup()
        if (!backup) return
        if (!confirm("سيتم استبدال البيانات الحالية بالنسخة المختارة. متابعة؟")) return
        undoStack.push(C.deepClone(state))
        state = C.ensureState(backup)
        if (Collab.ensureCollaborationState) state = Collab.ensureCollaborationState(state)
        redoStack = []
        closeModal()
        render()
        scheduleSave()
        toast("تمت استعادة النسخة الاحتياطية")
      } catch (error) { toast("تعذر استعادة النسخة", error.message, "error") }
      return
    }
  }

  function handleGridPaste(event) {
    const start = closestElement(event.target, "[data-boq-id]")
    if (!start || !event.clipboardData) return
    const text = event.clipboardData.getData("text/plain")
    if (!text.includes("\t") && !text.includes("\n")) return
    event.preventDefault()
    const project = currentProject(); const rows = [...document.querySelectorAll(".pricing-grid tbody tr")]
    const rowIndex = rows.findIndex((row) => row.contains(start)); const cells = [...rows[rowIndex]?.querySelectorAll("[data-boq-id]") || []]; const colIndex = cells.indexOf(start)
    const matrix = text.trimEnd().split(/\r?\n/).map((line) => line.split("\t"))
    commit("لصق متعدد الخلايا في BOQ", () => matrix.forEach((values, r) => { const row = rows[rowIndex + r]; const item = project.boq.find((entry) => entry.id === row?.querySelector("[data-boq-id]")?.dataset.boqId); if (!item) return; const targets = [...row.querySelectorAll("[data-boq-id]")]; values.forEach((raw, c) => { const target = targets[colIndex + c]; if (!target) return; const field = target.dataset.field; const value = ["quantity", "takeoffQuantity", "manualRate"].includes(field) ? C.number(raw) : raw.trim(); item[field] = value; item.sources ||= {}; item.sources[field === "quantity" || field === "takeoffQuantity" ? "quantity" : field] = { type: "paste", date: new Date().toISOString(), user: C.activeUser(state)?.name || state.user.name } }) }))
  }

  function handleGridKeydown(event) {
    const input = closestElement(event.target, "[data-boq-id]")
    if (!input || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "d") return
    event.preventDefault()
    const rows = [...document.querySelectorAll(".pricing-grid tbody tr")]; const rowIndex = rows.findIndex((row) => row.contains(input)); const field = input.dataset.field; const value = input.value; const project = currentProject()
    if (rowIndex < 0) return
    commit(`Fill Down ${field}`, () => rows.slice(rowIndex + 1).forEach((row) => { const target = row.querySelector(`[data-boq-id][data-field="${field}"]`); const item = project.boq.find((entry) => entry.id === target?.dataset.boqId); if (!target || !item) return; const converted = ["quantity", "takeoffQuantity", "manualRate"].includes(field) ? C.number(value) : value; item[field] = converted; item.sources ||= {}; item.sources[field] = { type: "fill_down", date: new Date().toISOString(), user: C.activeUser(state)?.name || state.user.name } }))
  }

  function handleChange(event) {
    const input = event.target
    const project = currentProject()
    if (input.id === "workspace-switcher") {
      state.session.workspaceId = input.value
      state.session.tenantId = state.workspaces.find((entry) => entry.id === input.value)?.tenantId || ""
      undoStack = []; redoStack = []; activeItemId = null; activeDrawingId = null
      const firstProject = state.projects.find((entry) => entry.workspaceId === input.value)
      state.activeProjectId = firstProject?.id || ""
      if (firstProject) { activeItemId = firstProject.boq[0]?.id || null; state.activeScenarioId = firstProject.scenarios[0]?.id || "" }
      activeView = "projects"
      openTabs = ["projects"]
      render(); scheduleSave(); return
    }
    if (input.id === "project-switcher") {
      if (!state.projects.some((entry) => entry.id === input.value && entry.workspaceId === state.session.workspaceId && C.can(state, "project.view", entry))) return
      undoStack = []; redoStack = []; activeDrawingId = null
      state.activeProjectId = input.value
      activeItemId = currentProject().boq[0]?.id || null
      render(); scheduleSave(); return
    }
    if (input.dataset.drawingPage) return changeDrawingPage(input.value)
    if (input.id === "measurement-boq-item") {
      activeItemId = input.value || null
      drawMeasurementOverlay()
      return
    }
    if (input.dataset.modelSelect !== undefined) {
      activeModelId = input.value || ""
      render()
      return
    }
    if (input.dataset.ifcMap) {
      const elementId = input.dataset.ifcMap; const field = input.dataset.ifcField; const modelId = activeModelId
      const model = (project.ifcModels || []).find((entry) => entry.id === modelId)
      const element = (project.ifcElements || []).find((entry) => entry.modelId === modelId && entry.elementId === elementId)
      if (!model || !element || !["boqItemId", "rateAssemblyId", "quantityField"].includes(field)) return
      const mapping = (project.ifcMappings || []).find((entry) => entry.modelId === modelId && entry.elementId === elementId)
      const values = { modelId, elementId, boqItemId: field === "boqItemId" ? input.value : mapping?.boqItemId || "", rateAssemblyId: field === "rateAssemblyId" ? input.value : mapping?.rateAssemblyId || "", quantityField: field === "quantityField" ? input.value : mapping?.quantityField || "count", userId: C.activeUser(state)?.id || state.session?.userId || "" }
      if (!values.boqItemId) {
        if (mapping) commit("إلغاء ربط عنصر IFC", () => { project.ifcMappings = project.ifcMappings.filter((entry) => entry.id !== mapping.id); element.mappingStatus = "unmapped"; element.boqItemId = ""; element.rateAssemblyId = "" })
        return
      }
      let result
      const ok = commit("ربط عنصر IFC ببند BOQ", () => { result = Model.linkIfcElementToBoq?.(project, values) })
      if (!ok || !result?.ok) toast("تعذر ربط عنصر IFC", result?.reason || "راجع البند.", "warning")
      return
    }
    if (input.id === "revision-overlay-select") {
      measurementCanvas.revisionOverlayId = input.value || null
      drawMeasurementOverlay()
      return
    }
    if (input.id === "boq-file-input" && input.files[0]) return loadBoqFile(input.files[0])
    if (input.id === "import-sheet") return switchImportSheet(input.value)
    if (input.dataset.importMap) { importDraft.mapping[input.dataset.importMap] = input.value; return }
    if (input.id === "assembly-select") {
      const itemId = $("#assembly-form input[name=\"itemId\"]")?.value || activeItemId
      return rateAssemblyModal(itemId, input.value)
    }
    if (input.dataset.reportLanguage) {
      reportLanguage = input.value === "en" ? "en" : "ar"
      state.settings.language = reportLanguage
      render()
      scheduleSave()
      return
    }
    if (input.id === "quote-target-type") {
      $$("#quote-target-id option").forEach((option) => { option.hidden = option.dataset.type !== input.value })
      const first = $(`#quote-target-id option[data-type="${input.value}"]`)
      if (first) $("#quote-target-id").value = first.value
      return
    }
    if (input.dataset.filter) { filters[input.dataset.filter] = input.value; render(); return }
    if (input.dataset.documentId) {
      const document = project.documents.find((entry) => entry.id === input.dataset.documentId)
      const field = input.dataset.field
      if (!document || document[field] === input.value) return
      commit(`تحديث Document Register: ${document.title}`, () => { document[field] = input.value; C.recalculateDocumentRevisions(project); project.tenderReview.completedAt = "" }, { audit: false })
      return
    }
    if (input.dataset.summaryId) {
      const field = project.tenderSummary.find((entry) => entry.id === input.dataset.summaryId)
      const value = input.dataset.field === "verified" ? input.checked : input.value
      if (!field || field[input.dataset.field] === value) return
      commit(`تحديث Tender Summary: ${field.label}`, () => { field[input.dataset.field] = value; project.tenderReview.completedAt = "" }, { audit: false })
      return
    }
    if (input.dataset.tenderReviewField) {
      commit("تحديث ملاحظات Tender Review", () => { project.tenderReview[input.dataset.tenderReviewField] = input.value }, { audit: false })
      return
    }
    if (input.dataset.scopeId) {
      const row = project.scopeMatrix.find((entry) => entry.id === input.dataset.scopeId)
      if (!row || row[input.dataset.field] === input.value) return
      commit(`تحديث Scope Matrix: ${row.system}`, () => { row[input.dataset.field] = input.value; project.tenderReview.completedAt = "" }, { audit: false })
      return
    }
    if (input.dataset.riskId) {
      const risk = project.risks.find((entry) => entry.id === input.dataset.riskId)
      if (!risk || risk[input.dataset.field] === input.value) return
      commit(`تحديث حالة ${risk.title}`, () => { risk[input.dataset.field] = input.value })
      return
    }
    if (input.dataset.boqWorkflow) {
      const item = project.boq.find((entry) => entry.id === input.dataset.boqWorkflow)
      if (!item) return
      commit(`تحديث حالة البند ${item.itemNo}`, () => { item.workflowStatus = input.value; item.workflowUpdatedAt = new Date().toISOString(); item.workflowUpdatedBy = C.activeUser(state)?.name || state.user.name })
      return
    }
    if (input.dataset.decisionField) {
      const field = input.dataset.decisionField
      const numericFields = ["targetPrice", "currencyFactor", "currencyRate"]
      commit(`تعديل What-If ${field}`, () => { project.decisionDraft ||= {}; project.decisionDraft[field] = numericFields.includes(field) || field.endsWith("Percent") ? C.number(input.value) : input.value }, { audit: false })
      return
    }
    if (input.dataset.boqId) {
      const item = project.boq.find((entry) => entry.id === input.dataset.boqId)
      const field = input.dataset.field
      const value = ["quantity", "takeoffQuantity", "manualRate"].includes(field) ? C.number(input.value) : input.value
      if (item[field] === value) return
      commit(`تعديل بند ${item.itemNo}`, () => { item[field] = value; item.sources ||= {}; const sourceKey = ["quantity", "takeoffQuantity"].includes(field) ? "quantity" : field === "manualRate" ? "price" : field; item.sources[sourceKey] = { type: "manual", cell: field, date: new Date().toISOString(), user: C.activeUser(state)?.name || state.user.name } }, { audit: false })
      return
    }
    if (input.dataset.resourceId) {
      const resource = state.resources.find((entry) => entry.id === input.dataset.resourceId)
      const field = input.dataset.field
      const value = field === "rate" ? C.number(input.value) : input.value.trim()
      if (resource[field] === value) return
      const impact = field === "rate" ? C.resourceImpact(state, resource.id, project.id).length : 0
      commit(`تعديل المورد ${resource.code}`, () => {
        if (field === "rate") {
          resource.history ||= []
          resource.history.push({ rate: C.number(resource.rate), date: resource.updatedAt || new Date().toISOString(), source: resource.sourceProject || "السعر السابق" })
          resource.updatedAt = new Date().toISOString()
          resource.sourceProject = "تعديل يدوي"
        }
        resource[field] = value
      }, { audit: field === "rate" })
      if (field === "rate") toast("تم تحديث مكتبة الأسعار", `${impact} بنود مرتبطة ستعرض New Rate Available؛ سعر المشروع لن يتغير بدون اعتماد.`)
      return
    }
    if (input.dataset.analysisLine) {
      const line = project.analyses[activeItemId].lines.find((entry) => entry.id === input.dataset.analysisLine)
      commit("تعديل معامل مورد في التحليل", () => { line.factor = C.number(input.value) }, { audit: false })
      return
    }
    if (input.dataset.analysisExtra) {
      commit("تعديل إضافات تحليل سعر الوحدة", () => {
        project.analyses[activeItemId] ||= { lines: [], extras: C.defaultExtras() }
        project.analyses[activeItemId].extras ||= C.defaultExtras()
        project.analyses[activeItemId].extras[input.dataset.analysisExtra] = C.number(input.value)
      }, { audit: false })
      return
    }
    if (input.dataset.scenarioField) {
      const scenario = currentScenario()
      if (scenario.locked) return toast("السيناريو مقفول", "أعد فتح السيناريو قبل تعديل معادلاته.", "warning")
      const field = input.dataset.scenarioField
      const value = ["profitBasis", "roundingMode"].includes(field) ? input.value : C.number(input.value)
      commit(`تعديل سيناريو ${scenario.name}`, () => { scenario[field] = value }, { audit: false })
      return
    }
    if (input.dataset.rfqId) {
      const rfq = project.rfqs.find((entry) => entry.id === input.dataset.rfqId)
      commit(`تحديث حالة RFQ إلى ${statusLabels[input.value]}`, () => { rfq.status = input.value })
      return
    }
    if (input.dataset.projectList) {
      commit(`تعديل ${input.dataset.projectList}`, () => { project[input.dataset.projectList] = input.value.split(/\n/).map((entry) => entry.trim()).filter(Boolean) }, { audit: false })
    }
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries())
  }

  async function handleSubmit(event) {
    const form = event.target
    if (form?.id === "login-form") {
      event.preventDefault()
      if (typeof form.reportValidity === "function" && !form.reportValidity()) return
      await authenticateUser(formObject(form))
      return
    }
    if (form?.id === "setup-form") {
      event.preventDefault()
      const values = formObject(form)
      if (String(values.password || "").length < 8) return toast("كلمة المرور قصيرة", "استخدم 8 أحرف على الأقل.", "warning")
      const userId = C.id("user")
      const now = new Date().toISOString()
      state.users ||= []; state.auth ||= {}; state.auth.accounts ||= []
      state.users.unshift({ id: userId, name: String(values.name || "").trim(), initials: String(values.name || "").trim().split(/\s+/).map((v) => v[0]).join("").slice(0, 3).toUpperCase(), email: "", role: "system_admin", active: true, createdAt: now })
      state.auth.accounts.unshift({ id: C.id("account"), userId, username: String(values.username || "").trim(), passwordHash: await window.QESTIMAAuth.hash(values.password), active: true, createdAt: now })
      state.workspaces.forEach((workspace) => { if (workspace.id === state.session.workspaceId) { workspace.ownerUserId = userId; workspace.members = [{ userId, role: "system_admin" }] } })
      state.users[0].tenantIds = [state.session.tenantId]
      state.auth.securityMode = "commercial"; state.auth.firstRunCompletedAt = now
      state.session = { ...(state.session || {}), userId, authenticated: false }
      state.user = { name: state.users[0].name, initials: state.users[0].initials }
      if (!(await saveNow())) return
      renderLogin(); toast("تم إنشاء حساب المدير", "سجّل الدخول بالحساب الجديد.")
      return
    }
    if (!(form instanceof HTMLFormElement)) return
    event.preventDefault()
    if (!form.reportValidity()) return
    const values = formObject(form)
    if (form.id === "license-form") {
      if (window.qestimaDesktop?.commercialBuild) {
        const checked = await window.qestimaDesktop.verifyLicenseToken(values.activationCode)
        if (!checked?.ok) return toast("تعذر التفعيل", checked?.reason || "الترخيص منتهٍ أو غير موقّع بالمفتاح المعتمد.", "error")
        const claims = checked.claims
        state.license = { ...state.license, status: "active", activationMode: "signed", licenseToken: values.activationCode, startsAt: new Date(claims.nbf * 1000).toISOString(), expiresAt: new Date(claims.exp * 1000).toISOString(), featureFlags: claims.featureFlags || {}, maxDevices: claims.maxDevices, maxUsers: claims.maxUsers }
        await saveNow(); closeModal(); renderLicenseIndicator(); renderLogin(); return
      }
      const result = C.activateLocalLicense(state, values)
      if (!result.ok) return toast("تعذر تفعيل الترخيص", "استخدم كودًا صحيحًا مثل QESTIMA-DEMO-30.", "error")
      commit("تفعيل أو تجديد الترخيص", () => { state.license = result.license }, { allowExpired: true, allowWithoutProject: true })
      closeModal()
      renderLicenseIndicator()
      renderLogin()
      toast("تم تفعيل الترخيص", `متاح ${C.licenseStatus(state).daysLeft} يومًا`)
      return
    }
    if (form.id === "central-login-form") {
      const result = await centralRequest({ baseUrl: values.baseUrl, path: "/api/v1/auth/login", method: "POST", body: { tenantId: values.tenantId, username: values.username, password: values.password, appVersion: state.appVersion, deviceId: state.session?.deviceId || "" } })
      if (!result?.ok) return toast("فشل الاتصال بالمركز", result?.data?.reason || result?.error || "تحقق من العنوان والبيانات.", "error")
      const deviceResult = await centralRequest({ baseUrl: values.baseUrl, path: "/api/v1/devices/register", method: "POST", token: result.data.token, body: { id: state.central?.device?.id || undefined, name: "QESTIMA Windows device", platform: window.qestimaDesktop?.platform || navigator.platform || "windows", appVersion: state.appVersion || "" } })
      commit("تسجيل الدخول إلى Central API", () => {
        const centralLicense = result.data.license || {}
        state.central = { ...(state.central || {}), apiBaseUrl: values.baseUrl.replace(/\/+$/, ""), tenantId: values.tenantId, accessToken: result.data.token, licenseToken: result.data.licenseToken || "", licensePublicKeyId: result.data.licensePublicKeyId || "", serverUser: result.data.user, connectionState: "central", lastSyncAt: new Date().toISOString(), device: deviceResult?.data?.device || state.central?.device || null }
        state.license = { ...(state.license || {}), ...centralLicense, activationMode: "central", organization: result.data.tenant?.name || state.license?.organization || "Company Workspace", licenseToken: result.data.licenseToken || "" }
        state.session.tenantId = values.tenantId
        state.session.deviceId = deviceResult?.data?.device?.id || state.session.deviceId || ""
        state.session.connectionState = "central"
        // A central session must operate inside the matching company
        // workspace. Never allow a personal project to be pushed under a
        // different tenant merely because the user logged in centrally.
        const companyWorkspace = (state.workspaces || []).find((workspace) => workspace.tenantId === values.tenantId || (workspace.type === "company" && !workspace.tenantId))
        if (companyWorkspace) {
          companyWorkspace.tenantId ||= values.tenantId
          state.session.workspaceId = companyWorkspace.id
          const firstCompanyProject = (state.projects || []).find((entry) => entry.tenantId === values.tenantId || entry.workspaceId === companyWorkspace.id)
          if (firstCompanyProject) {
            state.activeProjectId = firstCompanyProject.id
            activeItemId = firstCompanyProject.boq?.[0]?.id || null
          }
        }
      }, { audit: false, allowExpired: true })
      closeModal(); startCentralSyncTimer(); toast("تم الاتصال بمساحة الشركة", `${result.data.tenant?.name || values.tenantId} · ${result.data.user?.role || "user"}${deviceResult?.ok ? " · الجهاز مسجّل" : ""}`)
      return
    }
    if (form.id === "company-profile-form") {
      if (!C.can(state, "project.edit", currentProject())) return toast("الصلاحية غير متاحة", "لا يمكن تعديل بيانات الشركة بهذا الحساب.", "warning")
      commit("تحديث Company Branding", () => {
        state.companyProfile = { ...(state.companyProfile || {}), name: String(values.name || "QESTIMA").trim() || "QESTIMA", tagline: String(values.tagline || "MEP Estimating System").trim(), address: String(values.address || "").trim(), taxNumber: String(values.taxNumber || "").trim(), phone: String(values.phone || "").trim(), email: String(values.email || "").trim(), logoDataUrl: String(values.logoDataUrl || "").trim() }
      })
      closeModal(); toast("تم حفظ بيانات الشركة", "ستظهر في Report Center وملفات التصدير.")
      return
    }
    const project = currentProject()

    if (form.id === "pdf-question-form") {
      const result = C.askProjectDocuments(project, values.query, { limit: 12 })
      const results = $("#pdf-question-results")
      if (results) results.innerHTML = `<div class="document-answer-head"><strong>${esc(result.answer)}</strong><span class="badge teal">Project-only · ${result.matches.length} matches</span></div>${result.matches.map((match) => `<article class="document-answer-row"><div><strong>${esc(match.title)}</strong><small>Page ${esc(match.page || "—")} · confidence ${Math.round(C.number(match.confidence) * 100)}%</small></div><p>${esc(match.excerpt)}</p></article>`).join("") || `<div class="empty-state compact-empty"><p>لم يتم العثور على النص داخل المستندات المفهرسة لهذا المشروع.</p></div>`}`
      return
    }

    if (form.id === "pdf-compare-form") {
      const result = C.compareDocumentRevisions(project, values.beforeId, values.afterId)
      const output = $("#pdf-compare-results")
      if (output) output.innerHTML = result.ok ? `<div class="document-answer-head"><strong>${result.counts.changedInsights} insight changes · ${result.counts.changedPages} changed pages</strong><span class="badge amber">Review before applying</span></div>${result.changes.map((change) => `<article class="document-answer-row"><div><strong>${esc(change.label)}</strong><small>Page ${esc(change.beforePage || "—")} → ${esc(change.afterPage || "—")}</small></div><p><span class="before-value">${esc(change.before || "—")}</span> → <span class="after-value">${esc(change.after || "—")}</span></p></article>`).join("") || `<div class="empty-state compact-empty"><p>لم تتغير الحقول المستخرجة بين النسختين.</p></div>`}` : `<div class="alert-strip danger"><strong>تعذر المقارنة</strong><small>${esc(result.reason || "حلّل النسختين أولًا.")}</small></div>`
      return
    }

    if (form.id === "comment-form") {
      const text = values.text.trim()
      if (!text) return
      commit("إضافة تعليق على المشروع", () => { project.comments ||= []; project.comments.unshift({ id: C.id("comment"), text, itemId: values.itemId || "", mention: values.mention.trim(), dueDate: values.dueDate || "", author: C.activeUser(state)?.name || state.user.name, createdAt: new Date().toISOString() }) })
      closeModal(); toast("تم حفظ التعليق", values.mention ? `تمت الإشارة إلى ${values.mention}` : "")
      return
    }

    if (form.id === "feedback-form") {
      const payload = { appVersion: state.appVersion || "0.12.0", schemaVersion: state.schemaVersion, view: values.view || activeView, description: values.description.trim(), steps: values.steps.trim(), userAgent: navigator.userAgent, platform: navigator.platform, timestamp: new Date().toISOString() }
      browserDownload(`QESTIMA-Diagnostic-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2))
      closeModal(); toast("تم تنزيل ملف التشخيص", "أرسله للمطور مع وصف المشكلة.")
      return
    }

    if (form.id === "measurement-form") {
      const quantity = Math.max(0, C.number(values.quantity))
      const item = project.boq.find((entry) => entry.id === values.itemId)
      const drawing = project.documents.find((entry) => entry.id === values.drawingDocumentId)
      const group = (project.measurementGroups || []).find((entry) => entry.id === values.groupId)
      const measurement = C.createMeasurement({ kind: values.kind || "length", name: values.name.trim(), quantity, unit: values.unit.trim() || "m", scale: values.scale, layer: values.layer, color: group?.color, groupId: values.groupId || "", drawingDocumentId: values.drawingDocumentId || "", drawingPage: values.drawingPage, drawingRevision: drawing?.revision || "", itemId: values.itemId || "", system: values.system, floor: values.floor, openings: String(values.openings || "").split(",").map((v) => C.number(v)).filter(Boolean), notes: values.notes.trim(), measuredBy: C.activeUser(state)?.name || state.user.name })
      commit(`إضافة قياس ${measurement.name}`, () => {
        project.measurements ||= []
        project.measurements.unshift(measurement)
      })
      closeModal(); toast("تم حفظ القياس كمقترح", item ? `مرتبط مبدئيًا بالبند ${item.itemNo} — اضغط Approve في Quantity Review لتحديث كمية التسعير.` : "يمكن ربطه ببند BOQ لاحقًا.")
      return
    }

    if (form.id === "measurement-group-form") {
      const group = C.createMeasurementGroup({ name: values.name, system: values.system, color: values.color, notes: values.notes, createdBy: C.activeUser(state)?.name || state.user.name })
      commit(`إنشاء Dimension Group ${group.name}`, () => { project.measurementGroups ||= []; project.measurementGroups.unshift(group) })
      closeModal(); toast("تم إنشاء Dimension Group", `${group.name} · ${group.color}`)
      return
    }

    if (form.id === "assembly-form") {
      const itemId = values.itemId || activeItemId
      const assembly = (state.rateAssemblies || C.defaultRateAssemblies()).find((entry) => entry.id === values.assemblyId)
      if (!assembly) return toast("القالب غير موجود", "اختر قالب Rate Assembly صالحًا.", "warning")
      commit(`إضافة Rate Assembly للبند ${project.boq.find((item) => item.id === itemId)?.itemNo || ""}`, () => {
        project.analyses[itemId] ||= { lines: [], extras: C.defaultExtras() }
        assembly.components.forEach((component, index) => {
          const resourceId = values[`resource-${index}`]
          const factor = Math.max(0, C.number(values[`factor-${index}`]))
          if (!resourceId || factor <= 0) return
          const resource = state.resources.find((entry) => entry.id === resourceId)
          const existing = project.analyses[itemId].lines.find((line) => line.resourceId === resourceId)
          if (existing) existing.factor = C.number(existing.factor) + factor
          else project.analyses[itemId].lines.push({ id: C.id("line"), resourceId, factor, rateSnapshot: C.resourceSnapshot(resource, { source: `Assembly · ${assembly.name}`, approvedBy: C.activeUser(state)?.name || state.user.name }) })
        })
        project.analyses[itemId].assemblyId = assembly.id
        project.analyses[itemId].assemblyName = assembly.name
      })
      closeModal(); toast("تمت إضافة Dynamic Rate Assembly", assembly.name)
      return
    }

    if (form.id === "project-form") {
      const projectFormData = new FormData(form)
      const disciplines = projectFormData.getAll("disciplines")
      const existing = state.projects.find((entry) => entry.id === form.dataset.id)
      if (existing) {
        commit(`تحديث بيانات مشروع ${existing.name}`, () => {
          Object.assign(existing, {
            name: values.name.trim(), client: values.client.trim(), consultant: values.consultant.trim(),
            mainContractor: values.mainContractor.trim(), location: values.location.trim(), tenderNumber: values.tenderNumber.trim(),
            deadline: values.deadline, pricingBaseDate: values.pricingBaseDate, projectType: values.projectType, disciplines,
            workflowMode: values.workflowMode, currency: values.currency, tax: C.number(values.tax), status: values.status,
          })
        })
      } else {
        const now = new Date().toISOString()
        const projectId = C.id("project")
        const scenarioIds = [C.id("scenario"), C.id("scenario"), C.id("scenario"), C.id("scenario")]
        let newProject = {
          id: projectId, workspaceId: state.session.workspaceId, tenantId: state.session.tenantId, tenderCode: C.nextTenderCode(state), name: values.name.trim(), client: values.client.trim(), consultant: values.consultant.trim(),
          mainContractor: values.mainContractor.trim(), location: values.location.trim(), tenderNumber: values.tenderNumber.trim(),
          deadline: values.deadline, pricingBaseDate: values.pricingBaseDate, projectType: values.projectType, disciplines,
          workflowMode: values.workflowMode, currency: values.currency, tax: C.number(values.tax), status: values.status,
          revisionNo: 0, createdAt: now, updatedAt: now, boq: [], analyses: {}, rfqs: [], quotes: [], revisions: [],
          clarifications: [], exclusions: [], measurements: [], documents: [], tenderSummary: [], tenderReview: { completedAt: "", completedBy: "", notes: "" }, scopeMatrix: C.defaultScopeMatrix(disciplines), risks: [],
          scenarios: [
            { id: scenarioIds[0], name: "Conservative", indirectPercent: 9, contingencyPercent: 5, escalationPercent: 0, profitPercent: 14, discountPercent: 0, vatPercent: C.number(values.tax) },
            { id: scenarioIds[1], name: "Competitive", indirectPercent: 6, contingencyPercent: 3, escalationPercent: 0, profitPercent: 9, discountPercent: 0, vatPercent: C.number(values.tax) },
            { id: scenarioIds[2], name: "Target Profit", indirectPercent: 7, contingencyPercent: 3, escalationPercent: 0, profitPercent: 12, discountPercent: 0, vatPercent: C.number(values.tax) },
            { id: scenarioIds[3], name: "Management Final", indirectPercent: 7, contingencyPercent: 3, escalationPercent: 0, profitPercent: 10, discountPercent: 0, vatPercent: C.number(values.tax) },
          ],
          audit: [{ id: C.id("audit"), date: now, user: state.user.name, action: "إنشاء المشروع" }],
        }
        if (values.creationMode === "copy" && values.sourceProjectId) {
          const source = state.projects.find((entry) => entry.id === values.sourceProjectId)
          if (source) {
            const copied = C.deepClone(source)
            Object.assign(copied, { id: projectId, workspaceId: state.session.workspaceId, tenderCode: C.nextTenderCode(state), name: values.name.trim() || `${source.name} — نسخة`, client: values.client.trim() || source.client, consultant: values.consultant.trim() || source.consultant, mainContractor: values.mainContractor.trim() || source.mainContractor, location: values.location.trim() || source.location, tenderNumber: values.tenderNumber.trim(), deadline: values.deadline, pricingBaseDate: values.pricingBaseDate, projectType: values.projectType, disciplines, workflowMode: values.workflowMode, currency: values.currency, tax: C.number(values.tax), status: "draft", revisionNo: 0, createdAt: now, updatedAt: now, revisions: [], tenderReview: { completedAt: "", completedBy: "", notes: "" }, submittedLockedAt: "", submittedLockedBy: "", audit: [{ id: C.id("audit"), date: now, user: state.user.name, action: `نسخ من مشروع ${source.name}` }] })
            copied.tenantId = state.session.tenantId
            copied.scenarios = copied.scenarios.map((scenario) => ({ ...scenario, id: C.id("scenario"), locked: false, approvedBy: "", approvedAt: "" }))
            copied.submissionSnapshots = []
            copied.syncBaseSnapshot = null; copied.serverVersion = 0
            newProject = copied
          }
        }
        newProject.tenderSummary = C.defaultTenderSummary(newProject)
        C.ensureProjectV5(newProject, state, state.projects.length)
        commit(`إنشاء مشروع ${newProject.name}`, () => {
          state.projects.push(newProject)
          state.activeProjectId = projectId
          state.activeScenarioId = newProject.scenarios[1]?.id || newProject.scenarios[0]?.id
        }, { audit: false })
        activeItemId = null
        activeView = values.creationMode === "package" || newProject.workflowMode !== "quick" ? "documents" : "boq"
        if (!openTabs.includes(activeView)) openTabs.push(activeView)
      }
      closeModal(); render(); toast(existing ? "تم تحديث المشروع" : "تم إنشاء المشروع", !existing && values.creationMode === "package" ? "ارفع الآن Tender Package من شاشة المستندات." : "")
      return
    }

    if (form.id === "boq-form") {
      if (project.boq.some((item) => item.itemNo.trim().toLowerCase() === values.itemNo.trim().toLowerCase())) return toast("رقم البند موجود بالفعل", "استخدم رقمًا مختلفًا أو عدّل البند الحالي.", "warning")
      const item = { id: C.id("boq"), itemNo: values.itemNo.trim(), description: values.description.trim(), unit: values.unit.trim(), quantity: C.number(values.quantity), section: values.section.trim() || "غير مصنف", system: values.system.trim() || "MEP", floor: values.floor.trim() || "عام", pricingMethod: "analysis", manualRate: 0, selectedQuoteId: null, notes: "", sources: { quantity: { type: "manual", date: new Date().toISOString(), user: C.activeUser(state)?.name || state.user.name }, price: null }, drawingDocumentId: "", drawingRevision: "", specificationDocumentId: "", specificationSection: "", building: "", floorZone: values.floor.trim() || "عام", takeoffQuantity: 0, quantityBasis: "boq", quantityDecision: "boq", linkedRfqId: "", linkedRiskId: "" }
      commit(`إضافة بند ${item.itemNo}`, () => { project.boq.push(item) })
      activeItemId = item.id
      closeModal(); toast("تمت إضافة بند BOQ")
      return
    }

    if (form.id === "boq-link-form") {
      const item = project.boq.find((entry) => entry.id === form.dataset.id)
      if (!item) return
      const takeoffQuantity = C.number(values.takeoffQuantity)
      const variance = takeoffQuantity ? takeoffQuantity - C.number(item.quantity) : 0
      commit(`ربط مصادر وكمية البند ${item.itemNo}`, () => {
        Object.assign(item, { drawingDocumentId: values.drawingDocumentId, specificationDocumentId: values.specificationDocumentId, specificationSection: values.specificationSection.trim(), building: values.building.trim(), floorZone: values.floorZone.trim(), linkedRfqId: values.linkedRfqId, takeoffQuantity, quantityBasis: values.quantityBasis, quantityDecision: values.quantityBasis })
        const drawing = project.documents.find((document) => document.id === item.drawingDocumentId)
        item.drawingRevision = drawing?.revision || ""
        if (variance && values.varianceAction !== "none") {
          const riskType = values.varianceAction === "clarification" ? "clarification" : "assumption"
          const risk = { sourceKey: `qty-decision-${item.id}-${riskType}`, type: riskType, title: `${item.itemNo} — Quantity variance ${variance > 0 ? "+" : ""}${C.round(variance, 3)} ${item.unit}`, description: `BOQ Quantity: ${item.quantity}; Takeoff Quantity: ${takeoffQuantity}; Pricing basis: ${values.quantityBasis}.`, severity: "high", sourceDocumentId: item.drawingDocumentId || "", sourcePage: "" }
          addGeneratedRisk(project, risk)
        }
      })
      closeModal(); toast("تم ربط البند بالمستندات", variance ? `فرق الكمية ${variance > 0 ? "+" : ""}${C.round(variance, 3)} ${item.unit}` : "لا يوجد فرق كمية")
      return
    }

    if (form.id === "scope-form") {
      commit(`إضافة ${values.system} إلى Scope Matrix`, () => { project.scopeMatrix.push({ id: C.id("scope"), system: values.system.trim(), inScope: values.inScope, boqStatus: "unknown", drawingsStatus: "unknown", specsStatus: "unknown", notes: values.notes.trim() }); project.tenderReview.completedAt = "" })
      closeModal(); toast("تمت إضافة النظام")
      return
    }

    if (form.id === "risk-form") {
      const risk = { id: C.id("risk"), type: values.type, title: values.title.trim(), description: values.description.trim(), severity: values.severity, status: values.status, sourceDocumentId: values.sourceDocumentId, sourcePage: values.sourcePage.trim(), owner: values.owner.trim(), dueDate: values.dueDate, createdAt: new Date().toISOString(), sourceKey: "" }
      commit(`إضافة ${riskTypeLabels[risk.type]}`, () => { project.risks.unshift(risk) })
      closeModal(); toast("تمت إضافة العنصر إلى سجل المتابعة")
      return
    }

    if (form.id === "resource-form") {
      if (state.resources.some((resource) => resource.code.trim().toLowerCase() === values.code.trim().toLowerCase())) return toast("كود المورد موجود بالفعل", "استخدم كودًا فريدًا للمحافظة على الترابط.", "warning")
      const now = new Date().toISOString()
      const resource = { id: C.id("res"), code: values.code.trim(), name: values.name.trim(), type: values.type, category: values.category.trim() || "MEP", unit: values.unit.trim(), rate: C.number(values.rate), supplierId: values.supplierId || null, region: values.region.trim(), sourceProject: values.sourceProject.trim() || project.name, updatedAt: now, history: [{ rate: C.number(values.rate), date: now, source: values.sourceProject.trim() || project.name }] }
      commit(`إضافة مورد ${resource.code}`, () => { state.resources.push(resource) })
      closeModal(); toast("تمت إضافة المورد للمكتبة")
      return
    }

    if (form.id === "analysis-line-form") {
      const factor = Math.max(C.number(values.factor), 0)
      commit("إضافة مورد لتحليل سعر الوحدة", () => {
        project.analyses[activeItemId] ||= { lines: [], extras: C.defaultExtras() }
        const existing = project.analyses[activeItemId].lines.find((line) => line.resourceId === values.resourceId)
        if (existing) existing.factor = C.number(existing.factor) + factor
        else {
          const resource = state.resources.find((entry) => entry.id === values.resourceId)
          project.analyses[activeItemId].lines.push({ id: C.id("line"), resourceId: values.resourceId, factor, rateSnapshot: C.resourceSnapshot(resource, { source: resource?.sourceProject || "Resource Library", approvedBy: C.activeUser(state)?.name || state.user.name }) })
        }
      })
      closeModal(); toast("تم تحديث تحليل سعر الوحدة")
      return
    }

    if (form.id === "copy-analysis-form") {
      const sourceItem = project.boq.find((item) => item.id === values.sourceItemId)
      const sourceAnalysis = project.analyses[values.sourceItemId]
      if (!sourceItem || !sourceAnalysis) return
      const replaceExisting = new FormData(form).has("replaceExisting")
      const current = project.analyses[activeItemId] || { lines: [], extras: C.defaultExtras() }
      if (current.lines.length && !replaceExisting) return toast("التحليل الحالي غير فارغ", "فعّل Replace current analysis أو استخدم Add Resource.", "warning")
      commit(`نسخ تحليل السعر من ${sourceItem.itemNo}`, () => {
        project.analyses[activeItemId] = C.cloneAnalysis(sourceAnalysis, { sourceItemId: sourceItem.id, copiedBy: C.activeUser(state)?.name || state.user.name })
      })
      closeModal(); toast("تم نسخ تحليل سعر الوحدة", `${sourceItem.itemNo} → ${project.boq.find((item) => item.id === activeItemId)?.itemNo}`)
      return
    }

    if (form.id === "supplier-form") {
      const supplier = { id: C.id("supplier"), name: values.name.trim(), contact: values.contact.trim(), email: values.email.trim(), phone: values.phone.trim(), region: values.region.trim() }
      commit(`إضافة مورد ${supplier.name}`, () => { state.suppliers.push(supplier) })
      closeModal(); toast("تمت إضافة المورد / المقاول")
      return
    }

    if (form.id === "rfq-form") {
      const formData = new FormData(form)
      const supplierIds = formData.getAll("supplierIds")
      const selectedTargets = formData.getAll("targetIds")
      const rfq = { id: C.id("rfq"), title: values.title.trim(), supplierIds, targetIds: selectedTargets.length ? selectedTargets : project.boq.map((item) => item.id), status: values.sentAt ? "waiting" : "draft", sentAt: values.sentAt, dueAt: values.dueAt, notes: values.notes.trim(), attachment: null }
      commit(`إنشاء RFQ: ${rfq.title}`, () => { project.rfqs.unshift(rfq) })
      closeModal(); toast("تم حفظ طلب الأسعار", `${supplierIds.length} مورد · ${rfq.targetIds.length} بند`)
      return
    }

    if (form.id === "quote-form") {
      const quote = { id: C.id("quote"), supplierId: values.supplierId, reference: values.reference.trim(), date: values.date, currency: values.currency, vat: C.number(values.vat), validityDays: C.number(values.validityDays), discountPercent: C.number(values.discountPercent), freightUnit: C.number(values.freightUnit), riskPercent: C.number(values.riskPercent), vatIncluded: false, delivery: values.delivery.trim(), payment: values.payment.trim(), warranty: values.warranty.trim(), attachment: null, items: [] }
      commit(`تسجيل عرض ${quote.reference || "مورد"}`, () => { project.quotes.unshift(quote) })
      const attachNow = new FormData(form).has("attachNow")
      closeModal(); toast("تم تسجيل العرض", "أضف أسعار البنود للمقارنة.")
      if (attachNow) {
        let attachment = null
        if (window.qestimaDesktop?.pickAttachment) attachment = await window.qestimaDesktop.pickAttachment()
        else {
          const [file] = await browserPickFiles("file", ".pdf,.xlsx,.xls,.docx,.doc,.zip,.jpg,.jpeg,.png,.txt")
          if (file) attachment = await storeBrowserAttachment(file)
        }
        if (attachment) commit("إرفاق عرض السعر الأصلي", () => { quote.attachment = attachment })
      }
      return
    }

    if (form.id === "quote-line-form") {
      const quote = project.quotes.find((entry) => entry.id === values.quoteId)
      if (!quote) return
      const line = { targetType: values.targetType, targetId: values.targetId, brand: values.brand.trim(), model: values.model.trim(), unit: values.unit.trim(), unitPrice: C.number(values.unitPrice), discountPercent: C.number(values.discountPercent), freightUnit: C.number(values.freightUnit), riskPercent: C.number(values.riskPercent), compliant: values.compliant === "true", deviation: values.deviation.trim(), notes: values.notes.trim() }
      commit("إضافة سعر إلى مقارنة العروض", () => {
        const index = quote.items.findIndex((entry) => entry.targetType === line.targetType && entry.targetId === line.targetId)
        if (index >= 0) quote.items[index] = line
        else quote.items.push(line)
      })
      closeModal(); toast("تم تحديث مقارنة العروض")
      return
    }

    if (form.id === "scenario-form") {
      const scenario = { id: C.id("scenario"), name: values.name.trim(), indirectPercent: C.number(values.indirectPercent), contingencyPercent: C.number(values.contingencyPercent), escalationPercent: C.number(values.escalationPercent), profitPercent: C.number(values.profitPercent), profitBasis: "cost", discountPercent: C.number(values.discountPercent), vatPercent: C.number(values.vatPercent), managementAdjustment: 0, roundingStep: 0, roundingMode: "nearest", locked: false, approvedBy: "", approvedAt: "" }
      commit(`إضافة سيناريو ${scenario.name}`, () => { project.scenarios.push(scenario); state.activeScenarioId = scenario.id })
      closeModal(); toast("تمت إضافة سيناريو التسعير")
    }
  }

  async function init() {
    let raw = null
    let migratedLegacy = false
    let storageError = null
    try {
      raw = window.qestimaDesktop ? await window.qestimaDesktop.loadData() : null
      for (const key of ["qestima-v6", "qestima-v5", "qestima-v4", "qestima-v3", "qestima-v2", "costlap-v2", "mep-costlab-v1"]) {
        if (raw) break
        const stored = localStorage.getItem(key)
        if (!stored) continue
        raw = JSON.parse(stored)
        migratedLegacy = key !== "qestima-v6" || raw?.schemaVersion !== 6
      }
    } catch (error) {
      console.error("QESTIMA load error", error)
      storageError = error
    }
    if (storageError && window.qestimaDesktop) {
      const loading = $("#loading-screen")
      if (loading) {
        loading.classList.remove("hidden")
        const message = loading.querySelector("p")
        if (message) message.textContent = "تعذر فتح مخزن QESTIMA المشفّر. لم يتم إنشاء بيانات بديلة؛ استعد Project Package أو تواصل مع المسؤول."
      }
      return
    }
    state = raw ? C.ensureState(raw) : C.createInitialState()
    C.prepareOpenEdition(state)
    if (window.qestimaDesktop?.commercialBuild && state.license?.activationMode === "signed") {
      const checked = await window.qestimaDesktop.verifyLicenseToken(state.license.licenseToken)
      if (!checked?.ok) state.license.status = "expired"
    }
    if (Collab.ensureCollaborationState) state = Collab.ensureCollaborationState(state)
    C.prepareOpenEdition(state)
    reportLanguage = state.settings.language === "en" ? "en" : "ar"
    if (window.qestimaDesktop?.commercialBuild && !state.auth?.firstRunCompletedAt && (state.auth?.accounts || []).every((account) => account.username === "admin")) {
      state.auth.accounts = []
      state.auth.securityMode = "commercial"
    }
    restoreUiState()
    activeItemId = currentProject().boq.some((item) => item.id === activeItemId) ? activeItemId : currentProject().boq[0]?.id || null
    activeDrawingId = currentProject().documents.some((entry) => entry.id === activeDrawingId && entry.category === "drawings") ? activeDrawingId : drawingClosed ? null : currentProject().documents.find((entry) => entry.category === "drawings" && entry.latestRevision)?.id || null
    activeModelId = currentProject().ifcModels?.[0]?.id || null
    // Capture clicks before any browser-shell or child handler can swallow
    // them; direct listeners remain as a compatibility fallback.
    document.addEventListener("click", handleClick, true)
    document.addEventListener("paste", handleGridPaste)
    document.addEventListener("keydown", handleGridKeydown)
    document.addEventListener("change", handleChange)
    document.addEventListener("submit", handleSubmit)
    bindStaticNavigation()
    $("#undo-btn").addEventListener("click", undo)
    $("#redo-btn").addEventListener("click", redo)
    $("#theme-btn").addEventListener("click", () => commit("تغيير مظهر البرنامج", () => { state.settings.theme = state.settings.theme === "dark" ? "light" : "dark" }, { audit: false }))
    $("#backup-btn").addEventListener("click", backupModal)
    $("#global-search").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return
      filters.boqSearch = event.target.value.trim()
      openView("boq")
    })
    $("#modal-root").addEventListener("click", (event) => { if (event.target.classList.contains("modal-backdrop")) closeModal() })
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeModal()
      if (!(event.ctrlKey || event.metaKey || event.altKey)) return
      if (handleRibbonShortcut(event)) return
      if (event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo() }
      if (event.key.toLowerCase() === "y") { event.preventDefault(); redo() }
      if (event.key.toLowerCase() === "s") { event.preventDefault(); saveNow(); toast("تم حفظ البيانات") }
      const shortcuts = { "1": "boq", "2": "analysis", "3": "suppliers", "4": "quality", "5": "reports", "6": "drawings", "7": "control" }
      const shortcutView = shortcuts[event.key]
      if (shortcutView) { event.preventDefault(); openView(shortcutView) }
      if (event.key === "Enter" && event.shiftKey && activeView === "quality") { event.preventDefault(); document.querySelector('[data-action="freeze-submission"]')?.click() }
    })
    window.addEventListener("beforeunload", () => { persistUiState(); if (!window.qestimaDesktop) localStorage.setItem("qestima-v6", JSON.stringify(state)) })
    const loginSurface = $("#login-screen")
    if (state.settings.openEdition) {
      isAuthenticated = true
      activeView = "projects"
      activeRibbonTab = "home"
      openTabs = [activeView]
      loginSurface?.classList.add("hidden")
      $("#app-shell")?.classList.remove("hidden")
      render()
    } else if (loginSurface) {
      isAuthenticated = false
      state.session.authenticated = false
      loginSurface.classList.remove("hidden")
      $("#app-shell")?.classList.add("hidden")
      renderLogin()
    } else {
      // Keep test harnesses and older unpacked shells usable when they do not
      // yet contain the login surface.
      isAuthenticated = true
      state.session.authenticated = true
      render()
      $("#app-shell")?.classList.remove("hidden")
    }
    $("#loading-screen").classList.add("hidden")
    scheduleSave()
    if (!state.settings.openEdition) startCentralSyncTimer()
    if (migratedLegacy && isAuthenticated) setTimeout(() => toast("تم ترحيل بيانات النسخة القديمة", "المشاريع والأسعار السابقة أصبحت داخل QESTIMA.", "success"), 300)
  }

  init().catch((error) => {
    console.error(error)
    $("#loading-screen p").textContent = "تعذر تشغيل البرنامج. أعد فتح التطبيق."
  })
})()
