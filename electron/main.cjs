const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron")
const { createServer } = require("node:http")
const { promises: fs } = require("node:fs")
const { createHash, verify: verifySignature } = require("node:crypto")
const path = require("node:path")
const os = require("node:os")
const { execFile } = require("node:child_process")
const { promisify } = require("node:util")
const { openStore, load: loadSqliteState, save: saveSqliteState, checkpoint: checkpointSqlite, close: closeSqlite } = require("./store.cjs")
const { createProjectPackage, readProjectPackage } = require("./project-package.cjs")
const { inspectCadBuffer } = require("./cad-engine.cjs")
const PdfEngine = require("./pdf-engine.cjs")
const { atomicReplace } = require("./recovery.cjs")

const execFileAsync = promisify(execFile)

const APP_PORT = 47531
const LEGACY_PROFILE = "MEP CostLab"
let mainWindow = null
let localServer = null
let dataStore = null

// Keep the Chromium profile used by v0.1.0 so its localStorage data migrates automatically.
app.setPath("userData", path.join(app.getPath("appData"), LEGACY_PROFILE))

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function dataFile(name = "qestima-data-v3.json") {
  return path.join(app.getPath("userData"), name)
}

async function ensureDataFolders() {
  await fs.mkdir(app.getPath("userData"), { recursive: true })
  await fs.mkdir(path.join(app.getPath("userData"), "attachments"), { recursive: true })
  dataStore ||= openStore(app)
}

async function atomicWrite(filePath, content) {
  atomicReplace(filePath, content)
}

async function startLocalServer() {
  const appRoot = path.join(app.getAppPath(), "app")
  localServer = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", `http://127.0.0.1:${APP_PORT}`)
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html"
      const resolved = path.resolve(appRoot, relative)
      if (!resolved.startsWith(path.resolve(appRoot) + path.sep) && resolved !== path.join(appRoot, "index.html")) {
        response.writeHead(403).end("Forbidden")
        return
      }
      const data = await fs.readFile(resolved)
      response.writeHead(200, {
        "Content-Type": contentTypes[path.extname(resolved).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      response.end(data)
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      response.end("Not Found")
    }
  })

  await new Promise((resolve, reject) => {
    localServer.once("error", reject)
    localServer.listen(APP_PORT, "127.0.0.1", resolve)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: "#0b1820",
    autoHideMenuBar: true,
    title: "QESTIMA — MEP Estimating System",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  Menu.setApplicationMenu(null)
  mainWindow.loadURL(`http://127.0.0.1:${APP_PORT}/`)
  mainWindow.once("ready-to-show", () => mainWindow.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })
}

ipcMain.handle("data:load", async () => {
  await ensureDataFolders()
  const sqliteState = loadSqliteState(dataStore)
  if (sqliteState) return sqliteState
  for (const name of ["qestima-data-v3.json", "qestima-data-v2.json", "costlap-data-v2.json"]) {
    try {
      return JSON.parse(await fs.readFile(dataFile(name), "utf8"))
    } catch {
      // Continue to the legacy v0.2 filename before falling back to Chromium storage.
    }
  }
  return null
})

async function listFiles(folder) {
  const output = []
  const entries = await fs.readdir(folder, { withFileTypes: true })
  for (const entry of entries) {
    const absolute = path.join(folder, entry.name)
    if (entry.isDirectory()) output.push(...await listFiles(absolute))
    else if (entry.isFile()) output.push(absolute)
    if (output.length >= 2000) break
  }
  return output.slice(0, 2000)
}

async function copyTree(source, destination) {
  await fs.mkdir(destination, { recursive: true })
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) await copyTree(from, to)
    else if (entry.isFile()) await fs.copyFile(from, to)
  }
}

async function restorePackageAttachments(root, manifest, destination, decrypted = {}) {
  const allowedRoots = new Set(["attachments", "documents", "drawings", "quotations", "revisions"])
  const files = Array.isArray(manifest?.files) ? manifest.files : []
  for (const relative of files) {
    const normalized = String(relative || "").replace(/\\/g, "/")
    const [category] = normalized.split("/")
    if (!allowedRoots.has(category) || !normalized.includes("/")) continue
    const safe = normalized.split("/").filter(Boolean)
    if (safe.some((part) => part === "." || part === "..")) continue
    const source = path.resolve(root, ...safe)
    if (!source.startsWith(`${path.resolve(root)}${path.sep}`)) continue
    const targetName = path.basename(source)
    if (!targetName || targetName === "." || targetName === "..") continue
    try {
      const stat = await fs.stat(source)
      if (!stat.isFile()) continue
      // Attachment ids remain stable local filenames.  Category folders are
      // an interchange concern; the desktop vault keeps its flat, safe
      // attachment namespace so existing project links keep working.
      const bytes = decrypted[relative] || await fs.readFile(source)
      const target = path.join(destination, targetName)
      try {
        const existing = await fs.readFile(target)
        if (!existing.equals(bytes)) throw new Error(`ATTACHMENT_COLLISION:${targetName}`)
      } catch (error) { if (error.code !== "ENOENT") throw error; await fs.writeFile(target, bytes, { flag: "wx" }) }
    } catch (error) {
      // A checksum-verified package can still contain a file removed by an
      // operator between verification and copy.  State restore remains
      // possible and the missing attachment is visible in the document list.
      throw error
    }
  }
}

ipcMain.handle("project:export-package", async (_event, payload = {}) => {
  await ensureDataFolders()
  const pick = await dialog.showOpenDialog(mainWindow, { title: "اختيار مكان حزمة مشروع QESTIMA", properties: ["openDirectory", "createDirectory"] })
  if (pick.canceled || !pick.filePaths[0]) return null
  const target = path.join(pick.filePaths[0], `QESTIMA-Project-${new Date().toISOString().replace(/[:.]/g, "-")}`)
  const original = payload?.state || payload
  const selected = original?.projects?.find((entry) => entry.id === original.activeProjectId)
  if (!selected) throw new Error("PROJECT_REQUIRED")
  const resourceIds = new Set(Object.values(selected.analyses || {}).flatMap((analysis) => (analysis.lines || []).map((line) => line.resourceId)))
  const supplierIds = new Set((selected.quotes || []).map((quote) => quote.supplierId))
  const state = { schemaVersion: original.schemaVersion, appVersion: original.appVersion, projects: [selected], activeProjectId: selected.id, resources: (original.resources || []).filter((entry) => resourceIds.has(entry.id)), suppliers: (original.suppliers || []).filter((entry) => supplierIds.has(entry.id)) }
  const passphrase = String(payload?.passphrase || "")
  const project = state?.projects?.find((entry) => entry.id === state?.activeProjectId) || state?.projects?.[0]
  const attachmentIds = [...new Set([...[(project?.documents || []), (project?.quotes || [])].flat().map(entry => entry.attachment?.id), ...(project?.tenderIntake || []).map(entry => entry.source?.attachmentId)].filter(Boolean))]
  createProjectPackage({ state, passphrase, attachmentIds, sourceAttachments: path.join(app.getPath("userData"), "attachments"), targetRoot: target, key: dataStore.key, appVersion: state?.appVersion || "", keySource: "local-vault" })
  return target
})

ipcMain.handle("project:import-package", async (_event, passphrase = "") => {
  await ensureDataFolders()
  const pick = await dialog.showOpenDialog(mainWindow, { title: "استعادة حزمة مشروع QESTIMA", properties: ["openDirectory"] })
  if (pick.canceled || !pick.filePaths[0]) return null
  const root = pick.filePaths[0]
  const imported = readProjectPackage({ root, passphrase: String(passphrase || ""), key: dataStore.key })
  await atomicWrite(dataFile(`pre-import-${Date.now()}.encrypted-backup`), require("./store.cjs").encrypt(loadSqliteState(dataStore), dataStore.key))
  await restorePackageAttachments(root, imported.manifest, path.join(app.getPath("userData"), "attachments"), imported.attachments)
  return imported.state
})

// Chromium's printToPDF is used instead of the browser print dialog for the
// desktop Report Center. A hidden, isolated window keeps the working project
// UI untouched while still honoring the report's CSS page size, backgrounds,
// tables and explicit headers/footers.
async function renderPdfFromHtml(html) {
  if (typeof html !== "string" || html.length < 100) throw new Error("Invalid report HTML")
  let reportWindow = null
  try {
    reportWindow = new BrowserWindow({
      show: false,
      width: 1400,
      height: 1000,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    await reportWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`)
    return await reportWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, marginsType: "none" })
  } finally {
    if (reportWindow && !reportWindow.isDestroyed()) reportWindow.close()
  }
}

ipcMain.handle("report:pdf", async (_event, html, suggestedName = "QESTIMA-Report.pdf") => {
  const pdf = await renderPdfFromHtml(html)
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "حفظ تقرير QESTIMA PDF",
    defaultPath: path.join(app.getPath("downloads"), path.basename(String(suggestedName).replace(/[\\/:*?"<>|]+/g, "-") || "QESTIMA-Report.pdf")),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  })
  if (result.canceled || !result.filePath) return null
  await fs.writeFile(result.filePath, pdf)
  return result.filePath
})

ipcMain.handle("report:pack", async (_event, payload = {}) => {
  if (typeof payload.html !== "string" || payload.html.length < 100) throw new Error("Invalid report HTML")
  if (typeof payload.workbookBase64 !== "string" || payload.workbookBase64.length < 20) throw new Error("Invalid formatted workbook")
  if (payload.html.length > 8_000_000 || payload.workbookBase64.length > 80_000_000) throw new Error("Report pack is too large")
  const pick = await dialog.showOpenDialog(mainWindow, { title: "اختيار مجلد حفظ Tender Submission Pack", properties: ["openDirectory", "createDirectory"] })
  if (pick.canceled || !pick.filePaths[0]) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, "-")
  const requested = String(payload.suggestedName || "QESTIMA-Tender-Submission-Pack").replace(/[\\/:*?"<>|]+/g, "-").replace(/\.pdf$/i, "")
  const target = path.join(pick.filePaths[0], `${requested}-${stamp}`)
  await fs.mkdir(path.join(target, "Tender Documents"), { recursive: true })
  const pdf = await renderPdfFromHtml(payload.html)
  const files = []
  const pdfName = `${requested}.pdf`
  const workbookName = `${requested}.xlsx`
  await fs.writeFile(path.join(target, pdfName), pdf)
  files.push(pdfName)
  await fs.writeFile(path.join(target, workbookName), Buffer.from(payload.workbookBase64, "base64"))
  files.push(workbookName)
  const attachmentIds = Array.isArray(payload.attachmentIds) ? payload.attachmentIds.slice(0, 500) : []
  const copiedAttachments = []
  for (const rawId of attachmentIds) {
    const sourceName = path.basename(String(rawId || ""))
    if (!sourceName || sourceName === "." || sourceName === "..") continue
    const source = path.join(app.getPath("userData"), "attachments", sourceName)
    try {
      await fs.stat(source)
      const targetName = sourceName.replace(/[\\/:*?"<>|]+/g, "-")
      await fs.copyFile(source, path.join(target, "Tender Documents", targetName))
      copiedAttachments.push(targetName)
    } catch {
      // A missing attachment is recorded in the manifest rather than blocking
      // delivery of the report outputs.
    }
  }
  const manifest = {
    format: "qestima-tender-submission-pack",
    version: 1,
    generatedAt: new Date().toISOString(),
    appVersion: payload.appVersion || "",
    report: payload.manifest || {},
    files: [...files, ...copiedAttachments.map((name) => path.join("Tender Documents", name))],
    missingAttachmentIds: attachmentIds.filter((id) => !copiedAttachments.includes(path.basename(String(id || "")))),
  }
  await fs.writeFile(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")
  return target
})

async function storeTenderDocuments(paths) {
  await ensureDataFolders()
  const output = []
  for (let index = 0; index < paths.length; index += 1) {
    const source = paths[index]
    const stat = await fs.stat(source)
    if (!stat.isFile()) continue
    const originalName = path.basename(source)
    const safeName = originalName.replace(/[^\p{L}\p{N}._-]+/gu, "-")
    const storedName = `${Date.now()}-${index}-${safeName}`
    const destination = path.join(app.getPath("userData"), "attachments", storedName)
    const content = await fs.readFile(source)
    await fs.writeFile(destination, content)
    output.push({
      id: storedName,
      name: originalName,
      originalName,
      size: stat.size,
      fileType: path.extname(originalName).slice(1).toUpperCase() || "FILE",
      hash: createHash("sha256").update(content).digest("hex"),
    })
  }
  return output
}

ipcMain.handle("tender:pick-documents", async (_event, mode = "files") => {
  const isFolder = mode === "folder"
  const isZip = mode === "zip"
  const result = await dialog.showOpenDialog(mainWindow, {
    title: isFolder ? "اختيار مجلد مستندات المناقصة" : isZip ? "اختيار ملف ZIP" : "اختيار مستندات المناقصة",
    properties: isFolder ? ["openDirectory"] : isZip ? ["openFile"] : ["openFile", "multiSelections"],
    filters: isFolder ? undefined : isZip
      ? [{ name: "ZIP", extensions: ["zip"] }]
      : [
          { name: "Tender Documents", extensions: ["pdf", "dwg", "dxf", "ifc", "xlsx", "xls", "docx", "doc", "zip", "jpg", "jpeg", "png", "txt"] },
          { name: "All Files", extensions: ["*"] },
        ],
  })
  if (result.canceled || !result.filePaths.length) return []
  const selected = isFolder ? await listFiles(result.filePaths[0]) : result.filePaths
  return storeTenderDocuments(selected)
})

ipcMain.handle("cad:pick", async (_event, format = "DXF") => {
  const normalized = String(format || "DXF").toUpperCase()
  const extensions = normalized === "DWG" ? ["dwg"] : ["dxf"]
  const result = await dialog.showOpenDialog(mainWindow, { title: `اختيار ملف ${normalized}`, properties: ["openFile"], filters: [{ name: normalized, extensions }, { name: "CAD", extensions: ["dxf", "dwg"] }] })
  if (result.canceled || !result.filePaths[0]) return null
  return (await storeTenderDocuments([result.filePaths[0]]))[0] || null
})

ipcMain.handle("data:save", async (_event, state) => {
  await ensureDataFolders()
  if (saveSqliteState(dataStore, state)) { checkpointSqlite(dataStore); return { savedAt: new Date().toISOString(), storage: "sqlite-encrypted-normalized" } }
  await atomicWrite(dataFile(), JSON.stringify(state, null, 2))
  return { savedAt: new Date().toISOString(), storage: "legacy-json" }
})

ipcMain.handle("license:verify-token", async (_event, token) => {
  try {
    // Trust is configured by the publisher, never supplied by the renderer.
    const publicKeyPem = await fs.readFile(path.join(app.getAppPath(), "license-public.pem"), "utf8")
    const [header, payload, signature] = String(token || "").split(".")
    if (!header || !payload || !signature || !publicKeyPem) return { ok: false, reason: "INVALID_TOKEN" }
    const signingInput = `${header}.${payload}`
    const signatureBytes = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64")
    const verified = verifySignature(null, Buffer.from(signingInput), publicKeyPem, signatureBytes)
    const claims = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"))
    if (!Number.isFinite(claims.exp) || !Number.isFinite(claims.nbf) || claims.exp <= claims.nbf) return { ok: false, reason: "INVALID_LICENSE_DATES" }
    const now = Math.floor(Date.now() / 1000)
    const grace = Math.max(0, Number(claims.offlineGraceDays || 0)) * 86400
    const expired = now > Number(claims.exp)
    const notYet = Number.isFinite(Number(claims.nbf)) && now < Number(claims.nbf)
    const suspended = ["suspended", "revoked"].includes(String(claims.status || "").toLowerCase())
    return { ok: verified && !expired && !notYet && !suspended, verified, expired, notYet, suspended, claims }
  } catch { return { ok: false, reason: "TOKEN_VERIFICATION_FAILED" } }
})

ipcMain.handle("updates:verify-manifest", async (_event, manifest = {}, publicKeyPem = "") => {
  try {
    if (!manifest.signature || !publicKeyPem) return { ok: false, reason: "UPDATE_SIGNATURE_REQUIRED" }
    const copy = { ...manifest }; const signature = String(copy.signature); delete copy.signature
    const canonical = JSON.stringify(Object.keys(copy).sort().reduce((result, key) => { result[key] = copy[key]; return result }, {}))
    const signatureBytes = Buffer.from(signature.replace(/-/g, "+").replace(/_/g, "/"), "base64")
    const verified = verifySignature(null, Buffer.from(canonical), publicKeyPem, signatureBytes)
    return { ok: verified, verified, version: manifest.version || "", publicKeyId: manifest.publicKeyId || "" }
  } catch (error) { return { ok: false, reason: "UPDATE_SIGNATURE_VERIFICATION_FAILED", error: error?.message || String(error) } }
})

ipcMain.handle("backup:export", async (_event, state) => {
  const suggested = `QESTIMA-Backup-${new Date().toISOString().slice(0, 10)}.json`
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "حفظ نسخة احتياطية من QESTIMA",
    defaultPath: suggested,
    filters: [{ name: "QESTIMA Backup", extensions: ["json"] }],
  })
  if (result.canceled || !result.filePath) return null
  await atomicWrite(result.filePath, JSON.stringify(state, null, 2))
  return result.filePath
})

ipcMain.handle("backup:import", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "استعادة نسخة QESTIMA",
    properties: ["openFile"],
    filters: [{ name: "QESTIMA Backup", extensions: ["json"] }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return JSON.parse(await fs.readFile(result.filePaths[0], "utf8"))
})

ipcMain.handle("attachment:pick", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "إرفاق عرض السعر الأصلي",
    properties: ["openFile"],
    filters: [
      { name: "Quotations", extensions: ["pdf", "xlsx", "xls", "docx", "jpg", "jpeg", "png"] },
      { name: "All Files", extensions: ["*"] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return null
  await ensureDataFolders()
  const source = result.filePaths[0]
  const storedName = `${Date.now()}-${path.basename(source).replace(/[^\p{L}\p{N}._-]+/gu, "-")}`
  const destination = path.join(app.getPath("userData"), "attachments", storedName)
  await fs.copyFile(source, destination)
  return { id: storedName, name: path.basename(source) }
})

ipcMain.handle("attachment:open", async (_event, attachmentId) => {
  const safeName = path.basename(String(attachmentId || ""))
  if (!safeName) return "invalid"
  return shell.openPath(path.join(app.getPath("userData"), "attachments", safeName))
})

ipcMain.handle("pdf:read-bytes", async (_event, id) => {
  const safe = path.basename(String(id || ""))
  if (!safe || safe !== id) throw new Error("INVALID_ATTACHMENT_ID")
  const file = path.join(app.getPath("userData"), "attachments", safe)
  const stat = await fs.stat(file)
  if (stat.size > 150 * 1024 * 1024) throw new Error("PDF_TOO_LARGE")
  const bytes = await fs.readFile(file)
  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("PDF_REQUIRED")
  return bytes.toString("base64")
})

// IFC files are kept in the same encrypted local attachment area as tender
// documents. Parsing stays in the renderer's auditable model module; this IPC
// only chooses and reads the source text, so an import can never silently
// change BOQ quantities.
ipcMain.handle("model:pick-ifc", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "اختيار نموذج IFC",
    properties: ["openFile"],
    filters: [{ name: "IFC / Revit snapshot", extensions: ["ifc", "json"] }, { name: "All Files", extensions: ["*"] }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return (await storeTenderDocuments([result.filePaths[0]]))[0] || null
})

ipcMain.handle("model:extract-ifc", async (_event, attachmentId) => {
  try {
    const { source, stat } = await storedAttachmentPath(attachmentId)
    if (stat.size > 120 * 1024 * 1024) return { ok: false, reason: "IFC_TOO_LARGE", text: "", warnings: ["IFC model exceeds the 120 MB safety limit."] }
    return { ok: true, text: await fs.readFile(source, "utf8"), fileName: path.basename(source), size: stat.size }
  } catch (error) {
    return { ok: false, reason: "IFC_READ_FAILED", text: "", warnings: [error?.message || String(error)] }
  }
})

function dwgConverterExecutable() {
  const configured = String(process.env.QESTIMA_DWG_CONVERTER || "").trim()
  const binary = process.platform === "win32" ? "oda2dxf.exe" : "oda2dxf"
  const candidates = [configured, path.join(process.resourcesPath || "", "tools", binary), path.join(app.getAppPath(), "tools", binary), path.join(__dirname, "tools", binary)].filter(Boolean)
  for (const candidate of candidates) { try { require("node:fs").statSync(candidate); return candidate } catch {} }
  return ""
}

async function inspectDwgWithConverter(source, fileName) {
  const converter = dwgConverterExecutable()
  if (!converter) return { ok: false, format: "DWG", reason: "DWG_CONVERTER_REQUIRED", warnings: ["لا يوجد محوّل DWG معتمد. أضف QESTIMA_DWG_CONVERTER أو ضع oda2dxf.exe داخل مجلد tools."] }
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "qestima-dwg-"))
  const output = path.join(folder, "converted.dxf")
  try {
    await execFileAsync(converter, [source, output], { maxBuffer: 8 * 1024 * 1024, windowsHide: true })
    const converted = await fs.readFile(output)
    const result = inspectCadBuffer(converted, { fileName: `${fileName}.dxf`, entityLimit: 20000 })
    return result.ok ? { ...result, format: "DWG", convertedFrom: fileName, warnings: ["تمت قراءة DWG عبر محوّل خارجي؛ راجع المقياس والطبقات قبل اعتماد الكمية."] } : result
  } catch (error) {
    return { ok: false, format: "DWG", reason: "DWG_CONVERSION_FAILED", error: error?.message || String(error), warnings: ["فشل المحوّل الخارجي. لا يتم إنشاء كمية تلقائيًا."] }
  } finally { await fs.rm(folder, { recursive: true, force: true }).catch(() => {}) }
}

ipcMain.handle("cad:inspect", async (_event, attachmentId) => {
  try {
    const { source, stat, safeName } = await storedAttachmentPath(attachmentId)
    if (stat.size > 250 * 1024 * 1024) return { ok: false, reason: "CAD_TOO_LARGE", warnings: ["CAD file exceeds the 250 MB safety limit."] }
    const fileName = safeName
    const buffer = await fs.readFile(source)
    const direct = inspectCadBuffer(buffer, { fileName, entityLimit: 20000 })
    if (direct.format === "DWG") return inspectDwgWithConverter(source, fileName)
    return direct
  } catch (error) { return { ok: false, reason: "CAD_INSPECTION_FAILED", error: error?.message || String(error), warnings: [] } }
})

// The desktop shell can call a configured central API without exposing Node
// APIs to the page. Tokens are supplied by the signed-in client and are never
// persisted by this bridge.
ipcMain.handle("central:request", async (_event, payload = {}) => {
  try {
    const base = String(payload.baseUrl || "").replace(/\/+$/, "")
    const route = String(payload.path || "/health")
    const url = new URL(route, `${base}/`)
    if (!/^https?:$/.test(url.protocol)) throw new Error("CENTRAL_URL_INVALID")
    const method = String(payload.method || "GET").toUpperCase()
    const body = payload.body == null ? undefined : JSON.stringify(payload.body)
    if (body && body.length > 5 * 1024 * 1024) throw new Error("CENTRAL_REQUEST_TOO_LARGE")
    const result = await fetch(url, { method, headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(payload.token ? { Authorization: `Bearer ${String(payload.token)}` } : {}) }, body })
    const text = await result.text()
    let data; try { data = JSON.parse(text) } catch { data = { text: text.slice(0, 5000) } }
    return { ok: result.ok, status: result.status, data }
  } catch (error) {
    return { ok: false, status: 0, error: error?.message || String(error) }
  }
})

// PDF intelligence and page rendering are optional desktop capabilities. The
// app stays usable when Poppler/Tesseract are absent, but reports that state
// explicitly instead of silently inventing text or quantities.
async function storedAttachmentPath(attachmentId) {
  const safeName = path.basename(String(attachmentId || ""))
  if (!safeName || safeName === "." || safeName === "..") throw new Error("Invalid attachment id")
  const source = path.join(app.getPath("userData"), "attachments", safeName)
  const stat = await fs.stat(source)
  if (!stat.isFile()) throw new Error("Attachment is not a file")
  return { source, safeName, stat }
}

function pdfToolExecutable(command) {
  const binary = process.platform === "win32" ? `${command}.exe` : command
  const candidates = [
    path.join(process.resourcesPath || "", "tools", binary),
    path.join(app.getAppPath(), "tools", binary),
    path.join(__dirname, "tools", binary),
  ].filter(Boolean)
  // A packaged build can ship Poppler/Tesseract beside the app. During
  // development, falling back to PATH keeps the same IPC contract usable.
  for (const candidate of candidates) {
    try { require("node:fs").statSync(candidate); return candidate } catch {}
  }
  return command
}

async function runPdfTool(command, args, options = {}) {
  try {
    const result = await execFileAsync(pdfToolExecutable(command), args, { maxBuffer: options.maxBuffer || 80 * 1024 * 1024, windowsHide: true })
    return { ok: true, stdout: result.stdout || "", stderr: result.stderr || "" }
  } catch (error) {
    return { ok: false, error: error?.message || String(error), code: error?.code || "" }
  }
}

async function withPdfTempFolder(callback) {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "qestima-pdf-"))
  try { return await callback(folder) } finally { await fs.rm(folder, { recursive: true, force: true }).catch(() => {}) }
}

function splitPdfText(text, pageCount = 0) {
  const parts = String(text || "").split(/\f/).map((entry) => entry.replace(/\s+$/g, "").trim())
  if (pageCount > parts.length) while (parts.length < pageCount) parts.push("")
  return parts.map((entry, index) => ({ page: index + 1, text: entry })).filter((entry) => entry.text)
}

ipcMain.handle("pdf:extract", async (_event, attachmentId) => {
  try {
    const { source, stat } = await storedAttachmentPath(attachmentId)
    if (stat.size > 150 * 1024 * 1024) return { ok: false, reason: "PDF_TOO_LARGE", pages: [], warnings: ["PDF exceeds the 150 MB safety limit."] }
    const info = await runPdfTool("pdfinfo", [source], { maxBuffer: 2 * 1024 * 1024 })
    const metadata = PdfEngine.parsePdfInfo(info.stdout)
    const pageMatch = String(info.stdout || "").match(/^Pages:\s*(\d+)/im)
    const pageCount = Math.min(500, Math.max(0, Number(pageMatch?.[1] || 0)))
    const extracted = await runPdfTool("pdftotext", ["-layout", source, "-"])
    const textPages = extracted.ok ? splitPdfText(extracted.stdout, pageCount) : []
    const textLength = textPages.reduce((sum, page) => sum + page.text.length, 0)
    if (textLength >= 40) return { ...PdfEngine.classifyExtraction({ pages: textPages, pageCount: pageCount || textPages.length, textMethod: "pdftotext" }), metadata, warnings: info.ok ? [] : ["pdfinfo was unavailable; page count inferred from text."] }

    const warnings = []
    if (!extracted.ok) warnings.push("pdftotext unavailable or failed; OCR was attempted.")
    const ocrPages = await withPdfTempFolder(async (folder) => {
      const prefix = path.join(folder, "page")
      const rendered = await runPdfTool("pdftoppm", ["-r", "170", "-png", source, prefix], { maxBuffer: 8 * 1024 * 1024 })
      if (!rendered.ok) { warnings.push("Poppler pdftoppm is not installed; scanned PDF text is unavailable."); return [] }
      const names = (await fs.readdir(folder)).filter((name) => /^page-\d+\.png$/i.test(name)).sort((a, b) => Number(a.match(/(\d+)/)?.[1]) - Number(b.match(/(\d+)/)?.[1]))
      const results = []
      for (let index = 0; index < Math.min(names.length, 500); index += 1) {
        const imagePath = path.join(folder, names[index])
        let ocr = await runPdfTool("tesseract", [imagePath, "stdout", "-l", "ara+eng", "--psm", "6"], { maxBuffer: 8 * 1024 * 1024 })
        if (!ocr.ok) ocr = await runPdfTool("tesseract", [imagePath, "stdout", "-l", "eng", "--psm", "6"], { maxBuffer: 8 * 1024 * 1024 })
        if (ocr.ok && String(ocr.stdout).trim()) results.push({ page: index + 1, text: String(ocr.stdout).trim() })
        else warnings.push(`OCR failed on page ${index + 1}.`)
      }
      return results
    })
    if (ocrPages.length) return { ...PdfEngine.classifyExtraction({ pages: textPages, ocrPages, pageCount: pageCount || ocrPages.length, warnings, ocrMethod: "pdftoppm+tesseract" }), metadata }
    return { ok: false, reason: "PDF_TEXT_UNAVAILABLE", kind: "scanned_or_image", method: "unavailable", pageCount, pages: [], warnings, metadata }
  } catch (error) {
    return { ok: false, reason: "PDF_EXTRACTION_FAILED", error: error?.message || String(error), pages: [], warnings: [] }
  }
})

ipcMain.handle("pdf:render-page", async (_event, payload = {}) => {
  try {
    const { source } = await storedAttachmentPath(payload.attachmentId)
    const page = Math.max(1, Math.min(500, Math.round(Number(payload.page) || 1)))
    const dpi = Math.max(72, Math.min(300, Math.round(Number(payload.dpi) || 144)))
    // Page count is useful to the drawing workbench even when the user has
    // not run Smart Read yet. Keep it separate from extraction so opening a
    // PDF never changes tender data or creates an analysis record.
    const info = await runPdfTool("pdfinfo", [source], { maxBuffer: 2 * 1024 * 1024 })
    const pageMatch = String(info.stdout || "").match(/^Pages:\s*(\d+)/im)
    const pageCount = Math.min(500, Math.max(0, Number(pageMatch?.[1] || 0)))
    return await withPdfTempFolder(async (folder) => {
      const output = path.join(folder, "drawing")
      const rendered = await runPdfTool("pdftoppm", ["-f", String(page), "-l", String(page), "-singlefile", "-png", "-r", String(dpi), source, output], { maxBuffer: 8 * 1024 * 1024 })
      if (!rendered.ok) return { ok: false, reason: "PDF_RENDER_UNAVAILABLE", error: rendered.error, pageCount }
      const image = await fs.readFile(`${output}.png`)
      return { ok: true, page, dpi, pageCount, mime: "image/png", dataUrl: `data:image/png;base64,${image.toString("base64")}` }
    })
  } catch (error) {
    return { ok: false, reason: "PDF_RENDER_FAILED", error: error?.message || String(error) }
  }
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(async () => {
    await ensureDataFolders()
    await startLocalServer()
    createWindow()
  })
}

app.on("window-all-closed", () => {
  if (localServer) localServer.close()
  if (dataStore) { checkpointSqlite(dataStore); closeSqlite(dataStore); dataStore = null }
  app.quit()
})
