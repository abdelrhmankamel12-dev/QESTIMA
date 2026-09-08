(function (root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) module.exports = api
  if (root) root.QESTIMACore = api
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict"

  const RESOURCE_TYPES = ["material", "labor", "equipment", "subcontractor"]
  const DOCUMENT_CATEGORIES = ["instructions", "commercial", "scope", "boq", "drawings", "specifications", "schedules", "vendors", "addenda", "clarifications", "forms"]
  const DISCIPLINES = ["General", "HVAC", "Fire Fighting", "Plumbing", "Electrical", "Civil", "Architectural"]
  const ITEM_WORKFLOW = ["not_started", "in_progress", "priced", "under_review", "approved", "locked"]
  const UNIT_ALIASES = {
    m: "m", meter: "m", meters: "m", "م": "m", "م.ط": "m", lm: "m",
    m2: "m²", "m²": "m²", sqm: "m²", "م2": "m²", "م²": "m²",
    m3: "m³", "m³": "m³", cum: "m³", "م3": "m³", "م³": "m³",
    nr: "nr", no: "nr", pcs: "nr", piece: "nr", عدد: "nr",
    kg: "kg", kgs: "kg", كجم: "kg", ton: "t", طن: "t",
    hr: "hr", hour: "hr", ساعة: "hr", ls: "ls", "مقطوعية": "ls",
  }
  const QUALITY_WEIGHTS = { blocker: 8, high: 4, medium: 2, low: 1 }
  const ROLE_LABELS = {
    system_admin: "System Admin", estimation_manager: "Estimation Manager", lead_qs: "Lead QS",
    estimator: "Estimator / QS", procurement: "Procurement", technical_engineer: "Technical Engineer",
    commercial_reviewer: "Commercial Reviewer", viewer: "Viewer",
  }
  const ROLE_PERMISSIONS = {
    system_admin: ["*"],
    estimation_manager: ["project.view", "project.edit", "team.manage", "pricing.edit", "markup.view", "markup.edit", "approval.manage", "documents.edit", "takeoff.edit", "rfq.edit", "reports.view", "audit.view"],
    lead_qs: ["project.view", "team.assign", "pricing.edit", "documents.view", "takeoff.edit", "rfq.view", "reports.view", "audit.view"],
    estimator: ["project.view", "pricing.edit_assigned", "documents.view", "takeoff.view", "rfq.view", "reports.view_cost"],
    procurement: ["project.view", "documents.view", "rfq.edit", "resources.edit", "reports.view_cost"],
    technical_engineer: ["project.view", "documents.edit", "takeoff.edit", "pricing.view_assigned", "reports.view_cost"],
    commercial_reviewer: ["project.view", "documents.view", "risks.edit", "markup.view", "markup.edit", "reports.view", "audit.view"],
    viewer: ["project.view", "documents.view", "takeoff.view", "reports.view_cost"],
  }
  const PREVIEW_TRIAL_DAYS = 30
  const PREVIEW_ACTIVATION_PREFIX = "QESTIMA-"

  function id(prefix = "id") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function roleCan(role, permission) {
    const allowed = ROLE_PERMISSIONS[role] || []
    return allowed.includes("*") || allowed.includes(permission)
  }

  function activeUser(state) {
    return (state?.users || []).find((user) => user.id === state?.session?.userId) || (state?.users || [])[0] || null
  }

  function activeWorkspace(state) {
    return (state?.workspaces || []).find((workspace) => workspace.id === state?.session?.workspaceId) || (state?.workspaces || [])[0] || null
  }

  function can(state, permission, project = null) {
    const user = activeUser(state)
    if (!user) return false
    const workspace = activeWorkspace(state)
    const membership = workspace?.members?.find((member) => member.userId === user.id)
    const projectRole = project?.access?.roleOverrides?.[user.id]
    const role = projectRole || membership?.role || user.role || "viewer"
    const activeTenantId = state?.session?.tenantId || workspace?.tenantId || ""
    if (project?.tenantId && activeTenantId && project.tenantId !== activeTenantId) return false
    if (project?.access?.memberIds?.length && !project.access.memberIds.includes(user.id) && !roleCan(role, "*")) return false
    return roleCan(role, permission)
  }

  function canWrite(state, project = null) {
    return ["project.edit", "pricing.edit", "pricing.edit_assigned", "documents.edit", "takeoff.edit", "rfq.edit", "resources.edit", "markup.edit", "risks.edit", "team.assign", "approval.manage"].some((permission) => can(state, permission, project))
  }

  function number(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    const normalized = String(value ?? "")
      .replace(/[٬,]/g, "")
      .replace(/٫/g, ".")
      .trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  function round(value, digits = 4) {
    const scale = 10 ** digits
    return Math.round((number(value) + Number.EPSILON) * scale) / scale
  }

  function roundToStep(value, step = 0, mode = "nearest") {
    const numeric = number(value)
    const increment = Math.abs(number(step))
    if (!increment) return numeric
    const scaled = numeric / increment
    const rounded = mode === "up" ? Math.ceil(scaled) : mode === "down" ? Math.floor(scaled) : Math.round(scaled)
    return round(rounded * increment, 2)
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value))
  }

  function normalizeHeader(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[\s_./\\()\-–—]+/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
  }

  function normalizeUnit(value) {
    const raw = String(value ?? "").trim().toLowerCase().replace(/[\s._-]+/g, "")
    return UNIT_ALIASES[raw] || String(value ?? "").trim() || "nr"
  }

  // Document intelligence foundation. Parsing/OCR engines stay replaceable;
  // the project always keeps the original file and an auditable result.
  function inspectDocument(file = {}, options = {}) {
    const name = String(file.name || file.title || "document");
    const ext = (name.split(".").pop() || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    const category = classifyTenderDocument(name, "");
    const isPdf = ext === "pdf" || type === "application/pdf";
    const isDxf = ["dxf", "dwg"].includes(ext);
    const text = String(options.text || "");
    const textPdf = isPdf && text.trim().length > 40;
    return {
      fileName: name, extension: ext, category: category || (isPdf ? "drawings" : "forms"),
      format: isPdf ? "PDF" : isDxf ? ext.toUpperCase() : ext.toUpperCase() || "FILE",
      pdfKind: isPdf ? (textPdf ? "text" : "scanned_or_image") : "n/a",
      ocr: isPdf && !textPdf ? { status: "pending", languages: ["ar", "en"] } : { status: "not_required", languages: [] },
      extractedText: text.slice(0, 20000), headings: [], tables: [], summary: "",
      source: { page: Number(options.page) || null, revision: String(options.revision || "") },
      indexedAt: new Date().toISOString(), status: "review_required"
    }
  }

  // -----------------------------------------------------------------------
  // Priority 3 - source-linked PDF intelligence
  // -----------------------------------------------------------------------

  const DOCUMENT_INSIGHT_FIELDS = [
    { key: "submissionDeadline", label: "Submission deadline", patterns: [/submission\s+(?:deadline|date|time)/i, /bid\s+(?:closing|submission)/i, /tender\s+(?:closing|deadline)/i, /موعد\s*(?:التسليم|التقديم|الإغلاق)/i, /تاريخ\s*(?:إغلاق|التقديم)/i] },
    { key: "validity", label: "Offer validity", patterns: [/offer\s+validity/i, /valid(?:ity)?\s+(?:of\s+the\s+)?(?:offer|quotation|bid)/i, /صلاحية\s*(?:العرض|الأسعار|المناقصة)/i] },
    { key: "warranty", label: "Warranty", patterns: [/warrant(?:y|ies)/i, /defects?\s+liability/i, /ضمان(?:ات)?/i] },
    { key: "paymentTerms", label: "Payment terms", patterns: [/payment\s+terms?/i, /progress\s+payments?/i, /شروط\s*الدفع/i, /دفعات?/i] },
    { key: "retention", label: "Retention", patterns: [/retention(?:\s+money|\s+percentage)?/i, /احتجاز(?:ات)?/i, /استقطاع/i] },
    { key: "liquidatedDamages", label: "Liquidated damages", patterns: [/liquidated\s+damages?/i, /\bLD\b/i, /غرام(?:ة|ات)\s*(?:التأخير|التأخير)/i] },
    { key: "executionPeriod", label: "Execution period", patterns: [/execution\s+(?:period|duration)/i, /contract\s+duration/i, /duration\s+of\s+(?:the\s+)?works?/i, /مدة\s*(?:التنفيذ|المشروع|العقد)/i] },
    { key: "manufacturers", label: "Approved manufacturers", patterns: [/approved\s+(?:manufacturers?|makes?|vendors?)/i, /manufacturer\s+list/i, /المصنعين\s*المعتمدين/i, /الموردين\s*المعتمدين/i] },
    { key: "scope", label: "Scope of work", patterns: [/scope\s+of\s+work/i, /responsibility\s+matrix/i, /interface\s+matrix/i, /نطاق\s*(?:الأعمال|العمل)/i, /مصفوفة\s*(?:المسؤوليات|التداخل)/i] },
    { key: "exclusionsRisks", label: "Exclusions and risks", patterns: [/exclusions?/i, /assumptions?/i, /commercial\s+risks?/i, /استثناءات?/i, /افتراضات?/i, /مخاطر?/i] },
  ]

  function insightField(key) {
    return DOCUMENT_INSIGHT_FIELDS.find((field) => field.key === key) || { key, label: key, patterns: [] }
  }

  function parseDateFromText(value) {
    const source = String(value || "")
    const iso = source.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
    if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`
    const dmy = source.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/)
    if (dmy) return `${dmy[3]}-${String(dmy[2]).padStart(2, "0")}-${String(dmy[1]).padStart(2, "0")}`
    return ""
  }

  function insightConfidence(field, line, pageText) {
    const keyword = field.patterns.some((pattern) => pattern.test(line))
    if (!keyword) return 0
    let confidence = 0.66
    if (/\d/.test(line)) confidence += 0.08
    if (parseDateFromText(line)) confidence += 0.14
    if (String(pageText || "").length > 80) confidence += 0.04
    if (/[:：]/.test(line)) confidence += 0.04
    return round(Math.min(0.98, confidence), 2)
  }

  function normalizeInsightValue(fieldKey, line) {
    const value = String(line || "").replace(/\s+/g, " ").trim()
    if (fieldKey === "submissionDeadline") return parseDateFromText(value) || value
    return value.replace(/^[\-–—•*\s]+/, "").trim()
  }

  function normalizePdfPages(pages, fallbackText = "") {
    if (Array.isArray(pages) && pages.length) {
      return pages.map((entry, index) => {
        if (typeof entry === "string") return { page: index + 1, text: entry }
        return { page: Math.max(1, number(entry?.page) || index + 1), text: String(entry?.text || entry?.content || "") }
      }).filter((entry) => entry.text.trim())
    }
    return String(fallbackText || "").trim() ? [{ page: 1, text: String(fallbackText) }] : []
  }

  function extractTenderInsights(pages, options = {}) {
    const pageRows = normalizePdfPages(pages, options.text)
    const seen = new Set()
    const insights = []
    pageRows.forEach((pageRow) => {
      const lines = String(pageRow.text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      DOCUMENT_INSIGHT_FIELDS.forEach((field) => {
        const line = lines.find((candidate) => field.patterns.some((pattern) => pattern.test(candidate)))
        if (!line) return
        const normalized = normalizeInsightValue(field.key, line)
        const dedupe = `${field.key}|${normalizeHeader(normalized)}`
        if (seen.has(dedupe)) return
        seen.add(dedupe)
        insights.push({
          id: id("insight"), fieldKey: field.key, label: field.label, value: normalized,
          normalizedValue: normalized, page: pageRow.page, sourceText: line.slice(0, 1000),
          confidence: insightConfidence(field, line, pageRow.text), status: "pending",
          reviewRequired: true, source: { page: pageRow.page, text: line.slice(0, 1000) },
          extractedAt: options.extractedAt || new Date().toISOString(), extractedBy: options.extractedBy || "QESTIMA PDF Intelligence",
          appliedToTenderReview: false,
        })
      })
    })
    return insights.sort((a, b) => a.page - b.page || b.confidence - a.confidence)
  }

  function summarizePdfText(pages) {
    const text = normalizePdfPages(pages).map((entry) => entry.text).join(" ").replace(/\s+/g, " ").trim()
    if (!text) return ""
    const sentences = text.split(/(?<=[.!؟。])\s+/).filter(Boolean)
    return sentences.slice(0, 3).join(" ").slice(0, 800)
  }

  function extractTextTables(pages) {
    const tables = []
    normalizePdfPages(pages).forEach((pageRow) => {
      let rows = []
      const flush = () => { if (rows.length >= 2) tables.push({ page: pageRow.page, rows: rows.slice(0, 80) }); rows = [] }
      String(pageRow.text || "").split(/\r?\n/).forEach((line) => {
        const raw = line.trim()
        const cells = raw.includes("|") ? raw.split("|").map((cell) => cell.trim()).filter(Boolean) : raw.split(/\t+|\s{3,}/).map((cell) => cell.trim()).filter(Boolean)
        if (cells.length >= 2) rows.push(cells)
        else flush()
      })
      flush()
    })
    return tables.slice(0, 100)
  }

  function analyzeTenderDocument(document = {}, pages = [], options = {}) {
    const pageRows = normalizePdfPages(pages, options.text)
    const fullText = pageRows.map((entry) => entry.text).join("\n\n")
    const classification = classifyTenderDocument(document.originalName || document.title || document.fileName || "", fullText)
    const inspection = inspectDocument({ name: document.originalName || document.title || document.fileName || "document", type: document.mimeType || document.type || "" }, { text: fullText, revision: document.revision, page: pageRows[0]?.page })
    const method = options.method || (inspection.pdfKind === "text" ? "pdftotext" : "ocr")
    const insights = extractTenderInsights(pageRows, options).map((entry) => ({ ...entry, documentId: document.id || "", source: { ...(entry.source || {}), documentId: document.id || "", revision: String(document.revision || "") } }))
    return {
      id: options.id || id("pdf-analysis"), documentId: document.id || "", documentRevision: String(document.revision || classification.revision || "00"),
      fileName: document.originalName || document.title || inspection.fileName, classification, format: inspection.format,
      pdfKind: inspection.pdfKind, extractionMethod: method, ocrLanguages: options.ocrLanguages || ["ara", "eng"],
      pageCount: pageRows.length, pages: pageRows.map((entry) => ({ page: entry.page, text: entry.text.slice(0, 50000) })),
      extractedText: fullText.slice(0, 200000), headings: pageRows.flatMap((entry) => entry.text.split(/\r?\n/).filter((line) => /^[A-Z][A-Z\s/&-]{4,}$/.test(line.trim())).map((line) => ({ page: entry.page, text: line.trim() }))).slice(0, 200),
      tables: extractTextTables(pageRows),
      summary: summarizePdfText(pageRows), insights,
      source: { documentId: document.id || "", revision: String(document.revision || classification.revision || "00") },
      status: options.status || "review_required", warnings: Array.isArray(options.warnings) ? [...options.warnings] : [],
      analyzedAt: options.analyzedAt || new Date().toISOString(), analyzedBy: options.analyzedBy || "QESTIMA PDF Intelligence",
      advisoryOnly: true,
    }
  }

  function documentIntelligenceSummary(project = {}) {
    const insights = Array.isArray(project.documentInsights) ? project.documentInsights : []
    const analyses = project.pdfAnalyses && typeof project.pdfAnalyses === "object" ? Object.values(project.pdfAnalyses) : []
    return {
      documents: (project.documents || []).filter((document) => document.status !== "superseded").length,
      analyzed: analyses.length, pending: insights.filter((entry) => entry.status === "pending").length,
      approved: insights.filter((entry) => entry.status === "approved").length,
      rejected: insights.filter((entry) => entry.status === "rejected").length,
      reviewRequired: insights.filter((entry) => entry.status === "pending").length,
      ocr: analyses.filter((entry) => entry.extractionMethod === "ocr" || entry.pdfKind === "scanned_or_image").length,
    }
  }

  function setDocumentInsightStatus(project, insightId, decision, user = "") {
    const insight = (project?.documentInsights || []).find((entry) => entry.id === insightId)
    const status = ["approved", "rejected", "pending"].includes(decision) ? decision : "pending"
    if (!insight) return { ok: false, reason: "INSIGHT_NOT_FOUND" }
    insight.status = status
    insight.reviewedAt = new Date().toISOString()
    insight.reviewedBy = user
    insight.reviewRequired = status === "pending"
    return { ok: true, insight }
  }

  // Explicit second step: an approved insight can be applied to Tender Review,
  // but parsing or approving a suggestion alone never changes the summary.
  function applyDocumentInsight(project, insightId, user = "") {
    const insight = (project?.documentInsights || []).find((entry) => entry.id === insightId)
    if (!insight) return { ok: false, reason: "INSIGHT_NOT_FOUND" }
    if (insight.status !== "approved") return { ok: false, reason: "INSIGHT_NOT_APPROVED" }
    const summaryKey = { submissionDeadline: "submissionMethod", exclusionsRisks: "commercialRisks", scope: "scopeSummary" }[insight.fieldKey] || insight.fieldKey
    const summary = (project.tenderSummary || []).find((entry) => entry.key === summaryKey)
    if (!summary) return { ok: false, reason: "SUMMARY_FIELD_NOT_FOUND" }
    summary.value = insight.normalizedValue || insight.value || ""
    summary.sourceDocumentId = insight.documentId || insight.source?.documentId || ""
    summary.sourcePage = String(insight.page || insight.source?.page || "")
    summary.verified = true
    summary.notes = `Applied from PDF insight · confidence ${Math.round(number(insight.confidence) * 100)}%`
    insight.appliedToTenderReview = true
    insight.appliedAt = new Date().toISOString()
    insight.appliedBy = user
    return { ok: true, insight, summary }
  }

  function queryTerms(value) {
    const stopWords = new Set([
      "a", "an", "and", "are", "can", "does", "for", "from", "how", "in", "is", "me", "of", "on", "please", "show", "tell", "the", "to", "what", "when", "where", "which", "who", "with", "نسبة", "ما", "ماذا", "هل", "من", "في", "عن", "على", "الى", "إلى", "هو", "هي", "هذا", "هذه", "كم", "اريد", "أريد", "اعرض", "أظهر", "من فضلك",
    ])
    return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).map((term) => normalizeHeader(term)).filter((term) => term.length > 1 && !stopWords.has(term))
  }

  function documentMatchScore(query, content) {
    const queryWords = queryTerms(query)
    const contentWords = new Set(queryTerms(content))
    const hits = queryWords.filter((term) => contentWords.has(term)).length
    const exact = normalizeHeader(content).includes(normalizeHeader(query)) ? 1 : 0
    return queryWords.length ? hits / queryWords.length + exact * 0.35 : exact
  }

  function projectDocumentSearch(project = {}, query = "", options = {}) {
    const needle = normalizeHeader(query)
    const queryWords = queryTerms(query)
    if (!needle && !queryWords.length) return []
    const rows = []
    ;(project.documentInsights || []).forEach((insight) => {
      const content = [insight.label, insight.value, insight.sourceText, insight.fieldKey].join(" ")
      const score = documentMatchScore(query, content)
      if (score <= 0) return
      rows.push({ type: "insight", documentId: insight.documentId, page: insight.page, title: insight.label, excerpt: insight.sourceText || insight.value, confidence: round(Math.min(0.99, number(insight.confidence) + score * 0.08), 2), matchScore: score, status: insight.status })
    })
    const analyses = project.pdfAnalyses && typeof project.pdfAnalyses === "object" ? Object.values(project.pdfAnalyses) : []
    analyses.forEach((analysis) => (analysis.pages || []).forEach((page) => {
      const text = String(page.text || "")
      const score = documentMatchScore(query, text)
      if (score <= 0) return
      const normalizedText = normalizeHeader(text)
      const index = needle ? normalizedText.indexOf(needle) : -1
      const start = index >= 0 ? Math.max(0, index - 140) : 0
      rows.push({ type: "document", documentId: analysis.documentId, page: page.page, title: analysis.fileName, excerpt: text.slice(start, start + 360), confidence: round(Math.min(0.99, (analysis.extractionMethod === "ocr" ? 0.72 : 0.9) + score * 0.05), 2), matchScore: score, status: analysis.status })
    }))
    return rows.sort((a, b) => number(b.matchScore) - number(a.matchScore) || number(b.confidence) - number(a.confidence)).slice(0, Math.max(1, number(options.limit) || 20))
  }

  function askProjectDocuments(project = {}, query = "", options = {}) {
    const matches = projectDocumentSearch(project, query, options)
    const insightAnswers = matches.filter((match) => match.type === "insight").slice(0, 4).map((match) => `${match.title}: ${match.excerpt}`)
    return {
      query: String(query || ""), answer: matches.length ? (insightAnswers.length ? insightAnswers.join(" · ") : `Found ${matches.length} source-linked result(s) in this project.`) : "No matching text was found in the indexed project documents.",
      matches, sources: matches.map((match) => ({ documentId: match.documentId, page: match.page, confidence: match.confidence, excerpt: match.excerpt })),
      projectOnly: true, advisoryOnly: true,
    }
  }

  function compareDocumentRevisions(project = {}, beforeId = "", afterId = "") {
    const before = project.pdfAnalyses?.[beforeId] || null
    const after = project.pdfAnalyses?.[afterId] || null
    if (!before || !after) return { ok: false, reason: "ANALYSIS_NOT_FOUND", beforeId, afterId, changes: [] }
    const beforeByField = new Map((before.insights || []).map((entry) => [entry.fieldKey, entry]))
    const afterByField = new Map((after.insights || []).map((entry) => [entry.fieldKey, entry]))
    const keys = [...new Set([...beforeByField.keys(), ...afterByField.keys()])]
    const changes = keys.map((key) => {
      const oldValue = beforeByField.get(key)?.normalizedValue || beforeByField.get(key)?.value || ""
      const newValue = afterByField.get(key)?.normalizedValue || afterByField.get(key)?.value || ""
      if (oldValue === newValue) return null
      return { fieldKey: key, label: insightField(key).label, before: oldValue, after: newValue, beforePage: beforeByField.get(key)?.page || "", afterPage: afterByField.get(key)?.page || "" }
    }).filter(Boolean)
    const beforePages = new Map((before.pages || []).map((entry) => [entry.page, normalizeHeader(entry.text)]))
    const afterPages = new Map((after.pages || []).map((entry) => [entry.page, normalizeHeader(entry.text)]))
    const changedPages = [...new Set([...beforePages.keys(), ...afterPages.keys()])].filter((page) => beforePages.get(page) !== afterPages.get(page))
    return { ok: true, beforeId, afterId, beforeRevision: before.documentRevision, afterRevision: after.documentRevision, changes, changedPages, counts: { changedInsights: changes.length, changedPages: changedPages.length } }
  }

  function point(value) {
    return { x: number(value?.x), y: number(value?.y) }
  }

  function distanceBetween(left, right) {
    return Math.sqrt((number(right?.x) - number(left?.x)) ** 2 + (number(right?.y) - number(left?.y)) ** 2)
  }

  function polygonArea(points = []) {
    if (points.length < 3) return 0
    return Math.abs(points.reduce((sum, current, index) => {
      const next = points[(index + 1) % points.length]
      return sum + number(current.x) * number(next.y) - number(next.x) * number(current.y)
    }, 0)) / 2
  }

  function polylineLength(points = [], close = false) {
    const values = points.map(point)
    let total = values.slice(1).reduce((sum, current, index) => sum + distanceBetween(values[index], current), 0)
    if (close && values.length > 2) total += distanceBetween(values[values.length - 1], values[0])
    return total
  }

  function measurementGeometry(kind = "length", points = [], scale = 1, count = 0) {
    const normalized = (points || []).map(point)
    const unitsPerPixel = Math.max(0, number(scale))
    const pixelQuantity = kind === "area" ? polygonArea(normalized) : kind === "count" ? Math.max(number(count), normalized.length) : polylineLength(normalized, kind === "perimeter")
    const quantity = kind === "area" ? pixelQuantity * unitsPerPixel ** 2 : kind === "count" ? pixelQuantity : pixelQuantity * unitsPerPixel
    return { kind, points: normalized, pixelQuantity: round(pixelQuantity, 4), scale: unitsPerPixel || 1, quantity: round(quantity, 4), unit: kind === "area" ? "m²" : kind === "count" ? "nr" : "m" }
  }

  function calibrateScale(pixelDistance, knownDistance) {
    const pixels = Math.max(0, number(pixelDistance))
    const known = Math.max(0, number(knownDistance))
    return { ok: pixels > 0 && known > 0, pixelDistance: pixels, knownDistance: known, unitsPerPixel: pixels > 0 ? round(known / pixels, 8) : 0 }
  }

  function createMeasurementGroup(input = {}) {
    const color = String(input.color || "#28c7b7").trim()
    return {
      id: input.id || id("measurement-group"), name: String(input.name || "Untitled group").trim() || "Untitled group",
      color: /^#[0-9a-f]{6}$/i.test(color) ? color : "#28c7b7", system: String(input.system || ""),
      createdAt: input.createdAt || new Date().toISOString(), createdBy: String(input.createdBy || ""), notes: String(input.notes || ""),
    }
  }

  function createMeasurement(input = {}) {
    const kind = ["length", "polyline", "area", "count", "perimeter"].includes(input.kind) ? input.kind : "length"
    const points = Array.isArray(input.points) ? input.points.map(point) : []
    const geometry = points.length && (input.quantity == null || number(input.quantity) <= 0) ? measurementGeometry(kind, points, number(input.scale) || 1, input.count) : null
    const quantity = geometry ? geometry.quantity : number(input.quantity)
    return {
      id: input.id || id("measurement"), kind, name: String(input.name || "Untitled measurement"), quantity,
      unit: normalizeUnit(input.unit || geometry?.unit || (kind === "area" ? "m²" : kind === "count" ? "nr" : "m")),
      scale: number(input.scale) || geometry?.scale || 1, pixelQuantity: number(input.pixelQuantity || geometry?.pixelQuantity), points,
      openings: Array.isArray(input.openings) ? input.openings.map(number) : [], layer: String(input.layer || "Default"), color: String(input.color || "#35c6b0"),
      drawingDocumentId: String(input.drawingDocumentId || ""), drawingPage: number(input.drawingPage) || 1, drawingRevision: String(input.drawingRevision || ""),
      system: String(input.system || ""), floor: String(input.floor || ""), itemId: String(input.itemId || ""), groupId: String(input.groupId || ""), measuredBy: String(input.measuredBy || ""),
      status: input.status || (input.approved === true ? "approved" : "pending"), approved: input.approved === true || input.status === "approved",
      revisionCarryForward: Boolean(input.revisionCarryForward), previousMeasurementId: String(input.previousMeasurementId || ""),
      createdAt: input.createdAt || new Date().toISOString(), notes: String(input.notes || "")
    }
  }

  function measurementNetQuantity(measurement = {}) {
    const gross = number(measurement.quantity)
    return round(Math.max(0, gross - (measurement.kind === "area" ? (measurement.openings || []).reduce((sum, value) => sum + number(value), 0) : 0)), 3)
  }

  function approveMeasurement(measurement, user = "") { return { ...createMeasurement(measurement), approved: true, status: "approved", measuredBy: measurement.measuredBy || user, approvedAt: new Date().toISOString(), approvedBy: user } }

  function measurementTotals(project = {}, drawingDocumentId = "", drawingPage = null) {
    const rows = (project.measurements || []).filter((entry) => (!drawingDocumentId || entry.drawingDocumentId === drawingDocumentId) && (drawingPage == null || number(entry.drawingPage) === number(drawingPage)))
    const totals = new Map()
    rows.forEach((entry) => {
      const key = entry.itemId || `${entry.system || "Unlinked"}|${entry.unit || ""}`
      const current = totals.get(key) || { itemId: entry.itemId || "", system: entry.system || "", unit: entry.unit || "", gross: 0, net: 0, pending: 0, approved: 0 }
      current.gross += number(entry.quantity)
      current.net += measurementNetQuantity(entry)
      if (entry.approved || entry.status === "approved") current.approved += 1
      else current.pending += 1
      totals.set(key, current)
    })
    return [...totals.values()].map((row) => ({ ...row, gross: round(row.gross, 3), net: round(row.net, 3) }))
  }

  function takeoffVariance(project = {}, itemId = "") {
    const item = (project.boq || []).find((entry) => entry.id === itemId)
    const measured = (project.measurements || []).filter((entry) => entry.itemId === itemId).reduce((sum, entry) => sum + measurementNetQuantity(entry), 0)
    return { itemId, boqQuantity: number(item?.quantity), takeoffQuantity: round(measured, 3), variance: round(measured - number(item?.quantity), 3), variancePercent: number(item?.quantity) ? round((measured - number(item.quantity)) / number(item.quantity) * 100, 2) : 0, approved: (project.measurements || []).filter((entry) => entry.itemId === itemId).every((entry) => entry.approved || entry.status === "approved") }
  }

  function applyApprovedMeasurement(project = {}, measurementId = "", user = "") {
    const measurement = (project.measurements || []).find((entry) => entry.id === measurementId)
    const item = (project.boq || []).find((entry) => entry.id === measurement?.itemId)
    if (!measurement || !item) return { ok: false, reason: "MEASUREMENT_OR_ITEM_NOT_FOUND" }
    if (!(measurement.approved || measurement.status === "approved")) return { ok: false, reason: "MEASUREMENT_NOT_APPROVED" }
    const variance = takeoffVariance(project, item.id)
    item.takeoffQuantity = variance.takeoffQuantity
    item.quantityBasis = "takeoff"
    item.quantityDecision = "takeoff"
    item.drawingDocumentId = measurement.drawingDocumentId || item.drawingDocumentId
    item.drawingRevision = measurement.drawingRevision || item.drawingRevision
    item.sources ||= {}
    item.sources.quantity = { type: "measurement", drawing: measurement.drawingDocumentId, page: measurement.drawingPage, revision: measurement.drawingRevision, date: new Date().toISOString(), user }
    return { ok: true, item, variance }
  }

  function carryMeasurementsToRevision(project = {}, beforeDocumentId = "", afterDocumentId = "", user = "") {
    const target = (project.documents || []).find((entry) => entry.id === afterDocumentId)
    if (!target) return { ok: false, reason: "TARGET_DRAWING_NOT_FOUND", measurements: [] }
    const carried = (project.measurements || []).filter((entry) => entry.drawingDocumentId === beforeDocumentId).map((entry) => createMeasurement({ ...deepClone(entry), id: id("measurement"), drawingDocumentId: afterDocumentId, drawingRevision: target.revision || "", approved: false, status: "pending", revisionCarryForward: true, previousMeasurementId: entry.id, measuredBy: user, notes: `${entry.notes ? `${entry.notes} · ` : ""}Carried from ${entry.drawingRevision || "previous revision"}; review required.` }))
    return { ok: true, measurements: carried, changedElements: carried.map((entry) => ({ id: entry.id, previousMeasurementId: entry.previousMeasurementId, page: entry.drawingPage, itemId: entry.itemId })) }
  }

  function dxfSummary(text = "") {
    const source = String(text || "")
    const layers = [...new Set([...source.matchAll(/8\s*\n([^\r\n]+)/g)].map((m) => m[1].trim()).filter(Boolean))]
    const blocks = [...new Set([...source.matchAll(/2\s*\n([^\r\n]+)/g)].map((m) => m[1].trim()).filter(Boolean))]
    const polylines = (source.match(/LWPOLYLINE|POLYLINE/g) || []).length
    const mtext = (source.match(/TEXT|MTEXT/g) || []).length
    return { layers, blocks, polylines, textEntities: mtext, status: "advisory", message: "DXF quantities require engineer review before BOQ update." }
  }

  function daysBetween(left, right) {
    const a = new Date(left).getTime()
    const b = new Date(right).getTime()
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
    return Math.floor((a - b) / 86400000)
  }

  // The browser-only preview needs a deterministic credential check even
  // when Web Crypto is unavailable on a file:// launch. This is a local
  // preview guard, not a replacement for signed server authentication.
  function credentialDigest(value) {
    let hash = 2166136261
    for (const character of String(value ?? "")) {
      hash ^= character.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`
  }

  function addDaysIso(value, days) {
    const date = new Date(value)
    const base = Number.isFinite(date.getTime()) ? date : new Date()
    base.setDate(base.getDate() + Math.max(1, Math.round(number(days) || 1)))
    return base.toISOString()
  }

  function defaultLicense(now = new Date().toISOString()) {
    return {
      id: "LIC-LOCAL-PREVIEW",
      licenseKey: "QESTIMA-DEMO-LOCAL",
      plan: "Preview",
      type: "Trial",
      status: "active",
      startsAt: now,
      expiresAt: addDaysIso(now, PREVIEW_TRIAL_DAYS),
      maxDevices: 1,
      maxUsers: 1,
      organization: "Personal Workspace",
      activationMode: "offline_preview",
      lastValidatedAt: now,
      activatedAt: now,
    }
  }

  function licenseStatus(value, now = new Date()) {
    const license = value?.license || value || {}
    const expiry = new Date(license.expiresAt || "")
    const validExpiry = Number.isFinite(expiry.getTime())
    const deltaMs = validExpiry ? expiry.getTime() - now.getTime() : null
    const daysLeft = validExpiry ? Math.ceil(deltaMs / 86400000) : null
    const expired = license.status === "expired" || (validExpiry && deltaMs < 0)
    const suspended = ["suspended", "revoked"].includes(String(license.status || "").toLowerCase())
    return {
      ...license,
      status: suspended ? String(license.status).toLowerCase() : expired ? "expired" : String(license.status || "active").toLowerCase(),
      expiresAt: validExpiry ? expiry.toISOString() : "",
      daysLeft,
      expired: expired || suspended,
      expiringSoon: !expired && !suspended && daysLeft != null && daysLeft >= 0 && daysLeft <= 7,
    }
  }

  function decodeLicenseToken(token) {
    const parts = String(token || "").split(".")
    if (parts.length !== 3) return { ok: false, reason: "INVALID_TOKEN_FORMAT" }
    try {
      const decode = (part) => { const raw = String(part).replace(/-/g, "+").replace(/_/g, "/"); const binary = typeof atob === "function" ? atob(raw) : Buffer.from(raw, "base64").toString("utf8"); return JSON.parse(typeof binary === "string" && binary.trim().startsWith("{") ? binary : decodeURIComponent([...binary].map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""))) }
      const header = decode(parts[0]); const payload = decode(parts[1])
      return { ok: true, header, payload, signature: parts[2], signed: Boolean(parts[2]) }
    } catch { return { ok: false, reason: "INVALID_TOKEN_ENCODING" } }
  }

  function licenseTokenStatus(token, now = new Date(), verified = false) {
    const parsed = decodeLicenseToken(token)
    if (!parsed.ok) return parsed
    const payload = parsed.payload || {}
    const nowSeconds = Math.floor(now.getTime() / 1000)
    const grace = Math.max(0, number(payload.offlineGraceDays || 0)) * 86400
    const expired = Number.isFinite(Number(payload.exp)) && nowSeconds > Number(payload.exp) + grace
    const notYet = Number.isFinite(Number(payload.nbf)) && nowSeconds < Number(payload.nbf)
    const suspended = ["suspended", "revoked"].includes(String(payload.status || "").toLowerCase())
    return { ok: Boolean(verified) && !expired && !notYet && !suspended, verified: Boolean(verified), expired, notYet, suspended, payload, reason: !verified ? "SIGNATURE_NOT_VERIFIED" : suspended ? "LICENSE_NOT_ACTIVE" : expired ? "TOKEN_EXPIRED" : notYet ? "TOKEN_NOT_ACTIVE" : "ACTIVE" }
  }

  function activateLocalLicense(state, details = {}, now = new Date()) {
    const licenseKey = String(details.licenseKey || "").trim()
    const activationCode = String(details.activationCode || "").trim().toUpperCase()
    const match = new RegExp(`^${PREVIEW_ACTIVATION_PREFIX}(?:DEMO|TRIAL)-(\\d{1,3})$`, "i").exec(activationCode)
    if (!licenseKey || !match) return { ok: false, reason: "INVALID_ACTIVATION_CODE" }
    const days = Math.min(3650, Math.max(1, Number(match[1])))
    const previous = state?.license || defaultLicense(now.toISOString())
    const activatedAt = now.toISOString()
    return {
      ok: true,
      license: {
        ...previous,
        id: previous.id || "LIC-LOCAL-PREVIEW",
        licenseKey,
        plan: "Preview",
        type: "Trial",
        status: "active",
        startsAt: activatedAt,
        expiresAt: addDaysIso(activatedAt, days),
        activationMode: "offline_preview",
        activatedAt,
        lastValidatedAt: activatedAt,
        activationCodeHint: `QESTIMA-${days}d`,
      },
    }
  }

  const headerCandidates = {
    itemNo: ["item", "itemno", "itemnumber", "code", "boqcode", "رقمالبند", "كود", "البند"],
    description: ["description", "itemdescription", "scope", "الوصف", "وصفالبند", "البيان"],
    unit: ["unit", "uom", "الوحده"],
    quantity: ["quantity", "qty", "الكميه"],
    section: ["section", "division", "trade", "القسم"],
    system: ["system", "discipline", "النظام", "السيستم"],
    floor: ["floor", "level", "الدور", "الطابق"],
  }

  const tenderSummaryFields = [
    ["submissionMethod", "موعد وطريقة التسليم"], ["validity", "مدة صلاحية العرض"], ["currencyVat", "العملة والضريبة"],
    ["bidBond", "Bid Bond"], ["performanceBond", "Performance Bond"], ["advancePayment", "Advance Payment"],
    ["retention", "Retention"], ["liquidatedDamages", "Liquidated Damages"], ["paymentTerms", "Payment Terms"],
    ["executionPeriod", "مدة التنفيذ"], ["warranty", "Warranty"], ["alternatives", "Required Alternatives"],
    ["manufacturers", "Required Manufacturers"], ["mandatoryVendors", "المواد أو الموردون الإلزاميون"],
    ["submissionDocuments", "المستندات المطلوب تقديمها"], ["commercialRisks", "أهم المخاطر والشروط التجارية"], ["scopeSummary", "ملخص نطاق الأعمال المستخرج"],
  ]

  function nextTenderCode(state, date = new Date()) {
    const year = date.getFullYear()
    const prefix = `TND-${year}-`
    const numbers = (state?.projects || []).map((project) => String(project.tenderCode || "")).filter((code) => code.startsWith(prefix)).map((code) => number(code.slice(prefix.length)))
    return `${prefix}${String(Math.max(0, ...numbers) + 1).padStart(3, "0")}`
  }

  function defaultTenderSummary(project = {}) {
    const defaults = {
      submissionMethod: project.deadline ? `Submission deadline: ${project.deadline}` : "",
      currencyVat: project.currency ? `${project.currency} · VAT ${number(project.tax)}%` : "",
    }
    return tenderSummaryFields.map(([key, label]) => ({ id: id("summary"), key, label, value: defaults[key] || "", sourceDocumentId: "", sourcePage: "", verified: false, notes: "" }))
  }

  function defaultScopeMatrix(disciplines = ["HVAC", "Fire Fighting", "Plumbing"]) {
    const systems = {
      HVAC: ["Chilled Water", "Ventilation", "Air Conditioning Controls"],
      "Fire Fighting": ["Fire Fighting", "Fire Alarm Interface"],
      Plumbing: ["Water Supply", "Drainage", "Sanitary Fixtures"],
      Electrical: ["Power Supply to MEP Equipment", "BMS Controls"],
      Civil: ["Builder's Work"],
      Architectural: ["MEP Openings & Access Panels"],
    }
    return [...new Set((disciplines || []).flatMap((discipline) => systems[discipline] || []))].map((system) => ({ id: id("scope"), system, inScope: "yes", boqStatus: "unknown", drawingsStatus: "unknown", specsStatus: "unknown", notes: "" }))
  }

  function classifyTenderDocument(fileName, content = "") {
    const original = String(fileName || "")
    const fileNameText = original.toLowerCase().replace(/[_-]+/g, " ")
    const contentText = String(content || "").slice(0, 6000).toLowerCase().replace(/[_-]+/g, " ")
    const name = `${fileNameText} ${contentText}`
    const rules = [
      ["addenda", /addend|bulletin|تعديل|ملحق/], ["clarifications", /clarif|rfi|question|answer|استفسار/],
      ["boq", /\bboq\b|bill of quant|schedule of quantities|جدول كميات/], ["specifications", /specification|\bspec\b|مواصف/],
      ["drawings", /drawing|\bdwg\b|plan|layout|مخطط|رسم/], ["schedules", /schedule|equipment list|valve list|fixture list/],
      ["vendors", /vendor|manufacturer|approved make|مورد|مصنع/], ["scope", /scope|responsibility|interface matrix|نطاق|مسؤولي/],
      ["commercial", /contract|condition|payment|bond|liquidated|commercial|شروط|دفعات/],
      ["instructions", /\bitt\b|invitation|instruction|submission requirement|دعوة|تعليمات/],
      ["forms", /form|returnable|proposal|نموذج/],
    ]
    const category = rules.find(([, pattern]) => pattern.test(fileNameText))?.[0] || rules.find(([, pattern]) => pattern.test(contentText))?.[0] || "instructions"
    const disciplineRules = [
      ["Fire Fighting", /fire|sprinkler|hydrant|\bff\b/], ["Plumbing", /plumb|drain|water supply|sanitary|piping|\bpl\b/],
      ["HVAC", /hvac|duct|chilled|ventilation|mechanical|\bmech\b/], ["Electrical", /electrical|power|lighting|\bel\b/],
      ["Architectural", /architect|arch/], ["Civil", /civil|structural/],
    ]
    const discipline = disciplineRules.find(([, pattern]) => pattern.test(fileNameText))?.[0] || disciplineRules.find(([, pattern]) => pattern.test(contentText))?.[0] || "General"
    const extension = original.includes(".") ? original.split(".").pop().toUpperCase() : "FILE"
    const revisionMatch = original.match(/(?:\brev(?:ision)?|\br)[\s._-]*([a-z0-9]+)/i)
    const revision = revisionMatch ? revisionMatch[1].toUpperCase().padStart(/^\d+$/.test(revisionMatch[1]) ? 2 : 1, "0") : "00"
    const base = original.replace(/\.[^.]+$/, "").replace(/(?:\brev(?:ision)?|\br)[\s._-]*[a-z0-9]+/ig, "").replace(/[_-]+/g, " ").trim()
    const numberMatch = original.match(/\b[A-Z]{1,5}[-_][A-Z0-9-]{2,}\b/i)
    return { category, discipline, fileType: extension, revision, documentNumber: numberMatch?.[0]?.replace(/_/g, "-").toUpperCase() || "", title: base || original }
  }

  function revisionRank(value) {
    const text = String(value || "0").toUpperCase().trim()
    if (/^\d+$/.test(text)) return number(text)
    return [...text].reduce((sum, char) => sum * 36 + parseInt(char, 36), 0)
  }

  function recalculateDocumentRevisions(project) {
    const groups = new Map()
    ;(project.documents || []).forEach((document) => {
      const key = normalizeHeader(document.documentNumber || document.title || document.originalName)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(document)
    })
    groups.forEach((documents) => {
      const sorted = [...documents].sort((a, b) => revisionRank(b.revision) - revisionRank(a.revision) || String(b.receivedDate).localeCompare(String(a.receivedDate)))
      const latest = sorted[0]
      sorted.forEach((document) => {
        document.latestRevision = document.id === latest.id
        document.status = document.latestRevision ? "current" : "superseded"
        document.supersededBy = document.latestRevision ? "" : latest.id
      })
    })
  }

  function scopeStatus(row) {
    if (row.inScope === "no") return "not_applicable"
    if (row.inScope === "partial") return "clarification"
    if (row.boqStatus === "no") return "boq_gap"
    if (row.drawingsStatus === "missing" || row.specsStatus === "missing") return "incomplete"
    if ([row.boqStatus, row.drawingsStatus, row.specsStatus].includes("unknown")) return "review"
    return "complete"
  }

  function effectiveQuantity(item) {
    return item?.quantityBasis === "takeoff" && number(item.takeoffQuantity) > 0 ? number(item.takeoffQuantity) : number(item?.quantity)
  }

  function guessColumn(headers, field) {
    const candidates = headerCandidates[field] || []
    return headers.find((header) => candidates.includes(normalizeHeader(header))) || ""
  }

  function cleanBoqRows(rows, mapping, options = {}) {
    const seen = new Set()
    const duplicates = []
    const diagnostics = { blankRows: 0, duplicateRows: 0, normalizedUnits: 0, textNumbers: 0, zeroQuantities: 0, formulaErrors: 0, missingDescriptions: 0, missingQuantities: 0 }
    const cleaned = []
    rows.forEach((row, index) => {
      const rawDescription = String(row[mapping.description] ?? "").trim()
      const rawQuantity = row[mapping.quantity]
      if (!rawDescription && !String(row[mapping.itemNo] ?? "").trim()) {
        diagnostics.blankRows += 1
        return
      }
      if (!rawDescription) diagnostics.missingDescriptions += 1
      if (rawQuantity === "" || rawQuantity == null) diagnostics.missingQuantities += 1
      if (typeof rawQuantity === "string" && rawQuantity.trim()) diagnostics.textNumbers += 1
      if (typeof rawQuantity === "string" && /#(?:ref|value|name|div|n\/a)!?/i.test(rawQuantity)) diagnostics.formulaErrors += 1
      const originalUnit = String(row[mapping.unit] ?? "").trim()
      const canonicalUnit = normalizeUnit(originalUnit || "nr")
      if (originalUnit && canonicalUnit !== originalUnit) diagnostics.normalizedUnits += 1
      const item = {
        id: id("boq"),
        itemNo: String(row[mapping.itemNo] ?? "").trim() || `IMP-${index + 1}`,
        description: rawDescription,
        unit: canonicalUnit,
        quantity: number(row[mapping.quantity]),
        section: String(row[mapping.section] ?? "").trim() || "غير مصنف",
        system: String(row[mapping.system] ?? "").trim() || "MEP",
        floor: String(row[mapping.floor] ?? "").trim() || "عام",
        pricingMethod: "analysis",
        manualRate: 0,
        selectedQuoteId: null,
        notes: "",
        drawingDocumentId: "",
        drawingRevision: "",
        specificationDocumentId: "",
        specificationSection: "",
        building: "",
        floorZone: String(row[mapping.floor] ?? "").trim() || "عام",
        takeoffQuantity: 0,
        quantityBasis: "boq",
        quantityDecision: "boq",
        linkedRfqId: "",
        linkedRiskId: "",
        sources: { quantity: { type: "excel", file: String(options.fileName || ""), row: index + 2, cell: String(mapping.quantity || "") + (index + 2), date: options.importedAt || new Date().toISOString(), user: String(options.importedBy || "") }, description: { type: "excel", file: String(options.fileName || ""), row: index + 2, cell: String(mapping.description || "") + (index + 2), date: options.importedAt || new Date().toISOString(), user: String(options.importedBy || "") } },
      }
      if (item.quantity <= 0) diagnostics.zeroQuantities += 1
      const key = `${normalizeHeader(item.itemNo)}|${normalizeHeader(item.description)}|${normalizeHeader(item.unit)}`
      if (seen.has(key)) {
        duplicates.push(item)
        diagnostics.duplicateRows += 1
        if (options.skipDuplicates !== false) return
      }
      seen.add(key)
      cleaned.push(item)
    })
    return { rows: cleaned, duplicates, diagnostics }
  }

  function tokenize(value) {
    return String(value ?? "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").split(/[^a-z0-9\u0600-\u06ff]+/i).map((token) => token.trim()).filter((token) => token.length > 1)
  }

  function similarity(left, right) {
    const a = new Set(tokenize(left))
    const b = new Set(tokenize(right))
    if (!a.size || !b.size) return 0
    const intersection = [...a].filter((token) => b.has(token)).length
    const union = new Set([...a, ...b]).size
    return union ? intersection / union : 0
  }

  function findHistoricalMatches(state, item, options = {}) {
    const limit = Math.max(1, number(options.limit) || 5)
    const currentProjectId = options.projectId || state?.activeProjectId
    const currentWorkspaceId = options.workspaceId || state?.session?.workspaceId
    const matches = []
    ;(state?.projects || []).forEach((project) => {
      if (currentWorkspaceId && project.workspaceId && project.workspaceId !== currentWorkspaceId) return
      if (currentProjectId && project.id === currentProjectId) return
      ;(project.boq || []).forEach((candidate) => {
        const descriptionScore = similarity(item?.description, candidate.description)
        const unitScore = normalizeUnit(item?.unit) === normalizeUnit(candidate.unit) ? 0.08 : 0
        const itemNoScore = item?.itemNo && candidate.itemNo && normalizeHeader(item.itemNo) === normalizeHeader(candidate.itemNo) ? 0.18 : 0
        const score = Math.min(1, descriptionScore * 0.74 + unitScore + itemNoScore)
        if (score < (options.minimumScore == null ? 0.35 : number(options.minimumScore))) return
        const rate = itemCostUnit(project, candidate, state.resources || [])
        if (rate <= 0) return
        const source = projectRateSourceForMatch(project, candidate, state)
        matches.push({ score: round(score * 100, 1), projectId: project.id, projectName: project.name, itemId: candidate.id, itemNo: candidate.itemNo, description: candidate.description, unit: candidate.unit, rate: round(rate, 4), pricingDate: project.pricingBaseDate || project.updatedAt || project.createdAt || "", source, system: candidate.system || "", differences: buildMatchDifferences(item, candidate) })
      })
    })
    return matches.sort((a, b) => b.score - a.score || String(b.pricingDate).localeCompare(String(a.pricingDate))).slice(0, limit)
  }

  function projectRateSourceForMatch(project, item, state) {
    if (item?.pricingMethod === "supplier") {
      const quote = (project.quotes || []).find((entry) => entry.id === item.selectedQuoteId)
      const supplier = (state?.suppliers || []).find((entry) => entry.id === quote?.supplierId)
      return supplier ? `Quote · ${supplier.name}` : "Supplier Quote"
    }
    if (item?.pricingMethod === "manual") return "Manual project rate"
    const lines = project?.analyses?.[item?.id]?.lines || []
    const resources = (state?.resources || []).filter((resource) => lines.some((line) => line.resourceId === resource.id)).map((resource) => resource.code)
    return resources.length ? `Rate analysis · ${resources.slice(0, 3).join(", ")}` : "Rate analysis"
  }

  function buildMatchDifferences(item, candidate) {
    const differences = []
    if (normalizeUnit(item?.unit) !== normalizeUnit(candidate?.unit)) differences.push(`Unit ${candidate?.unit || "—"} → ${item?.unit || "—"}`)
    if (String(item?.system || "") !== String(candidate?.system || "")) differences.push(`System ${candidate?.system || "—"} → ${item?.system || "—"}`)
    if (String(item?.section || "") !== String(candidate?.section || "")) differences.push(`Section ${candidate?.section || "—"} → ${item?.section || "—"}`)
    return differences
  }

  function createImportTemplate(name, mapping, options = {}) {
    return { id: options.id || id("template"), name: String(name || "Client BOQ Template"), client: String(options.client || ""), mapping: { ...mapping }, headers: Array.isArray(options.headers) ? [...options.headers] : Object.values(mapping).filter(Boolean), createdAt: options.createdAt || new Date().toISOString(), lastUsedAt: options.lastUsedAt || "", useCount: number(options.useCount) }
  }

  function detectImportTemplate(templates, headers, client = "") {
    const normalized = new Set((headers || []).map(normalizeHeader))
    return (templates || []).map((template) => {
      const values = Object.entries(template.mapping || {}).filter(([, value]) => value)
      const hits = values.filter(([, value]) => normalized.has(normalizeHeader(value))).length
      const clientBoost = client && normalizeHeader(template.client) && normalizeHeader(template.client) === normalizeHeader(client) ? 0.2 : 0
      return { template, score: values.length ? Math.min(1, hits / values.length + clientBoost) : 0, matched: hits, total: values.length }
    }).sort((a, b) => b.score - a.score)[0] || null
  }

  function defaultRateAssemblies() {
    return [
      { id: "assembly-chw-pipe", name: "CHW Pipe — standard build-up", discipline: "HVAC", unit: "m", components: [{ type: "material", label: "Pipe", search: "pipe", factor: 1 }, { type: "material", label: "Fittings", search: "fit", factor: 0.08 }, { type: "material", label: "Supports", search: "support", factor: 0.04 }, { type: "material", label: "Insulation", search: "insul", factor: 1 }, { type: "labor", label: "Installation labor", search: "pipe", factor: 0.35 }, { type: "equipment", label: "Testing equipment", search: "test", factor: 0.02 }] },
      { id: "assembly-ppr-pipe", name: "PPR Pipe — water supply", discipline: "Plumbing", unit: "m", components: [{ type: "material", label: "PPR pipe", search: "ppr", factor: 1.05 }, { type: "material", label: "Fittings & joints", search: "ppr fit", factor: 0.12 }, { type: "material", label: "Supports", search: "support", factor: 0.04 }, { type: "labor", label: "Fusion / installation labor", search: "pipe", factor: 0.35 }, { type: "equipment", label: "Pressure testing", search: "test", factor: 0.02 }] },
      { id: "assembly-fire-pipe", name: "Fire Fighting Pipe — sprinkler", discipline: "Fire Fighting", unit: "m", components: [{ type: "material", label: "Fire pipe", search: "fire pipe", factor: 1 }, { type: "material", label: "Grooved fittings", search: "groov fit", factor: 0.1 }, { type: "material", label: "Supports / hangers", search: "support", factor: 0.06 }, { type: "material", label: "Primer / painting", search: "paint", factor: 0.03 }, { type: "labor", label: "Installation labor", search: "fire", factor: 0.42 }, { type: "equipment", label: "Hydrostatic testing", search: "test", factor: 0.03 }] },
      { id: "assembly-duct", name: "Ductwork — standard build-up", discipline: "HVAC", unit: "m²", components: [{ type: "material", label: "GI sheet", search: "duct", factor: 7.5 }, { type: "material", label: "Flanges & cleats", search: "flange", factor: 0.12 }, { type: "material", label: "Supports", search: "support", factor: 0.08 }, { type: "material", label: "Insulation", search: "insul", factor: 1 }, { type: "labor", label: "Fabrication labor", search: "duct", factor: 0.3 }, { type: "labor", label: "Installation labor", search: "duct", factor: 0.35 }, { type: "equipment", label: "Leakage testing", search: "test", factor: 0.02 }] },
      { id: "assembly-insulation", name: "Insulation — pipe / duct", discipline: "HVAC", unit: "m²", components: [{ type: "material", label: "Insulation", search: "insul", factor: 1 }, { type: "material", label: "Adhesive & accessories", search: "adhes", factor: 0.08 }, { type: "labor", label: "Insulation labor", search: "insul", factor: 0.22 }, { type: "equipment", label: "Inspection / testing", search: "test", factor: 0.01 }] },
      { id: "assembly-valves", name: "Valves — MEP valve set", discipline: "General", unit: "nr", components: [{ type: "material", label: "Valve", search: "valve", factor: 1 }, { type: "material", label: "Flanges / gaskets", search: "gasket", factor: 0.15 }, { type: "labor", label: "Installation labor", search: "valve", factor: 0.25 }, { type: "equipment", label: "Testing", search: "test", factor: 0.02 }] },
      { id: "assembly-pumps", name: "Pumps — supply and install", discipline: "Plumbing", unit: "nr", components: [{ type: "material", label: "Pump package", search: "pump", factor: 1 }, { type: "material", label: "Base / accessories", search: "pump acc", factor: 0.08 }, { type: "labor", label: "Mechanical installation", search: "pump", factor: 0.35 }, { type: "equipment", label: "Lifting / testing", search: "test", factor: 0.04 }] },
      { id: "assembly-ahu-fcu", name: "AHU / FCU — equipment set", discipline: "HVAC", unit: "nr", components: [{ type: "material", label: "AHU / FCU unit", search: "ahu", factor: 1 }, { type: "material", label: "Controls and accessories", search: "control", factor: 0.12 }, { type: "labor", label: "Installation and connection", search: "ahu", factor: 0.3 }, { type: "equipment", label: "Testing and commissioning", search: "test", factor: 0.05 }] },
      { id: "assembly-sanitary-fixtures", name: "Sanitary Fixtures — complete set", discipline: "Plumbing", unit: "nr", components: [{ type: "material", label: "Sanitary fixture", search: "sanitary", factor: 1 }, { type: "material", label: "Trim / accessories", search: "fixture acc", factor: 0.1 }, { type: "labor", label: "Installation labor", search: "sanitary", factor: 0.3 }, { type: "equipment", label: "Testing", search: "test", factor: 0.01 }] },
    ]
  }

  function materialAge(value, now = new Date()) {
    const date = new Date(value || 0)
    const ageDays = Number.isFinite(date.getTime()) ? Math.max(0, daysBetween(now, date)) : Infinity
    return { ageDays, stale: !Number.isFinite(ageDays) || ageDays > 180, date: Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "" }
  }

  function quoteValidity(quote, now = new Date()) {
    const issued = new Date(quote?.date || 0)
    const validityDays = Math.max(0, number(quote?.validityDays || quote?.validity || 0))
    const explicit = quote?.validUntil ? new Date(quote.validUntil) : null
    const expiry = explicit && Number.isFinite(explicit.getTime()) ? explicit : (validityDays && Number.isFinite(issued.getTime()) ? new Date(issued.getTime() + validityDays * 86400000) : null)
    const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - new Date(now).getTime()) / 86400000) : null
    return { issued: Number.isFinite(issued.getTime()) ? issued.toISOString().slice(0, 10) : "", validityDays, expiry: expiry ? expiry.toISOString().slice(0, 10) : "", daysToExpiry, expired: daysToExpiry != null && daysToExpiry < 0, expiringSoon: daysToExpiry != null && daysToExpiry >= 0 && daysToExpiry <= 7, ageDays: Number.isFinite(issued.getTime()) ? Math.max(0, daysBetween(now, issued)) : Infinity }
  }

  function evaluateQuoteLine(quote, line, target, project = {}) {
    const rawUnit = number(line?.unitPrice)
    const quantity = Math.max(0, number(target?.quantity || 1))
    const discountPercent = line?.discountPercent == null ? number(quote?.discountPercent) : number(line.discountPercent)
    const freightUnit = line?.freightUnit == null ? number(quote?.freightUnit) : number(line.freightUnit)
    const otherUnit = line?.otherAdjustmentUnit == null ? number(quote?.otherAdjustmentUnit) : number(line.otherAdjustmentUnit)
    const riskPercent = line?.riskPercent == null ? number(quote?.riskPercent) : number(line.riskPercent)
    const netUnit = Math.max(0, rawUnit * (1 - discountPercent / 100) + freightUnit + otherUnit)
    const riskUnit = netUnit * riskPercent / 100
    const evaluatedUnit = netUnit + riskUnit
    const vatPercent = line?.vat == null ? number(quote?.vat ?? project?.tax) : number(line.vat)
    const vatIncluded = Boolean(line?.vatIncluded ?? quote?.vatIncluded)
    const vatUnit = vatIncluded ? 0 : evaluatedUnit * vatPercent / 100
    return { rawUnit: round(rawUnit, 4), netUnit: round(netUnit, 4), riskUnit: round(riskUnit, 4), evaluatedUnit: round(evaluatedUnit, 4), quantity, rawTotal: round(rawUnit * quantity, 2), evaluatedTotal: round(evaluatedUnit * quantity, 2), vatUnit: round(vatUnit, 4), grandUnit: round(evaluatedUnit + vatUnit, 4), grandTotal: round((evaluatedUnit + vatUnit) * quantity, 2), discountPercent, freightUnit, otherUnit, riskPercent, vatPercent, vatIncluded, compliant: line?.compliant !== false, validity: quoteValidity(quote) }
  }

  function levelQuoteOffers(project, target, options = {}) {
    const quotes = (project?.quotes || []).map((quote) => {
      const line = (quote.items || []).find((entry) => entry.targetType === target.targetType && entry.targetId === target.targetId)
      if (!line) return null
      const evaluation = evaluateQuoteLine(quote, line, target, project)
      return { quoteId: quote.id, supplierId: quote.supplierId, reference: quote.reference || "", line, ...evaluation }
    }).filter(Boolean)
    const eligible = quotes.filter((entry) => entry.compliant && entry.evaluatedUnit > 0 && !entry.validity.expired)
    const lowestRaw = quotes.filter((entry) => entry.rawUnit > 0).slice().sort((a, b) => a.rawUnit - b.rawUnit)[0] || null
    const lowestCompliant = eligible.slice().sort((a, b) => a.rawUnit - b.rawUnit)[0] || null
    const bestEvaluated = eligible.slice().sort((a, b) => a.evaluatedUnit - b.evaluatedUnit)[0] || null
    return { offers: quotes, eligible, lowestRaw, lowestCompliant, bestEvaluated, target }
  }

  function revisionImpact(beforeProject, afterProject, resources = []) {
    const before = new Map((beforeProject?.boq || []).map((item) => [normalizeHeader(item.itemNo || item.id), item]))
    const after = new Map((afterProject?.boq || []).map((item) => [normalizeHeader(item.itemNo || item.id), item]))
    const added = [], deleted = [], changed = []
    after.forEach((item, key) => { if (!before.has(key)) added.push({ item, cost: effectiveQuantity(item) * itemCostUnit(afterProject, item, resources) }) })
    before.forEach((item, key) => { if (!after.has(key)) deleted.push({ item, cost: effectiveQuantity(item) * itemCostUnit(beforeProject, item, resources) }) })
    after.forEach((item, key) => {
      const old = before.get(key)
      if (!old) return
      const fields = ["description", "unit", "quantity", "section", "system", "floor"]
      const differences = fields.filter((field) => String(old[field] ?? "") !== String(item[field] ?? "")).map((field) => ({ field, before: old[field], after: item[field] }))
      const beforeCost = effectiveQuantity(old) * itemCostUnit(beforeProject, old, resources)
      const afterCost = effectiveQuantity(item) * itemCostUnit(afterProject, item, resources)
      if (differences.length || beforeCost !== afterCost) changed.push({ before: old, after: item, differences, beforeCost, afterCost, delta: afterCost - beforeCost })
    })
    const beforeCost = [...before.values()].reduce((sum, item) => sum + effectiveQuantity(item) * itemCostUnit(beforeProject, item, resources), 0)
    const afterCost = [...after.values()].reduce((sum, item) => sum + effectiveQuantity(item) * itemCostUnit(afterProject, item, resources), 0)
    const changedIds = new Set([...added.map((entry) => entry.item.id), ...deleted.map((entry) => entry.item.id), ...changed.map((entry) => entry.after.id)])
    const rfqUpdates = (afterProject?.rfqs || []).filter((rfq) => (rfq.targetIds || []).some((targetId) => changedIds.has(targetId))).map((rfq) => ({ id: rfq.id, title: rfq.title || rfq.id, status: rfq.status || "draft", targetIds: (rfq.targetIds || []).filter((targetId) => changedIds.has(targetId)) }))
    return { added, deleted, changed, rfqUpdates, beforeCost: round(beforeCost, 2), afterCost: round(afterCost, 2), delta: round(afterCost - beforeCost, 2), counts: { added: added.length, deleted: deleted.length, changed: changed.length } }
  }

  // Compare a raw imported BOQ array with another array or project snapshot.
  // Keeping this as a small wrapper makes the same analyzer usable by the
  // Import Wizard before the new rows are committed to the project.
  function compareBoqRows(before, after, resources = []) {
    const toProject = (value) => Array.isArray(value) ? { boq: value, analyses: {}, quotes: [], rfqs: [] } : (value || { boq: [], analyses: {}, quotes: [], rfqs: [] })
    const beforeProject = toProject(before)
    let afterProject = toProject(after)
    // When the Import Wizard supplies a raw array, carry the old analysis and
    // quote links onto matching item numbers so the cost delta is meaningful.
    if (Array.isArray(after) && !Array.isArray(before)) {
      const previous = new Map((beforeProject.boq || []).map((item) => [normalizeHeader(item.itemNo || item.id), item]))
      const mapped = after.map((item) => {
        const old = previous.get(normalizeHeader(item.itemNo || item.id))
        return old ? { ...deepClone(item), id: old.id } : deepClone(item)
      })
      afterProject = { ...deepClone(beforeProject), boq: mapped }
    }
    return revisionImpact(beforeProject, afterProject, resources)
  }

  function duplicateBoqItems(project) {
    const seen = new Map(), duplicates = []
    ;(project?.boq || []).forEach((item) => {
      const key = normalizeHeader(item.itemNo || item.description)
      if (!key) return
      if (seen.has(key)) duplicates.push({ item, duplicateOf: seen.get(key) })
      else seen.set(key, item)
    })
    return duplicates
  }

  function resourceMap(resources) {
    return Object.fromEntries((resources || []).map((resource) => [resource.id, resource]))
  }

  function resourceSnapshot(resource, context = {}) {
    if (!resource) return null
    return {
      rate: number(resource.rate),
      capturedAt: context.capturedAt || new Date().toISOString(),
      source: context.source || resource.sourceProject || "Resource Library",
      supplierId: context.supplierId || resource.supplierId || null,
      region: resource.region || "",
      resourceUpdatedAt: resource.updatedAt || "",
      approvedBy: context.approvedBy || "",
    }
  }

  function captureAnalysisSnapshots(analysis, resources, context = {}) {
    const map = resourceMap(resources)
    ;(analysis?.lines || []).forEach((line) => {
      if (!line.rateSnapshot && map[line.resourceId]) line.rateSnapshot = resourceSnapshot(map[line.resourceId], context)
    })
    return analysis
  }

  function snapshotDrift(line, resources) {
    const resource = (resources || []).find((entry) => entry.id === line?.resourceId)
    const current = number(resource?.rate)
    const projectRate = number(line?.rateSnapshot?.rate ?? current)
    return { resource, projectRate, latestRate: current, difference: round(current - projectRate, 4), changed: Boolean(resource) && current !== projectRate }
  }

  function defaultExtras() {
    return {
      wastePercent: 0,
      transport: 0,
      accessories: 0,
      prelimPercent: 0,
      escalationPercent: 0,
      riskPercent: 0,
      overheadPercent: 0,
      profitPercent: 0,
      discountPercent: 0,
      vatPercent: 0,
    }
  }

  function calculateAnalysis(analysis, resources) {
    const map = resourceMap(resources)
    const components = { material: 0, labor: 0, equipment: 0, subcontractor: 0 }
    for (const line of analysis?.lines || []) {
      const resource = map[line.resourceId]
      if (!resource) continue
      const type = RESOURCE_TYPES.includes(resource.type) ? resource.type : "material"
      const projectRate = line.rateSnapshot ? number(line.rateSnapshot.rate) : number(resource.rate)
      components[type] += projectRate * number(line.factor)
    }
    Object.keys(components).forEach((key) => { components[key] = round(components[key]) })
    const extras = { ...defaultExtras(), ...(analysis?.extras || {}) }
    const base = Object.values(components).reduce((sum, value) => sum + value, 0)
    const waste = components.material * number(extras.wastePercent) / 100
    const transport = number(extras.transport)
    const accessories = number(extras.accessories)
    const beforePrelim = base + waste + transport + accessories
    const preliminaries = beforePrelim * number(extras.prelimPercent) / 100
    const beforeEscalation = beforePrelim + preliminaries
    const escalation = beforeEscalation * number(extras.escalationPercent) / 100
    const beforeRisk = beforeEscalation + escalation
    const risk = beforeRisk * number(extras.riskPercent) / 100
    const beforeOverhead = beforeRisk + risk
    const overhead = beforeOverhead * number(extras.overheadPercent) / 100
    const costUnit = beforeOverhead + overhead
    const profit = costUnit * number(extras.profitPercent) / 100
    const grossSelling = costUnit + profit
    const discount = grossSelling * number(extras.discountPercent) / 100
    const sellingBeforeVat = grossSelling - discount
    const vat = sellingBeforeVat * number(extras.vatPercent) / 100
    return {
      components,
      base: round(base),
      waste: round(waste),
      transport: round(transport),
      accessories: round(accessories),
      preliminaries: round(preliminaries),
      escalation: round(escalation),
      risk: round(risk),
      overhead: round(overhead),
      costUnit: round(costUnit),
      profit: round(profit),
      discount: round(discount),
      sellingBeforeVat: round(sellingBeforeVat),
      vat: round(vat),
      sellingWithVat: round(sellingBeforeVat + vat),
    }
  }

  function quoteUnitRate(project, item) {
    const quote = (project.quotes || []).find((entry) => entry.id === item.selectedQuoteId)
    if (!quote) return 0
    return number((quote.items || []).find((entry) => entry.targetType === "boq" && entry.targetId === item.id)?.unitPrice)
  }

  function itemCostUnit(project, item, resources) {
    if (item.pricingMethod === "manual") return number(item.manualRate)
    if (item.pricingMethod === "supplier") return quoteUnitRate(project, item) || number(item.manualRate)
    return calculateAnalysis((project.analyses || {})[item.id], resources).costUnit || number(item.manualRate)
  }

  function calculateProject(project, resources, scenario) {
    const selected = scenario || (project.scenarios || [])[0] || {}
    const direct = (project.boq || []).reduce((sum, item) => sum + effectiveQuantity(item) * itemCostUnit(project, item, resources), 0)
    const indirect = direct * number(selected.indirectPercent) / 100
    const contingency = (direct + indirect) * number(selected.contingencyPercent) / 100
    const escalation = (direct + indirect) * number(selected.escalationPercent) / 100
    const totalCost = direct + indirect + contingency + escalation
    const profitPercent = Math.max(0, number(selected.profitPercent))
    const profitBasis = selected.profitBasis === "margin" ? "margin" : "cost"
    const profit = profitBasis === "margin"
      ? totalCost * Math.min(profitPercent, 99.99) / (100 - Math.min(profitPercent, 99.99))
      : totalCost * profitPercent / 100
    const gross = totalCost + profit
    const discount = gross * number(selected.discountPercent) / 100
    const beforeRounding = gross - discount + number(selected.managementAdjustment)
    const beforeVat = roundToStep(beforeRounding, selected.roundingStep, selected.roundingMode)
    const roundingAdjustment = beforeVat - beforeRounding
    const vatPercent = selected.vatPercent == null ? number(project.tax) : number(selected.vatPercent)
    const vat = beforeVat * vatPercent / 100
    const total = beforeVat + vat
    return {
      direct: round(direct, 2),
      indirect: round(indirect, 2),
      contingency: round(contingency, 2),
      escalation: round(escalation, 2),
      totalCost: round(totalCost, 2),
      profit: round(profit, 2),
      discount: round(discount, 2),
      managementAdjustment: round(selected.managementAdjustment, 2),
      beforeRounding: round(beforeRounding, 2),
      roundingAdjustment: round(roundingAdjustment, 2),
      beforeVat: round(beforeVat, 2),
      vat: round(vat, 2),
      total: round(total, 2),
      trueMargin: beforeVat ? round(profit / beforeVat * 100, 2) : 0,
      sellingFactor: direct ? round(beforeVat / direct, 6) : 0,
      profitBasis,
      vatPercent,
    }
  }

  function projectCostBreakdown(project, resources, groupBy = "system") {
    const rows = new Map()
    ;(project?.boq || []).forEach((item) => {
      const key = String(item?.[groupBy] || item?.section || "Unclassified")
      const quantity = effectiveQuantity(item)
      const rate = itemCostUnit(project, item, resources)
      const total = quantity * rate
      const current = rows.get(key) || { key, items: 0, priced: 0, quantity: 0, direct: 0 }
      current.items += 1
      if (rate > 0) current.priced += 1
      current.quantity += quantity
      current.direct += total
      rows.set(key, current)
    })
    const grand = [...rows.values()].reduce((sum, row) => sum + row.direct, 0)
    return [...rows.values()].map((row) => ({
      ...row,
      quantity: round(row.quantity, 3),
      direct: round(row.direct, 2),
      sharePercent: grand ? round(row.direct / grand * 100, 2) : 0,
      progress: row.items ? round(row.priced / row.items * 100, 1) : 0,
    })).sort((a, b) => b.direct - a.direct)
  }

  function cloneAnalysis(analysis, options = {}) {
    const copied = deepClone(analysis || { lines: [], extras: defaultExtras() })
    copied.lines = (copied.lines || []).map((line) => ({ ...line, id: id("line") }))
    copied.extras = { ...defaultExtras(), ...(copied.extras || {}) }
    copied.copiedFromItemId = options.sourceItemId || ""
    copied.copiedAt = options.copiedAt || new Date().toISOString()
    copied.copiedBy = options.copiedBy || ""
    return copied
  }

  function projectHealth(project, resources) {
    const items = project?.boq || []
    const unpriced = items.filter((item) => itemCostUnit(project, item, resources) <= 0)
    const pricedCount = items.length - unpriced.length
    const progress = items.length ? Math.round(pricedCount / items.length * 100) : 0
    const pendingRfqs = (project?.rfqs || []).filter((rfq) => !["received", "closed"].includes(rfq.status)).length
    return { totalItems: items.length, pricedCount, unpriced, progress, pendingRfqs }
  }

  function pricingQuality(project, resources, scenario = null, options = {}) {
    const findings = []
    const items = project?.boq || []
    const waivers = project?.qualityWaivers || []
    const now = options.now || new Date()
    const minimumMargin = options.minimumMargin == null ? 3 : Math.max(0, number(options.minimumMargin))
    const historicalTolerance = options.historicalTolerance == null ? 0.35 : Math.max(0, number(options.historicalTolerance))
    const add = (code, severity, title, detail, itemId = "") => {
      const waived = waivers.some((waiver) => waiver.code === code && (!itemId || waiver.itemId === itemId) && waiver.status === "approved")
      findings.push({ id: id("quality"), code, severity, title, detail, itemId, waived, status: waived ? "waived" : "open" })
    }
    items.forEach((item) => {
      const rate = itemCostUnit(project, item, resources)
      if (number(item.quantity) <= 0) add("ZERO_QUANTITY", "blocker", `${item.itemNo} has zero quantity`, "Quantity must be greater than zero before submission.", item.id)
      if (rate <= 0) add("UNPRICED_ITEM", "blocker", `${item.itemNo} is unpriced`, "Assign a valid rate analysis, supplier quote or manual rate.", item.id)
      if (item.pricingMethod === "analysis" && !(project.analyses?.[item.id]?.lines || []).length) add("MISSING_ANALYSIS", "high", `${item.itemNo} has no rate analysis`, "Create or copy a unit-rate build-up.", item.id)
      if (item.quantityBasis === "takeoff" && number(item.takeoffQuantity) <= 0) add("TAKEOFF_MISSING", "high", `${item.itemNo} uses takeoff without quantity`, "Select a valid takeoff quantity or return to BOQ quantity.", item.id)
      const analysis = project.analyses?.[item.id]
      ;(analysis?.lines || []).forEach((line) => {
        if (!resources.some((resource) => resource.id === line.resourceId)) add("MISSING_RESOURCE", "blocker", `${item.itemNo} references a missing resource`, "Restore the resource or replace the analysis line.", item.id)
        if (rate > 0 && !line.rateSnapshot?.source && !line.source) add("MISSING_PRICE_SOURCE", "high", `${item.itemNo} has a rate without source`, "Capture the supplier, project or library source before approval.", item.id)
      })
      const selectedQuote = item.selectedQuoteId ? (project.quotes || []).find((quote) => quote.id === item.selectedQuoteId) : null
      const selectedLine = selectedQuote?.items?.find((line) => line.targetType === "boq" && line.targetId === item.id)
      if (rate > 0 && item.pricingMethod === "manual" && !item.source && !item.priceSource && !/(source|عرض|مورد|historical|manual)/i.test(String(item.notes || ""))) add("MISSING_PRICE_SOURCE", "high", `${item.itemNo} has no price source`, "Add a quotation, historical reference or approved manual-rate note.", item.id)
      if (selectedLine?.unit && normalizeUnit(selectedLine.unit) !== normalizeUnit(item.unit)) add("UNIT_MISMATCH", "high", `${item.itemNo} has a supplier unit mismatch`, `BOQ unit is ${item.unit}; selected quotation uses ${selectedLine.unit}.`, item.id)
      if (item.linkedRfqId) {
        const rfq = (project.rfqs || []).find((entry) => entry.id === item.linkedRfqId)
        const hasQuote = (project.quotes || []).some((quote) => (quote.items || []).some((line) => line.targetType === "boq" && line.targetId === item.id))
        if (rfq && !["received", "closed"].includes(rfq.status) && !hasQuote) add("RFQ_FOLLOW_UP", "medium", `${item.itemNo} is waiting for an RFQ response`, `Follow up ${rfq.title || rfq.id} before freezing the tender.`, item.id)
      }
      if (options.state && rate > 0 && options.checkHistorical !== false) {
        const match = findHistoricalMatches(options.state, item, { projectId: project.id, limit: 1, minimumScore: options.historicalMinimumScore == null ? 0.75 : options.historicalMinimumScore })[0]
        if (match?.rate > 0 && Math.abs(rate - match.rate) / match.rate > historicalTolerance) add("HISTORICAL_OUTLIER", "medium", `${item.itemNo} differs from historical pricing`, `Current ${round(rate, 2)} vs ${round(match.rate, 2)} in ${match.projectName} (${match.score}% match).`, item.id)
      }
    })
    duplicateBoqItems(project).forEach(({ item }) => add("DUPLICATE_ITEM", "high", `${item.itemNo} is duplicated`, "Merge or explicitly keep the duplicate before submission.", item.id))
    ;(project?.quotes || []).forEach((quote) => {
      const validity = quoteValidity(quote, now)
      if (validity.expired) add("EXPIRED_QUOTE", "high", `${quote.reference || "Quotation"} has expired`, `Quotation expired ${Math.abs(validity.daysToExpiry)} day(s) ago.`)
      else if (validity.expiringSoon) add("EXPIRING_QUOTE", "medium", `${quote.reference || "Quotation"} expires soon`, `${validity.daysToExpiry} day(s) remaining.`)
    })
    ;(resources || []).forEach((resource) => { const age = materialAge(resource.updatedAt, now); if (age.stale) add("STALE_RATE", "medium", `${resource.code} rate is aging`, `Last updated ${age.date || "unknown"}; review the library snapshot.`) })
    ;(project?.scopeMatrix || []).forEach((row) => {
      const status = scopeStatus(row)
      if (!['complete', 'not_applicable'].includes(status)) add("SCOPE_GAP", "high", `${row.system || "System"} scope is not closed`, `Scope status is ${status}; reconcile BOQ, drawings and specifications before submission.`)
    })
    if (scenario && !scenario.locked) add("SCENARIO_NOT_LOCKED", "high", "Selected scenario is not approved", "Lock and approve the final pricing scenario before submission.")
    if (scenario) {
      const totals = calculateProject(project, resources, scenario)
      if (totals.beforeVat > 0 && totals.trueMargin < minimumMargin) add("LOW_MARGIN", "high", "True margin is below the minimum", `Current margin ${totals.trueMargin}% is below the ${minimumMargin}% minimum.`)
    }
    if (number(project?.tax) < 0 || number(project?.tax) > 100) add("INVALID_VAT", "high", "VAT percentage is invalid", "Use a VAT value between 0 and 100.")
    const active = findings.filter((finding) => !finding.waived)
    const weight = active.reduce((sum, finding) => sum + (QUALITY_WEIGHTS[finding.severity] || 1), 0)
    const maxWeight = Math.max(1, items.length * QUALITY_WEIGHTS.blocker + (project?.quotes || []).length * QUALITY_WEIGHTS.high)
    const score = Math.max(0, Math.min(100, Math.round(100 - weight / maxWeight * 100)))
    const blockers = active.filter((finding) => finding.severity === "blocker")
    return { score, findings, blockers, canSubmit: blockers.length === 0 && active.every((finding) => finding.severity !== "high"), counts: { blocker: active.filter((f) => f.severity === "blocker").length, high: active.filter((f) => f.severity === "high").length, medium: active.filter((f) => f.severity === "medium").length, low: active.filter((f) => f.severity === "low").length, waived: findings.filter((f) => f.waived).length } }
  }

  function tenderReviewGate(project, stateOrResources, scenario = null, options = {}) {
    const state = stateOrResources?.resources ? stateOrResources : { resources: stateOrResources || [] }
    const resources = state.resources || []
    const selected = scenario || (project?.scenarios || [])[0] || null
    const health = projectHealth(project, resources)
    const quality = options.quality || pricingQuality(project, resources, selected, { ...options, state: options.state || (stateOrResources?.resources ? stateOrResources : null) })
    const selectedQuotes = (project?.boq || []).filter((item) => item.pricingMethod === "supplier" && item.selectedQuoteId).map((item) => {
      const quote = (project.quotes || []).find((entry) => entry.id === item.selectedQuoteId)
      const line = quote?.items?.find((entry) => entry.targetType === "boq" && entry.targetId === item.id)
      return { item, quote, line, validity: quote ? quoteValidity(quote, options.now || new Date()) : null }
    })
    const quotesValid = selectedQuotes.every((entry) => entry.quote && entry.line && entry.validity && !entry.validity.expired)
    const openRisks = (project?.risks || []).filter((risk) => !["closed", "approved"].includes(String(risk.status || "").toLowerCase()) && !risk.approvedAt)
    const scopeComplete = (project?.scopeMatrix || []).every((row) => ["complete", "not_applicable"].includes(scopeStatus(row)))
    const items = [
      { code: "TENDER_REVIEW", label: "Tender Review مكتمل", detail: project?.tenderReview?.completedAt ? `اعتمده ${project.tenderReview.completedBy || "المراجع"}` : "راجع المستندات والملخص والمصادر", complete: Boolean(project?.tenderReview?.completedAt), required: true },
      { code: "SCOPE_MATRIX", label: "Scope Matrix مكتملة", detail: scopeComplete ? "كل الأنظمة داخل النطاق مغلقة" : "توجد أنظمة بحالة Review أو Gap", complete: scopeComplete, required: true },
      { code: "ALL_PRICED", label: "جميع بنود BOQ مسعّرة", detail: `${health.pricedCount}/${health.totalItems} بند`, complete: health.unpriced.length === 0, required: true },
      { code: "QUOTES_VALID", label: "العروض المختارة سارية", detail: selectedQuotes.length ? `${selectedQuotes.filter((entry) => entry.validity && !entry.validity.expired).length}/${selectedQuotes.length} عرض` : "لا يوجد اختيار مورد يتطلب تحققًا", complete: quotesValid, required: true },
      { code: "RISKS_APPROVED", label: "المخاطر والاستفسارات معتمدة", detail: openRisks.length ? `${openRisks.length} عنصر مفتوح` : "لا توجد مخاطر مفتوحة", complete: openRisks.length === 0, required: true },
      { code: "MARKUP_APPROVED", label: "Markup والسيناريو معتمدان", detail: selected?.locked ? `Locked · ${selected.approvedBy || "Management"}` : "اقفل السيناريو بعد مراجعة الربح", complete: Boolean(selected?.locked), required: true },
      { code: "FINAL_REVISION", label: "Final Revision محفوظة", detail: project?.revisions?.length ? `آخر Revision R${project.revisionNo || 0}` : "احفظ Snapshot قبل التقديم", complete: (project?.revisions || []).length > 0, required: true },
    ]
    return { items, quality, health, selectedQuotes, openRisks, scopeComplete, quotesValid, canSubmit: quality.canSubmit && items.every((item) => !item.required || item.complete), completed: items.filter((item) => item.complete).length, total: items.length }
  }

  function tenderControl(project, state, scenario = null, options = {}) {
    const pricing = projectHealth(project, state?.resources || [])
    const tender = tenderHealth(project, state?.resources || [])
    const quality = pricingQuality(project, state?.resources || [], scenario, { ...options, state })
    const reviewGate = tenderReviewGate(project, state, scenario, { ...options, quality })
    const now = new Date(options.now || new Date())
    const deadline = project?.deadline ? new Date(`${project.deadline}T23:59:59`) : null
    const daysLeft = deadline && Number.isFinite(deadline.getTime()) ? Math.ceil((deadline.getTime() - now.getTime()) / 86400000) : null
    const overdueAssignments = (project?.assignments || []).filter((assignment) => assignment.dueDate && new Date(`${assignment.dueDate}T23:59:59`) < now && assignment.status !== "approved")
    const verified = (project?.tenderSummary || []).filter((field) => field.verified && field.value).length
    const review = project?.tenderReview?.completedAt ? 100 : Math.round(verified / Math.max((project?.tenderSummary || []).length, 1) * 100)
    const scope = (project?.scopeMatrix || []).length ? Math.round((project.scopeMatrix.filter((row) => ["complete", "not_applicable"].includes(scopeStatus(row))).length / project.scopeMatrix.length) * 100) : 100
    const readiness = Math.max(0, Math.min(100, Math.round(pricing.progress * 0.45 + review * 0.2 + scope * 0.15 + (quality.score || 0) * 0.2)))
    return { daysLeft, pricing, tender, quality, reviewGate, review, scope, readiness, overdueAssignments, currentRevision: number(project?.revisionNo), currentOffer: scenario ? calculateProject(project, state?.resources || [], scenario) : null, pendingQuotes: (project?.quotes || []).filter((quote) => !quoteValidity(quote, now).expired).length }
  }

  function applyWhatIf(project, resources, scenario, changes = {}) {
    const copy = deepClone(project)
    const resourceTypeFields = { material: "materialPercent", labor: "laborPercent", equipment: "equipmentPercent", subcontractor: "subcontractorPercent" }
    Object.values(copy.analyses || {}).forEach((analysis) => (analysis.lines || []).forEach((line) => {
      const resource = (resources || []).find((entry) => entry.id === line.resourceId)
      const field = resourceTypeFields[resource?.type]
      if (!field || !number(changes[field])) return
      line.rateSnapshot ||= resourceSnapshot(resource, { source: "What-If baseline" })
      line.rateSnapshot.rate = number(line.rateSnapshot.rate) * (1 + number(changes[field]) / 100)
    }))
    if (number(changes.supplierDiscountPercent)) {
      copy.quotes = (copy.quotes || []).map((quote) => ({ ...quote, items: (quote.items || []).map((line) => ({ ...line, unitPrice: number(line.unitPrice) * (1 - number(changes.supplierDiscountPercent) / 100) })) }))
    }
    const currencyFactor = number(changes.currencyFactor ?? changes.currencyRate ?? 1)
    if (currencyFactor > 0 && currencyFactor !== 1) {
      Object.values(copy.analyses || {}).forEach((analysis) => (analysis.lines || []).forEach((line) => {
        line.rateSnapshot ||= { rate: 0, capturedAt: new Date().toISOString(), source: "What-If currency baseline" }
        line.rateSnapshot.rate = number(line.rateSnapshot.rate) * currencyFactor
      }))
      ;(copy.boq || []).forEach((item) => { if (item.manualRate) item.manualRate = number(item.manualRate) * currencyFactor })
      copy.quotes = (copy.quotes || []).map((quote) => ({ ...quote, items: (quote.items || []).map((line) => ({ ...line, unitPrice: number(line.unitPrice) * currencyFactor, freightUnit: number(line.freightUnit) * currencyFactor })) }))
    }
    const alternateSelections = { ...(changes.alternateQuoteSelections || {}) }
    if (changes.alternateQuoteId) (copy.boq || []).forEach((item) => { alternateSelections[item.id] = changes.alternateQuoteId })
    if (changes.alternateSupplierId) {
      const supplierQuotes = (copy.quotes || []).filter((quote) => quote.supplierId === changes.alternateSupplierId).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      if (supplierQuotes[0]) (copy.boq || []).forEach((item) => { if (supplierQuotes[0].items?.some((line) => line.targetType === "boq" && line.targetId === item.id)) alternateSelections[item.id] = supplierQuotes[0].id })
    }
    Object.entries(alternateSelections).forEach(([itemId, quoteId]) => {
      const item = (copy.boq || []).find((entry) => entry.id === itemId)
      const quote = (copy.quotes || []).find((entry) => entry.id === quoteId)
      const line = quote?.items?.find((entry) => entry.targetType === "boq" && entry.targetId === itemId)
      if (item && quote && line && number(line.unitPrice) > 0) { item.pricingMethod = "supplier"; item.selectedQuoteId = quote.id; item.manualRate = number(line.unitPrice) }
    })
    const adjusted = { ...deepClone(scenario || {}), contingencyPercent: number(scenario?.contingencyPercent) + number(changes.contingencyPercent), profitPercent: changes.profitOverride == null ? number(scenario?.profitPercent) : number(changes.profitOverride), discountPercent: number(scenario?.discountPercent) }
    const totals = calculateProject(copy, resources, adjusted)
    return { changes: { ...changes }, scenario: adjusted, totals, project: copy }
  }

  function targetPriceOptimizer(project, resources, scenario, targetPrice) {
    const base = calculateProject(project, resources, scenario)
    const target = Math.max(0, number(targetPrice))
    const gap = round(base.beforeVat - target, 2)
    const impacts = (project?.boq || []).map((item) => {
      const quantity = effectiveQuantity(item)
      const rate = itemCostUnit(project, item, resources)
      const value = quantity * rate
      return { itemId: item.id, itemNo: item.itemNo, description: item.description, currentCost: round(value, 2), sharePercent: base.direct ? round(value / base.direct * 100, 2) : 0 }
    }).sort((a, b) => b.currentCost - a.currentCost)
    return { targetPrice: target, currentPrice: base.beforeVat, gap, reductionPercent: base.beforeVat ? round(Math.max(0, gap) / base.beforeVat * 100, 2) : 0, base, topImpactItems: impacts.slice(0, 10), achievable: target >= base.totalCost }
  }

  function freezeSubmission(project, state, scenarioId, options = {}) {
    const selected = (project?.scenarios || []).find((entry) => entry.id === scenarioId) || project?.scenarios?.[0]
    const quality = pricingQuality(project, state?.resources || [], selected, { ...options, state })
    const reviewGate = tenderReviewGate(project, state, selected, { ...options, quality })
    if (!selected) return { ok: false, reason: "SCENARIO_REQUIRED", quality }
    if (!selected.locked) return { ok: false, reason: "SCENARIO_NOT_LOCKED", quality }
    if (!quality.canSubmit && !options.allowWaived) return { ok: false, reason: "QUALITY_GATE_FAILED", quality }
    if (!reviewGate.canSubmit && !options.allowWaived) return { ok: false, reason: "TENDER_REVIEW_GATE_FAILED", quality, reviewGate }
    const snapshot = { id: id("submission"), label: options.label || `Final Submission · R${number(project.revisionNo)}`, createdAt: new Date().toISOString(), createdBy: options.user || state?.user?.name || "QESTIMA", revisionNo: number(project.revisionNo), scenarioId: selected.id, qualityScore: quality.score, project: projectSnapshot(project) }
    project.submissionSnapshots ||= []
    project.submissionSnapshots.unshift(snapshot)
    project.status = "submitted"
    project.submittedLockedAt = snapshot.createdAt
    project.submittedLockedBy = snapshot.createdBy
    return { ok: true, snapshot, quality, reviewGate }
  }

  function tenderHealth(project, resources) {
    const pricing = projectHealth(project, resources)
    const documents = project?.documents || []
    const scopeGaps = (project?.scopeMatrix || []).filter((row) => !["complete", "not_applicable"].includes(scopeStatus(row)))
    const openRisks = (project?.risks || []).filter((risk) => risk.status !== "closed")
    const missingCategories = ["boq", "drawings", "specifications", "scope", "commercial"].filter((category) => !documents.some((document) => document.category === category && document.status !== "superseded"))
    let key = "ready"
    if (!documents.length) key = "documents_missing"
    else if (!project?.tenderReview?.completedAt) key = "review_incomplete"
    else if (pricing.progress < 100) key = "pricing"
    return { key, pricing, scopeGaps, openRisks, missingCategories, documentCount: documents.length, reviewComplete: Boolean(project?.tenderReview?.completedAt) }
  }

  function resourceImpact(state, resourceId, projectId) {
    const projects = projectId ? (state.projects || []).filter((project) => project.id === projectId) : state.projects || []
    const impact = []
    projects.forEach((project) => {
      ;(project.boq || []).forEach((item) => {
        const lines = (project.analyses || {})[item.id]?.lines || []
        if (lines.some((line) => line.resourceId === resourceId)) {
          impact.push({ projectId: project.id, projectName: project.name, itemId: item.id, itemNo: item.itemNo, description: item.description })
        }
      })
    })
    return impact
  }

  function searchState(state, query, filters = {}) {
    const needle = normalizeHeader(query)
    const workspaceId = filters.workspaceId || state?.session?.workspaceId
    const user = activeUser(state)
    const projects = (state?.projects || []).filter((project) => {
      if (workspaceId && project.workspaceId !== workspaceId) return false
      if (project.access?.memberIds?.length && user && !project.access.memberIds.includes(user.id) && user.role !== "system_admin") return false
      if (filters.status && project.status !== filters.status) return false
      if (filters.location && project.location !== filters.location) return false
      if (filters.projectType && project.projectType !== filters.projectType) return false
      return true
    })
    const matches = []
    const includes = (value) => !needle || normalizeHeader(value).includes(needle)
    projects.forEach((project) => {
      if ([project.name, project.tenderCode, project.client, project.consultant, project.location, project.projectType].some(includes)) matches.push({ type: "project", projectId: project.id, title: `${project.tenderCode} — ${project.name}`, detail: `${project.client || ""} · ${project.location || ""}`, date: project.updatedAt })
      ;(project.boq || []).forEach((item) => { if ([item.itemNo, item.description, item.system, item.section, item.specificationSection].some(includes)) matches.push({ type: "boq", projectId: project.id, entityId: item.id, title: `${item.itemNo} — ${item.description}`, detail: `${project.name} · ${item.system} · ${item.unit}`, date: project.updatedAt }) })
      ;(project.documents || []).forEach((document) => { if ([document.documentNumber, document.title, document.originalName, document.category].some(includes)) matches.push({ type: "document", projectId: project.id, entityId: document.id, title: document.documentNumber || document.title, detail: `${project.name} · Rev ${document.revision} · ${document.status}`, date: document.receivedDate }) })
      ;(project.quotes || []).forEach((quote) => {
        const supplier = (state.suppliers || []).find((entry) => entry.id === quote.supplierId)
        if ([quote.reference, supplier?.name, quote.attachment?.name].some(includes)) matches.push({ type: "quotation", projectId: project.id, entityId: quote.id, title: `${supplier?.name || "Supplier"} — ${quote.reference || "Quotation"}`, detail: `${project.name} · ${quote.currency} · ${quote.date}`, date: quote.date })
      })
    })
    ;(state?.resources || []).forEach((resource) => { if ([resource.code, resource.name, resource.category, resource.region, resource.sourceProject].some(includes)) matches.push({ type: "resource", entityId: resource.id, title: `${resource.code} — ${resource.name}`, detail: `${resource.rate} · ${resource.region || ""} · ${resource.sourceProject || ""}`, date: resource.updatedAt }) })
    ;(state?.suppliers || []).forEach((supplier) => { if ([supplier.name, supplier.region, supplier.email].some(includes)) matches.push({ type: "supplier", entityId: supplier.id, title: supplier.name, detail: `${supplier.region || ""} · ${supplier.email || ""}`, date: "" }) })
    return matches.sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 250)
  }

  function staleResources(resources, days = 180, now = new Date()) {
    const threshold = now.getTime() - days * 86400000
    return (resources || []).filter((resource) => {
      const updated = new Date(resource.updatedAt || 0).getTime()
      return !updated || updated < threshold
    })
  }

  function projectSnapshot(project) {
    const snapshot = deepClone(project)
    snapshot.revisions = []
    snapshot.submissionSnapshots = []
    return snapshot
  }

  // Report Center data model. Reports are built from the same immutable
  // project/revision snapshots used by the pricing workflow so exports stay
  // auditable and permission-aware. The renderer can turn this serializable
  // object into HTML, PDF or a formatted workbook without reimplementing the
  // estimating rules.
  function buildReportPack(project, state, options = {}) {
    const current = project || {}
    const resources = state?.resources || []
    const scenario = (current.scenarios || []).find((entry) => entry.id === options.scenarioId) || current.scenarios?.[0] || {}
    const costPermission = can(state, "reports.view_cost", current) || can(state, "reports.view", current) || can(state, "markup.view", current)
    const markupPermission = can(state, "markup.view", current) || can(state, "reports.view", current)
    const showCost = options.showCost == null ? costPermission : Boolean(options.showCost && costPermission)
    const showMarkup = options.showMarkup == null ? markupPermission : Boolean(options.showMarkup && markupPermission)
    const totals = calculateProject(current, resources, scenario)
    const sourceForItem = (item) => {
      if (item?.pricingMethod === "supplier") {
        const quote = (current.quotes || []).find((entry) => entry.id === item.selectedQuoteId)
        return quote?.reference || quote?.source || "Supplier quotation"
      }
      if (item?.pricingMethod === "manual") return item.source || item.priceSource || "Manual / approved"
      const first = (current.analyses?.[item?.id]?.lines || [])[0]
      return first?.rateSnapshot?.source || first?.source || "Rate analysis"
    }
    const pricedBoq = (current.boq || []).map((item) => {
      const quantity = effectiveQuantity(item)
      const costRate = itemCostUnit(current, item, resources)
      const sellingRate = costRate * number(totals.sellingFactor)
      return {
        itemId: item.id,
        itemNo: item.itemNo || "",
        description: item.description || "",
        unit: item.unit || "",
        boqQuantity: number(item.quantity),
        pricingQuantity: quantity,
        quantityBasis: item.quantityBasis || "boq",
        section: item.section || "",
        system: item.system || "",
        floor: item.floor || item.floorZone || "",
        status: costRate > 0 ? "Priced" : "Unpriced",
        costUnitRate: showCost ? round(costRate, 4) : null,
        costTotal: showCost ? round(costRate * quantity, 2) : null,
        sellingUnitRate: showMarkup ? round(sellingRate, 4) : null,
        sellingTotal: showMarkup ? round(sellingRate * quantity, 2) : null,
        source: sourceForItem(item),
        sourceMeta: item.sources || {},
      }
    })
    const unpricedItems = pricedBoq.filter((row) => row.status === "Unpriced")
    const rateAnalysis = []
    const resourceBreakdownMap = new Map()
    ;(current.boq || []).forEach((item) => {
      const analysis = current.analyses?.[item.id] || { lines: [], extras: defaultExtras() }
      const result = calculateAnalysis(analysis, resources)
      rateAnalysis.push({
        itemId: item.id,
        itemNo: item.itemNo || "",
        description: item.description || "",
        unit: item.unit || "",
        components: showCost ? { ...result.components } : null,
        base: showCost ? result.base : null,
        waste: showCost ? result.waste : null,
        transport: showCost ? result.transport : null,
        accessories: showCost ? result.accessories : null,
        preliminaries: showCost ? result.preliminaries : null,
        escalation: showCost ? result.escalation : null,
        risk: showCost ? result.risk : null,
        overhead: showCost ? result.overhead : null,
        costUnit: showCost ? result.costUnit : null,
        profit: showMarkup ? result.profit : null,
        discount: showMarkup ? result.discount : null,
        sellingBeforeVat: showMarkup ? result.sellingBeforeVat : null,
        vat: showMarkup ? result.vat : null,
        sellingWithVat: showMarkup ? result.sellingWithVat : null,
        extras: deepClone(analysis.extras || defaultExtras()),
      })
      ;(analysis.lines || []).forEach((line) => {
        const resource = resources.find((entry) => entry.id === line.resourceId)
        if (!resource) return
        const snapshotRate = number(line.rateSnapshot?.rate ?? resource.rate)
        const key = resource.id || resource.code || resource.name
        const row = resourceBreakdownMap.get(key) || { resourceId: resource.id, code: resource.code || "", name: resource.name || "", type: resource.type || "material", unit: resource.unit || "", factor: 0, rate: snapshotRate, total: 0, source: line.rateSnapshot?.source || resource.sourceProject || "Resource Library" }
        row.factor += number(line.factor)
        row.total += snapshotRate * number(line.factor)
        row.rate = snapshotRate
        row.source = line.rateSnapshot?.source || row.source
        resourceBreakdownMap.set(key, row)
      })
    })
    const resourceBreakdown = [...resourceBreakdownMap.values()].map((row) => ({ ...row, factor: round(row.factor, 4), rate: showCost ? round(row.rate, 4) : null, total: showCost ? round(row.total, 2) : null })).sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.name).localeCompare(String(b.name)))
    const costSummary = [
      ["Direct Cost", totals.direct], ["Indirect Cost", totals.indirect], ["Contingency / Risk", totals.contingency], ["Escalation", totals.escalation], ["Total Cost", totals.totalCost],
      ["Profit", totals.profit], ["Discount", totals.discount], ["Selling Before VAT", totals.beforeVat], ["VAT", totals.vat], ["Grand Total", totals.total], ["True Margin %", totals.trueMargin],
    ].map(([label, value]) => ({ label, value: (label === "Profit" || label === "Discount" || label === "Selling Before VAT" || label === "VAT" || label === "Grand Total" || label === "True Margin %" ? showMarkup : showCost) ? value : null }))
    const targetRows = (current.boq || []).map((item) => ({ targetType: "boq", targetId: item.id, code: item.itemNo || "", name: item.description || "", unit: item.unit || "", quantity: effectiveQuantity(item) }))
    const supplierAdjudication = targetRows.map((target) => {
      const leveled = levelQuoteOffers(current, target)
      const clean = (entry) => entry ? {
        quoteId: entry.quoteId,
        supplierId: entry.supplierId,
        reference: entry.reference,
        rawUnit: showCost ? entry.rawUnit : null,
        evaluatedUnit: showCost ? entry.evaluatedUnit : null,
        grandUnit: showCost ? entry.grandUnit : null,
        grandTotal: showCost ? entry.grandTotal : null,
        compliant: entry.compliant,
        expired: entry.validity?.expired || false,
        delivery: entry.line?.delivery || current.quotes?.find((quote) => quote.id === entry.quoteId)?.delivery || "",
        payment: entry.line?.payment || current.quotes?.find((quote) => quote.id === entry.quoteId)?.payment || "",
        warranty: entry.line?.warranty || current.quotes?.find((quote) => quote.id === entry.quoteId)?.warranty || "",
        deviation: entry.line?.deviation || "",
      } : null
      return {
        ...target,
        offers: leveled.offers.map(clean).filter(Boolean),
        lowestRaw: clean(leveled.lowestRaw),
        lowestCompliant: clean(leveled.lowestCompliant),
        bestEvaluated: clean(leveled.bestEvaluated),
      }
    })
    const qualifications = uniqueStrings([...(current.clarifications || []), ...(current.risks || []).filter((risk) => risk.type === "clarification").map((risk) => risk.title)])
    const exclusions = uniqueStrings([...(current.exclusions || []), ...(current.risks || []).filter((risk) => risk.type === "exclusion").map((risk) => risk.title)])
    const scopeGaps = (current.scopeMatrix || []).filter((row) => !["complete", "not_applicable"].includes(scopeStatus(row))).map((row) => ({ system: row.system || "", status: scopeStatus(row), inScope: row.inScope || "", boqStatus: row.boqStatus || "", drawingsStatus: row.drawingsStatus || "", specsStatus: row.specsStatus || "", notes: row.notes || "" }))
    const lastRevision = (current.revisions || [])[0]
    const impact = lastRevision?.snapshot ? revisionImpact(lastRevision.snapshot, current, resources) : { added: [], deleted: [], changed: [], rfqUpdates: [], beforeCost: 0, afterCost: totals.direct, delta: totals.direct, counts: { added: current.boq?.length || 0, deleted: 0, changed: 0 } }
    const revisionImpactReport = {
      baseline: lastRevision ? lastRevision.label || `R${lastRevision.revisionNo || ""}` : "No saved baseline",
      counts: impact.counts,
      beforeCost: showCost ? impact.beforeCost : null,
      afterCost: showCost ? impact.afterCost : null,
      delta: showCost ? impact.delta : null,
      added: impact.added.map((entry) => ({ itemNo: entry.item?.itemNo || "", description: entry.item?.description || "", quantity: effectiveQuantity(entry.item), cost: showCost ? round(entry.cost, 2) : null })),
      deleted: impact.deleted.map((entry) => ({ itemNo: entry.item?.itemNo || "", description: entry.item?.description || "", quantity: effectiveQuantity(entry.item), cost: showCost ? round(entry.cost, 2) : null })),
      changed: impact.changed.map((entry) => ({ itemNo: entry.after?.itemNo || entry.before?.itemNo || "", differences: entry.differences, beforeCost: showCost ? round(entry.beforeCost, 2) : null, afterCost: showCost ? round(entry.afterCost, 2) : null, delta: showCost ? round(entry.delta, 2) : null })),
      rfqUpdates: impact.rfqUpdates,
    }
    const scenarioComparison = (current.scenarios || []).map((entry) => {
      const value = calculateProject(current, resources, entry)
      return { id: entry.id, name: entry.name, locked: Boolean(entry.locked), profitBasis: entry.profitBasis || "cost", totalCost: showCost ? value.totalCost : null, profit: showMarkup ? value.profit : null, trueMargin: showMarkup ? value.trueMargin : null, beforeVat: showMarkup ? value.beforeVat : null, grandTotal: showMarkup ? value.total : null }
    })
    const quality = pricingQuality(current, resources, scenario, { state })
    const gate = tenderReviewGate(current, state, scenario, { quality })
    const control = tenderControl(current, state, scenario, { quality })
    const auditTrail = [...(current.audit || []), ...(state?.auditLog || []).filter((entry) => !entry.projectId || entry.projectId === current.id)].sort((a, b) => String(b.date || b.timestamp || "").localeCompare(String(a.date || a.timestamp || ""))).slice(0, 250)
    const company = state?.companyProfile || state?.settings?.company || {}
    const documents = (current.documents || []).map((document) => ({ id: document.id, number: document.documentNumber || "", title: document.title || document.originalName || "", category: document.category || "", discipline: document.discipline || "", revision: document.revision || "", status: document.status || "", current: document.status !== "superseded", source: document.originalName || "" }))
    return {
      generatedAt: new Date().toISOString(),
      language: options.language || state?.settings?.language || "ar",
      permissions: { showCost, showMarkup, role: activeUser(state)?.role || "viewer" },
      brand: { name: company.name || "QESTIMA", tagline: company.tagline || "MEP Estimating System", address: company.address || "", phone: company.phone || "", email: company.email || "", taxNumber: company.taxNumber || "", logoDataUrl: company.logoDataUrl || "" },
      project: { id: current.id || "", code: current.tenderCode || "", name: current.name || "", client: current.client || "", consultant: current.consultant || "", mainContractor: current.mainContractor || "", location: current.location || "", deadline: current.deadline || "", currency: current.currency || "SAR", vat: number(current.tax), revisionNo: number(current.revisionNo), status: current.status || "" },
      scenario: { id: scenario.id || "", name: scenario.name || "", locked: Boolean(scenario.locked) },
      readiness: { score: control.readiness, pricingProgress: control.pricing.progress, reviewProgress: control.review, scopeProgress: control.scope, qualityScore: quality.score, daysLeft: control.daysLeft, unpricedCount: unpricedItems.length, pendingQuotes: control.pendingQuotes, missingDocuments: tenderHealth(current, resources).missingCategories.length },
      sections: {
        pricedBoq,
        unpricedItems,
        rateAnalysis,
        resourceBreakdown,
        costSummary,
        supplierAdjudication,
        qualificationsExclusions: { qualifications, exclusions },
        scopeGaps,
        revisionImpact: revisionImpactReport,
        scenarioComparison,
        managementSummary: { totals: showMarkup || showCost ? { direct: showCost ? totals.direct : null, totalCost: showCost ? totals.totalCost : null, beforeVat: showMarkup ? totals.beforeVat : null, grandTotal: showMarkup ? totals.total : null, profit: showMarkup ? totals.profit : null, trueMargin: showMarkup ? totals.trueMargin : null } : null, gate: { canSubmit: gate.canSubmit, completed: gate.completed, total: gate.total }, quality: { score: quality.score, blockers: quality.blockers.length, openFindings: quality.findings.filter((finding) => !finding.waived).length } },
        auditTrail,
        documentRegister: documents,
        tenderReview: { summary: deepClone(current.tenderSummary || []), completedAt: current.tenderReview?.completedAt || "", completedBy: current.tenderReview?.completedBy || "" },
      },
      submissionPack: {
        title: `Tender Submission Pack · ${current.tenderCode || current.name || "QESTIMA"}`,
        revision: number(current.revisionNo),
        includes: ["Management Summary", "Priced BOQ", "Supplier Adjudication", "Tender Qualifications & Exclusions", "Scope Gaps", "Revision Impact", "Audit Trail", "Formatted Excel Workbook", "PDF Report"],
        documents: documents.filter((document) => document.current),
        locked: Boolean(current.submittedLockedAt),
        generatedBy: activeUser(state)?.name || state?.user?.name || "QESTIMA",
      },
    }
  }

  function uniqueStrings(values) {
    return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))]
  }

  function scenario(idValue, name, profit, indirect = 7, contingency = 3) {
    return {
      id: idValue,
      name,
      indirectPercent: indirect,
      contingencyPercent: contingency,
      escalationPercent: 0,
      profitPercent: profit,
      profitBasis: "cost",
      discountPercent: 0,
      vatPercent: 15,
      managementAdjustment: 0,
      roundingStep: 0,
      roundingMode: "nearest",
      locked: false,
      approvedBy: "",
      approvedAt: "",
    }
  }

  function seedState() {
    const now = new Date().toISOString()
    const today = now.slice(0, 10)
    const resources = [
      { id: "r-ppr25", code: "MAT-PPR25", name: "ماسورة PPR قطر 25 مم", type: "material", category: "Plumbing", unit: "م.ط", rate: 16, supplierId: "sup-alpha", region: "الرياض", sourceProject: "مشروع تجريبي", updatedAt: now, history: [{ rate: 16, date: now, source: "سعر افتتاحي" }] },
      { id: "r-pprfit", code: "MAT-PPR-FIT", name: "وصلات وتعليقات PPR", type: "material", category: "Plumbing", unit: "مقطوعية/م", rate: 6, supplierId: "sup-alpha", region: "الرياض", sourceProject: "مشروع تجريبي", updatedAt: now, history: [{ rate: 6, date: now, source: "سعر افتتاحي" }] },
      { id: "r-pipelab", code: "LAB-PIPE", name: "فني مواسير", type: "labor", category: "Plumbing", unit: "ساعة", rate: 22, supplierId: null, region: "الرياض", sourceProject: "معدل داخلي", updatedAt: now, history: [{ rate: 22, date: now, source: "معدل داخلي" }] },
      { id: "r-duct", code: "MAT-GI-DUCT", name: "صاج مجلفن مصنع", type: "material", category: "HVAC", unit: "كجم", rate: 12.5, supplierId: "sup-gulf", region: "الرياض", sourceProject: "مشروع تجريبي", updatedAt: now, history: [{ rate: 12.5, date: now, source: "عرض مورد" }] },
      { id: "r-ductlab", code: "LAB-DUCT", name: "فني دكت", type: "labor", category: "HVAC", unit: "ساعة", rate: 24, supplierId: null, region: "الرياض", sourceProject: "معدل داخلي", updatedAt: now, history: [{ rate: 24, date: now, source: "معدل داخلي" }] },
      { id: "r-spr", code: "MAT-SPR", name: "رشاش حريق Upright مع الملحقات", type: "material", category: "Fire Fighting", unit: "عدد", rate: 48, supplierId: "sup-madar", region: "الرياض", sourceProject: "مشروع تجريبي", updatedAt: now, history: [{ rate: 48, date: now, source: "عرض مورد" }] },
      { id: "r-firelab", code: "LAB-FIRE", name: "فني مكافحة حريق", type: "labor", category: "Fire Fighting", unit: "ساعة", rate: 23, supplierId: null, region: "الرياض", sourceProject: "معدل داخلي", updatedAt: now, history: [{ rate: 23, date: now, source: "معدل داخلي" }] },
    ]
    const projectId = "project-demo"
    const state = {
      schemaVersion: 6,
      appVersion: "0.13.0",
      activeProjectId: projectId,
      activeScenarioId: "sc-competitive",
      user: { name: "عبدالرحمن كامل", initials: "AK" },
      session: { userId: "user-owner", workspaceId: "workspace-personal", tenantId: "tenant-personal", authenticated: true, signedInAt: now, sessionId: id("session"), deviceId: "", connectionState: "local", lastConnectionAt: now, syncCursor: "" },
      auth: {
        accounts: [{ id: "account-owner", userId: "user-owner", username: "admin", passwordHash: credentialDigest("Qestima@2026"), active: true, createdAt: now }],
        lastUsername: "",
        lastLoginAt: "",
        securityMode: "local_preview",
      },
      license: defaultLicense(now),
      users: [
        { id: "user-owner", name: "عبدالرحمن كامل", initials: "AK", email: "", role: "system_admin", active: true, tenantIds: ["tenant-personal", "tenant-company-pilot"], createdAt: now, lastConnectionAt: now, appVersion: "0.13.0" },
        { id: "user-estimator", name: "Ahmed Estimator", initials: "AE", email: "", role: "estimator", active: true, tenantIds: ["tenant-company-pilot"], createdAt: now, lastConnectionAt: "", appVersion: "" },
        { id: "user-procurement", name: "Procurement Engineer", initials: "PR", email: "", role: "procurement", active: true, tenantIds: ["tenant-company-pilot"], createdAt: now, lastConnectionAt: "", appVersion: "" },
        { id: "user-commercial", name: "Commercial Reviewer", initials: "CR", email: "", role: "commercial_reviewer", active: true, tenantIds: ["tenant-company-pilot"], createdAt: now, lastConnectionAt: "", appVersion: "" },
      ],
      workspaces: [
        { id: "workspace-personal", name: "Abdelrhman — Personal", type: "personal", tenantId: "tenant-personal", ownerUserId: "user-owner", storageMode: "local_encrypted_cache", syncStatus: "offline", members: [{ userId: "user-owner", role: "system_admin" }], createdAt: now },
        { id: "workspace-company", name: "QESTIMA Company Pilot", type: "company", tenantId: "tenant-company-pilot", ownerUserId: "user-owner", storageMode: "central_server", syncStatus: "server_not_connected", members: [{ userId: "user-owner", role: "system_admin" }, { userId: "user-estimator", role: "estimator" }, { userId: "user-procurement", role: "procurement" }, { userId: "user-commercial", role: "commercial_reviewer" }], createdAt: now },
      ],
      recycleBin: [],
      settings: { theme: "light", language: "ar", stalePriceDays: 180 },
      uiState: { activeView: "projects", activeRibbonTab: "home", activeContextTab: "", openTabs: ["projects"], activeItemId: "", activeDrawingId: "", drawingClosed: false, ribbonCollapsed: false, workspaceScroll: {}, ribbonHiddenCommands: [], ribbonLayout: {} },
      companyProfile: { name: "QESTIMA", tagline: "MEP Estimating System", address: "", phone: "", email: "", taxNumber: "", logoDataUrl: "" },
      importTemplates: [],
      rateAssemblies: defaultRateAssemblies(),
      auditLog: [],
      tenants: [
        { id: "tenant-personal", name: "Abdelrhman — Personal", slug: "abdelrhman-personal", type: "personal", status: "active", plan: "Preview", ownerUserId: "user-owner", maxUsers: 1, maxDevices: 1, storageMode: "local_encrypted_cache", region: "sa", apiBaseUrl: "", createdAt: now, updatedAt: now, lastConnectionAt: now, featureFlags: { centralSync: false, ownerPortal: false, ifcImport: true, revitBridge: false, dxfImport: true } },
        { id: "tenant-company-pilot", name: "QESTIMA Company Pilot", slug: "qestima-company-pilot", type: "company", status: "active", plan: "Pilot", ownerUserId: "user-owner", maxUsers: 10, maxDevices: 10, storageMode: "central_object_storage", region: "sa", apiBaseUrl: "", createdAt: now, updatedAt: now, lastConnectionAt: "", featureFlags: { centralSync: true, ownerPortal: true, ifcImport: true, revitBridge: false, dxfImport: true } },
      ],
      devices: [],
      supportAccess: [],
      syncQueue: [],
      syncConflicts: [],
      centralAudit: [],
      central: { apiBaseUrl: "", environment: "pilot", connectionState: "local", lastSyncAt: "", syncCursor: "", syncCursors: {}, publicKeyId: "", licensePublicKeyId: "", licenseToken: "", updateChannel: "stable" },
      updatePolicy: { channel: "stable", requireSignature: true, minimumVersion: "", lastCheckedAt: "", lastManifestVersion: "" },
      resources,
      suppliers: [
        { id: "sup-alpha", name: "مورد ألفا", contact: "", email: "", phone: "", region: "الرياض" },
        { id: "sup-gulf", name: "مورد الخليج", contact: "", email: "", phone: "", region: "الرياض" },
        { id: "sup-madar", name: "مؤسسة المدار", contact: "", email: "", phone: "", region: "الرياض" },
      ],
      projects: [{
        id: projectId,
        workspaceId: "workspace-personal",
        tenantId: "tenant-personal",
        tenderCode: `TND-${new Date().getFullYear()}-001`,
        name: "مشروع MEP تجريبي",
        client: "عميل تجريبي",
        consultant: "استشاري المشروع",
        mainContractor: "المقاول الرئيسي",
        location: "الرياض",
        tenderNumber: "TND-DEMO-01",
        deadline: "",
        currency: "SAR",
        tax: 15,
        pricingBaseDate: today,
        projectType: "Commercial",
        disciplines: ["HVAC", "Fire Fighting", "Plumbing"],
        workflowMode: "standard",
        status: "pricing",
        revisionNo: 0,
        createdAt: now,
        updatedAt: now,
        boq: [
          { id: "b1", itemNo: "PL-01", description: "توريد وتركيب مواسير PPR قطر 25 مم", unit: "م.ط", quantity: 180, section: "Plumbing", system: "Water Supply", floor: "عام", pricingMethod: "analysis", manualRate: 0, selectedQuoteId: null, notes: "" },
          { id: "b2", itemNo: "HV-01", description: "توريد وتركيب دكت صاج مجلفن شامل الإكسسوارات", unit: "م²", quantity: 320, section: "HVAC", system: "Ventilation", floor: "عام", pricingMethod: "analysis", manualRate: 0, selectedQuoteId: null, notes: "" },
          { id: "b3", itemNo: "FF-01", description: "توريد وتركيب رشاش حريق Upright كامل", unit: "عدد", quantity: 96, section: "Fire Fighting", system: "Sprinkler", floor: "عام", pricingMethod: "analysis", manualRate: 0, selectedQuoteId: null, notes: "" },
        ],
        analyses: {
          b1: { lines: [{ id: "l1", resourceId: "r-ppr25", factor: 1.05 }, { id: "l2", resourceId: "r-pprfit", factor: 1 }, { id: "l3", resourceId: "r-pipelab", factor: 0.35 }], extras: { ...defaultExtras(), wastePercent: 3, transport: 1.5, accessories: 1 } },
          b2: { lines: [{ id: "l4", resourceId: "r-duct", factor: 7.5 }, { id: "l5", resourceId: "r-ductlab", factor: 0.65 }], extras: { ...defaultExtras(), wastePercent: 5, transport: 4, accessories: 7 } },
          b3: { lines: [{ id: "l6", resourceId: "r-spr", factor: 1 }, { id: "l7", resourceId: "r-firelab", factor: 0.4 }], extras: { ...defaultExtras(), wastePercent: 2, transport: 1, accessories: 3 } },
        },
        rfqs: [{ id: "rfq-demo", title: "RFQ مواد MEP الرئيسية", supplierIds: ["sup-alpha", "sup-gulf", "sup-madar"], targetIds: ["b1", "b2", "b3"], status: "waiting", sentAt: now.slice(0, 10), dueAt: "", notes: "", attachment: null }],
        quotes: [
          { id: "q-alpha", supplierId: "sup-alpha", reference: "ALF-001", date: now.slice(0, 10), currency: "SAR", vat: 15, delivery: "14 يوم", payment: "30 يوم", warranty: "سنة", attachment: null, items: [{ targetType: "boq", targetId: "b1", brand: "Saudi", model: "PPR", unitPrice: 28, compliant: true, deviation: "", notes: "" }, { targetType: "boq", targetId: "b2", brand: "Local", model: "GI", unitPrice: 112, compliant: true, deviation: "", notes: "" }] },
          { id: "q-gulf", supplierId: "sup-gulf", reference: "GLF-115", date: now.slice(0, 10), currency: "SAR", vat: 15, delivery: "10 أيام", payment: "دفعة مقدمة 20%", warranty: "سنة", attachment: null, items: [{ targetType: "boq", targetId: "b1", brand: "Gulf", model: "PPR", unitPrice: 26.5, compliant: true, deviation: "", notes: "" }, { targetType: "boq", targetId: "b2", brand: "Local", model: "GI", unitPrice: 116, compliant: true, deviation: "", notes: "" }] },
          { id: "q-madar", supplierId: "sup-madar", reference: "MD-77", date: now.slice(0, 10), currency: "SAR", vat: 15, delivery: "21 يوم", payment: "60 يوم", warranty: "سنتان", attachment: null, items: [{ targetType: "boq", targetId: "b3", brand: "UL/FM", model: "Upright", unitPrice: 59.5, compliant: true, deviation: "", notes: "" }] },
        ],
        scenarios: [
          scenario("sc-conservative", "Conservative", 14, 9, 5),
          scenario("sc-competitive", "Competitive", 9, 6, 3),
          scenario("sc-target", "Target Profit", 12, 7, 3),
          scenario("sc-management", "Management Final", 10, 7, 3),
        ],
        revisions: [],
        audit: [{ id: id("audit"), date: now, user: "مدير التسعير", action: "إنشاء المشروع التجريبي" }],
        clarifications: [],
        exclusions: [],
        measurements: [],
        documents: [],
        pdfAnalyses: {},
        documentInsights: [],
        drawingScales: {},
        measurementGroups: [],
        tenderSummary: defaultTenderSummary({ deadline: "", currency: "SAR", tax: 15 }),
        tenderReview: { completedAt: "", completedBy: "", notes: "" },
        scopeMatrix: defaultScopeMatrix(["HVAC", "Fire Fighting", "Plumbing"]),
        risks: [],
        access: { memberIds: ["user-owner"], roleOverrides: {}, disciplineAssignments: { HVAC: "user-owner", "Fire Fighting": "user-owner", Plumbing: "user-owner" } },
        assignments: [
          { id: "assignment-hvac", discipline: "HVAC", userId: "user-owner", dueDate: "", status: "in_progress", progress: 0, needsReview: false },
          { id: "assignment-fire", discipline: "Fire Fighting", userId: "user-owner", dueDate: "", status: "in_progress", progress: 0, needsReview: false },
          { id: "assignment-plumbing", discipline: "Plumbing", userId: "user-owner", dueDate: "", status: "in_progress", progress: 0, needsReview: false },
        ],
        locks: {},
        smartFindings: [],
        recycleBin: [],
        submittedLockedAt: "",
        submittedLockedBy: "",
        qualityWaivers: [],
        comments: [],
        submissionSnapshots: [],
        decisionScenarios: [],
        outcome: { status: "", reason: "", date: "", notes: "" },
        serverVersion: 1,
        lastSyncedAt: "",
        syncBaseSnapshot: null,
        projectLock: null,
        ifcModels: [],
        ifcElements: [],
        ifcMappings: [],
        modelRevisions: [],
      }],
    }
    state.projects.forEach((project, index) => ensureProjectV5(project, state, index))
    return state
  }

  function migrateLegacy(legacy) {
    const state = seedState()
    if (!legacy || typeof legacy !== "object") return state
    const project = state.projects[0]
    project.name = legacy.projectName || project.name
    if (Array.isArray(legacy.resources) && legacy.resources.length) {
      const now = new Date().toISOString()
      state.resources = legacy.resources.map((resource) => ({
        id: resource.id || id("res"),
        code: resource.code || "RES",
        name: resource.name || "مورد",
        type: resource.type === "plant" ? "equipment" : resource.type === "subcontract" ? "subcontractor" : resource.type || "material",
        category: "MEP",
        unit: resource.unit || "عدد",
        rate: number(resource.rate),
        supplierId: null,
        region: "",
        sourceProject: project.name,
        updatedAt: now,
        history: [{ rate: number(resource.rate), date: now, source: "ترحيل من CostLab v0.1" }],
      }))
    }
    if (Array.isArray(legacy.boq) && legacy.boq.length) {
      project.boq = legacy.boq.map((item) => ({
        id: item.id || id("boq"), itemNo: item.code || item.itemNo || "", description: item.description || "", unit: item.unit || "عدد", quantity: number(item.quantity), section: "غير مصنف", system: "MEP", floor: "عام", pricingMethod: (legacy.buildUps?.[item.id] || []).length ? "analysis" : "manual", manualRate: number(item.baseRate), selectedQuoteId: null, notes: "",
      }))
      project.analyses = {}
      Object.entries(legacy.buildUps || {}).forEach(([itemId, lines]) => {
        project.analyses[itemId] = { lines: (lines || []).map((line) => ({ id: line.id || id("line"), resourceId: line.resourceId, factor: number(line.factor) })), extras: defaultExtras() }
      })
    }
    const supplierIds = []
    if (Array.isArray(legacy.suppliers)) {
      state.suppliers = legacy.suppliers.map((supplier) => {
        const supplierId = supplier.id || id("sup")
        supplierIds.push(supplierId)
        return { id: supplierId, name: supplier.name || "مورد", contact: "", email: "", phone: "", region: "" }
      })
      project.quotes = legacy.suppliers.map((supplier, index) => ({
        id: `legacy-quote-${index}`,
        supplierId: supplierIds[index],
        reference: "Migrated v0.1",
        date: new Date().toISOString().slice(0, 10),
        currency: "SAR",
        vat: number(legacy.markup?.tax ?? 15),
        delivery: "",
        payment: "",
        warranty: "",
        attachment: null,
        items: Object.entries(supplier.rates || {}).filter(([, rate]) => number(rate) > 0).map(([targetId, rate]) => ({ targetType: "boq", targetId, brand: "", model: "", unitPrice: number(rate), compliant: true, deviation: "", notes: "" })),
      }))
    }
    const migratedScenario = project.scenarios.find((entry) => entry.id === "sc-management")
    migratedScenario.indirectPercent = number(legacy.markup?.overhead ?? 7)
    migratedScenario.contingencyPercent = number(legacy.markup?.contingency ?? 3)
    migratedScenario.profitPercent = number(legacy.markup?.profit ?? 10)
    migratedScenario.vatPercent = number(legacy.markup?.tax ?? 15)
    state.activeScenarioId = migratedScenario.id
    project.audit.push({ id: id("audit"), date: new Date().toISOString(), user: state.user.name, action: "ترحيل بيانات MEP CostLab v0.1 إلى QESTIMA v0.7", immutable: true })
    return state
  }

  function ensureProjectV5(project, state, index = 0) {
    const now = new Date().toISOString()
    const ownerId = state?.session?.userId || state?.users?.[0]?.id || "user-owner"
    project.workspaceId ||= state?.session?.workspaceId || state?.workspaces?.[0]?.id || "workspace-personal"
    project.tenantId ||= state?.workspaces?.find((workspace) => workspace.id === project.workspaceId)?.tenantId || state?.session?.tenantId || "tenant-personal"
    project.tenderCode ||= `TND-${new Date(project.createdAt || now).getFullYear()}-${String(index + 1).padStart(3, "0")}`
    project.mainContractor ||= ""
    project.location ||= ""
    project.tenderNumber ||= ""
    project.pricingBaseDate ||= String(project.createdAt || now).slice(0, 10)
    project.projectType ||= "Commercial"
    project.disciplines = Array.isArray(project.disciplines) && project.disciplines.length ? project.disciplines : ["HVAC", "Fire Fighting", "Plumbing"]
    project.workflowMode = project.workflowMode === "quick" ? "quick" : "standard"
    project.boq ||= []
    project.analyses ||= {}
    project.rfqs ||= []
    project.quotes ||= []
    project.quotes.forEach((quote) => {
      quote.validityDays = Math.max(0, number(quote.validityDays || 0))
      quote.discountPercent = number(quote.discountPercent)
      quote.freightUnit = number(quote.freightUnit)
      quote.riskPercent = number(quote.riskPercent)
      quote.vatIncluded = Boolean(quote.vatIncluded)
      quote.items ||= []
      quote.items.forEach((line) => { line.unit ||= ""; line.discountPercent = number(line.discountPercent); line.freightUnit = number(line.freightUnit); line.riskPercent = number(line.riskPercent) })
    })
    project.scenarios ||= [scenario("sc-competitive", "Competitive", 10)]
    project.scenarios.forEach((entry) => {
      entry.profitBasis = entry.profitBasis === "margin" ? "margin" : "cost"
      entry.managementAdjustment = number(entry.managementAdjustment)
      entry.roundingStep = Math.max(0, number(entry.roundingStep))
      entry.roundingMode = ["nearest", "up", "down"].includes(entry.roundingMode) ? entry.roundingMode : "nearest"
      entry.locked = Boolean(entry.locked)
      entry.approvedBy ||= ""
      entry.approvedAt ||= ""
    })
    project.revisions ||= []
    project.audit ||= []
    project.clarifications ||= []
    project.exclusions ||= []
    project.measurements = Array.isArray(project.measurements) ? project.measurements.map((entry) => createMeasurement(entry)) : []
    project.pdfAnalyses = project.pdfAnalyses && typeof project.pdfAnalyses === "object" ? project.pdfAnalyses : {}
    project.documentInsights = Array.isArray(project.documentInsights) ? project.documentInsights : []
    project.drawingScales = project.drawingScales && typeof project.drawingScales === "object" ? project.drawingScales : {}
    project.measurementGroups = Array.isArray(project.measurementGroups) ? project.measurementGroups.map((entry) => createMeasurementGroup(entry)) : []
    project.smartFindings ||= []
    project.assignments ||= project.disciplines.map((discipline) => ({ id: id("assignment"), discipline, userId: ownerId, dueDate: "", status: "in_progress", progress: 0, needsReview: false }))
    project.access = { memberIds: [ownerId], roleOverrides: {}, disciplineAssignments: {}, ...(project.access || {}) }
    if (!project.access.memberIds?.length) project.access.memberIds = [ownerId]
    project.access.roleOverrides ||= {}
    project.access.disciplineAssignments ||= Object.fromEntries(project.assignments.map((assignment) => [assignment.discipline, assignment.userId]))
    project.locks ||= {}
    project.recycleBin ||= []
    project.submittedLockedAt ||= ""
    project.submittedLockedBy ||= ""
    project.qualityWaivers ||= []
    project.comments ||= []
    project.submissionSnapshots ||= []
    project.decisionScenarios ||= []
    project.outcome = { status: "", reason: "", date: "", notes: "", ...(project.outcome || {}) }
    project.serverVersion = Math.max(1, number(project.serverVersion) || 1)
    project.lastSyncedAt ||= ""
    project.syncBaseSnapshot = project.syncBaseSnapshot && typeof project.syncBaseSnapshot === "object" ? project.syncBaseSnapshot : null
    project.projectLock = project.projectLock && typeof project.projectLock === "object" ? project.projectLock : null
    project.ifcModels = Array.isArray(project.ifcModels) ? project.ifcModels : []
    project.ifcElements = Array.isArray(project.ifcElements) ? project.ifcElements : []
    project.ifcMappings = Array.isArray(project.ifcMappings) ? project.ifcMappings : []
    project.modelRevisions = Array.isArray(project.modelRevisions) ? project.modelRevisions : []
    project.documentRegisterVersion ||= 1
    project.documents ||= []
    project.tenderSummary = Array.isArray(project.tenderSummary) && project.tenderSummary.length ? project.tenderSummary : defaultTenderSummary(project)
    tenderSummaryFields.forEach(([key, label]) => {
      if (!project.tenderSummary.some((field) => field.key === key)) project.tenderSummary.push({ id: id("summary"), key, label, value: "", sourceDocumentId: "", sourcePage: "", verified: false, notes: "" })
    })
    project.tenderReview = { completedAt: "", completedBy: "", notes: "", ...(project.tenderReview || {}) }
    project.scopeMatrix = Array.isArray(project.scopeMatrix) && project.scopeMatrix.length ? project.scopeMatrix : defaultScopeMatrix(project.disciplines)
    project.risks ||= []
    project.boq.forEach((item) => {
      item.unit = normalizeUnit(item.unit)
      item.drawingDocumentId ||= ""
      item.drawingRevision ||= ""
      item.specificationDocumentId ||= ""
      item.specificationSection ||= ""
      item.building ||= ""
      item.floorZone ||= item.floor || ""
      item.takeoffQuantity = item.takeoffQuantity == null ? 0 : number(item.takeoffQuantity)
      item.quantityBasis = item.quantityBasis === "takeoff" ? "takeoff" : "boq"
      item.quantityDecision ||= item.quantityBasis
      item.linkedRfqId ||= ""
      item.linkedRiskId ||= ""
      item.workflowStatus = ITEM_WORKFLOW.includes(item.workflowStatus) ? item.workflowStatus : (itemCostUnit(project, item, state?.resources || []) > 0 ? "priced" : "not_started")
      item.workflowUpdatedAt ||= ""
      item.workflowUpdatedBy ||= ""
      item.assignedUserId ||= project.access.disciplineAssignments[item.section] || project.access.disciplineAssignments[item.system] || ""
      item.version = Math.max(1, number(item.version) || 1)
    })
    Object.values(project.analyses).forEach((analysis) => captureAnalysisSnapshots(analysis, state?.resources || [], { source: "Captured during QESTIMA v0.7 migration" }))
    project.documents.forEach((document) => {
      document.measurementScale = number(document.measurementScale) || 0
      document.smartReadStatus ||= "not_read"
      document.smartReadAt ||= ""
      document.pdfPageCount = Math.max(0, number(document.pdfPageCount))
      document.smartReadMethod ||= ""
      document.version = Math.max(1, number(document.version) || 1)
    })
    project.audit.forEach((entry) => { entry.immutable = true; entry.actorId ||= ""; entry.source ||= "QESTIMA" })
    recalculateDocumentRevisions(project)
    return project
  }

  function ensureState(value) {
    if (!value || typeof value !== "object") return seedState()
    if (![2, 3, 4, 5, 6].includes(value.schemaVersion)) return ensureState(migrateLegacy(value))
    const state = deepClone(value)
    state.schemaVersion = 6
    state.appVersion = "0.13.0"
    state.resources = Array.isArray(state.resources) ? state.resources : []
    state.suppliers = Array.isArray(state.suppliers) ? state.suppliers : []
    state.projects = Array.isArray(state.projects) ? state.projects : []
    state.user ||= { name: "عبدالرحمن كامل", initials: "AK" }
    const now = new Date().toISOString()
    state.users = Array.isArray(state.users) && state.users.length ? state.users : [{ id: "user-owner", name: state.user.name || "عبدالرحمن كامل", initials: state.user.initials || "AK", email: "", role: "system_admin", active: true, tenantIds: ["tenant-personal", "tenant-company-pilot"], createdAt: now, lastConnectionAt: now, appVersion: "0.13.0" }]
    state.workspaces = Array.isArray(state.workspaces) && state.workspaces.length ? state.workspaces : [
      { id: "workspace-personal", name: `${state.users[0].name} — Personal`, type: "personal", ownerUserId: state.users[0].id, storageMode: "local_encrypted_cache", syncStatus: "offline", members: [{ userId: state.users[0].id, role: "system_admin" }], createdAt: now },
      { id: "workspace-company", name: "QESTIMA Company Pilot", type: "company", ownerUserId: state.users[0].id, storageMode: "central_server", syncStatus: "server_not_connected", members: [{ userId: state.users[0].id, role: "system_admin" }], createdAt: now },
    ]
    state.workspaces = state.workspaces.map((workspace) => ({ ...workspace, tenantId: workspace.tenantId || (workspace.type === "company" ? "tenant-company-pilot" : "tenant-personal") }))
    state.session = { userId: state.users[0].id, workspaceId: state.workspaces[0].id, tenantId: state.workspaces[0].tenantId || "tenant-personal", authenticated: true, signedInAt: now, sessionId: id("session"), deviceId: "", connectionState: "local", lastConnectionAt: now, syncCursor: "", ...(state.session || {}) }
    if (!state.auth || typeof state.auth !== "object") state.auth = {}
    state.auth.accounts = Array.isArray(state.auth.accounts) ? state.auth.accounts.filter((account) => account && typeof account === "object") : []
    if (!state.auth.accounts.length && state.auth.securityMode !== "commercial") state.auth.accounts.push({ id: "account-owner", userId: state.users[0].id, username: "admin", passwordHash: credentialDigest("Qestima@2026"), active: true, createdAt: now })
    const ownerAccount = state.auth.accounts.find((account) => account.userId === state.users[0].id) || state.auth.accounts[0]
    if (ownerAccount) {
      ownerAccount.userId ||= state.users[0].id
      ownerAccount.active = ownerAccount.active !== false
    }
    state.auth.lastUsername ||= ""
    state.auth.lastLoginAt ||= ""
    state.auth.securityMode ||= "local_preview"
    state.license = { ...defaultLicense(now), ...(state.license || {}) }
    state.recycleBin ||= []
    state.settings = { theme: "light", language: "ar", stalePriceDays: 180, ...(state.settings || {}) }
    state.uiState = { activeView: "projects", activeRibbonTab: "home", activeContextTab: "", openTabs: ["projects"], activeItemId: "", activeDrawingId: "", drawingClosed: false, ribbonCollapsed: false, workspaceScroll: {}, ribbonHiddenCommands: [], ribbonLayout: {}, ...(state.uiState || {}) }
    state.uiState.openTabs = Array.isArray(state.uiState.openTabs) ? state.uiState.openTabs : ["projects"]
    state.uiState.drawingClosed = state.uiState.drawingClosed === true
    state.uiState.ribbonCollapsed = state.uiState.ribbonCollapsed === true
    state.companyProfile = { name: "QESTIMA", tagline: "MEP Estimating System", address: "", phone: "", email: "", taxNumber: "", logoDataUrl: "", ...(state.companyProfile || state.settings.company || {}) }
    state.importTemplates = Array.isArray(state.importTemplates) ? state.importTemplates : []
    state.rateAssemblies = Array.isArray(state.rateAssemblies) && state.rateAssemblies.length ? state.rateAssemblies : []
    defaultRateAssemblies().forEach((assembly) => { if (!state.rateAssemblies.some((entry) => entry.id === assembly.id)) state.rateAssemblies.push(assembly) })
    state.auditLog = Array.isArray(state.auditLog) ? state.auditLog : []
    state.tenants = Array.isArray(state.tenants) && state.tenants.length ? state.tenants : [
      { id: "tenant-personal", name: "Personal Workspace", slug: "personal", type: "personal", status: "active", plan: "Preview", ownerUserId: state.users[0].id, maxUsers: 1, maxDevices: 1, storageMode: "local_encrypted_cache", region: "sa", apiBaseUrl: "", createdAt: now, updatedAt: now, lastConnectionAt: now, featureFlags: { centralSync: false, ownerPortal: false, ifcImport: true, revitBridge: false, dxfImport: true } },
      { id: "tenant-company-pilot", name: "QESTIMA Company Pilot", slug: "qestima-company-pilot", type: "company", status: "active", plan: "Pilot", ownerUserId: state.users[0].id, maxUsers: 10, maxDevices: 10, storageMode: "central_object_storage", region: "sa", apiBaseUrl: "", createdAt: now, updatedAt: now, lastConnectionAt: "", featureFlags: { centralSync: true, ownerPortal: true, ifcImport: true, revitBridge: false, dxfImport: true } },
    ]
    state.devices = Array.isArray(state.devices) ? state.devices : []
    state.supportAccess = Array.isArray(state.supportAccess) ? state.supportAccess : []
    state.syncQueue = Array.isArray(state.syncQueue) ? state.syncQueue : []
    state.syncConflicts = Array.isArray(state.syncConflicts) ? state.syncConflicts : []
    state.centralAudit = Array.isArray(state.centralAudit) ? state.centralAudit : []
    state.central = { apiBaseUrl: "", environment: "pilot", connectionState: "local", lastSyncAt: "", syncCursor: "", syncCursors: {}, publicKeyId: "", licensePublicKeyId: "", licenseToken: "", updateChannel: "stable", ...(state.central || {}) }
    state.central.syncCursors = state.central.syncCursors && typeof state.central.syncCursors === "object" ? state.central.syncCursors : {}
    state.updatePolicy = { channel: state.central.updateChannel || "stable", requireSignature: true, minimumVersion: "", lastCheckedAt: "", lastManifestVersion: "", ...(state.updatePolicy || {}) }
    state.workspaces.forEach((workspace) => { workspace.tenantId ||= workspace.type === "company" ? "tenant-company-pilot" : "tenant-personal" })
    state.users.forEach((user) => { user.tenantIds = Array.isArray(user.tenantIds) && user.tenantIds.length ? user.tenantIds : [user.role === "system_admin" ? "tenant-personal" : "tenant-company-pilot"]; user.lastConnectionAt ||= ""; user.appVersion ||= "" })
    state.projects.forEach((project, index) => ensureProjectV5(project, state, index))
    if (!state.projects.some((project) => project.id === state.activeProjectId)) state.activeProjectId = state.projects[0]?.id || null
    const activeProject = state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0]
    if (!activeProject?.scenarios.some((scenario) => scenario.id === state.activeScenarioId)) state.activeScenarioId = activeProject?.scenarios[0]?.id || null
    return state
  }

  function emptyProject(state) {
    const project = { id: "", name: "No project selected", tenderCode: "—", workspaceId: state.session?.workspaceId, tenantId: state.session?.tenantId, currency: "SAR", tax: 15, status: "draft", boq: [], analyses: {}, documents: [], measurements: [], rfqs: [], quotes: [], scenarios: [{ id: "empty-scenario", name: "Default", profitPercent: 0, vatPercent: 15 }], revisions: [], audit: [], tenderSummary: [], scopeMatrix: [], risks: [], clarifications: [], exclusions: [] }
    return ensureProjectV5(project, state, 0)
  }

  function createInitialState() {
    const state = seedState()
    state.projects = []; state.resources = []; state.suppliers = []
    state.activeProjectId = ""; state.activeScenarioId = ""
    state.user = { name: "Owner", initials: "QS" }
    state.users = [{ id: "user-owner", name: "Owner", initials: "QS", role: "system_admin", active: true, tenantIds: ["tenant-personal"] }]
    state.auth = { accounts: [], securityMode: "commercial", firstRunCompletedAt: "" }
    state.workspaces = state.workspaces.filter((entry) => entry.id === "workspace-personal")
    state.workspaces[0].name = "Personal Workspace"
    state.tenants = (state.tenants || []).filter((entry) => entry.id === "tenant-personal")
    state.auditLog = []; state.centralAudit = []; state.recycleBin = []
    state.session.authenticated = false
    return ensureState(state)
  }

  return {
    emptyProject,
    createInitialState,
    RESOURCE_TYPES,
    DOCUMENT_CATEGORIES,
    DISCIPLINES,
    ITEM_WORKFLOW,
    UNIT_ALIASES,
    QUALITY_WEIGHTS,
    ROLE_LABELS,
    ROLE_PERMISSIONS,
    tenderSummaryFields,
    id,
    roleCan,
    activeUser,
    activeWorkspace,
    can,
    canWrite,
    number,
    round,
    roundToStep,
    deepClone,
    normalizeHeader,
    normalizeUnit,
    inspectDocument,
    extractTenderInsights,
    extractTextTables,
    analyzeTenderDocument,
    documentIntelligenceSummary,
    setDocumentInsightStatus,
    applyDocumentInsight,
    projectDocumentSearch,
    askProjectDocuments,
    compareDocumentRevisions,
    createMeasurement,
    createMeasurementGroup,
    measurementGeometry,
    calibrateScale,
    measurementNetQuantity,
    approveMeasurement,
    measurementTotals,
    takeoffVariance,
    applyApprovedMeasurement,
    carryMeasurementsToRevision,
    dxfSummary,
    daysBetween,
    credentialDigest,
    defaultLicense,
    licenseStatus,
    decodeLicenseToken,
    licenseTokenStatus,
    activateLocalLicense,
    headerCandidates,
    guessColumn,
    cleanBoqRows,
    tokenize,
    similarity,
    findHistoricalMatches,
    createImportTemplate,
    detectImportTemplate,
    defaultRateAssemblies,
    materialAge,
    quoteValidity,
    evaluateQuoteLine,
    levelQuoteOffers,
    revisionImpact,
    compareBoqRows,
    duplicateBoqItems,
    defaultExtras,
    resourceSnapshot,
    captureAnalysisSnapshots,
    snapshotDrift,
    calculateAnalysis,
    itemCostUnit,
    calculateProject,
    projectCostBreakdown,
    cloneAnalysis,
    projectHealth,
    pricingQuality,
    tenderReviewGate,
    tenderControl,
    applyWhatIf,
    targetPriceOptimizer,
    freezeSubmission,
    tenderHealth,
    effectiveQuantity,
    nextTenderCode,
    defaultTenderSummary,
    defaultScopeMatrix,
    classifyTenderDocument,
    revisionRank,
    recalculateDocumentRevisions,
    scopeStatus,
    resourceImpact,
    searchState,
    staleResources,
    projectSnapshot,
    buildReportPack,
    seedState,
    migrateLegacy,
    ensureProjectV5,
    ensureProjectV4: ensureProjectV5,
    ensureState,
  }
})
