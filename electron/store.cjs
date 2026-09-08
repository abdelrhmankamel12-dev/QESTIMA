const path = require("node:path")
const fs = require("node:fs")
const os = require("node:os")
const crypto = require("node:crypto")

let DatabaseSync = null
try { ({ DatabaseSync } = require("node:sqlite")) } catch {}

const STORE_SCHEMA = 2

function userDataPath(app) {
  return path.resolve(String(app?.getPath?.("userData") || path.join(process.cwd(), ".qestima-user")))
}

function legacyKeyFor(app) {
  return crypto.createHash("sha256").update(`${userDataPath(app)}:QESTIMA-vault`).digest()
}

function safeStorage() {
  try {
    const { safeStorage } = require("electron")
    return safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage : null
  } catch {
    return null
  }
}

function fallbackKey(app) {
  const dataPath = userDataPath(app)
  const identity = `${dataPath}|${os.hostname()}|${os.userInfo?.().username || process.env.USERNAME || process.env.USER || "user"}|QESTIMA-vault-v2`
  return crypto.scryptSync(identity, "QESTIMA-local-vault", 32)
}

function keyFor(app) {
  const dataPath = userDataPath(app)
  fs.mkdirSync(dataPath, { recursive: true })
  const keyFile = path.join(dataPath, "vault.key")
  const storage = safeStorage()
  if (storage) {
    try {
      const record = JSON.parse(fs.readFileSync(keyFile, "utf8"))
      if (record?.version === 1 && record.encrypted) {
        const plaintext = storage.decryptString(Buffer.from(record.encrypted, "base64"))
        const key = Buffer.from(String(plaintext), "base64")
        if (key.length === 32) return key
      }
    } catch {}
    try {
      const key = crypto.randomBytes(32)
      const encrypted = storage.encryptString(key.toString("base64"))
      fs.writeFileSync(keyFile, JSON.stringify({ version: 1, algorithm: "electron-safeStorage", encrypted: encrypted.toString("base64"), createdAt: new Date().toISOString() }), { encoding: "utf8", mode: 0o600 })
      return key
    } catch {}
  }
  // Development/Linux fallback. The state remains authenticated and encrypted;
  // production Windows builds use Electron safeStorage above.
  return fallbackKey(app)
}

function normalizeKey(key) {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(String(key || ""), "base64")
  if (buffer.length !== 32) throw new Error("QESTIMA vault key must be 32 bytes")
  return buffer
}

function encrypt(value, key) {
  const vaultKey = normalizeKey(key)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", vaultKey, iv)
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return JSON.stringify({ v: 2, alg: "AES-256-GCM", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), body: body.toString("base64") })
}

function decrypt(payload, key) {
  const data = typeof payload === "string" ? JSON.parse(payload) : payload
  const decipher = crypto.createDecipheriv("aes-256-gcm", normalizeKey(key), Buffer.from(data.iv, "base64"))
  decipher.setAuthTag(Buffer.from(data.tag, "base64"))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.body, "base64")), decipher.final()]).toString("utf8"))
}

function createSchema(db) {
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL,
      schema_version INTEGER NOT NULL DEFAULT ${STORE_SCHEMA}, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_records (
      project_id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT '', workspace_id TEXT DEFAULT '',
      revision_no INTEGER NOT NULL DEFAULT 0, status TEXT DEFAULT '', payload TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS boq_items (
      project_id TEXT NOT NULL, item_id TEXT NOT NULL, item_no TEXT DEFAULT '', description TEXT DEFAULT '',
      unit TEXT DEFAULT '', quantity REAL NOT NULL DEFAULT 0, payload TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(project_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS resources (
      resource_id TEXT PRIMARY KEY, code TEXT DEFAULT '', name TEXT DEFAULT '', resource_type TEXT DEFAULT '',
      unit TEXT DEFAULT '', rate REAL NOT NULL DEFAULT 0, payload TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      project_id TEXT NOT NULL, document_id TEXT NOT NULL, category TEXT DEFAULT '', revision TEXT DEFAULT '',
      status TEXT DEFAULT '', payload TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(project_id, document_id)
    );
    CREATE TABLE IF NOT EXISTS rate_analyses (
      project_id TEXT NOT NULL, item_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(project_id, item_id)
    );
    CREATE TABLE IF NOT EXISTS quotes (
      project_id TEXT NOT NULL, quote_id TEXT NOT NULL, supplier_id TEXT DEFAULT '', payload TEXT NOT NULL,
      updated_at TEXT NOT NULL, PRIMARY KEY(project_id, quote_id)
    );
    CREATE TABLE IF NOT EXISTS revision_snapshots (
      project_id TEXT NOT NULL, revision_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
      PRIMARY KEY(project_id, revision_id)
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      entry_id TEXT PRIMARY KEY, project_id TEXT DEFAULT '', actor_id TEXT DEFAULT '', action TEXT DEFAULT '',
      detail TEXT DEFAULT '', timestamp TEXT NOT NULL, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_boq_description ON boq_items(description);
    CREATE INDEX IF NOT EXISTS idx_resources_code ON resources(code);
    CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
    CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(project_id, timestamp);
  `)
  const applied = db.prepare("SELECT version FROM schema_migrations WHERE version=?").get(STORE_SCHEMA)
  if (!applied) db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(?,?)").run(STORE_SCHEMA, new Date().toISOString())
}

function openStore(app, options = {}) {
  const file = path.resolve(options.filePath || path.join(userDataPath(app), "qestima.db"))
  if (!DatabaseSync) throw new Error("SQLITE_RUNTIME_UNAVAILABLE: install the bundled QESTIMA desktop runtime")
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  createSchema(db)
  return { kind: "sqlite", file, db, key: options.key ? normalizeKey(options.key) : keyFor(app), legacyKey: legacyKeyFor(app), app, schemaVersion: STORE_SCHEMA }
}

function load(store) {
  if (!store || store.kind !== "sqlite") return null
  const row = store.db.prepare("SELECT payload FROM app_state WHERE id=1").get()
  if (!row) return null
  try { return decrypt(row.payload, store.key) } catch {
    // Preserve compatibility with the pre-v0.12 vault key. The next save
    // rewrites the payload using the persisted safeStorage key.
    try { return decrypt(row.payload, store.legacyKey) } catch {
      // A present but unauthenticated payload is corruption/tampering, not an
      // empty first run. Throwing prevents the renderer from silently seeding
      // demo data over a customer's project and forces the recovery path.
      const error = new Error("STORE_DECRYPT_FAILED")
      error.code = "STORE_DECRYPT_FAILED"
      throw error
    }
  }
}

function runTransaction(db, callback) {
  db.exec("BEGIN IMMEDIATE")
  try { const result = callback(); db.exec("COMMIT"); return result } catch (error) { try { db.exec("ROLLBACK") } catch {} ; throw error }
}

function saveNormalized(store, state, at) {
  const db = store.db
  // The normalized tables are query-friendly indexes, not a second plaintext
  // copy of the tender.  Keep structural columns available for diagnostics,
  // but encrypt every JSON payload (rates, descriptions, documents, quotes,
  // analyses and audit details) with the same authenticated vault key.
  const protectedPayload = (value) => encrypt(value, store.key)
  db.exec("DELETE FROM project_records; DELETE FROM boq_items; DELETE FROM resources; DELETE FROM documents; DELETE FROM rate_analyses; DELETE FROM quotes; DELETE FROM revision_snapshots;")
  const insertProject = db.prepare("INSERT INTO project_records(project_id,tenant_id,workspace_id,revision_no,status,payload,updated_at) VALUES(?,?,?,?,?,?,?)")
  const insertBoq = db.prepare("INSERT INTO boq_items(project_id,item_id,item_no,description,unit,quantity,payload,updated_at) VALUES(?,?,?,?,?,?,?,?)")
  const insertResource = db.prepare("INSERT INTO resources(resource_id,code,name,resource_type,unit,rate,payload,updated_at) VALUES(?,?,?,?,?,?,?,?)")
  const insertDocument = db.prepare("INSERT INTO documents(project_id,document_id,category,revision,status,payload,updated_at) VALUES(?,?,?,?,?,?,?)")
  const insertAnalysis = db.prepare("INSERT INTO rate_analyses(project_id,item_id,payload,updated_at) VALUES(?,?,?,?)")
  const insertQuote = db.prepare("INSERT INTO quotes(project_id,quote_id,supplier_id,payload,updated_at) VALUES(?,?,?,?,?)")
  const insertRevision = db.prepare("INSERT INTO revision_snapshots(project_id,revision_id,payload,created_at) VALUES(?,?,?,?)")
  ;(state.projects || []).forEach((project) => {
    const projectId = String(project.id || "")
    if (!projectId) return
    insertProject.run(projectId, String(project.tenantId || ""), String(project.workspaceId || ""), Number(project.revisionNo || 0), String(project.status || ""), protectedPayload(project), at)
    ;(project.boq || []).forEach((item) => insertBoq.run(projectId, String(item.id || ""), "[encrypted]", "[encrypted]", "", 0, protectedPayload(item), at))
    Object.entries(project.analyses || {}).forEach(([itemId, analysis]) => insertAnalysis.run(projectId, String(itemId), protectedPayload(analysis), at))
    ;(project.documents || []).forEach((document) => insertDocument.run(projectId, String(document.id || ""), String(document.category || ""), String(document.revision || ""), String(document.status || ""), protectedPayload(document), at))
    ;(project.quotes || []).forEach((quote) => insertQuote.run(projectId, String(quote.id || ""), String(quote.supplierId || ""), protectedPayload(quote), at))
    ;(project.revisions || []).forEach((revision) => insertRevision.run(projectId, String(revision.id || `revision-${revision.createdAt || at}`), protectedPayload(revision), revision.createdAt || at))
  })
  ;(state.resources || []).forEach((resource) => insertResource.run(String(resource.id || ""), "[encrypted]", "[encrypted]", String(resource.type || ""), "", 0, protectedPayload(resource), at))
  const insertAudit = db.prepare("INSERT OR IGNORE INTO audit_log(entry_id,project_id,actor_id,action,detail,timestamp,payload) VALUES(?,?,?,?,?,?,?)")
  ;(state.auditLog || []).forEach((entry) => insertAudit.run(String(entry.id || entry.entryId || `audit-${entry.timestamp || at}-${entry.action || "event"}`), String(entry.projectId || ""), String(entry.userId || entry.actorId || entry.user || ""), String(entry.action || ""), "[encrypted]", String(entry.timestamp || entry.date || at), protectedPayload(entry)))
  ;(state.centralAudit || []).forEach((entry) => insertAudit.run(String(entry.id || `central-${entry.timestamp || at}`), String(entry.projectId || ""), String(entry.actorId || entry.userId || ""), String(entry.action || ""), "[encrypted]", String(entry.timestamp || at), protectedPayload(entry)))
}

function save(store, state) {
  if (!store || store.kind !== "sqlite") return false
  const at = new Date().toISOString()
  runTransaction(store.db, () => {
    store.db.prepare("INSERT INTO app_state(id,payload,schema_version,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,schema_version=excluded.schema_version,updated_at=excluded.updated_at").run(encrypt(state, store.key), Number(state?.schemaVersion || 6), at)
    saveNormalized(store, state, at)
  })
  return true
}

function checkpoint(store) {
  if (!store || store.kind !== "sqlite") return false
  try { store.db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); return true } catch { return false }
}

function close(store) {
  if (store?.kind === "sqlite") store.db.close()
}

module.exports = { STORE_SCHEMA, openStore, load, save, close, checkpoint, encrypt, decrypt, keyFor, legacyKeyFor }
