const path = require("node:path")
const fs = require("node:fs")
const crypto = require("node:crypto")

let DatabaseSync
try { ({ DatabaseSync } = require("node:sqlite")) } catch {}

function json(value, fallback) {
  try { return value == null ? fallback : JSON.parse(String(value)) } catch { return fallback }
}

function safeJson(value, fallback = {}) {
  try { return JSON.stringify(value == null ? fallback : value) } catch { return JSON.stringify(fallback) }
}

function id(prefix = "id") {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`
}

function nowIso() { return new Date().toISOString() }

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const digest = crypto.scryptSync(String(password || ""), salt, 32).toString("hex")
  return { salt, digest, encoded: `scrypt$${salt}$${digest}` }
}

function verifyPassword(password, encoded) {
  const match = String(encoded || "").match(/^scrypt\$([^$]+)\$([a-f0-9]+)$/i)
  if (!match) return false
  const actual = crypto.scryptSync(String(password || ""), match[1], match[2].length / 2).toString("hex")
  return actual.length === match[2].length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(match[2]))
}

function rowTenant(row) {
  if (!row) return null
  return {
    id: row.id, name: row.name, slug: row.slug, type: row.type, status: row.status, plan: row.plan,
    ownerUserId: row.owner_user_id, maxUsers: row.max_users, maxDevices: row.max_devices,
    storageMode: row.storage_mode, region: row.region, apiBaseUrl: row.api_base_url || "",
    featureFlags: json(row.feature_flags, {}), createdAt: row.created_at, updatedAt: row.updated_at,
    lastConnectionAt: row.last_connection_at || "",
  }
}

function rowUser(row) {
  if (!row) return null
  return {
    id: row.id, tenantId: row.tenant_id, username: row.username, name: row.name,
    role: row.role, email: row.email || "", active: row.active !== 0, createdAt: row.created_at,
    lastConnectionAt: row.last_connection_at || "", appVersion: row.app_version || "",
  }
}

function rowDevice(row) {
  if (!row) return null
  return { id: row.id, tenantId: row.tenant_id, userId: row.user_id, name: row.name, platform: row.platform, machineHash: row.machine_hash || "", status: row.status, appVersion: row.app_version || "", lastConnectionAt: row.last_connection_at || "", registeredAt: row.registered_at }
}

function rowLicense(row) {
  if (!row) return null
  return { id: row.id, tenantId: row.tenant_id, licenseKey: row.license_key, plan: row.plan, status: row.status, startsAt: row.starts_at, expiresAt: row.expires_at, maxUsers: row.max_users, maxDevices: row.max_devices, featureFlags: json(row.feature_flags, {}), offlineGraceDays: row.offline_grace_days, updatedAt: row.updated_at, updatedBy: row.updated_by || "" }
}

class CentralStore {
  constructor(options = {}) {
    if (!DatabaseSync) throw new Error("QESTIMA Central API requires Node.js with node:sqlite (Node 22+).")
    this.dbPath = path.resolve(options.dbPath || path.join(process.cwd(), "qestima-central.db"))
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true })
    this.db = new DatabaseSync(this.dbPath)
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
        status TEXT NOT NULL, plan TEXT NOT NULL, owner_user_id TEXT NOT NULL, max_users INTEGER NOT NULL,
        max_devices INTEGER NOT NULL, storage_mode TEXT NOT NULL, region TEXT NOT NULL, api_base_url TEXT DEFAULT '',
        feature_flags TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_connection_at TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), username TEXT NOT NULL,
        name TEXT NOT NULL, email TEXT DEFAULT '', role TEXT NOT NULL, password_hash TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_connection_at TEXT DEFAULT '', app_version TEXT DEFAULT '',
        UNIQUE(tenant_id, username)
      );
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), user_id TEXT NOT NULL REFERENCES users(id),
        name TEXT NOT NULL, platform TEXT NOT NULL, machine_hash TEXT DEFAULT '', status TEXT NOT NULL,
        app_version TEXT DEFAULT '', last_connection_at TEXT DEFAULT '', registered_at TEXT NOT NULL,
        UNIQUE(tenant_id, machine_hash)
      );
      CREATE TABLE IF NOT EXISTS licenses (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id), license_key TEXT NOT NULL,
        plan TEXT NOT NULL, status TEXT NOT NULL, starts_at TEXT NOT NULL, expires_at TEXT NOT NULL,
        max_users INTEGER NOT NULL, max_devices INTEGER NOT NULL, feature_flags TEXT NOT NULL,
        offline_grace_days INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, updated_by TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), payload TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_locks (
        project_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), token TEXT NOT NULL,
        user_id TEXT NOT NULL, device_id TEXT DEFAULT '', expires_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), actor_id TEXT NOT NULL,
        action TEXT NOT NULL, entity_type TEXT DEFAULT '', entity_id TEXT DEFAULT '', detail TEXT DEFAULT '',
        payload TEXT NOT NULL, timestamp TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS support_access (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), requested_by TEXT NOT NULL,
        reason TEXT NOT NULL, scopes TEXT NOT NULL, status TEXT NOT NULL, starts_at TEXT DEFAULT '',
        expires_at TEXT DEFAULT '', approved_by TEXT DEFAULT '', requested_at TEXT NOT NULL, revoked_at TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS objects (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), sha256 TEXT NOT NULL,
        file_name TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, storage_path TEXT NOT NULL,
        created_by TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenant_id);
    `)
  }

  close() { this.db.close() }

  createTenant(input = {}) {
    const at = input.createdAt || nowIso()
    const tenant = {
      id: String(input.id || id("tenant")), name: String(input.name || "QESTIMA Company"),
      slug: String(input.slug || input.id || id("tenant")).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || id("tenant"),
      type: input.type === "personal" ? "personal" : "company", status: input.status || "active", plan: input.plan || "Pilot",
      ownerUserId: String(input.ownerUserId || ""), maxUsers: Math.max(1, Number(input.maxUsers || 10)), maxDevices: Math.max(1, Number(input.maxDevices || 10)),
      storageMode: input.storageMode || "central_object_storage", region: input.region || "sa", apiBaseUrl: input.apiBaseUrl || "",
      featureFlags: input.featureFlags || {}, createdAt: at, updatedAt: at, lastConnectionAt: "",
    }
    this.db.prepare("INSERT INTO tenants(id,name,slug,type,status,plan,owner_user_id,max_users,max_devices,storage_mode,region,api_base_url,feature_flags,created_at,updated_at,last_connection_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(tenant.id, tenant.name, tenant.slug, tenant.type, tenant.status, tenant.plan, tenant.ownerUserId, tenant.maxUsers, tenant.maxDevices, tenant.storageMode, tenant.region, tenant.apiBaseUrl, safeJson(tenant.featureFlags), tenant.createdAt, tenant.updatedAt, "")
    const license = input.license || { id: `LIC-${tenant.id}`, licenseKey: "", plan: tenant.plan, status: "active", startsAt: at, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), maxUsers: tenant.maxUsers, maxDevices: tenant.maxDevices, featureFlags: tenant.featureFlags, offlineGraceDays: 3 }
    this.upsertLicense(tenant.id, license, tenant.ownerUserId)
    return tenant
  }

  tenant(tenantId) { return rowTenant(this.db.prepare("SELECT * FROM tenants WHERE id=?").get(String(tenantId || ""))) }

  createUser(tenantId, input = {}) {
    const tenant = this.tenant(tenantId)
    if (!tenant) throw new Error("TENANT_NOT_FOUND")
    const createdAt = input.createdAt || nowIso()
    const activeUsers = this.db.prepare("SELECT COUNT(*) AS count FROM users WHERE tenant_id=? AND active=1").get(tenantId).count
    if (input.active !== false && activeUsers >= tenant.maxUsers) throw new Error("USER_SEAT_LIMIT")
    const credentials = hashPassword(input.password || crypto.randomBytes(24).toString("base64url"))
    const user = { id: String(input.id || id("user")), tenantId, username: String(input.username || "").trim(), name: String(input.name || input.username || "User").trim(), email: String(input.email || ""), role: String(input.role || "estimator"), passwordHash: credentials.encoded, active: input.active !== false, createdAt, lastConnectionAt: "", appVersion: "" }
    if (!user.username) throw new Error("USERNAME_REQUIRED")
    this.db.prepare("INSERT INTO users(id,tenant_id,username,name,email,role,password_hash,active,created_at,last_connection_at,app_version) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(user.id, user.tenantId, user.username, user.name, user.email, user.role, user.passwordHash, user.active ? 1 : 0, user.createdAt, "", "")
    return { ...rowUser({ ...user, tenant_id: tenantId, created_at: createdAt, active: user.active ? 1 : 0 }), passwordHash: undefined }
  }

  users(tenantId) { return this.db.prepare("SELECT * FROM users WHERE tenant_id=? ORDER BY created_at").all(tenantId).map(rowUser) }

  userByCredentials(tenantId, username, password) {
    const row = this.db.prepare("SELECT * FROM users WHERE tenant_id=? AND lower(username)=lower(?)").get(String(tenantId || ""), String(username || ""))
    if (!row || row.active === 0 || !verifyPassword(password, row.password_hash)) return null
    return rowUser(row)
  }

  user(userId, tenantId = "") {
    const row = this.db.prepare("SELECT * FROM users WHERE id=? AND tenant_id=?").get(String(userId || ""), String(tenantId || ""))
    return rowUser(row)
  }

  touchConnection(tenantId, userId, input = {}) {
    const at = nowIso()
    this.db.prepare("UPDATE users SET last_connection_at=?, app_version=? WHERE id=? AND tenant_id=?").run(at, String(input.appVersion || ""), userId, tenantId)
    this.db.prepare("UPDATE tenants SET last_connection_at=?, updated_at=? WHERE id=?").run(at, at, tenantId)
    if (input.deviceId) this.db.prepare("UPDATE devices SET last_connection_at=?, app_version=?, status='active' WHERE id=? AND tenant_id=?").run(at, String(input.appVersion || ""), input.deviceId, tenantId)
    return { at }
  }

  registerDevice(tenantId, userId, input = {}) {
    const tenant = this.tenant(tenantId)
    if (!tenant) return { ok: false, reason: "TENANT_NOT_FOUND" }
    const existing = input.id ? this.db.prepare("SELECT * FROM devices WHERE id=? AND tenant_id=?").get(String(input.id), tenantId) : input.machineHash ? this.db.prepare("SELECT * FROM devices WHERE tenant_id=? AND machine_hash=?").get(tenantId, String(input.machineHash)) : null
    const count = this.db.prepare("SELECT COUNT(*) AS count FROM devices WHERE tenant_id=? AND status<>'revoked'").get(tenantId).count
    if (!existing && count >= tenant.maxDevices) return { ok: false, reason: "DEVICE_SEAT_LIMIT", usage: this.usage(tenantId), limit: tenant.maxDevices }
    const at = nowIso(); const deviceId = String(existing?.id || input.id || id("device"))
    if (existing) this.db.prepare("UPDATE devices SET user_id=?, name=?, platform=?, machine_hash=?, app_version=?, last_connection_at=?, status='active' WHERE id=? AND tenant_id=?").run(userId, String(input.name || existing.name || "QESTIMA device"), String(input.platform || existing.platform || "windows"), String(input.machineHash || existing.machine_hash || ""), String(input.appVersion || existing.app_version || ""), at, deviceId, tenantId)
    else this.db.prepare("INSERT INTO devices(id,tenant_id,user_id,name,platform,machine_hash,status,app_version,last_connection_at,registered_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(deviceId, tenantId, userId, String(input.name || "QESTIMA device"), String(input.platform || "windows"), String(input.machineHash || ""), "active", String(input.appVersion || ""), at, at)
    const device = rowDevice(this.db.prepare("SELECT * FROM devices WHERE id=?").get(deviceId))
    this.touchConnection(tenantId, userId, { deviceId, appVersion: input.appVersion })
    this.audit(tenantId, userId, existing ? "device.reconnected" : "device.registered", "device", deviceId, device.name, { appVersion: input.appVersion || "", platform: input.platform || "windows" })
    return { ok: true, device, usage: this.usage(tenantId) }
  }

  devices(tenantId) { return this.db.prepare("SELECT * FROM devices WHERE tenant_id=? ORDER BY last_connection_at DESC").all(tenantId).map(rowDevice) }

  usage(tenantId) {
    const users = this.db.prepare("SELECT COUNT(*) AS count FROM users WHERE tenant_id=? AND active=1").get(tenantId).count
    const devices = this.db.prepare("SELECT COUNT(*) AS count FROM devices WHERE tenant_id=? AND status<>'revoked'").get(tenantId).count
    const tenant = this.tenant(tenantId)
    return { users, devices, maxUsers: tenant?.maxUsers || 0, maxDevices: tenant?.maxDevices || 0 }
  }

  license(tenantId) { return rowLicense(this.db.prepare("SELECT * FROM licenses WHERE tenant_id=?").get(tenantId)) }

  upsertLicense(tenantId, input = {}, updatedBy = "") {
    const at = nowIso(); const license = { id: String(input.id || `LIC-${tenantId}`), tenantId, licenseKey: String(input.licenseKey || ""), plan: String(input.plan || "Pilot"), status: String(input.status || "active"), startsAt: input.startsAt || at, expiresAt: input.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(), maxUsers: Math.max(1, Number(input.maxUsers || 10)), maxDevices: Math.max(1, Number(input.maxDevices || 10)), featureFlags: input.featureFlags || {}, offlineGraceDays: Math.max(0, Number(input.offlineGraceDays || 0)), updatedAt: at, updatedBy: String(updatedBy || "") }
    this.db.prepare("INSERT INTO licenses(id,tenant_id,license_key,plan,status,starts_at,expires_at,max_users,max_devices,feature_flags,offline_grace_days,updated_at,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id) DO UPDATE SET license_key=excluded.license_key, plan=excluded.plan, status=excluded.status, starts_at=excluded.starts_at, expires_at=excluded.expires_at, max_users=excluded.max_users, max_devices=excluded.max_devices, feature_flags=excluded.feature_flags, offline_grace_days=excluded.offline_grace_days, updated_at=excluded.updated_at, updated_by=excluded.updated_by").run(license.id, tenantId, license.licenseKey, license.plan, license.status, license.startsAt, license.expiresAt, license.maxUsers, license.maxDevices, safeJson(license.featureFlags), license.offlineGraceDays, license.updatedAt, license.updatedBy)
    return this.license(tenantId)
  }

  licenseAction(tenantId, action, input = {}, actorId = "") {
    const current = this.license(tenantId)
    if (!current) return { ok: false, reason: "LICENSE_NOT_FOUND" }
    if (!["suspend", "extend", "revoke", "activate"].includes(action)) return { ok: false, reason: "UNKNOWN_LICENSE_ACTION" }
    const next = { ...current }
    if (action === "suspend") next.status = "suspended"
    if (action === "revoke") next.status = "revoked"
    if (action === "activate") next.status = "active"
    if (action === "extend") { const base = new Date(current.expiresAt); const start = Number.isFinite(base.getTime()) && base > new Date() ? base : new Date(); start.setUTCDate(start.getUTCDate() + Math.max(1, Number(input.days || 30))); next.expiresAt = start.toISOString(); next.status = "active" }
    const license = this.upsertLicense(tenantId, next, actorId)
    this.audit(tenantId, actorId, `license.${action}`, "license", license.id, input.reason || "", { days: input.days || 0 })
    return { ok: true, license }
  }

  project(tenantId, projectId) {
    const row = this.db.prepare("SELECT * FROM projects WHERE tenant_id=? AND id=?").get(tenantId, projectId)
    if (!row) return null
    return { ...json(row.payload, {}), id: row.id, tenantId: row.tenant_id, serverVersion: row.version, updatedAt: row.updated_at, updatedBy: row.updated_by }
  }

  projects(tenantId) {
    return this.db.prepare("SELECT * FROM projects WHERE tenant_id=? ORDER BY updated_at DESC").all(tenantId).map((row) => ({ ...json(row.payload, {}), id: row.id, tenantId: row.tenant_id, serverVersion: row.version, updatedAt: row.updated_at, updatedBy: row.updated_by }))
  }

  saveProject(tenantId, payload, actorId = "", expectedVersion = null, options = {}) {
    const projectId = String(payload?.id || id("project")); const existing = this.db.prepare("SELECT * FROM projects WHERE tenant_id=? AND id=?").get(tenantId, projectId)
    const activeLock = this.db.prepare("SELECT * FROM project_locks WHERE tenant_id=? AND project_id=?").get(tenantId, projectId)
    if (activeLock && new Date(activeLock.expires_at).getTime() > Date.now() && activeLock.user_id !== String(actorId || "")) return { ok: false, reason: "PROJECT_LOCKED", lock: activeLock }
    if (activeLock && new Date(activeLock.expires_at).getTime() > Date.now() && options.lockToken && activeLock.token !== String(options.lockToken)) return { ok: false, reason: "LOCK_TOKEN_MISMATCH", lock: activeLock }
    if (existing && expectedVersion != null && Number(expectedVersion) !== Number(existing.version)) return { ok: false, reason: "VERSION_CONFLICT", server: this.project(tenantId, projectId), expectedVersion, actualVersion: existing.version }
    const at = nowIso(); const version = existing ? existing.version + 1 : 1; const normalized = { ...payload, id: projectId, tenantId, serverVersion: version, updatedAt: at, updatedBy: actorId }
    if (existing) this.db.prepare("UPDATE projects SET payload=?,version=?,updated_at=?,updated_by=? WHERE tenant_id=? AND id=?").run(safeJson(normalized), version, at, actorId, tenantId, projectId)
    else this.db.prepare("INSERT INTO projects(id,tenant_id,payload,version,updated_at,updated_by) VALUES(?,?,?,?,?,?)").run(projectId, tenantId, safeJson(normalized), version, at, actorId)
    this.audit(tenantId, actorId, existing ? "project.updated" : "project.created", "project", projectId, "", { version })
    return { ok: true, project: normalized }
  }

  lock(tenantId, projectId, action, input = {}, actorId = "") {
    const existing = this.db.prepare("SELECT * FROM project_locks WHERE tenant_id=? AND project_id=?").get(tenantId, projectId)
    const now = Date.now(); const valid = existing && new Date(existing.expires_at).getTime() > now
    if (action === "release") {
      if (!existing || !valid) { this.db.prepare("DELETE FROM project_locks WHERE tenant_id=? AND project_id=?").run(tenantId, projectId); return { ok: true, released: false } }
      if (existing.user_id !== actorId && input.force !== true) return { ok: false, reason: "LOCK_NOT_OWNED", lock: existing }
      this.db.prepare("DELETE FROM project_locks WHERE tenant_id=? AND project_id=?").run(tenantId, projectId); this.audit(tenantId, actorId, "project.lock_released", "project", projectId); return { ok: true, released: true }
    }
    if (action === "renew") {
      if (!existing || !valid || existing.user_id !== actorId || (input.token && existing.token !== input.token)) return { ok: false, reason: "LOCK_NOT_OWNED", lock: existing }
    } else if (valid && (existing.user_id !== actorId || (input.deviceId && existing.device_id !== input.deviceId))) return { ok: false, reason: "PROJECT_LOCKED", lock: existing }
    const ttl = Math.max(1, Math.min(120, Number(input.ttlMinutes || 15))); const at = nowIso(); const lock = { projectId, tenantId, token: existing?.token || id("lock"), userId: actorId, deviceId: String(input.deviceId || existing?.device_id || ""), expiresAt: new Date(Date.now() + ttl * 60000).toISOString(), updatedAt: at }
    this.db.prepare("INSERT INTO project_locks(project_id,tenant_id,token,user_id,device_id,expires_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET token=excluded.token,user_id=excluded.user_id,device_id=excluded.device_id,expires_at=excluded.expires_at,updated_at=excluded.updated_at").run(projectId, tenantId, lock.token, lock.userId, lock.deviceId, lock.expiresAt, lock.updatedAt)
    this.audit(tenantId, actorId, `project.lock_${action === "renew" ? "renewed" : "acquired"}`, "project", projectId)
    return { ok: true, lock }
  }

  audit(tenantId, actorId, action, entityType = "", entityId = "", detail = "", payload = {}) {
    const entry = { id: id("audit"), tenantId, actorId: String(actorId || ""), action, entityType, entityId: String(entityId || ""), detail: String(detail || ""), payload, timestamp: nowIso() }
    this.db.prepare("INSERT INTO audit_log(id,tenant_id,actor_id,action,entity_type,entity_id,detail,payload,timestamp) VALUES(?,?,?,?,?,?,?,?,?)").run(entry.id, tenantId, entry.actorId, entry.action, entry.entityType, entry.entityId, entry.detail, safeJson(entry.payload), entry.timestamp)
    return entry
  }

  auditEntries(tenantId, limit = 100) { return this.db.prepare("SELECT * FROM audit_log WHERE tenant_id=? ORDER BY timestamp DESC LIMIT ?").all(tenantId, Math.max(1, Math.min(1000, Number(limit || 100)))).map((row) => ({ id: row.id, tenantId: row.tenant_id, actorId: row.actor_id, action: row.action, entityType: row.entity_type, entityId: row.entity_id, detail: row.detail, payload: json(row.payload, {}), timestamp: row.timestamp, immutable: true })) }

  support(tenantId, input = {}, actorId = "") {
    const record = { id: String(input.id || id("support")), tenantId, requestedBy: actorId, reason: String(input.reason || ""), scopes: Array.isArray(input.scopes) ? [...new Set(input.scopes.map(String))] : ["diagnostics"], status: "requested", startsAt: "", expiresAt: "", approvedBy: "", requestedAt: nowIso(), revokedAt: "" }
    this.db.prepare("INSERT INTO support_access(id,tenant_id,requested_by,reason,scopes,status,starts_at,expires_at,approved_by,requested_at,revoked_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(record.id, tenantId, record.requestedBy, record.reason, safeJson(record.scopes, []), record.status, "", "", "", record.requestedAt, "")
    this.audit(tenantId, actorId, "support_access.requested", "support_access", record.id, record.reason); return record
  }

  supportAction(tenantId, accessId, action, input = {}, actorId = "") {
    const row = this.db.prepare("SELECT * FROM support_access WHERE tenant_id=? AND id=?").get(tenantId, accessId)
    if (!row) return { ok: false, reason: "SUPPORT_REQUEST_NOT_FOUND" }
    const record = { id: row.id, tenantId: row.tenant_id, requestedBy: row.requested_by, reason: row.reason, scopes: json(row.scopes, []), status: row.status, startsAt: row.starts_at || "", expiresAt: row.expires_at || "", approvedBy: row.approved_by || "", requestedAt: row.requested_at, revokedAt: row.revoked_at || "" }
    if (action === "approve") { const hours = Math.max(1, Math.min(72, Number(input.hours || 4))); record.status = "approved"; record.approvedBy = actorId; record.startsAt = nowIso(); record.expiresAt = new Date(Date.now() + hours * 3600000).toISOString() }
    else if (action === "revoke") { record.status = "revoked"; record.revokedAt = nowIso() }
    else return { ok: false, reason: "UNKNOWN_SUPPORT_ACTION" }
    this.db.prepare("UPDATE support_access SET status=?,starts_at=?,expires_at=?,approved_by=?,revoked_at=? WHERE tenant_id=? AND id=?").run(record.status, record.startsAt, record.expiresAt, record.approvedBy, record.revokedAt, tenantId, accessId)
    this.audit(tenantId, actorId, `support_access.${action}d`, "support_access", accessId)
    return { ok: true, access: record }
  }

  supportEntries(tenantId) { return this.db.prepare("SELECT * FROM support_access WHERE tenant_id=? ORDER BY requested_at DESC").all(tenantId).map((row) => ({ id: row.id, tenantId: row.tenant_id, requestedBy: row.requested_by, reason: row.reason, scopes: json(row.scopes, []), status: row.status, startsAt: row.starts_at || "", expiresAt: row.expires_at || "", approvedBy: row.approved_by || "", requestedAt: row.requested_at, revokedAt: row.revoked_at || "" })) }

  objectMeta(tenantId, objectId) { return this.db.prepare("SELECT * FROM objects WHERE tenant_id=? AND id=?").get(tenantId, objectId) }

  saveObject(tenantId, input = {}, storagePath, actorId = "") {
    const row = { id: String(input.id || id("object")), tenantId, sha256: String(input.sha256 || ""), fileName: String(input.fileName || "attachment"), contentType: String(input.contentType || "application/octet-stream"), size: Number(input.size || 0), storagePath, createdBy: actorId, createdAt: nowIso() }
    this.db.prepare("INSERT INTO objects(id,tenant_id,sha256,file_name,content_type,size,storage_path,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(row.id, tenantId, row.sha256, row.fileName, row.contentType, row.size, storagePath, actorId, row.createdAt)
    this.audit(tenantId, actorId, "object.created", "object", row.id, row.fileName); return row
  }

  ownerOverview(tenantId) {
    const tenant = this.tenant(tenantId)
    if (!tenant) return null
    return { tenant, usage: this.usage(tenantId), license: this.license(tenantId), users: this.users(tenantId), devices: this.devices(tenantId), projects: this.projects(tenantId).map((project) => ({ id: project.id, name: project.name, tenderCode: project.tenderCode, status: project.status, serverVersion: project.serverVersion, updatedAt: project.updatedAt })), supportAccess: this.supportEntries(tenantId), audit: this.auditEntries(tenantId, 20) }
  }
}

module.exports = { CentralStore, hashPassword, verifyPassword, id, nowIso }
