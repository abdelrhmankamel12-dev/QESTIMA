const http = require("node:http")
const path = require("node:path")
const fs = require("node:fs")
const crypto = require("node:crypto")
const { CentralStore, id, nowIso } = require("./central-store.cjs")

const MAX_BODY = 35 * 1024 * 1024
const DEFAULT_PORT = Number(process.env.QESTIMA_CENTRAL_PORT || 47600)

function base64url(value) { return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") }
function decodeBase64url(value) { return Buffer.from(String(value || "").replace(/-/g, "+").replace(/_/g, "/"), "base64") }

function issueAccessToken(claims, secret, ttlSeconds = 8 * 3600) {
  // Never let a client request an effectively permanent bearer token. The
  // central service owns session lifetime; the desktop only asks for a normal
  // working session within this bounded window.
  const ttl = Math.max(300, Math.min(24 * 3600, Number(ttlSeconds) || 8 * 3600))
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "QESTIMA" }))
  const payload = base64url(JSON.stringify({ ...claims, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttl, jti: id("session") }))
  const input = `${header}.${payload}`
  const signature = base64url(crypto.createHmac("sha256", String(secret)).update(input).digest())
  return `${input}.${signature}`
}

function verifyAccessToken(token, secret) {
  try {
    const [header, payload, signature] = String(token || "").split(".")
    if (!header || !payload || !signature) return null
    const expected = crypto.createHmac("sha256", String(secret)).update(`${header}.${payload}`).digest()
    const actual = decodeBase64url(signature)
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null
    const claims = JSON.parse(decodeBase64url(payload).toString("utf8"))
    if (claims.exp && Date.now() / 1000 > Number(claims.exp)) return null
    return claims
  } catch { return null }
}

function updateSigningInput(manifest = {}) {
  const copy = { ...manifest }; delete copy.signature
  return JSON.stringify(Object.keys(copy).sort().reduce((result, key) => { result[key] = copy[key]; return result }, {}))
}

function signUpdateManifest(manifest = {}, privateKeyPem = "") {
  if (!privateKeyPem) return { ...manifest }
  const signed = { ...manifest }
  signed.signature = base64url(crypto.sign(null, Buffer.from(updateSigningInput(signed)), privateKeyPem))
  return signed
}

function licenseSigningInput(token = {}) {
  const copy = { ...token }
  delete copy.signature
  return JSON.stringify(Object.keys(copy).sort().reduce((result, key) => { result[key] = copy[key]; return result }, {}))
}

function signLicenseToken(claims = {}, privateKeyPem = "", publicKeyId = "") {
  if (!privateKeyPem) return ""
  const header = { alg: "EdDSA", typ: "QESTIMA-LICENSE", ...(publicKeyId ? { kid: String(publicKeyId) } : {}) }
  const encodedHeader = base64url(JSON.stringify(header))
  const encodedPayload = base64url(JSON.stringify(claims))
  const input = `${encodedHeader}.${encodedPayload}`
  const signature = base64url(crypto.sign(null, Buffer.from(input), privateKeyPem))
  return `${input}.${signature}`
}

function issueLicenseToken(tenant, license, user, options = {}) {
  const startsAt = new Date(license?.startsAt || Date.now())
  const expiresAt = new Date(license?.expiresAt || Date.now())
  const claims = {
    iss: "qestima-central",
    aud: "qestima-client",
    sub: String(tenant?.id || ""),
    tenantId: String(tenant?.id || ""),
    licenseId: String(license?.id || ""),
    licenseKey: String(license?.licenseKey || ""),
    plan: String(license?.plan || "Pilot"),
    status: String(license?.status || "active"),
    nbf: Number.isFinite(startsAt.getTime()) ? Math.floor(startsAt.getTime() / 1000) : undefined,
    exp: Number.isFinite(expiresAt.getTime()) ? Math.floor(expiresAt.getTime() / 1000) : undefined,
    maxUsers: Number(license?.maxUsers || tenant?.maxUsers || 1),
    maxDevices: Number(license?.maxDevices || tenant?.maxDevices || 1),
    featureFlags: license?.featureFlags || {},
    offlineGraceDays: Number(license?.offlineGraceDays || 0),
    userId: String(user?.id || ""),
    issuedAt: nowIso(),
  }
  Object.keys(claims).forEach((key) => { if (claims[key] === undefined) delete claims[key] })
  try { return signLicenseToken(claims, options.licensePrivateKey || process.env.QESTIMA_LICENSE_PRIVATE_KEY || "", options.licensePublicKeyId || process.env.QESTIMA_LICENSE_PUBLIC_KEY_ID || "") } catch (error) { if (options.strictLicenseSigning) throw error; return "" }
}

function licenseGate(license) {
  if (!license) return { blocked: true, reason: "LICENSE_NOT_FOUND" }
  const status = String(license.status || "active").toLowerCase()
  if (["suspended", "revoked"].includes(status)) return { blocked: true, reason: `LICENSE_${status.toUpperCase()}` }
  const startsAt = new Date(license.startsAt || "")
  if (Number.isFinite(startsAt.getTime()) && Date.now() < startsAt.getTime()) return { blocked: true, reason: "LICENSE_NOT_STARTED" }
  const expiry = new Date(license.expiresAt || "")
  if (Number.isFinite(expiry.getTime())) {
    const graceDays = Math.max(0, Number(license.offlineGraceDays || 0))
    if (Date.now() > expiry.getTime() + graceDays * 86400000) return { blocked: true, reason: "LICENSE_EXPIRED" }
  }
  return { blocked: false, reason: "ACTIVE" }
}

function licenseWriteAllowed(request, pathname, license) {
  const gate = licenseGate(license)
  if (!gate.blocked) return true
  const isLicenseAction = request.method === "POST" && /^\/api\/v1\/licenses\/[^/]+\/action$/.test(pathname)
  const isReadOnly = request.method === "GET" || pathname === "/api/v1/owner/overview" || pathname === "/api/v1/audit" || pathname === "/api/v1/devices" || pathname === "/api/v1/users" || pathname === "/api/v1/sync/pull"
  return isReadOnly || isLicenseAction
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = []
    request.on("data", (chunk) => { size += chunk.length; if (size > MAX_BODY) { reject(Object.assign(new Error("REQUEST_TOO_LARGE"), { statusCode: 413 })); request.destroy(); return } chunks.push(chunk) })
    request.on("end", () => {
      if (!chunks.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))) } catch { reject(Object.assign(new Error("INVALID_JSON"), { statusCode: 400 })) }
    })
    request.on("error", reject)
  })
}

function send(response, status, body, headers = {}) {
  const payload = typeof body === "string" ? body : JSON.stringify(body)
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers })
  response.end(payload)
}

function ok(response, data, status = 200) { send(response, status, { ok: true, ...data }) }
function fail(response, status, reason, detail = "") { send(response, status, { ok: false, reason, detail: detail || undefined }) }

function routePath(request) {
  const url = new URL(request.url || "/", "http://qestima.local")
  return { url, parts: url.pathname.split("/").filter(Boolean) }
}

function tenantStorageSegment(tenantId) {
  const value = String(tenantId || "")
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) throw new Error("TENANT_ID_INVALID")
  return value
}

function requiredRole(claims, roles) { return claims && (claims.role === "system_admin" || claims.role === "owner" || roles.includes(claims.role)) }

function createCentralServer(options = {}) {
  const secret = String(options.secret || process.env.QESTIMA_CENTRAL_SECRET || "")
  if (secret.length < 32) throw new Error("Set QESTIMA_CENTRAL_SECRET to a random value of at least 32 characters; no default secret is provided.")
  const store = options.store || new CentralStore({ dbPath: options.dbPath || process.env.QESTIMA_CENTRAL_DB })
  const objectRoot = path.resolve(options.objectRoot || process.env.QESTIMA_OBJECT_ROOT || path.join(path.dirname(store.dbPath), "objects"))
  fs.mkdirSync(objectRoot, { recursive: true })
  const updateManifest = signUpdateManifest(options.updateManifest || { channel: "stable", version: "", minimumVersion: "", signature: "", publicKeyId: "", publishedAt: "" }, options.updatePrivateKey || process.env.QESTIMA_UPDATE_PRIVATE_KEY || "")

  async function handler(request, response) {
    response.setHeader("Access-Control-Allow-Origin", options.allowOrigin || "*")
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-QESTIMA-Bootstrap")
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
    if (request.method === "OPTIONS") return response.writeHead(204).end()
    const { url, parts } = routePath(request)
    try {
      if (request.method === "GET" && url.pathname === "/health") return ok(response, { service: "qestima-central", version: "0.12.0", time: nowIso(), database: "sqlite", objectStorage: "filesystem" })
      if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
        const body = await readJson(request); const tenantId = String(body.tenantId || ""); const user = store.userByCredentials(tenantId, body.username, body.password)
        const tenant = store.tenant(tenantId); const license = store.license(tenantId)
        if (!tenant || !user || tenant.status !== "active" || !license || ["suspended", "revoked"].includes(license.status)) return fail(response, 401, "AUTHENTICATION_FAILED")
        const token = issueAccessToken({ sub: user.id, tenantId, role: user.role, username: user.username, appVersion: String(body.appVersion || "") }, secret, Number(body.ttlSeconds || 8 * 3600))
        store.touchConnection(tenantId, user.id, { deviceId: body.deviceId, appVersion: body.appVersion })
        store.audit(tenantId, user.id, "auth.login", "session", "", "", { deviceId: body.deviceId || "" })
        return ok(response, { token, user, tenant, license, licenseToken: issueLicenseToken(tenant, license, user, options), licensePublicKeyId: String(options.licensePublicKeyId || process.env.QESTIMA_LICENSE_PUBLIC_KEY_ID || "") })
      }
      if (request.method === "POST" && url.pathname === "/api/v1/provision") {
        const bootstrap = String(request.headers["x-qestima-bootstrap"] || "")
        if (!options.provisioningSecret || bootstrap !== String(options.provisioningSecret)) return fail(response, 403, "PROVISIONING_DENIED")
        const body = await readJson(request); if (!body.tenant?.name || !body.user?.username || !body.user?.password) return fail(response, 400, "PROVISIONING_FIELDS_REQUIRED")
        const tenant = store.createTenant({ ...body.tenant, ownerUserId: body.user.id || "" }); const user = store.createUser(tenant.id, { ...body.user, id: body.user.id || undefined, role: body.user.role || "owner" })
        store.db.prepare("UPDATE tenants SET owner_user_id=? WHERE id=?").run(user.id, tenant.id)
        store.audit(tenant.id, user.id, "tenant.provisioned", "tenant", tenant.id)
        return ok(response, { tenant: store.tenant(tenant.id), user }, 201)
      }
      if (request.method === "GET" && url.pathname === "/api/v1/updates") return ok(response, { manifest: updateManifest })

      const auth = String(request.headers.authorization || "").match(/^Bearer\s+(.+)$/i)
      const claims = verifyAccessToken(auth?.[1], secret)
      if (!claims) return fail(response, 401, "AUTHENTICATION_REQUIRED")
      const tenantId = String(claims.tenantId || "")
      const tenant = store.tenant(tenantId)
      if (!tenant || tenant.status !== "active") return fail(response, 403, "TENANT_SUSPENDED")
      const currentLicense = store.license(tenantId)
      if (!licenseWriteAllowed(request, url.pathname, currentLicense)) return fail(response, 423, "LICENSE_READ_ONLY", `License state: ${licenseGate(currentLicense).reason}. Reactivate or extend the license before writing data.`)
      if (url.pathname.startsWith("/api/v1/tenants/") && parts[2] !== tenantId) return fail(response, 403, "TENANT_ISOLATION_VIOLATION")

      if (request.method === "GET" && url.pathname === "/api/v1/projects") return ok(response, { projects: store.projects(tenantId) })
      if (request.method === "POST" && url.pathname === "/api/v1/projects") {
        if (!requiredRole(claims, ["estimation_manager", "lead_qs"])) return fail(response, 403, "PROJECT_WRITE_DENIED")
        const body = await readJson(request); const result = store.saveProject(tenantId, body.project || body, claims.sub, null); return result.ok ? ok(response, { project: result.project }, 201) : fail(response, 409, result.reason)
      }
      if (parts[0] === "api" && parts[1] === "v1" && parts[2] === "projects" && parts[3]) {
        const projectId = parts[3]
        if (request.method === "GET" && parts.length === 4) { const project = store.project(tenantId, projectId); return project ? ok(response, { project }) : fail(response, 404, "PROJECT_NOT_FOUND") }
        if (request.method === "PUT" && parts.length === 4) {
          if (!requiredRole(claims, ["estimation_manager", "lead_qs", "estimator", "procurement", "technical_engineer", "commercial_reviewer"])) return fail(response, 403, "PROJECT_WRITE_DENIED")
          const body = await readJson(request); const expectedRaw = body.expectedVersion ?? request.headers["if-match"]; const expected = expectedRaw == null || expectedRaw === "" ? null : Number(expectedRaw)
          const result = store.saveProject(tenantId, { ...(body.project || body), id: projectId }, claims.sub, Number.isFinite(expected) ? expected : null, { lockToken: body.lockToken || request.headers["x-qestima-lock-token"] || "" })
          return result.ok ? ok(response, { project: result.project }) : fail(response, 409, result.reason, "Reload the project and resolve the highlighted paths before retrying.")
        }
        if (parts[4] === "lock" && request.method === "POST") {
          const body = await readJson(request); const action = ["acquire", "renew", "release"].includes(body.action) ? body.action : "acquire"; const result = store.lock(tenantId, projectId, action, body, claims.sub); return result.ok ? ok(response, result) : fail(response, 409, result.reason, result.lock ? JSON.stringify(result.lock) : "")
        }
      }
      if (request.method === "POST" && url.pathname === "/api/v1/sync/push") {
        const body = await readJson(request); const operations = Array.isArray(body.operations) ? body.operations : []; const applied = []; const conflicts = []
        operations.slice(0, 500).forEach((operation) => { const result = store.saveProject(tenantId, { ...(operation.payload || {}), id: operation.projectId }, claims.sub, operation.baseVersion == null ? null : operation.baseVersion, { lockToken: operation.lockToken || "" }); if (result.ok) applied.push(result.project); else conflicts.push({ projectId: operation.projectId, reason: result.reason, server: result.server, local: operation.payload, lock: result.lock }) })
        store.audit(tenantId, claims.sub, "sync.push", "sync", "", "", { applied: applied.length, conflicts: conflicts.length }); return ok(response, { applied, conflicts, serverTime: nowIso() })
      }
      if (request.method === "GET" && url.pathname === "/api/v1/sync/pull") {
        const since = url.searchParams.get("since") || ""; const projects = store.projects(tenantId).filter((project) => !since || String(project.updatedAt || "") > since); return ok(response, { projects, cursor: nowIso() })
      }
      if (request.method === "POST" && url.pathname === "/api/v1/devices/register") { const body = await readJson(request); const result = store.registerDevice(tenantId, claims.sub, body); return result.ok ? ok(response, result) : fail(response, 409, result.reason) }
      if (request.method === "GET" && url.pathname === "/api/v1/devices") return ok(response, { devices: store.devices(tenantId), usage: store.usage(tenantId) })
      if (request.method === "GET" && url.pathname === "/api/v1/users") return ok(response, { users: store.users(tenantId), usage: store.usage(tenantId) })
      if (request.method === "POST" && url.pathname === "/api/v1/users") {
        if (!requiredRole(claims, ["estimation_manager"])) return fail(response, 403, "USER_ADMIN_DENIED")
        const body = await readJson(request); if (!body.username || !body.password) return fail(response, 400, "USER_FIELDS_REQUIRED")
        try { const user = store.createUser(tenantId, body); store.audit(tenantId, claims.sub, "user.created", "user", user.id, user.username); return ok(response, { user }, 201) } catch (error) { return fail(response, error.message === "USER_SEAT_LIMIT" ? 409 : 400, error.message || "USER_CREATE_FAILED") }
      }
      if (request.method === "GET" && url.pathname === "/api/v1/owner/overview") { if (!requiredRole(claims, ["system_admin"])) return fail(response, 403, "OWNER_PORTAL_DENIED"); return ok(response, store.ownerOverview(tenantId)) }
      if (request.method === "POST" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "licenses" && parts[3] === tenantId && parts[4] === "action") { if (!requiredRole(claims, ["system_admin"])) return fail(response, 403, "LICENSE_ADMIN_DENIED"); const body = await readJson(request); const result = store.licenseAction(tenantId, body.action, body, claims.sub); return result.ok ? ok(response, { ...result, licenseToken: issueLicenseToken(tenant, result.license, store.user(claims.sub, tenantId), options), licensePublicKeyId: String(options.licensePublicKeyId || process.env.QESTIMA_LICENSE_PUBLIC_KEY_ID || "") }) : fail(response, 400, result.reason) }
      if (request.method === "GET" && url.pathname === "/api/v1/audit") return ok(response, { entries: store.auditEntries(tenantId, url.searchParams.get("limit")) })
      if (request.method === "POST" && url.pathname === "/api/v1/support/access") { const body = await readJson(request); return ok(response, { access: store.support(tenantId, body, claims.sub) }, 201) }
      if (request.method === "POST" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "support" && parts[3] === "access" && parts[4] && parts[5] === "action") { if (!requiredRole(claims, ["system_admin"])) return fail(response, 403, "SUPPORT_ADMIN_DENIED"); const body = await readJson(request); const result = store.supportAction(tenantId, parts[4], body.action, body, claims.sub); return result.ok ? ok(response, result) : fail(response, 400, result.reason) }
      if (request.method === "POST" && url.pathname === "/api/v1/objects") {
        const body = await readJson(request); const encoded = String(body.dataBase64 || ""); if (!encoded || encoded.length > MAX_BODY * 1.4) return fail(response, 413, "OBJECT_TOO_LARGE")
        const content = Buffer.from(encoded, "base64"); if (content.length > 25 * 1024 * 1024) return fail(response, 413, "OBJECT_TOO_LARGE")
        const sha256 = crypto.createHash("sha256").update(content).digest("hex"); const objectId = String(body.id || id("object")).replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 128) || id("object"); const tenantDir = path.join(objectRoot, tenantStorageSegment(tenantId)); fs.mkdirSync(tenantDir, { recursive: true }); const target = path.join(tenantDir, `${sha256}-${objectId}`); fs.writeFileSync(target, content); const meta = store.saveObject(tenantId, { ...body, id: objectId, sha256, size: content.length }, target, claims.sub); return ok(response, { object: meta }, 201)
      }
      if (request.method === "GET" && parts[0] === "api" && parts[1] === "v1" && parts[2] === "objects" && parts[3]) { const meta = store.objectMeta(tenantId, parts[3]); if (!meta) return fail(response, 404, "OBJECT_NOT_FOUND"); if (!String(meta.storage_path).startsWith(path.join(objectRoot, tenantStorageSegment(tenantId)) + path.sep)) return fail(response, 403, "OBJECT_ISOLATION_VIOLATION"); const content = fs.readFileSync(meta.storage_path); return send(response, 200, { ok: true, object: { id: meta.id, fileName: meta.file_name, contentType: meta.content_type, size: meta.size, sha256: meta.sha256, dataBase64: content.toString("base64") } }) }
      return fail(response, 404, "NOT_FOUND")
    } catch (error) {
      const status = Number(error.statusCode || 500); if (status >= 500) console.error(error); return fail(response, status, error.message || "INTERNAL_ERROR")
    }
  }

  const server = http.createServer(handler)
  return { server, store, objectRoot, handler, close: () => { store.close(); server.close() } }
}

function startCentralServer(options = {}) {
  const instance = createCentralServer(options); const port = Number(options.port || DEFAULT_PORT); const host = options.host || process.env.QESTIMA_CENTRAL_HOST || "127.0.0.1"
  return new Promise((resolve, reject) => { instance.server.once("error", reject); instance.server.listen(port, host, () => { console.log(`QESTIMA Central API listening on http://${host}:${port}`); resolve({ ...instance, port, host }) }) })
}

if (require.main === module) {
  startCentralServer({ dbPath: process.env.QESTIMA_CENTRAL_DB, objectRoot: process.env.QESTIMA_OBJECT_ROOT }).catch((error) => { console.error(error.message); process.exitCode = 1 })
}

module.exports = { createCentralServer, startCentralServer, issueAccessToken, verifyAccessToken, signUpdateManifest, updateSigningInput, signLicenseToken, licenseSigningInput, issueLicenseToken, licenseGate, readJson }
