const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { createCentralServer, signUpdateManifest, updateSigningInput, licenseSigningInput } = require("../server/api.cjs")
const crypto = require("node:crypto")

async function request(base, route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } })
  const text = await response.text(); let data
  try { data = JSON.parse(text) } catch { data = { text } }
  return { response, data }
}

test("central API provisions a tenant, isolates project data and reports version conflicts", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-central-test-"))
  const licenseKeys = crypto.generateKeyPairSync("ed25519")
  const licensePrivateKey = licenseKeys.privateKey.export({ type: "pkcs8", format: "pem" })
  const instance = createCentralServer({ dbPath: path.join(folder, "central.db"), objectRoot: path.join(folder, "objects"), secret: "test-secret-012345678901234567890123456789", provisioningSecret: "bootstrap-test", licensePrivateKey, licensePublicKeyId: "license-test-key" })
  await new Promise((resolve) => instance.server.listen(0, "127.0.0.1", resolve)); const address = instance.server.address(); const base = `http://127.0.0.1:${address.port}`
  try {
    const provision = await request(base, "/api/v1/provision", { method: "POST", headers: { "X-QESTIMA-Bootstrap": "bootstrap-test" }, body: JSON.stringify({ tenant: { id: "tenant-a", name: "Tenant A", slug: "tenant-a", maxUsers: 2, maxDevices: 2 }, user: { id: "owner-a", username: "owner", name: "Owner", password: "Strong-password-123", role: "owner" } }) })
    assert.equal(provision.response.status, 201)
    const login = await request(base, "/api/v1/auth/login", { method: "POST", body: JSON.stringify({ tenantId: "tenant-a", username: "owner", password: "Strong-password-123", appVersion: "0.11.0" }) })
    assert.equal(login.data.ok, true); assert.ok(login.data.licenseToken); const token = login.data.token; const auth = { Authorization: `Bearer ${token}` }
    const licenseParts = login.data.licenseToken.split("."); const licenseSignature = Buffer.from(licenseParts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64")
    assert.equal(crypto.verify(null, Buffer.from(`${licenseParts[0]}.${licenseParts[1]}`), licenseKeys.publicKey, licenseSignature), true)
    const created = await request(base, "/api/v1/projects", { method: "POST", headers: auth, body: JSON.stringify({ id: "project-a", name: "Hospital Tender", tenantId: "wrong-tenant", boq: [] }) })
    assert.equal(created.response.status, 201); assert.equal(created.data.project.tenantId, "tenant-a")
    const listed = await request(base, "/api/v1/projects", { headers: auth }); assert.equal(listed.data.projects.length, 1); assert.equal(listed.data.projects[0].id, "project-a")
    const pushed = await request(base, "/api/v1/sync/push", { method: "POST", headers: auth, body: JSON.stringify({ operations: [{ projectId: "project-a", baseVersion: 1, payload: { id: "project-a", name: "Hospital Tender — synced", boq: [{ id: "m-01", description: "CHW Pipe 100 mm", quantity: 100 }] } }] }) })
    assert.equal(pushed.data.ok, true); assert.equal(pushed.data.applied.length, 1); assert.equal(pushed.data.applied[0].serverVersion, 2)
    const pulled = await request(base, "/api/v1/sync/pull", { headers: auth }); assert.equal(pulled.data.ok, true); assert.equal(pulled.data.projects[0].name, "Hospital Tender — synced"); assert.ok(pulled.data.cursor)
    const lock = await request(base, "/api/v1/projects/project-a/lock", { method: "POST", headers: auth, body: JSON.stringify({ action: "acquire", ttlMinutes: 5 }) }); assert.equal(lock.data.ok, true)
    const stale = await request(base, "/api/v1/projects/project-a", { method: "PUT", headers: { ...auth, "If-Match": "0" }, body: JSON.stringify({ name: "stale" }) }); assert.equal(stale.response.status, 409); assert.equal(stale.data.reason, "VERSION_CONFLICT")
    const overview = await request(base, "/api/v1/owner/overview", { headers: auth }); assert.equal(overview.data.ok, true); assert.equal(overview.data.usage.users, 1)
    const createdUser = await request(base, "/api/v1/users", { method: "POST", headers: auth, body: JSON.stringify({ username: "qs", name: "QS", password: "Strong-password-456", role: "estimator" }) }); assert.equal(createdUser.response.status, 201)
    const users = await request(base, "/api/v1/users", { headers: auth }); assert.equal(users.data.users.length, 2)
    const suspended = await request(base, "/api/v1/licenses/tenant-a/action", { method: "POST", headers: auth, body: JSON.stringify({ action: "suspend", reason: "test" }) }); assert.equal(suspended.data.ok, true); assert.equal(suspended.data.licenseToken.length > 0, true)
    const readOnly = await request(base, "/api/v1/projects/project-a", { method: "PUT", headers: auth, body: JSON.stringify({ name: "blocked" }) }); assert.equal(readOnly.response.status, 423); assert.equal(readOnly.data.reason, "LICENSE_READ_ONLY")
    const reactivated = await request(base, "/api/v1/licenses/tenant-a/action", { method: "POST", headers: auth, body: JSON.stringify({ action: "activate" }) }); assert.equal(reactivated.data.ok, true)
    const audit = await request(base, "/api/v1/audit", { headers: auth }); assert.ok(audit.data.entries.some((entry) => entry.action === "project.created"))
    const rejected = await request(base, "/api/v1/projects/project-a", { headers: { Authorization: "Bearer invalid" } }); assert.equal(rejected.response.status, 401)
  } finally {
    await new Promise((resolve) => instance.server.close(resolve)); instance.store.close(); fs.rmSync(folder, { recursive: true, force: true })
  }
})

test("update manifests can be signed outside the client", () => {
  const keys = crypto.generateKeyPairSync("ed25519")
  const manifest = signUpdateManifest({ channel: "stable", version: "0.11.0", publicKeyId: "test-key", publishedAt: "2026-09-02T00:00:00Z" }, keys.privateKey.export({ type: "pkcs8", format: "pem" }))
  const signature = Buffer.from(manifest.signature.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  assert.equal(crypto.verify(null, Buffer.from(updateSigningInput(manifest)), keys.publicKey, signature), true)
})

test("license signing input is canonical and excludes the signature", () => {
  const value = { exp: 2, sub: "tenant-a", signature: "ignore", nbf: 1 }
  assert.equal(licenseSigningInput(value), JSON.stringify({ exp: 2, nbf: 1, sub: "tenant-a" }))
})
