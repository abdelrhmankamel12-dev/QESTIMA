const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const vm = require("node:vm")
const C = require("../app/core.js")
const Collaboration = require("../app/collaboration.js")
const Model = require("../app/ifc.js")

class ClassList {
  add() {}
  remove() {}
  toggle() {}
  contains() { return false }
}

class StubElement {
  constructor() {
    this.innerHTML = ""
    this.textContent = ""
    this.value = ""
    this.disabled = false
    this.style = {}
    this.dataset = {}
    this.classList = new ClassList()
  }
  addEventListener() {}
  append() {}
  remove() {}
  querySelector() { return null }
  querySelectorAll() { return [] }
}

test("professional workspace boots into Projects Center", async () => {
  const ids = [
    "workspace-switcher", "workspace-mode", "project-switcher", "sidebar-progress-bar", "sidebar-progress-text",
    "nav-unpriced", "nav-documents", "nav-risks", "nav-review-state", "page-title", "user-name", "user-initials",
    "undo-btn", "redo-btn", "theme-btn", "app-shell", "workspace", "workspace-tabs", "status-project-code",
    "status-pricing", "status-review", "status-currency", "status-unpriced", "status-save", "backup-btn", "global-search",
    "modal-root", "loading-screen", "save-dot", "save-label", "save-time", "toast-root",
  ]
  const elements = Object.fromEntries(ids.map((id) => [id, new StubElement()]))
  const document = {
    documentElement: new StubElement(),
    querySelector: (selector) => selector.startsWith("#") ? elements[selector.slice(1)] || null : null,
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => new StubElement(),
  }
  // Demo fixture belongs to tests; production starts with an empty workspace.
  const storage = new Map([["qestima-v6", JSON.stringify(C.seedState())]])
  const localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }
  const XLSX = require("../app/vendor/xlsx.full.min.js")
  const window = { QESTIMACore: C, QESTIMACollaboration: Collaboration, QESTIMAModel: Model, QESTIMATenderIntake: require('../app/tender-intake.js'), addEventListener() {}, qestimaDesktop: null }
  const context = {
    window, document, localStorage, console, Intl, Date, Math, JSON, Blob, URL,
    indexedDB: {}, File: class File {}, HTMLFormElement: class HTMLFormElement {}, confirm: () => true, XLSX,
    setTimeout: (fn) => { Promise.resolve().then(fn); return 1 }, clearTimeout() {},
  }
  const source = fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8").replace("  init().catch", "  window.__QESTIMATest = { openView, handleClick, getState: () => state, buildReportArtifacts: () => { const project = currentProject(); const pack = C.buildReportPack(project, state, { language: \"ar\" }); return { workbook: buildReportWorkbook(pack), pdf: buildReportPdfHtml(pack) } } }\n  init().catch")
  vm.runInNewContext(source, context)
  await new Promise((resolve) => setImmediate(resolve))
  assert.match(elements.workspace.innerHTML, /Projects Center/)
  assert.match(elements.workspace.innerHTML, /Project, client, city or tender code/)
  assert.equal(elements["status-pricing"].textContent.includes("BOQ Pricing"), true)
  // Reproduce DOM ancestry: workspace data-view must not swallow field clicks
  // or action buttons inside it. The old broad selector fails both assertions.
  const workspaceAncestor = { nodeType: 1, dataset: { view: "projects" }, matches: (selector) => selector === "[data-view]" }
  const field = { nodeType: 1, parentElement: workspaceAncestor, matches: () => false }
  elements.workspace.innerHTML = "editing sentinel"
  let prevented = false
  await window.__QESTIMATest.handleClick({ target: field, preventDefault() { prevented = true } })
  assert.equal(prevented, false)
  assert.equal(elements.workspace.innerHTML, "editing sentinel")
  const addButton = { nodeType: 1, parentElement: workspaceAncestor, dataset: { action: "new-project" }, matches: (selector) => selector === "[data-action]" }
  await window.__QESTIMATest.handleClick({ target: addButton, preventDefault() {} })
  assert.match(elements["modal-root"].innerHTML, /id="project-form"/)
  const reportButton = { nodeType: 1, parentElement: workspaceAncestor, dataset: { reportTab: "pricedBoq" }, matches: (selector) => selector === "button[data-report-tab]" }
  await window.__QESTIMATest.handleClick({ target: reportButton, preventDefault() {} })
  assert.match(elements.workspace.innerHTML, /Report Center/)
  window.__QESTIMATest.openView("projects")

  const index = fs.readFileSync(path.join(__dirname, "../app/index.html"), "utf8")
  assert.match(index, /id="ribbon-tabs"/)
  assert.match(index, /data-tab="drawings"/)
  const topRibbonTabs = [...index.matchAll(/class="ribbon-tab[^>]*data-tab="([^"]+)"/g)].map((match) => match[1])
  assert.deepEqual(topRibbonTabs, ["home", "tender_ai", "cost_estimation", "drawings", "suppliers", "reports"])
  assert.doesNotMatch(index, /data-tab="models"/)
  assert.doesNotMatch(index, /data-tab="subcontractors"/)
  assert.match(index, /data-ribbon-panel="reports"/)
  assert.match(index, /data-ribbon-panel="suppliers"/)
  assert.match(index, /data-ribbon-panel="home"/)
  assert.match(index, /role="tablist"/)
  assert.equal((index.match(/role="tab"/g) || []).length, 6)
  assert.equal((index.match(/role="tabpanel"/g) || []).length, 6)
  for (const group of ["Import", "Drawing", "View", "Layers", "Scale", "Revisions", "Model Review"]) assert.match(index, new RegExp(`ribbon-group"><span>${group}<\\/span>`))
  for (const group of ["BOQ", "Rate Build-Up", "Resources", "Productivity", "Indirect Cost", "Pricing", "Selling Price", "Scenarios", "Review", "History", "Outputs"]) assert.match(index, new RegExp(`ribbon-group"><span>${group}<\\/span>`))
  assert.match(index, /id="contextual-tabs"/)
  assert.match(index, /id="contextual-command-ribbon"/)
  for (const tab of topRibbonTabs) {
    const htmlTabId = tab.replaceAll("_", "-")
    assert.match(index, new RegExp(`aria-controls="ribbon-panel-${htmlTabId}"`))
    assert.match(index, new RegExp(`id="ribbon-panel-${htmlTabId}"`))
  }
  const appSource = fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8")
  assert.match(appSource, /function contextualRibbonContexts\(\)/)
  assert.match(appSource, /function renderContextualRibbon\(\)/)
  assert.match(appSource, /function persistUiState\(\)/)
  assert.match(appSource, /function restoreUiState\(\)/)
  assert.match(appSource, /function toggleRibbonCollapsed\(\)/)
  assert.match(appSource, /function handleWorkspaceTabKeydown\(event\)/)
  assert.match(appSource, /function commandAvailability\(action, project = currentProject\(\)\)/)
  assert.match(appSource, /ribbonActionPermissions/)
  assert.match(appSource, /const ribbonConfig = \[/)
  assert.match(appSource, /id: "cost_estimation", label: "Cost Estimation"/)
  for (const group of ["Productivity", "Indirect Cost", "Selling Price", "Scenarios", "History", "Outputs"]) assert.match(appSource, new RegExp(`ribbonGroup\\(\\"${group}\\"`))
  assert.match(appSource, /action === "recalculate-analysis"/)
  assert.match(appSource, /action === "open-productivity"/)
  assert.match(appSource, /function renderRibbonCommand\(command\)/)
  assert.match(appSource, /data-command-id=/)
  assert.match(appSource, /data-shortcut=/)
  assert.match(appSource, /featureEnabled\(feature\)/)
  assert.match(appSource, /workspaceScroll/)
  assert.match(appSource, /document\.documentElement\.dir/)
  for (const command of ["new-project", "import-drawing", "boq", "create-rfq", "smart-pdf-review", "submission-pack", "customize-ribbon"]) assert.match(appSource, new RegExp(`\\"${command}\\"`))
  assert.match(appSource, /drawingClosed/)
  assert.match(appSource, /data-action="contextual-tab"/)
  const styles = fs.readFileSync(path.join(__dirname, "../app/styles.css"), "utf8")
  assert.match(styles, /\.app-shell\.ribbon-collapsed \.ribbon-stack/)
  assert.match(styles, /--qe-accent:\s*#d5a52f/)
  assert.match(styles, /\.boq-pro-layout/)
  assert.match(appSource, /document\.addEventListener\("click", handleClick, true\)/)
  assert.match(appSource, /function closestElement\(node, selector\)/)
  assert.match(appSource, /exportReportPack\(\{/) 
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8"), /exportReportPack:/)
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8"), /ipcMain\.handle\("report:pack"/)

  window.__QESTIMATest.openView("boq")
  window.__QESTIMATest.openView("tender_ai")
  assert.match(elements.workspace.innerHTML, /TENDER AI/)
  assert.match(elements.workspace.innerHTML, /BOQ REVIEW/)
  const intakeState = window.__QESTIMATest.getState()
  const intakeProject = intakeState.projects.find(p => p.id === intakeState.activeProjectId) || intakeState.projects[0]
  intakeProject.tenderIntake = window.QESTIMATenderIntake.stage(intakeProject, [{id:'review-test', name:'Contract.pdf', hash:'test-hash'}], 'test', '2026-09-09T18:00:00Z').queue
  window.__QESTIMATest.openView("tender_ai")
  assert.match(elements.workspace.innerHTML, /Contract.pdf/)
  await window.__QESTIMATest.handleClick({target:{nodeType:1,dataset:{action:'intake-review',id:'intake-review-test'},matches:s=>s==='[data-action]'},preventDefault(){}})
  assert.match(elements['modal-root'].innerHTML, /id="intake-review-form"/)
  assert.match(elements['modal-root'].innerHTML, /name="supersedes"/)
  window.__QESTIMATest.openView("boq")
  assert.match(elements.workspace.innerHTML, /BOQ Pricing Sheet/)
  assert.match(elements.workspace.innerHTML, /Unit Direct Cost/)
  assert.match(elements.workspace.innerHTML, /rate-inspector/)

  window.__QESTIMATest.openView("analysis")
  assert.match(elements.workspace.innerHTML, /analysis-workbench/)
  assert.match(elements.workspace.innerHTML, /Copy Previous Analysis/)
  assert.match(elements.workspace.innerHTML, /COST CALCULATION/)

  window.__QESTIMATest.openView("suppliers")
  assert.match(elements.workspace.innerHTML, /Supplier Comparison &amp; RFQ Control/)
  assert.match(elements.workspace.innerHTML, /Select This Offer/)

  window.__QESTIMATest.openView("markup")
  assert.match(elements.workspace.innerHTML, /Pricing &amp; Markup Control/)
  assert.match(elements.workspace.innerHTML, /Target Margin/)
  assert.match(elements.workspace.innerHTML, /Approve & Lock/)

  window.__QESTIMATest.openView("control")
  assert.match(elements.workspace.innerHTML, /Tender Control Center/)
  assert.match(elements.workspace.innerHTML, /Tender Readiness/)

  window.__QESTIMATest.openView("quality")
  assert.match(elements.workspace.innerHTML, /Quality &amp; Submission/)
  assert.match(elements.workspace.innerHTML, /Pricing Quality Checker/)

  window.__QESTIMATest.openView("decisions")
  assert.match(elements.workspace.innerHTML, /What-If sensitivity/)
  assert.match(elements.workspace.innerHTML, /Target Price Optimizer/)

  window.__QESTIMATest.openView("reports")
  assert.match(elements.workspace.innerHTML, /Report Center/)
  assert.match(elements.workspace.innerHTML, /Tender Submission Pack/)
  assert.match(elements.workspace.innerHTML, /Priced BOQ/)
  const reportArtifacts = window.__QESTIMATest.buildReportArtifacts()
  assert.ok(reportArtifacts.workbook.SheetNames.includes("BOQ المسعّر"))
  assert.match(reportArtifacts.pdf, /@page\{size:A4/)
  assert.match(reportArtifacts.pdf, /ملخص الإدارة/)

  window.__QESTIMATest.openView("drawings")
  assert.match(elements.workspace.innerHTML, /drawing-workspace-shell/)
  assert.match(elements.workspace.innerHTML, /drawing-right-dock/)
  assert.match(elements.workspace.innerHTML, /Rate Inspector/)
  assert.match(elements.workspace.innerHTML, /PDF measurement \+ DXF index are ready/)
  assert.match(elements.workspace.innerHTML, /pdf-page-canvas/)
  assert.match(elements.workspace.innerHTML, /measurement-overlay/)
  assert.match(elements.workspace.innerHTML, /start-measure/)
  assert.match(appSource, /function startCanvasMeasurement\(kind = "length"\)/)
  assert.match(appSource, /function loadDrawingPage\(\)/)
  assert.match(appSource, /activeView = "boq"/)
  assert.match(appSource, /pdf-question-form/)
  assert.match(appSource, /renderDocumentIntelligencePanel/)
  assert.match(appSource, /measurement-group-form/)
  assert.match(appSource, /createMeasurementGroup/)
  assert.match(elements.workspace.innerHTML, /Dimension Groups/)
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8"), /renderPdfPage:/)
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8"), /ipcMain\.handle\("pdf:extract"/)
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8"), /ipcMain\.handle\("pdf:render-page"/)
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/main.cjs"), "utf8"), /ipcMain\.handle\("cad:inspect"/)
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8"), /inspectCadDocument:/)

  window.__QESTIMATest.openView("models")
  assert.match(elements.workspace.innerHTML, /IFC &amp; Model Mapping/)
  assert.match(elements.workspace.innerHTML, /Element Mapping/)
  assert.match(elements.workspace.innerHTML, /AI \/ IFC Suggested/)
  window.__QESTIMATest.openView("owner_portal")
  assert.match(elements.workspace.innerHTML, /Owner Portal/)
  assert.match(elements.workspace.innerHTML, /Tenant isolation active/)
  assert.match(fs.readFileSync(path.join(__dirname, "../app/index.html"), "utf8"), /src="collaboration\.js"/)
  assert.match(fs.readFileSync(path.join(__dirname, "../app/index.html"), "utf8"), /src="ifc\.js"/)
  assert.match(fs.readFileSync(path.join(__dirname, "../electron/preload.cjs"), "utf8"), /centralRequest:/)
  assert.match(fs.readFileSync(path.join(__dirname, "../revit-addin/QestimaRevitBridge.cs"), "utf8"), /ExportQestimaSnapshot/)
})
