const path = require("node:path")
const fs = require("node:fs")
const crypto = require("node:crypto")
let DatabaseSync = null
try { ({ DatabaseSync } = require("node:sqlite")) } catch {}
const { encrypt, decrypt } = require("./store.cjs")

const PACKAGE_FORMAT = "qestima-project-package"
const PACKAGE_VERSION = 2

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function sha256Buffer(value) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function safeRelative(relative) {
  const normalized = path.posix.normalize(String(relative || "").replace(/\\/g, "/"))
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../") || path.posix.isAbsolute(normalized)) throw new Error("PACKAGE_PATH_INVALID")
  return normalized
}

function walkFiles(root, relative = "") {
  const folder = path.join(root, relative)
  const output = []
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const child = relative ? path.join(relative, entry.name) : entry.name
    if (entry.isDirectory()) output.push(...walkFiles(root, child))
    else if (entry.isFile()) output.push(child)
  }
  return output
}

function copyTreeContents(source, destination, prefix = "") {
  if (!source || !fs.existsSync(source)) return []
  const files = walkFiles(source)
  files.forEach((relative) => {
    const targetRelative = path.join(prefix, relative)
    const target = path.join(destination, targetRelative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(source, relative), target)
  })
  return files.map((relative) => path.posix.join(prefix.replace(/\\/g, "/"), relative.replace(/\\/g, "/")).replace(/^\//, ""))
}

function copySelectedFiles(source, destination, selected = []) {
  if (!source || !fs.existsSync(source)) return []
  const allowed = new Set(selected.map((value) => {
    const raw = String(value || "").replace(/\\/g, "/")
    try { return safeRelative(raw) } catch { return path.basename(raw) }
  }).filter(Boolean))
  if (!allowed.size) return []
  const files = walkFiles(source).filter((relative) => {
    const normalized = relative.replace(/\\/g, "/")
    return allowed.has(normalized) || allowed.has(path.basename(normalized))
  })
  files.forEach((relative) => {
    const target = path.join(destination, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(source, relative), target)
  })
  return files.map((relative) => relative.replace(/\\/g, "/").replace(/^\//, ""))
}

function attachmentCategory(category, fallback = "attachments") {
  const normalized = String(category || "").toLowerCase().replace(/[^a-z]+/g, "")
  if (normalized === "drawings" || normalized === "drawing") return "drawings"
  if (normalized === "quotations" || normalized === "quotation" || normalized === "quotes" || normalized === "quote") return "quotations"
  if (normalized === "revisions" || normalized === "revision" || normalized === "addenda" || normalized === "addendum") return "revisions"
  if (normalized === "documents" || normalized === "document" || normalized === "specifications" || normalized === "instructions" || normalized === "commercial" || normalized === "scope" || normalized === "forms" || normalized === "schedules" || normalized === "vendors" || normalized === "clarifications" || normalized === "boq") return "documents"
  return fallback
}

function attachmentDescriptors(state = {}) {
  const descriptors = new Map()
  ;(state.projects || []).forEach((project) => {
    ;(project.documents || []).forEach((document) => {
      const attachmentId = document?.attachment?.id
      if (attachmentId) descriptors.set(path.basename(String(attachmentId)), attachmentCategory(document.category))
    })
    ;(project.quotes || []).forEach((quote) => {
      const attachmentId = quote?.attachment?.id
      if (attachmentId) descriptors.set(path.basename(String(attachmentId)), "quotations")
    })
  })
  return descriptors
}

// Project packages keep a stable attachment id (the local filename) while
// placing the bytes in an auditable category folder.  Unknown/legacy files
// remain under attachments/ so older projects continue to restore cleanly.
function copyPackageAttachments(source, targetRoot, state, selected = null, key = null) {
  if (!source || !fs.existsSync(source)) return []
  const descriptors = attachmentDescriptors(state)
  const requested = Array.isArray(selected)
  const allowed = requested ? new Set(selected.map((value) => path.basename(String(value || ""))).filter(Boolean)) : null
  const files = walkFiles(source).filter((relative) => {
    if (!allowed) return true
    const normalized = relative.replace(/\\/g, "/")
    return allowed.has(normalized) || allowed.has(path.basename(normalized))
  })
  const copied = []
  files.forEach((relative) => {
    const fileName = path.basename(relative)
    const category = descriptors.get(fileName) || "attachments"
    const safeSourceRelative = safeRelative(relative)
    const targetRelative = path.posix.join(category, safeSourceRelative.replace(/\\/g, "/"))
    const target = path.join(targetRoot, targetRelative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (key) fs.writeFileSync(target, encrypt({ bytes: fs.readFileSync(path.join(source, safeSourceRelative)).toString("base64") }, key))
    else fs.copyFileSync(path.join(source, safeSourceRelative), target)
    copied.push(targetRelative)
  })
  return copied
}

function derivePackageKey(passphrase, salt) {
  if (!passphrase) return null
  return crypto.scryptSync(String(passphrase), Buffer.from(String(salt), "base64"), 32)
}

function base64url(value) { return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") }
function decodeBase64url(value) { return Buffer.from(String(value || "").replace(/-/g, "+").replace(/_/g, "/"), "base64") }
function packageSigningInput(manifest = {}) { const copy = { ...manifest }; delete copy.signature; return JSON.stringify(Object.keys(copy).sort().reduce((result, key) => { result[key] = copy[key]; return result }, {})) }

function packageDatabase(dbPath, state, key) {
  if (!DatabaseSync) throw new Error("SQLITE_RUNTIME_UNAVAILABLE")
  const db = new DatabaseSync(dbPath)
  try {
    db.exec(`
      PRAGMA journal_mode=DELETE;
      PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS package_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS encrypted_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS project_index (project_id TEXT PRIMARY KEY, tender_code TEXT, name TEXT, revision_no INTEGER, status TEXT);
    `)
    const at = new Date().toISOString()
    const meta = { format: PACKAGE_FORMAT, version: PACKAGE_VERSION, schemaVersion: Number(state?.schemaVersion || 0), createdAt: at }
    const insertMeta = db.prepare("INSERT OR REPLACE INTO package_meta(key,value) VALUES(?,?)")
    Object.entries(meta).forEach(([keyName, value]) => insertMeta.run(keyName, String(value)))
    db.prepare("INSERT OR REPLACE INTO encrypted_state(id,payload) VALUES(1,?)").run(encrypt(state, key))
    const insertProject = db.prepare("INSERT OR REPLACE INTO project_index(project_id,tender_code,name,revision_no,status) VALUES(?,?,?,?,?)")
    ;(state.projects || []).forEach((project) => insertProject.run(String(project.id || ""), "[encrypted]", "[encrypted]", Number(project.revisionNo || 0), String(project.status || "")))
  } finally { db.close() }
}

function createProjectPackage(options = {}) {
  if (!options.state || typeof options.state !== "object") throw new Error("PACKAGE_STATE_REQUIRED")
  if (!options.targetRoot) throw new Error("PACKAGE_TARGET_REQUIRED")
  // A portable package can be created from its passphrase alone.  The local
  // vault key is required only for machine-bound packages, never as a hidden
  // second secret for a user who explicitly chose portable encryption.
  if (!options.key && !options.passphrase) throw new Error("PACKAGE_KEY_REQUIRED")
  const targetRoot = path.resolve(options.targetRoot)
  const salt = options.passphrase ? crypto.randomBytes(16).toString("base64") : ""
  const packageKey = options.passphrase ? derivePackageKey(options.passphrase, salt) : options.key
  if (!packageKey) throw new Error("PACKAGE_KEY_REQUIRED")
  fs.mkdirSync(targetRoot, { recursive: true })
  const directories = ["database", "attachments", "documents", "drawings", "quotations", "revisions", "exports"]
  directories.forEach((directory) => fs.mkdirSync(path.join(targetRoot, directory), { recursive: true }))
  const dbRelative = "database/project.sqlite"
  packageDatabase(path.join(targetRoot, dbRelative), options.state, packageKey)
  const copied = copyPackageAttachments(options.sourceAttachments, targetRoot, options.state, options.attachmentIds, packageKey)
  const files = [dbRelative.replace(/\\/g, "/"), ...copied]
  const checksums = {}
  files.forEach((relative) => { checksums[relative] = sha256File(path.join(targetRoot, relative)) })
  const checksumDocument = { algorithm: "sha256", files: checksums }
  const checksumJson = JSON.stringify(checksumDocument, null, 2)
  const createdAt = new Date().toISOString()
  const manifest = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    packageId: String(options.packageId || `pkg-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`),
    appVersion: String(options.appVersion || options.state.appVersion || ""),
    schemaVersion: Number(options.state.schemaVersion || 0),
    createdAt,
    encryption: { algorithm: "AES-256-GCM", state: "encrypted", attachments: "encrypted", keySource: options.passphrase ? "passphrase" : (options.keySource || "local-vault"), ...(salt ? { salt } : {}) },
    projects: (options.state.projects || []).map((project) => ({ id: project.id, revisionNo: Number(project.revisionNo || 0) })),
    files,
    database: dbRelative,
    attachmentRoot: "attachments",
    checksumsSha256: sha256Buffer(checksumJson),
  }
  if (options.packagePrivateKeyPem) {
    manifest.publicKeyId = String(options.packagePublicKeyId || "")
    manifest.signature = base64url(crypto.sign(null, Buffer.from(packageSigningInput(manifest)), options.packagePrivateKeyPem))
  }
  fs.writeFileSync(path.join(targetRoot, "checksums.json"), checksumJson, { mode: 0o600 })
  fs.writeFileSync(path.join(targetRoot, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 })
  return { root: targetRoot, manifest, checksums }
}

function verifyProjectPackage(root, options = {}) {
  if (!root) throw new Error("PACKAGE_ROOT_REQUIRED")
  const packageRoot = path.resolve(root)
  const manifestPath = path.join(packageRoot, "manifest.json")
  const checksumsPath = path.join(packageRoot, "checksums.json")
  if (!fs.existsSync(manifestPath) || !fs.existsSync(checksumsPath)) throw new Error("PACKAGE_MANIFEST_MISSING")
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  if (manifest.format !== PACKAGE_FORMAT || Number(manifest.version) !== PACKAGE_VERSION) throw new Error("PACKAGE_VERSION_UNSUPPORTED")
  if (manifest.signature) {
    if (!options.publicKeyPem) { if (options.requireSignature) throw new Error("PACKAGE_SIGNATURE_KEY_REQUIRED") }
    else {
      let valid = false
      try { valid = crypto.verify(null, Buffer.from(packageSigningInput(manifest)), options.publicKeyPem, decodeBase64url(manifest.signature)) } catch {}
      if (!valid) throw new Error("PACKAGE_SIGNATURE_INVALID")
    }
  } else if (options.requireSignature) throw new Error("PACKAGE_SIGNATURE_REQUIRED")
  const checksumBytes = fs.readFileSync(checksumsPath)
  if (manifest.checksumsSha256 && sha256Buffer(checksumBytes) !== String(manifest.checksumsSha256)) throw new Error("PACKAGE_CHECKSUM_MANIFEST_TAMPERED")
  if (options.requireSignature && !manifest.checksumsSha256) throw new Error("PACKAGE_CHECKSUM_UNBOUND")
  const checksumDocument = JSON.parse(checksumBytes.toString("utf8"))
  if (checksumDocument.algorithm !== "sha256" || !checksumDocument.files || typeof checksumDocument.files !== "object" || Array.isArray(checksumDocument.files)) throw new Error("PACKAGE_CHECKSUM_FORMAT_INVALID")
  const files = checksumDocument.files || {}
  const failures = []
  const declared = new Set([
    String(manifest.database || "").replace(/\\/g, "/"),
    ...(Array.isArray(manifest.files) ? manifest.files.map((entry) => String(entry || "").replace(/\\/g, "/")) : []),
  ].filter(Boolean))
  // Every database/attachment advertised by the manifest must be covered by
  // a checksum. This stops a partial package from looking valid after a
  // crash, and keeps the inventory auditable during restore.
  if (!Array.isArray(manifest.files) || !manifest.files.length || !manifest.database) failures.push("manifest.files")
  if (new Set((manifest.files || []).map((entry) => String(entry || "").replace(/\\/g, "/"))).size !== (manifest.files || []).length) failures.push("manifest.duplicate-files")
  declared.forEach((relative) => { if (!Object.prototype.hasOwnProperty.call(files, relative)) failures.push(relative) })
  Object.keys(files).forEach((relative) => { if (!declared.has(String(relative).replace(/\\/g, "/"))) failures.push(relative) })
  Object.entries(files).forEach(([relative, expected]) => {
    try {
      const safe = safeRelative(relative)
      const actualPath = path.join(packageRoot, safe)
      if (!/^[a-f0-9]{64}$/i.test(String(expected)) || !fs.existsSync(actualPath) || !fs.statSync(actualPath).isFile() || sha256File(actualPath) !== expected) failures.push(relative)
    } catch { failures.push(relative) }
  })
  if (failures.length) throw new Error(`PACKAGE_INTEGRITY_FAILED:${failures.join(",")}`)
  return { manifest, checksums: files, files: Object.keys(files) }
}

function readProjectPackage(options = {}) {
  if (!options.root) throw new Error("PACKAGE_ROOT_REQUIRED")
  const root = path.resolve(String(options.root))
  const legacyState = path.join(root, "state.json")
  if (!fs.existsSync(path.join(root, "manifest.json")) && fs.existsSync(legacyState)) return { state: JSON.parse(fs.readFileSync(legacyState, "utf8")), manifest: { format: "qestima-project-legacy", version: 1 }, warnings: ["Legacy unencrypted JSON package imported; export a new encrypted package after restore."] }
  const verified = verifyProjectPackage(root, options)
  const encryption = verified.manifest.encryption || {}
  const packageKey = encryption.keySource === "passphrase"
    ? derivePackageKey(options.passphrase, encryption.salt)
    : options.key
  if (!packageKey) throw new Error(encryption.keySource === "passphrase" ? "PACKAGE_PASSPHRASE_REQUIRED" : "PACKAGE_KEY_REQUIRED")
  if (!DatabaseSync) throw new Error("SQLITE_RUNTIME_UNAVAILABLE")
  const databaseRelative = safeRelative(verified.manifest.database)
  if (!databaseRelative.toLowerCase().endsWith(".sqlite")) throw new Error("PACKAGE_DATABASE_INVALID")
  const databasePath = path.resolve(root, databaseRelative)
  if (!databasePath.startsWith(`${root}${path.sep}`)) throw new Error("PACKAGE_DATABASE_INVALID")
  const db = new DatabaseSync(databasePath)
  try {
    const row = db.prepare("SELECT payload FROM encrypted_state WHERE id=1").get()
    if (!row) throw new Error("PACKAGE_STATE_MISSING")
    try {
      const attachments = {}
      if (verified.manifest.encryption?.attachments === "encrypted") {
        for (const relative of verified.manifest.files || []) {
          if (relative === verified.manifest.database) continue
          attachments[relative] = Buffer.from(decrypt(fs.readFileSync(path.join(root, safeRelative(relative)), "utf8"), packageKey).bytes, "base64")
        }
      }
      return { state: decrypt(row.payload, packageKey), manifest: verified.manifest, attachments, warnings: [] }
    } catch { throw new Error("PACKAGE_DECRYPT_FAILED") }
  } finally { db.close() }
}

module.exports = { PACKAGE_FORMAT, PACKAGE_VERSION, derivePackageKey, packageSigningInput, createProjectPackage, verifyProjectPackage, readProjectPackage, sha256File }
