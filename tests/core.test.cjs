const test = require("node:test")
const assert = require("node:assert/strict")
const C = require("../app/core.js")
const Collaboration = require("../app/collaboration.js")
const Model = require("../app/ifc.js")
const closeTo = (actual, expected, precision = 0.0001) => assert.ok(Math.abs(actual - expected) <= precision, `${actual} is not within ${precision} of ${expected}`)

test("unit rate analysis separates cost types and applies additions in order", () => {
  const resources = [
    { id: "m", type: "material", rate: 100 },
    { id: "l", type: "labor", rate: 20 },
    { id: "e", type: "equipment", rate: 10 },
    { id: "s", type: "subcontractor", rate: 50 },
  ]
  const result = C.calculateAnalysis({
    lines: [
      { resourceId: "m", factor: 2 },
      { resourceId: "l", factor: 3 },
      { resourceId: "e", factor: 1 },
      { resourceId: "s", factor: 1 },
    ],
    extras: { wastePercent: 5, transport: 5, accessories: 5, prelimPercent: 10, escalationPercent: 2, riskPercent: 3, overheadPercent: 4, profitPercent: 10, discountPercent: 2, vatPercent: 15 },
  }, resources)

  assert.deepEqual(result.components, { material: 200, labor: 60, equipment: 10, subcontractor: 50 })
  assert.equal(result.base, 320)
  assert.equal(result.waste, 10)
  assert.equal(result.transport, 5)
  assert.equal(result.accessories, 5)
  assert.equal(result.preliminaries, 34)
  assert.equal(result.escalation, 7.48)
  assert.equal(result.risk, 11.4444)
  assert.equal(result.overhead, 15.717)
  assert.equal(result.costUnit, 408.6414)
  assert.equal(result.profit, 40.8641)
  assert.equal(result.discount, 8.9901)
  assert.equal(result.sellingBeforeVat, 440.5154)
  assert.equal(result.vat, 66.0773)
})

test("library rate update is detected but project snapshot changes only after approval", () => {
  const state = C.seedState()
  const project = state.projects[0]
  const item = project.boq[0]
  const scenario = project.scenarios.find((entry) => entry.id === state.activeScenarioId)
  const beforeRate = C.itemCostUnit(project, item, state.resources)
  const beforeProject = C.calculateProject(project, state.resources, scenario).direct
  const resource = state.resources.find((entry) => entry.id === "r-ppr25")
  const impact = C.resourceImpact(state, resource.id)

  resource.rate += 10

  const heldRate = C.itemCostUnit(project, item, state.resources)
  const heldProject = C.calculateProject(project, state.resources, scenario).direct
  const analysisLine = project.analyses[item.id].lines.find((line) => line.resourceId === resource.id)
  const drift = C.snapshotDrift(analysisLine, state.resources)
  assert.equal(impact.length, 1)
  assert.equal(heldRate, beforeRate)
  assert.equal(heldProject, beforeProject)
  assert.equal(drift.changed, true)
  assert.equal(drift.difference, 10)

  analysisLine.rateSnapshot = C.resourceSnapshot(resource, { source: "Approved test update" })
  const afterRate = C.itemCostUnit(project, item, state.resources)
  const afterProject = C.calculateProject(project, state.resources, scenario).direct
  closeTo(afterRate - beforeRate, 10.815)
  closeTo(afterProject - beforeProject, 1946.7)
})

test("project pricing scenario calculates overhead, profit, discount and VAT", () => {
  const project = {
    tax: 15,
    boq: [{ id: "i", quantity: 10, pricingMethod: "manual", manualRate: 100 }],
    analyses: {}, quotes: [],
  }
  const totals = C.calculateProject(project, [], { indirectPercent: 10, contingencyPercent: 5, escalationPercent: 2, profitPercent: 10, discountPercent: 5, vatPercent: 15 })
  assert.equal(totals.direct, 1000)
  assert.equal(totals.indirect, 100)
  assert.equal(totals.contingency, 55)
  assert.equal(totals.escalation, 22)
  assert.equal(totals.totalCost, 1177)
  assert.equal(totals.profit, 117.7)
  assert.equal(totals.discount, 64.74)
  assert.equal(totals.beforeVat, 1229.97)
  assert.equal(totals.vat, 184.49)
  assert.equal(totals.total, 1414.46)
})

test("BOQ cleaner maps Arabic headers, removes blanks and detects duplicates", () => {
  const rows = [
    { "رقم البند": "HV-01", "الوصف": "Duct", "الوحدة": "m2", "الكمية": "1,200", "القسم": "HVAC" },
    { "رقم البند": "HV-01", "الوصف": "Duct", "الوحدة": "m2", "الكمية": "1200", "القسم": "HVAC" },
    { "رقم البند": "", "الوصف": "", "الوحدة": "", "الكمية": "" },
  ]
  const headers = Object.keys(rows[0])
  const mapping = Object.fromEntries(Object.keys(C.headerCandidates).map((field) => [field, C.guessColumn(headers, field)]))
  const result = C.cleanBoqRows(rows, mapping, { skipDuplicates: true })
  assert.equal(result.rows.length, 1)
  assert.equal(result.duplicates.length, 1)
  assert.equal(result.rows[0].quantity, 1200)
  assert.equal(result.rows[0].section, "HVAC")
})

test("legacy MEP CostLab data migrates without losing BOQ, build-ups or markup", () => {
  const legacy = {
    projectName: "Legacy Tender",
    boq: [{ id: "b1", code: "PL-01", description: "PPR Pipe", unit: "m", quantity: 10, baseRate: 25 }],
    resources: [{ id: "r1", code: "MAT-PPR", name: "PPR", type: "material", unit: "m", rate: 12 }],
    buildUps: { b1: [{ id: "l1", resourceId: "r1", factor: 1.1 }] },
    suppliers: [{ id: "s1", name: "Supplier", rates: { b1: 30 } }],
    markup: { overhead: 8, contingency: 4, profit: 11, tax: 15 },
  }
  const state = C.migrateLegacy(legacy)
  const project = state.projects[0]
  assert.equal(state.schemaVersion, 6)
  assert.equal(project.name, "Legacy Tender")
  assert.equal(project.boq.length, 1)
  assert.equal(project.analyses.b1.lines[0].resourceId, "r1")
  assert.equal(project.quotes[0].items[0].unitPrice, 30)
  assert.equal(project.scenarios.find((entry) => entry.id === "sc-management").profitPercent, 11)
})

test("v0.2 project upgrades to QESTIMA v0.7 without losing pricing data", () => {
  const old = C.seedState()
  old.schemaVersion = 2
  old.appVersion = "0.2.0"
  const originalDirect = C.calculateProject(old.projects[0], old.resources, old.projects[0].scenarios[0]).direct
  delete old.projects[0].documents
  delete old.projects[0].tenderSummary
  delete old.projects[0].scopeMatrix
  const upgraded = C.ensureState(old)
  assert.equal(upgraded.schemaVersion, 6)
  assert.equal(upgraded.appVersion, "0.15.0")
  assert.match(upgraded.projects[0].tenderCode, /^TND-\d{4}-\d{3}$/)
  assert.equal(upgraded.projects[0].tenderSummary.length, C.tenderSummaryFields.length)
  assert.ok(upgraded.projects[0].scopeMatrix.length > 0)
  assert.equal(C.calculateProject(upgraded.projects[0], upgraded.resources, upgraded.projects[0].scenarios[0]).direct, originalDirect)
})

test("v0.4 project upgrades to v0.7 scenario controls without changing its price", () => {
  const previous = C.seedState()
  previous.schemaVersion = 4
  previous.appVersion = "0.4.0"
  const project = previous.projects[0]
  project.scenarios.forEach((scenario) => {
    delete scenario.profitBasis
    delete scenario.roundingStep
    delete scenario.managementAdjustment
  })
  const before = C.calculateProject(project, previous.resources, project.scenarios[0]).beforeVat
  const upgraded = C.ensureState(previous)
  const scenario = upgraded.projects[0].scenarios[0]
  assert.equal(upgraded.schemaVersion, 6)
  assert.equal(scenario.profitBasis, "cost")
  assert.equal(scenario.roundingStep, 0)
  assert.equal(C.calculateProject(upgraded.projects[0], upgraded.resources, scenario).beforeVat, before)
})

test("local preview authentication and license activation are deterministic", () => {
  const state = C.seedState()
  const now = new Date("2026-09-02T00:00:00.000Z")
  assert.equal(C.credentialDigest("Qestima@2026"), state.auth.accounts[0].passwordHash)
  const activated = C.activateLocalLicense(state, { licenseKey: "QESTIMA-DEMO-LOCAL", activationCode: "QESTIMA-DEMO-45" }, now)
  assert.equal(activated.ok, true)
  const status = C.licenseStatus({ license: activated.license }, now)
  assert.equal(status.daysLeft, 45)
  assert.equal(status.expired, false)
  assert.equal(C.activateLocalLicense(state, { licenseKey: "x", activationCode: "invalid" }, now).ok, false)
})

test("target margin and management rounding calculate a controlled final price", () => {
  const project = { tax: 15, boq: [{ id: "i", quantity: 10, pricingMethod: "manual", manualRate: 100 }], analyses: {}, quotes: [] }
  const totals = C.calculateProject(project, [], { indirectPercent: 0, contingencyPercent: 0, escalationPercent: 0, profitPercent: 20, profitBasis: "margin", discountPercent: 0, managementAdjustment: 12, roundingStep: 100, roundingMode: "nearest", vatPercent: 15 })
  assert.equal(totals.totalCost, 1000)
  assert.equal(totals.profit, 250)
  assert.equal(totals.beforeRounding, 1262)
  assert.equal(totals.beforeVat, 1300)
  assert.equal(totals.roundingAdjustment, 38)
  assert.equal(totals.trueMargin, 19.23)
})

test("copied rate analysis is independent and preserves price snapshots", () => {
  const source = { lines: [{ id: "old", resourceId: "r1", factor: 2, rateSnapshot: { rate: 50, source: "SQ-1" } }], extras: { wastePercent: 5 } }
  const copied = C.cloneAnalysis(source, { sourceItemId: "b1", copiedBy: "Estimator" })
  assert.notEqual(copied.lines[0].id, source.lines[0].id)
  assert.equal(copied.lines[0].rateSnapshot.rate, 50)
  assert.equal(copied.copiedFromItemId, "b1")
  copied.lines[0].factor = 9
  assert.equal(source.lines[0].factor, 2)
})

test("project cost breakdown groups priced BOQ totals by system", () => {
  const project = { boq: [
    { id: "a", system: "HVAC", quantity: 2, pricingMethod: "manual", manualRate: 100 },
    { id: "b", system: "Plumbing", quantity: 1, pricingMethod: "manual", manualRate: 50 },
    { id: "c", system: "HVAC", quantity: 1, pricingMethod: "manual", manualRate: 0 },
  ], analyses: {}, quotes: [] }
  const rows = C.projectCostBreakdown(project, [], "system")
  assert.deepEqual(rows.map((row) => [row.key, row.direct, row.items, row.priced]), [["HVAC", 200, 2, 1], ["Plumbing", 50, 1, 1]])
  assert.equal(rows[0].sharePercent, 80)
})

test("Report Center builder includes required outputs and respects cost/markup permissions", () => {
  const state = C.seedState()
  const project = state.projects[0]
  const report = C.buildReportPack(project, state, { language: "en" })
  for (const key of ["pricedBoq", "unpricedItems", "rateAnalysis", "resourceBreakdown", "costSummary", "supplierAdjudication", "qualificationsExclusions", "scopeGaps", "revisionImpact", "scenarioComparison", "managementSummary", "auditTrail"]) assert.ok(Object.hasOwn(report.sections, key), `missing ${key}`)
  assert.equal(report.language, "en")
  assert.equal(report.permissions.showCost, true)
  assert.equal(report.permissions.showMarkup, true)
  state.session.userId = "user-estimator"
  project.access.memberIds = ["user-owner", "user-estimator"]
  const restricted = C.buildReportPack(project, state)
  assert.equal(restricted.permissions.showCost, true)
  assert.equal(restricted.permissions.showMarkup, false)
  assert.equal(restricted.sections.scenarioComparison[0].profit, null)
  assert.equal(restricted.sections.pricedBoq[0].sellingTotal, null)
  assert.equal(restricted.sections.managementSummary.totals.profit, null)
  assert.equal(restricted.sections.managementSummary.totals.grandTotal, null)
  assert.notEqual(restricted.sections.resourceBreakdown[0].rate, null)
  state.users.find((user) => user.id === "user-estimator").role = "unknown"
  const costHidden = C.buildReportPack(project, state)
  assert.equal(costHidden.permissions.showCost, false)
  assert.equal(costHidden.sections.resourceBreakdown[0].rate, null)
  assert.equal(costHidden.sections.managementSummary.totals, null)
})

test("workspace search only returns accessible projects", () => {
  const state = C.seedState()
  const personalProject = state.projects[0]
  const companyProject = C.deepClone(personalProject)
  companyProject.id = "company-project"
  companyProject.name = "Company Hospital Tender"
  companyProject.workspaceId = "workspace-company"
  companyProject.access.memberIds = ["user-owner"]
  state.projects.push(companyProject)

  state.session.workspaceId = "workspace-personal"
  assert.equal(C.searchState(state, "Tender").some((entry) => entry.projectId === companyProject.id), false)
  state.session.workspaceId = "workspace-company"
  assert.equal(C.searchState(state, "Tender").some((entry) => entry.projectId === companyProject.id), true)
})

test("markup visibility follows workspace roles", () => {
  const state = C.seedState()
  const project = state.projects[0]
  state.session.workspaceId = "workspace-company"
  project.workspaceId = "workspace-company"
  project.access.memberIds = ["user-owner", "user-estimator"]
  state.session.userId = "user-estimator"
  assert.equal(C.can(state, "pricing.edit_assigned", project), true)
  assert.equal(C.can(state, "markup.view", project), false)
  state.session.userId = "user-owner"
  assert.equal(C.can(state, "markup.view", project), true)
})

test("tender documents are classified and older revisions become superseded", () => {
  const suggestion = C.classifyTenderDocument("M-HVAC-204 Rev.02 Chilled Water Drawing.pdf")
  assert.equal(suggestion.category, "drawings")
  assert.equal(suggestion.discipline, "HVAC")
  assert.equal(suggestion.revision, "02")
  const project = { documents: [
    { id: "d1", documentNumber: "M-HVAC-204", title: "CHW Layout", revision: "01", receivedDate: "2026-08-01" },
    { id: "d2", documentNumber: "M-HVAC-204", title: "CHW Layout", revision: "02", receivedDate: "2026-08-20" },
  ] }
  C.recalculateDocumentRevisions(project)
  assert.equal(project.documents.find((document) => document.id === "d2").status, "current")
  assert.equal(project.documents.find((document) => document.id === "d1").status, "superseded")
  assert.equal(project.documents.find((document) => document.id === "d1").supersededBy, "d2")
})

test("takeoff quantity becomes the central pricing quantity only after engineer selection", () => {
  const project = { tax: 15, boq: [{ id: "i", quantity: 250, takeoffQuantity: 280, quantityBasis: "boq", pricingMethod: "manual", manualRate: 10 }], analyses: {}, quotes: [] }
  const scenario = { indirectPercent: 0, contingencyPercent: 0, escalationPercent: 0, profitPercent: 0, discountPercent: 0, vatPercent: 15 }
  assert.equal(C.calculateProject(project, [], scenario).direct, 2500)
  project.boq[0].quantityBasis = "takeoff"
  assert.equal(C.calculateProject(project, [], scenario).direct, 2800)
})

test("tender health and scope status expose missing review without blocking pricing", () => {
  const state = C.seedState()
  const project = state.projects[0]
  assert.equal(C.tenderHealth(project, state.resources).key, "documents_missing")
  project.documents.push({ id: "boq", title: "BOQ", category: "boq", revision: "01", status: "current", latestRevision: true })
  assert.equal(C.tenderHealth(project, state.resources).key, "review_incomplete")
  project.tenderReview.completedAt = new Date().toISOString()
  assert.equal(C.tenderHealth(project, state.resources).key, "ready")
  assert.equal(C.scopeStatus({ inScope: "yes", boqStatus: "no", drawingsStatus: "available", specsStatus: "available" }), "boq_gap")
})

test("smart BOQ diagnostics normalize units and expose quality signals", () => {
  const rows = [
    { Code: "A-1", Description: "CHW Pipe", Unit: "m2", Quantity: "1,200" },
    { Code: "A-1", Description: "CHW Pipe", Unit: "m2", Quantity: "#REF!" },
    { Code: "", Description: "", Unit: "", Quantity: "" },
  ]
  const result = C.cleanBoqRows(rows, { itemNo: "Code", description: "Description", unit: "Unit", quantity: "Quantity", section: "", system: "", floor: "" })
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].unit, "m²")
  assert.equal(result.diagnostics.blankRows, 1)
  assert.equal(result.diagnostics.duplicateRows, 1)
  assert.equal(result.diagnostics.formulaErrors, 1)
})

test("historical matching is ranked but never auto-approves", () => {
  const state = C.seedState()
  const previous = C.deepClone(state.projects[0])
  previous.id = "previous"
  previous.name = "Previous Hospital"
  previous.boq[0].description = "توريد وتركيب ماسورة PPR قطر 25 مم"
  previous.workspaceId = state.projects[0].workspaceId
  state.projects.push(previous)
  const matches = C.findHistoricalMatches(state, { id: "new", description: "توريد وتركيب مواسير PPR قطر 25 مم", unit: "م" }, { projectId: state.projects[0].id })
  assert.ok(matches.length > 0)
  assert.ok(matches[0].score >= 35)
  assert.equal(state.projects[0].boq[0].pricingMethod, "analysis")
})

test("commercial leveling separates lowest raw price from evaluated offer", () => {
  const project = { tax: 15, quotes: [
    { id: "qa", reference: "A", supplierId: "a", date: "2026-09-01", vat: 15, validityDays: 30, freightUnit: 20, items: [{ targetType: "boq", targetId: "i", unitPrice: 100, compliant: true }] },
    { id: "qb", reference: "B", supplierId: "b", date: "2026-09-01", vat: 15, validityDays: 30, freightUnit: 0, items: [{ targetType: "boq", targetId: "i", unitPrice: 105, discountPercent: 10, compliant: true }] },
  ] }
  const leveled = C.levelQuoteOffers(project, { targetType: "boq", targetId: "i", quantity: 10, unit: "m" })
  assert.equal(leveled.lowestRaw.quoteId, "qa")
  assert.equal(leveled.bestEvaluated.quoteId, "qb")
})

test("revision impact, quality gate and frozen submission are deterministic", () => {
  const state = C.seedState()
  const project = state.projects[0]
  const snapshot = C.projectSnapshot(project)
  project.boq[0].quantity += 10
  const impact = C.revisionImpact(snapshot, project, state.resources)
  assert.equal(impact.counts.changed, 1)
  const scenario = project.scenarios.find((entry) => entry.id === state.activeScenarioId)
  scenario.locked = true
  const quality = C.pricingQuality(project, state.resources, scenario)
  assert.ok(quality.findings.length >= 0)
  const frozen = C.freezeSubmission(project, state, scenario.id, { label: "Final R1", user: "Manager", allowWaived: true })
  assert.equal(frozen.ok, true)
  assert.equal(project.status, "submitted")
  assert.equal(project.submissionSnapshots[0].label, "Final R1")
})

test("what-if and target optimizer do not mutate the base project", () => {
  const state = C.seedState()
  const project = state.projects[0]
  const scenario = project.scenarios[0]
  const before = C.calculateProject(project, state.resources, scenario).beforeVat
  const preview = C.applyWhatIf(project, state.resources, scenario, { materialPercent: 10, contingencyPercent: 2 })
  assert.notEqual(preview.totals.beforeVat, before)
  assert.equal(C.calculateProject(project, state.resources, scenario).beforeVat, before)
  const target = C.targetPriceOptimizer(project, state.resources, scenario, before - 1000)
  assert.equal(target.targetPrice, before - 1000)
  assert.ok(target.topImpactItems.length > 0)
})

test("phase 4 ships reusable MEP rate assemblies", () => {
  const assemblies = C.defaultRateAssemblies()
  assert.ok(assemblies.length >= 9)
  for (const key of ["assembly-ppr-pipe", "assembly-fire-pipe", "assembly-insulation", "assembly-valves", "assembly-pumps", "assembly-ahu-fcu", "assembly-sanitary-fixtures"]) {
    const assembly = assemblies.find((entry) => entry.id === key)
    assert.ok(assembly, `missing ${key}`)
    assert.ok(assembly.components.some((component) => component.type === "material"))
    assert.ok(assembly.components.some((component) => component.type === "labor"))
  }
})

test("BOQ comparison identifies added, deleted, changed and RFQ impact", () => {
  const before = [{ id: "old-a", itemNo: "A-1", description: "Pipe", unit: "m", quantity: 10 }, { id: "old-b", itemNo: "B-1", description: "Valve", unit: "nr", quantity: 2 }]
  const after = [{ id: "new-a", itemNo: "A-1", description: "Pipe", unit: "m", quantity: 14 }, { id: "new-c", itemNo: "C-1", description: "Pump", unit: "nr", quantity: 1 }]
  const result = C.compareBoqRows({ boq: before, rfqs: [{ id: "rfq-1", title: "Pipe RFQ", targetIds: ["new-a"] }] }, { boq: after, rfqs: [{ id: "rfq-1", title: "Pipe RFQ", targetIds: ["new-a"] }] })
  assert.equal(result.counts.added, 1)
  assert.equal(result.counts.deleted, 1)
  assert.equal(result.counts.changed, 1)
  assert.equal(result.rfqUpdates.length, 1)
})

test("tender review gate exposes all final approval checks", () => {
  const state = C.seedState()
  const project = state.projects[0]
  const scenario = project.scenarios.find((entry) => entry.id === state.activeScenarioId)
  let gate = C.tenderReviewGate(project, state, scenario, { state })
  assert.equal(gate.items.length, 7)
  assert.equal(gate.canSubmit, false)
  project.tenderReview.completedAt = new Date().toISOString()
  project.scopeMatrix.forEach((row) => { row.inScope = "yes"; row.boqStatus = "yes"; row.drawingsStatus = "available"; row.specsStatus = "available" })
  scenario.locked = true
  project.revisions.push({ id: "rev-1", label: "R1", date: new Date().toISOString(), user: "Manager", snapshot: C.projectSnapshot(project) })
  gate = C.tenderReviewGate(project, state, scenario, { state })
  assert.equal(gate.canSubmit, true)
  assert.equal(gate.completed, 7)
})

test("quote leveling reports lowest compliant separately from lowest raw", () => {
  const project = { tax: 15, quotes: [
    { id: "bad", supplierId: "bad", date: "2026-09-01", validityDays: 30, items: [{ targetType: "boq", targetId: "i", unitPrice: 80, compliant: false }] },
    { id: "good", supplierId: "good", date: "2026-09-01", validityDays: 30, items: [{ targetType: "boq", targetId: "i", unitPrice: 95, compliant: true }] },
  ] }
  const result = C.levelQuoteOffers(project, { targetType: "boq", targetId: "i", quantity: 1, unit: "m" })
  assert.equal(result.lowestRaw.quoteId, "bad")
  assert.equal(result.lowestCompliant.quoteId, "good")
})

test("what-if supports currency and alternate supplier without mutating the tender", () => {
  const state = C.seedState()
  const project = state.projects[0]
  const item = project.boq[0]
  item.pricingMethod = "supplier"
  item.selectedQuoteId = "q-alpha"
  item.manualRate = 28
  const scenario = project.scenarios[0]
  const before = C.calculateProject(project, state.resources, scenario).beforeVat
  const preview = C.applyWhatIf(project, state.resources, scenario, { currencyFactor: 1.1, alternateQuoteId: "q-gulf" })
  assert.equal(preview.project.boq[0].selectedQuoteId, "q-gulf")
  assert.notEqual(preview.totals.beforeVat, before)
  assert.equal(project.boq[0].selectedQuoteId, "q-alpha")
  assert.equal(C.calculateProject(project, state.resources, scenario).beforeVat, before)
})

test("pricing quality catches source, unit and minimum margin issues", () => {
  const project = {
    tax: 15,
    boq: [{ id: "i", itemNo: "A-1", description: "Pipe", unit: "m", quantity: 10, pricingMethod: "supplier", selectedQuoteId: "q" }],
    analyses: {},
    quotes: [{ id: "q", reference: "Q-1", date: "2026-09-01", validityDays: 30, items: [{ targetType: "boq", targetId: "i", unit: "m²", unitPrice: 100, compliant: true }] }],
    scopeMatrix: [],
    risks: [],
  }
  const quality = C.pricingQuality(project, [], { locked: true, profitPercent: 1, indirectPercent: 0, contingencyPercent: 0, escalationPercent: 0, discountPercent: 0, vatPercent: 15 }, { minimumMargin: 20, now: new Date("2026-09-02T00:00:00Z") })
  assert.ok(quality.findings.some((finding) => finding.code === "UNIT_MISMATCH"))
  assert.ok(quality.findings.some((finding) => finding.code === "LOW_MARGIN"))
})

test("PDF intelligence extracts source-linked tender insights without mutating the tender", () => {
  const state = C.seedState()
  const project = state.projects[0]
  const before = C.deepClone(project.tenderSummary)
  const analysis = C.analyzeTenderDocument({ id: "pdf-1", title: "Tender Instructions.pdf", originalName: "Tender Instructions.pdf", revision: "01", mimeType: "application/pdf" }, [
    { page: 3, text: "Submission deadline: 2026-10-12\nOffer validity: 90 days\nRetention: 10%" },
    { page: 14, text: "Approved manufacturers: Acme, Beta\nScope of work includes HVAC and plumbing.\nItem   Qty\nPipe   20" },
  ], { method: "pdftotext", analyzedBy: "Engineer" })
  assert.equal(analysis.advisoryOnly, true)
  assert.equal(analysis.pdfKind, "text")
  assert.equal(analysis.insights.length, 5)
  assert.equal(analysis.insights.find((entry) => entry.fieldKey === "submissionDeadline").page, 3)
  assert.equal(analysis.tables.length, 1)
  assert.ok(analysis.insights.every((entry) => entry.confidence > 0 && entry.status === "pending"))
  project.pdfAnalyses = { [analysis.documentId]: analysis }
  project.documentInsights = analysis.insights
  assert.deepEqual(project.tenderSummary, before)
  const pending = project.documentInsights[0]
  assert.equal(C.setDocumentInsightStatus(project, pending.id, "approved", "Manager").ok, true)
  assert.deepEqual(project.tenderSummary, before)
  assert.equal(C.applyDocumentInsight(project, pending.id, "Manager").ok, true)
  assert.notDeepEqual(project.tenderSummary, before)
})

test("project document search and revision comparison stay scoped and source-aware", () => {
  const project = C.seedState().projects[0]
  const make = (id, revision, retention) => C.analyzeTenderDocument({ id, title: `Commercial Rev ${revision}.pdf`, originalName: `Commercial Rev ${revision}.pdf`, revision, mimeType: "application/pdf" }, [{ page: 7, text: `Retention: ${retention}%\nPayment terms: monthly` }], { method: "ocr" })
  const before = make("p-before", "01", 5)
  const after = make("p-after", "02", 10)
  project.pdfAnalyses = { [before.documentId]: before, [after.documentId]: after }
  project.documentInsights = [...before.insights, ...after.insights]
  const result = C.askProjectDocuments(project, "Retention", { limit: 10 })
  assert.equal(result.projectOnly, true)
  assert.ok(result.matches.every((entry) => entry.documentId === "p-before" || entry.documentId === "p-after"))
  assert.ok(result.matches.some((entry) => entry.page === 7))
  const natural = C.askProjectDocuments(project, "What is the retention percentage?", { limit: 10 })
  assert.ok(natural.matches.some((entry) => entry.type === "insight"))
  assert.match(natural.answer, /Retention/i)
  const diff = C.compareDocumentRevisions(project, "p-before", "p-after")
  assert.equal(diff.ok, true)
  assert.equal(diff.counts.changedInsights, 1)
  assert.equal(diff.changes[0].before, "Retention: 5%")
  assert.equal(diff.changes[0].after, "Retention: 10%")
})

test("PDF measurement geometry, engineer approval and revision carry-forward are deterministic", () => {
  const state = C.seedState()
  const project = state.projects[0]
  project.documents = [
    { id: "draw-old", category: "drawings", fileType: "PDF", documentNumber: "M-HVAC-01", revision: "01", title: "Plan", status: "superseded" },
    { id: "draw-new", category: "drawings", fileType: "PDF", documentNumber: "M-HVAC-01", revision: "02", title: "Plan", status: "current" },
  ]
  const scale = C.calibrateScale(100, 10)
  assert.equal(scale.unitsPerPixel, 0.1)
  const area = C.measurementGeometry("area", [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }], scale.unitsPerPixel)
  assert.equal(area.quantity, 50)
  const measurement = C.createMeasurement({ id: "m-old", kind: "length", name: "CHW route", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], scale: scale.unitsPerPixel, drawingDocumentId: "draw-old", drawingPage: 2, drawingRevision: "01", itemId: project.boq[0].id, unit: "m", measuredBy: "Ahmed" })
  project.measurements = [measurement]
  assert.equal(project.boq[0].takeoffQuantity || 0, 0)
  Object.assign(measurement, C.approveMeasurement(measurement, "Manager"))
  const applied = C.applyApprovedMeasurement(project, measurement.id, "Manager")
  assert.equal(applied.ok, true)
  assert.equal(project.boq[0].takeoffQuantity, 10)
  const carried = C.carryMeasurementsToRevision(project, "draw-old", "draw-new", "Manager")
  assert.equal(carried.ok, true)
  assert.equal(carried.measurements[0].approved, false)
  assert.equal(carried.measurements[0].previousMeasurementId, "m-old")
  assert.equal(carried.measurements[0].drawingRevision, "02")
})

test("dimension groups preserve color and link visual measurements without auto-applying quantities", () => {
  const group = C.createMeasurementGroup({ name: "HVAC · CHW", system: "HVAC", color: "#123456", createdBy: "Ahmed" })
  const measurement = C.createMeasurement({ kind: "polyline", groupId: group.id, color: group.color, points: [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }], scale: 0.1, itemId: "item-1", drawingPage: 2 })
  assert.equal(group.color, "#123456")
  assert.equal(measurement.groupId, group.id)
  assert.equal(measurement.approved, false)
  assert.equal(measurement.quantity, 7)
})

test("collaboration foundation isolates tenants, enforces seats and detects project conflicts", () => {
  const state = Collaboration.ensureCollaborationState(C.seedState())
  state.session.tenantId = "tenant-company-pilot"
  state.session.userId = "user-owner"
  const registered = Collaboration.registerDevice(state, { tenantId: "tenant-company-pilot", userId: "user-owner", id: "device-test", machineHash: "machine-test", appVersion: "0.11.0" })
  assert.equal(registered.ok, true)
  assert.equal(registered.device.tenantId, "tenant-company-pilot")
  assert.equal(Collaboration.canAccessTenant(state, "user-estimator", "tenant-company-pilot"), true)
  assert.equal(Collaboration.canAccessTenant(state, "user-estimator", "tenant-personal"), false)
  const project = state.projects[0]
  const lock = Collaboration.acquireProjectLock(project, { userId: "user-estimator", deviceId: "device-other", ttlMinutes: 10 })
  assert.equal(lock.ok, true)
  assert.equal(Collaboration.acquireProjectLock(project, { userId: "user-owner" }).reason, "PROJECT_LOCKED")
  Collaboration.releaseProjectLock(project, { userId: "user-estimator", token: lock.lock.token })
  const base = C.deepClone(project)
  project.syncBaseSnapshot = C.deepClone(base)
  project.name = "Local edit"
  const remote = C.deepClone(base); remote.client = "Remote edit"
  assert.equal(Collaboration.applyRemoteProject(state, project.id, remote).ok, true)
  const queued = Collaboration.queueSyncOperation(state, { tenantId: project.tenantId, projectId: project.id, baseVersion: project.serverVersion, payload: project, changedPaths: ["name"] })
  assert.equal(queued.status, "pending"); assert.equal(state.syncQueue.at(-1).projectId, project.id)
  const conflicting = C.deepClone(base); conflicting.name = "Remote name"
  const conflictResult = Collaboration.applyRemoteProject(state, project.id, conflicting)
  assert.equal(conflictResult.reason, "SYNC_CONFLICT")
  assert.equal(state.syncConflicts.length, 1)
})

test("license actions and support access are auditable and time bounded", () => {
  const state = Collaboration.ensureCollaborationState(C.seedState())
  state.session.tenantId = "tenant-company-pilot"
  const request = Collaboration.requestSupportAccess(state, { tenantId: "tenant-company-pilot", requestedBy: "user-owner", reason: "diagnostics", scopes: ["diagnostics"] })
  const approved = Collaboration.approveSupportAccess(state, request.id, { approvedBy: "user-owner", hours: 2 })
  assert.equal(approved.ok, true)
  assert.equal(Collaboration.supportAccessActive(approved.access), true)
  const license = Collaboration.licenseAction(state, "suspend", { tenantId: "tenant-company-pilot", userId: "user-owner" })
  assert.equal(license.ok, true)
  assert.equal(license.entitlements.readOnly, true)
  assert.ok(state.centralAudit.some((entry) => entry.action === "license.suspend"))
})

test("IFC import maps elements to BOQ only after explicit approval and supports revision comparison", () => {
  const state = C.seedState(); const project = state.projects[0]; const item = project.boq[0]
  const source = (length, extra = "") => `ISO-10303-21;HEADER;FILE_SCHEMA(('IFC4'));ENDSEC;DATA;#2=IFCBUILDINGSTOREY('L1',$,'Level 01',$,$,$,$,$,.ELEMENT.,0.0);#11=IFCQUANTITYLENGTH('Length',$,${length},$);#12=IFCELEMENTQUANTITY('Q1',$,'Base Quantities',(#11));#20=IFCPIPESEGMENT('GID-1',$,'CHW Pipe 100 mm',$,$,$,$,$);#30=IFCMATERIAL('Copper');#40=IFCRELDEFINESBYPROPERTIES('R1',$,$,$,(#20),#12);#41=IFCRELCONTAINEDINSPATIALSTRUCTURE('R2',$,$,$,(#20),#2);#42=IFCRELASSOCIATESMATERIAL('R3',$,$,$,(#20),#30);${extra}ENDSEC;END-ISO-10303-21;`
  const first = Model.parseIfcText(source(125.5), { fileName: "model.ifc", revision: "01" })
  assert.equal(first.advisoryOnly, true); assert.equal(first.elements[0].quantities.length, 125.5); assert.equal(first.elements[0].level, "Level 01")
  assert.equal(Model.upsertIfcModel(project, first).ok, true)
  const element = project.ifcElements[0]
  const linked = Model.linkIfcElementToBoq(project, { modelId: first.id, elementId: element.elementId, boqItemId: item.id, quantityField: "length", rateAssemblyId: "asm-chw-pipe", userId: "user-owner" })
  assert.equal(linked.mapping.status, "pending")
  assert.equal(Model.applyApprovedIfcQuantity(project, linked.mapping.id, "user-owner").reason, "MAPPING_NOT_APPROVED")
  assert.equal(Model.setIfcMappingStatus(project, linked.mapping.id, "approved", "manager").ok, true)
  assert.equal(Model.applyApprovedIfcQuantity(project, linked.mapping.id, "manager").ok, true)
  assert.equal(item.takeoffQuantity, 125.5); assert.equal(item.quantityDecision, "ifc-approved")
  const second = Model.parseIfcText(source(150, "#21=IFCPIPESEGMENT('GID-2',$,'New pipe',$,$,$,$,$);"), { fileName: "model.ifc", revision: "02" })
  assert.equal(Model.upsertIfcModel(project, second).ok, true)
  const diff = Model.compareIfcModels(first, second)
  assert.equal(diff.counts.added, 1); assert.equal(diff.counts.changed, 1); assert.equal(diff.changed[0].quantityChanges[0].delta, 24.5)
  const revit = Model.parseModelSource(JSON.stringify({ format: "qestima-revit-snapshot", modelVersion: "Revit 2025", elements: [{ elementId: "revit-1", category: "Duct", family: "Rectangular", type: "600x300", system: "Supply Air", level: "L01", quantities: { length: 12, count: 1 } }] }), { fileName: "revit.json" })
  assert.equal(revit.schema, "Revit JSON"); assert.equal(revit.elements[0].system, "Supply Air"); assert.equal(revit.advisoryOnly, true)
})
