(function (root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) module.exports = api
  if (root) root.QESTIMACollaboration = api
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict"

  const nowIso = () => new Date().toISOString()
  const id = (prefix = "id") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const number = (value) => {
    const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[,٬]/g, "").replace(/٫/g, ".").trim())
    return Number.isFinite(parsed) ? parsed : 0
  }
  const clone = (value) => JSON.parse(JSON.stringify(value))
  const pathKey = (parts) => parts.map((part) => String(part).replace(/~/g, "~0").replace(/\//g, "~1")).join("/")
  const pathParts = (path) => String(path || "").split("/").filter(Boolean).map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
  const getAt = (object, parts) => parts.reduce((value, part) => value == null ? undefined : value[part], object)
  const setAt = (object, parts, value) => {
    if (!parts.length) return value
    let cursor = object
    parts.slice(0, -1).forEach((part) => {
      if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {}
      cursor = cursor[part]
    })
    cursor[parts[parts.length - 1]] = clone(value)
    return object
  }

  const ROLE_LABELS = {
    system_admin: "System Admin", estimation_manager: "Estimation Manager", lead_qs: "Lead QS",
    estimator: "Estimator / QS", procurement: "Procurement", technical_engineer: "Technical Engineer",
    commercial_reviewer: "Commercial Reviewer", viewer: "Viewer", owner: "Owner",
  }

  function createTenant(input = {}) {
    const createdAt = input.createdAt || nowIso()
    const idValue = String(input.id || id("tenant"))
    return {
      id: idValue,
      name: String(input.name || "QESTIMA Company").trim() || "QESTIMA Company",
      slug: String(input.slug || idValue).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || idValue,
      type: input.type === "personal" ? "personal" : "company",
      status: ["active", "suspended", "revoked"].includes(input.status) ? input.status : "active",
      plan: String(input.plan || "Pilot"),
      ownerUserId: String(input.ownerUserId || ""),
      maxUsers: Math.max(1, Math.round(number(input.maxUsers) || (input.type === "personal" ? 1 : 10))),
      maxDevices: Math.max(1, Math.round(number(input.maxDevices) || (input.type === "personal" ? 1 : 10))),
      storageMode: String(input.storageMode || (input.type === "personal" ? "local_encrypted_cache" : "central_object_storage")),
      region: String(input.region || "sa"),
      apiBaseUrl: String(input.apiBaseUrl || ""),
      createdAt,
      updatedAt: input.updatedAt || createdAt,
      lastConnectionAt: input.lastConnectionAt || "",
      featureFlags: { ...defaultFeatureFlags(), ...(input.featureFlags || {}) },
    }
  }

  function defaultFeatureFlags() {
    return {
      pdfIntelligence: true, pdfTakeoff: true, centralSync: false, ownerPortal: false,
      ifcImport: true, revitBridge: false, dxfImport: true, nativeDwg: false,
    }
  }

  function ensureCollaborationState(state = {}) {
    const now = nowIso()
    state.tenants = Array.isArray(state.tenants) ? state.tenants : []
    state.devices = Array.isArray(state.devices) ? state.devices : []
    state.supportAccess = Array.isArray(state.supportAccess) ? state.supportAccess : []
    state.syncQueue = Array.isArray(state.syncQueue) ? state.syncQueue : []
    state.syncConflicts = Array.isArray(state.syncConflicts) ? state.syncConflicts : []
    state.centralAudit = Array.isArray(state.centralAudit) ? state.centralAudit : []
    state.central = { apiBaseUrl: "", environment: "pilot", connectionState: "local", lastSyncAt: "", syncCursor: "", syncCursors: {}, publicKeyId: "", licensePublicKeyId: "", licenseToken: "", updateChannel: "stable", tenantId: "", accessToken: "", serverUser: null, ...(state.central || {}) }
    state.central.syncCursors = state.central.syncCursors && typeof state.central.syncCursors === "object" ? state.central.syncCursors : {}
    state.updatePolicy = { channel: state.central.updateChannel || "stable", requireSignature: true, minimumVersion: "", lastCheckedAt: "", lastManifestVersion: "", ...(state.updatePolicy || {}) }
    if (!state.tenants.length) {
      const owner = state.users?.[0]
      state.tenants.push(createTenant({ id: "tenant-personal", name: `${owner?.name || "Personal"} — Personal`, type: "personal", plan: "Preview", ownerUserId: owner?.id || "user-owner", maxUsers: 1, maxDevices: 1, storageMode: "local_encrypted_cache", featureFlags: { centralSync: false, ownerPortal: false } }))
      state.tenants.push(createTenant({ id: "tenant-company-pilot", name: "QESTIMA Company Pilot", type: "company", plan: "Pilot", ownerUserId: owner?.id || "user-owner", maxUsers: 10, maxDevices: 10, storageMode: "central_object_storage", featureFlags: { centralSync: true, ownerPortal: true, revitBridge: false } }))
    } else state.tenants = state.tenants.map((tenant) => createTenant(tenant))
    const personal = state.tenants.find((tenant) => tenant.type === "personal") || state.tenants[0]
    state.session = { tenantId: personal?.id || "", deviceId: "", connectionState: "local", lastConnectionAt: "", syncCursor: "", ...(state.session || {}) }
    state.workspaces = (state.workspaces || []).map((workspace) => ({ ...workspace, tenantId: workspace.tenantId || (workspace.type === "company" ? "tenant-company-pilot" : personal?.id || "") }))
    state.users = (state.users || []).map((user) => ({ ...user, tenantIds: Array.isArray(user.tenantIds) && user.tenantIds.length ? user.tenantIds : [personal?.id || ""], lastConnectionAt: user.lastConnectionAt || "", appVersion: user.appVersion || "" }))
    state.devices = state.devices.map((device) => ({ status: "active", appVersion: "", lastConnectionAt: "", ...device }))
    ;(state.projects || []).forEach((project) => {
      project.tenantId ||= (state.workspaces || []).find((workspace) => workspace.id === project.workspaceId)?.tenantId || personal?.id || ""
      project.serverVersion = Math.max(1, Math.round(number(project.serverVersion) || 1))
      project.lastSyncedAt ||= ""
      project.syncBaseSnapshot ||= null
      project.projectLock ||= null
      project.modelRevisions ||= []
      project.ifcModels = Array.isArray(project.ifcModels) ? project.ifcModels : []
      project.ifcElements = Array.isArray(project.ifcElements) ? project.ifcElements : []
      project.ifcMappings = Array.isArray(project.ifcMappings) ? project.ifcMappings : []
    })
    return state
  }

  function tenantFor(state, tenantId = "") {
    ensureCollaborationState(state)
    return state.tenants.find((tenant) => tenant.id === (tenantId || state.session?.tenantId)) || null
  }

  function userTenantIds(user = {}) {
    return Array.isArray(user.tenantIds) ? user.tenantIds.filter(Boolean) : []
  }

  function canAccessTenant(state, userId, tenantId) {
    ensureCollaborationState(state)
    const tenant = tenantFor(state, tenantId)
    const user = (state.users || []).find((entry) => entry.id === userId)
    if (!tenant || !user || tenant.status !== "active" || user.active === false) return false
    if (user.role === "system_admin" || user.role === "owner") return true
    return userTenantIds(user).includes(tenant.id) || (state.workspaces || []).some((workspace) => workspace.tenantId === tenant.id && workspace.members?.some((member) => member.userId === userId))
  }

  function tenantUsage(state, tenantId) {
    ensureCollaborationState(state)
    const userIds = new Set((state.users || []).filter((user) => userTenantIds(user).includes(tenantId) || (state.workspaces || []).some((workspace) => workspace.tenantId === tenantId && workspace.members?.some((member) => member.userId === user.id))).map((user) => user.id))
    const devices = (state.devices || []).filter((device) => device.tenantId === tenantId && device.status !== "revoked")
    return { users: userIds.size, devices: devices.length, userIds: [...userIds], deviceIds: devices.map((device) => device.id) }
  }

  function registerDevice(state, input = {}) {
    ensureCollaborationState(state)
    const tenant = tenantFor(state, input.tenantId)
    const userId = input.userId || state.session?.userId || ""
    if (!tenant || !canAccessTenant(state, userId, tenant.id)) return { ok: false, reason: "TENANT_ACCESS_DENIED" }
    const deviceId = String(input.id || input.deviceId || `device-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    const existing = state.devices.find((device) => device.id === deviceId)
    if (!existing && tenantUsage(state, tenant.id).devices >= tenant.maxDevices) return { ok: false, reason: "DEVICE_SEAT_LIMIT", usage: tenantUsage(state, tenant.id), limit: tenant.maxDevices }
    const device = existing || { id: deviceId, tenantId: tenant.id, userId, registeredAt: nowIso() }
    Object.assign(device, { tenantId: tenant.id, userId, name: String(input.name || device.name || "QESTIMA device"), platform: String(input.platform || device.platform || "windows"), appVersion: String(input.appVersion || device.appVersion || ""), lastConnectionAt: nowIso(), status: "active", machineHash: String(input.machineHash || device.machineHash || "") })
    if (!existing) state.devices.push(device)
    state.session = { ...(state.session || {}), tenantId: tenant.id, deviceId: device.id, lastConnectionAt: device.lastConnectionAt, connectionState: tenant.featureFlags.centralSync ? "central" : "local" }
    tenant.lastConnectionAt = device.lastConnectionAt
    tenant.updatedAt = device.lastConnectionAt
    return { ok: true, device, usage: tenantUsage(state, tenant.id) }
  }

  function touchConnection(state, input = {}) {
    ensureCollaborationState(state)
    const now = nowIso()
    const user = (state.users || []).find((entry) => entry.id === (input.userId || state.session?.userId))
    const device = (state.devices || []).find((entry) => entry.id === (input.deviceId || state.session?.deviceId))
    if (user) { user.lastConnectionAt = now; user.appVersion = input.appVersion || user.appVersion || "" }
    if (device) { device.lastConnectionAt = now; device.appVersion = input.appVersion || device.appVersion || ""; device.status = "active" }
    const tenant = tenantFor(state, input.tenantId)
    if (tenant) tenant.lastConnectionAt = now
    state.session = { ...(state.session || {}), lastConnectionAt: now, connectionState: input.connectionState || state.session?.connectionState || "local" }
    return { ok: true, at: now, user, device, tenant }
  }

  function licenseEntitlements(license = {}, now = new Date()) {
    const startsAt = new Date(license.startsAt || 0)
    const expiresAt = new Date(license.expiresAt || 0)
    const validStart = Number.isFinite(startsAt.getTime()) ? startsAt : null
    const validExpiry = Number.isFinite(expiresAt.getTime()) ? expiresAt : null
    const graceDays = Math.max(0, Math.round(number(license.offlineGraceDays || license.offlineGracePeriodDays)))
    const graceAt = validExpiry ? new Date(validExpiry.getTime() + graceDays * 86400000) : null
    const active = license.status !== "revoked" && license.status !== "suspended" && (!validStart || now >= validStart) && (!graceAt || now <= graceAt)
    const expired = Boolean(validExpiry && now > validExpiry)
    const readOnly = !active
    return { active, expired, readOnly, graceDays, graceAt: graceAt?.toISOString() || "", maxUsers: Math.max(1, Math.round(number(license.maxUsers) || 1)), maxDevices: Math.max(1, Math.round(number(license.maxDevices) || 1)), featureFlags: { ...defaultFeatureFlags(), ...(license.featureFlags || {}) }, status: !active ? (license.status === "revoked" ? "revoked" : license.status === "suspended" ? "suspended" : "expired") : "active" }
  }

  function licenseAction(state, action, input = {}) {
    ensureCollaborationState(state)
    const license = state.license || {}
    const actor = String(input.userId || state.session?.userId || "")
    const now = nowIso()
    if (!["suspend", "extend", "revoke", "activate"].includes(action)) return { ok: false, reason: "UNKNOWN_LICENSE_ACTION" }
    if (action === "suspend") license.status = "suspended"
    if (action === "revoke") license.status = "revoked"
    if (action === "activate") { license.status = "active"; license.lastValidatedAt = now }
    if (action === "extend") {
      const base = new Date(license.expiresAt || now)
      const safeBase = Number.isFinite(base.getTime()) && base > new Date() ? base : new Date()
      safeBase.setDate(safeBase.getDate() + Math.max(1, Math.round(number(input.days) || 30)))
      license.expiresAt = safeBase.toISOString(); license.status = "active"; license.lastValidatedAt = now
    }
    license.updatedAt = now; license.updatedBy = actor
    recordCentralAudit(state, { tenantId: input.tenantId || state.session?.tenantId, actorId: actor, action: `license.${action}`, entityType: "license", entityId: license.id || license.licenseKey, detail: input.reason || "" })
    return { ok: true, license: clone(license), entitlements: licenseEntitlements(license) }
  }

  function featureAllowed(state, feature, options = {}) {
    ensureCollaborationState(state)
    const tenant = tenantFor(state, options.tenantId)
    const entitlements = licenseEntitlements(state.license || {}, options.now || new Date())
    if (!entitlements.active && options.allowReadOnly !== true) return false
    if (tenant && tenant.featureFlags && tenant.featureFlags[feature] === false) return false
    return entitlements.featureFlags[feature] !== false
  }

  function activeProjectLock(project = {}, now = new Date()) {
    const lock = project.projectLock
    if (!lock) return null
    const expiry = new Date(lock.expiresAt || 0)
    if (!Number.isFinite(expiry.getTime()) || expiry <= now) return null
    return lock
  }

  function acquireProjectLock(project, input = {}) {
    const now = new Date()
    const existing = activeProjectLock(project, now)
    const userId = String(input.userId || "")
    if (existing && (existing.userId !== userId || (input.deviceId && existing.deviceId !== input.deviceId))) return { ok: false, reason: "PROJECT_LOCKED", lock: clone(existing) }
    const ttlMinutes = Math.max(1, Math.min(120, Math.round(number(input.ttlMinutes) || 15)))
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60000).toISOString()
    project.projectLock = { token: existing?.token || id("lock"), userId, deviceId: String(input.deviceId || ""), acquiredAt: existing?.acquiredAt || now.toISOString(), heartbeatAt: now.toISOString(), expiresAt, mode: "soft" }
    project.updatedAt = now.toISOString()
    return { ok: true, lock: clone(project.projectLock) }
  }

  function renewProjectLock(project, input = {}) {
    const lock = activeProjectLock(project)
    if (!lock || lock.userId !== String(input.userId || "") || (input.token && lock.token !== input.token)) return { ok: false, reason: "LOCK_NOT_OWNED", lock: clone(lock) }
    const ttlMinutes = Math.max(1, Math.min(120, Math.round(number(input.ttlMinutes) || 15)))
    const now = new Date()
    lock.heartbeatAt = now.toISOString(); lock.expiresAt = new Date(now.getTime() + ttlMinutes * 60000).toISOString()
    return { ok: true, lock: clone(lock) }
  }

  function releaseProjectLock(project, input = {}) {
    const lock = activeProjectLock(project)
    if (!lock) { project.projectLock = null; return { ok: true, released: false } }
    if (lock.userId !== String(input.userId || "") && input.force !== true) return { ok: false, reason: "LOCK_NOT_OWNED", lock: clone(lock) }
    project.projectLock = null
    return { ok: true, released: true }
  }

  function changedPaths(before, after, prefix = []) {
    if (Object.is(before, after)) return []
    const bothArrays = Array.isArray(before) && Array.isArray(after)
    if (bothArrays) {
      const length = Math.max(before.length, after.length); const result = []
      for (let index = 0; index < length; index += 1) result.push(...changedPaths(before[index], after[index], [...prefix, index]))
      return result
    }
    if (Array.isArray(before) || Array.isArray(after)) return [pathKey(prefix)]
    const bothObjects = before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)
    if (!bothObjects) return [pathKey(prefix)]
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const result = []
    keys.forEach((key) => result.push(...changedPaths(before[key], after[key], [...prefix, key])))
    return result
  }

  function pathsOverlap(left, right) {
    return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)
  }

  function mergeNonConflicting(base, local, remote) {
    const localChanges = changedPaths(base, local).filter(Boolean)
    const remoteChanges = changedPaths(base, remote).filter(Boolean)
    const conflicts = localChanges.filter((path) => remoteChanges.some((candidate) => pathsOverlap(path, candidate)))
    if (conflicts.length) return { ok: false, conflicts: [...new Set(conflicts)], localChanges, remoteChanges, merged: null }
    const merged = clone(remote)
    localChanges.forEach((path) => setAt(merged, pathParts(path), getAt(local, pathParts(path))))
    return { ok: true, conflicts: [], localChanges, remoteChanges, merged }
  }

  function queueSyncOperation(state, input = {}) {
    ensureCollaborationState(state)
    const operation = {
      id: input.id || id("sync"), tenantId: String(input.tenantId || state.session?.tenantId || ""), projectId: String(input.projectId || ""), entityType: String(input.entityType || "project"), entityId: String(input.entityId || input.projectId || ""), operation: String(input.operation || "update"), baseVersion: Math.max(0, Math.round(number(input.baseVersion))), payload: clone(input.payload || {}), changedPaths: Array.isArray(input.changedPaths) ? [...input.changedPaths] : [], actorId: String(input.actorId || state.session?.userId || ""), deviceId: String(input.deviceId || state.session?.deviceId || ""), createdAt: input.createdAt || nowIso(), status: "pending",
    }
    state.syncQueue.push(operation)
    return operation
  }

  function applyRemoteProject(state, projectId, remoteProject, options = {}) {
    ensureCollaborationState(state)
    const project = (state.projects || []).find((entry) => entry.id === projectId)
    if (!project || !remoteProject) return { ok: false, reason: "PROJECT_NOT_FOUND" }
    const remote = clone(remoteProject)
    const base = project.syncBaseSnapshot ? clone(project.syncBaseSnapshot) : clone(project)
    const merged = mergeNonConflicting(base, project, remote)
    if (!merged.ok) {
      const conflict = { id: id("conflict"), tenantId: project.tenantId || state.session?.tenantId || "", projectId, entityType: "project", baseVersion: project.serverVersion || 1, localVersion: project.version || project.serverVersion || 1, remoteVersion: remote.serverVersion || 1, paths: merged.conflicts, local: clone(project), remote, createdAt: nowIso(), status: "open", detectedBy: options.userId || state.session?.userId || "" }
      state.syncConflicts.unshift(conflict)
      recordCentralAudit(state, { tenantId: conflict.tenantId, actorId: conflict.detectedBy, action: "sync.conflict_detected", entityType: "project", entityId: projectId, detail: conflict.paths.join(", ") })
      return { ok: false, reason: "SYNC_CONFLICT", conflict }
    }
    // The server version is authoritative after a successful pull.  Do not
    // increment it locally: doing so makes the next optimistic push look
    // newer than the server and creates a false conflict.
    Object.assign(project, merged.merged, { serverVersion: Math.max(number(remote.serverVersion), number(project.serverVersion) || 1), lastSyncedAt: nowIso(), syncBaseSnapshot: clone(remote) })
    state.central.lastSyncAt = project.lastSyncedAt
    return { ok: true, project, mergedPaths: merged.localChanges }
  }

  function resolveConflict(state, conflictId, resolutions = {}, options = {}) {
    ensureCollaborationState(state)
    const conflict = state.syncConflicts.find((entry) => entry.id === conflictId && entry.status === "open")
    if (!conflict) return { ok: false, reason: "CONFLICT_NOT_FOUND" }
    const selected = clone(conflict.remote)
    conflict.paths.forEach((path) => {
      const choice = resolutions[path] || resolutions.default || "remote"
      const value = choice === "local" ? getAt(conflict.local, pathParts(path)) : choice === "remote" ? getAt(conflict.remote, pathParts(path)) : choice
      setAt(selected, pathParts(path), value)
    })
    const project = (state.projects || []).find((entry) => entry.id === conflict.projectId)
    if (!project) return { ok: false, reason: "PROJECT_NOT_FOUND" }
    Object.assign(project, selected, { serverVersion: Math.max(number(conflict.localVersion), number(conflict.remoteVersion)) + 1, lastSyncedAt: nowIso(), syncBaseSnapshot: clone(selected) })
    conflict.status = "resolved"; conflict.resolvedAt = nowIso(); conflict.resolvedBy = options.userId || state.session?.userId || ""; conflict.resolutions = clone(resolutions)
    recordCentralAudit(state, { tenantId: conflict.tenantId, actorId: conflict.resolvedBy, action: "sync.conflict_resolved", entityType: "project", entityId: conflict.projectId, detail: conflict.paths.join(", ") })
    return { ok: true, project, conflict }
  }

  function recordCentralAudit(state, input = {}) {
    ensureCollaborationState(state)
    const entry = { id: input.id || id("central-audit"), tenantId: String(input.tenantId || state.session?.tenantId || ""), actorId: String(input.actorId || state.session?.userId || ""), action: String(input.action || "change"), entityType: String(input.entityType || ""), entityId: String(input.entityId || ""), detail: String(input.detail || ""), appVersion: String(input.appVersion || state.appVersion || ""), deviceId: String(input.deviceId || state.session?.deviceId || ""), timestamp: input.timestamp || nowIso(), immutable: true, source: "QESTIMA Central Audit" }
    state.centralAudit.unshift(entry)
    if (state.centralAudit.length > 5000) state.centralAudit.length = 5000
    return entry
  }

  function requestSupportAccess(state, input = {}) {
    ensureCollaborationState(state)
    const record = { id: input.id || id("support"), tenantId: String(input.tenantId || state.session?.tenantId || ""), requestedBy: String(input.requestedBy || state.session?.userId || ""), reason: String(input.reason || ""), scopes: Array.isArray(input.scopes) ? [...new Set(input.scopes.map(String))] : ["diagnostics"], status: "requested", requestedAt: nowIso(), startsAt: "", expiresAt: "", approvedBy: "", revokedAt: "" }
    state.supportAccess.unshift(record)
    recordCentralAudit(state, { tenantId: record.tenantId, actorId: record.requestedBy, action: "support_access.requested", entityType: "support_access", entityId: record.id, detail: record.reason })
    return record
  }

  function approveSupportAccess(state, accessId, input = {}) {
    ensureCollaborationState(state)
    const record = state.supportAccess.find((entry) => entry.id === accessId)
    if (!record) return { ok: false, reason: "SUPPORT_REQUEST_NOT_FOUND" }
    const now = new Date()
    const hours = Math.max(1, Math.min(72, Math.round(number(input.hours) || 4)))
    record.status = "approved"; record.approvedBy = String(input.approvedBy || state.session?.userId || ""); record.startsAt = now.toISOString(); record.expiresAt = new Date(now.getTime() + hours * 3600000).toISOString()
    recordCentralAudit(state, { tenantId: record.tenantId, actorId: record.approvedBy, action: "support_access.approved", entityType: "support_access", entityId: record.id, detail: `${hours}h · ${record.scopes.join(", ")}` })
    return { ok: true, access: record }
  }

  function revokeSupportAccess(state, accessId, input = {}) {
    ensureCollaborationState(state)
    const record = state.supportAccess.find((entry) => entry.id === accessId)
    if (!record) return { ok: false, reason: "SUPPORT_REQUEST_NOT_FOUND" }
    record.status = "revoked"; record.revokedAt = nowIso(); record.revokedBy = String(input.revokedBy || state.session?.userId || "")
    recordCentralAudit(state, { tenantId: record.tenantId, actorId: record.revokedBy, action: "support_access.revoked", entityType: "support_access", entityId: record.id })
    return { ok: true, access: record }
  }

  function supportAccessActive(record, now = new Date()) {
    if (!record || record.status !== "approved" || record.revokedAt) return false
    const start = new Date(record.startsAt || 0); const expiry = new Date(record.expiresAt || 0)
    return Number.isFinite(start.getTime()) && Number.isFinite(expiry.getTime()) && now >= start && now <= expiry
  }

  function ownerOverview(state, tenantId = "") {
    ensureCollaborationState(state)
    const tenant = tenantFor(state, tenantId)
    if (!tenant) return null
    const usage = tenantUsage(state, tenant.id)
    const projects = (state.projects || []).filter((project) => project.tenantId === tenant.id || project.workspaceId === (state.workspaces || []).find((workspace) => workspace.tenantId === tenant.id)?.id)
    const openConflicts = (state.syncConflicts || []).filter((conflict) => conflict.tenantId === tenant.id && conflict.status === "open")
    const support = (state.supportAccess || []).filter((entry) => entry.tenantId === tenant.id && entry.status !== "revoked")
    return { tenant: clone(tenant), usage: { users: usage.users, devices: usage.devices, maxUsers: tenant.maxUsers, maxDevices: tenant.maxDevices }, projects: projects.map((project) => ({ id: project.id, code: project.tenderCode, name: project.name, status: project.status, serverVersion: project.serverVersion, lastSyncedAt: project.lastSyncedAt, lock: activeProjectLock(project) })), openConflicts, supportAccess: support, lastAudit: (state.centralAudit || []).filter((entry) => entry.tenantId === tenant.id).slice(0, 20), license: licenseEntitlements(state.license || {}) }
  }

  function updateManifestStatus(manifest = {}, appVersion = "") {
    const version = String(manifest.version || manifest.appVersion || "")
    const minimum = String(manifest.minimumVersion || "")
    const compare = (left, right) => {
      const a = String(left || "").split(/[.-]/).map((part) => Number(part) || 0); const b = String(right || "").split(/[.-]/).map((part) => Number(part) || 0)
      for (let index = 0; index < Math.max(a.length, b.length); index += 1) if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0)
      return 0
    }
    return { version, minimumVersion: minimum, updateAvailable: Boolean(version && appVersion && compare(version, appVersion) > 0), minimumSatisfied: !minimum || !appVersion || compare(appVersion, minimum) >= 0, signed: Boolean(manifest.signature && manifest.publicKeyId), channel: manifest.channel || "stable", publishedAt: manifest.publishedAt || "" }
  }

  return {
    ROLE_LABELS, defaultFeatureFlags, createTenant, ensureCollaborationState, tenantFor, canAccessTenant, tenantUsage,
    registerDevice, touchConnection, licenseEntitlements, licenseAction, featureAllowed, activeProjectLock, acquireProjectLock,
    renewProjectLock, releaseProjectLock, changedPaths, mergeNonConflicting, queueSyncOperation, applyRemoteProject, resolveConflict,
    recordCentralAudit, requestSupportAccess, approveSupportAccess, revokeSupportAccess, supportAccessActive, ownerOverview, updateManifestStatus,
  }
})
