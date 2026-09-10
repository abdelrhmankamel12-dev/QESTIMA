// Company authentication is independent of commercial licensing.
const crypto = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')
const fs = require('node:fs')
const path = require('node:path')
const { hashPassword, verifyPassword } = require('./central-store.cjs')
const PERMISSIONS = ['users.manage', 'projects.manage', 'progress.view', 'dry.view', 'dry.edit', 'commercial.view', 'commercial.edit', 'approval.manage', 'reports.export']
const ROLES = {
  administrator: PERMISSIONS,
  manager: PERMISSIONS,
  estimator: ['dry.view', 'dry.edit', 'reports.export'],
  viewer: ['dry.view'],
}
function error(code, status = 400) { return Object.assign(new Error(code), { status }) }
function digest(s) { return crypto.createHash('sha256').update(String(s)).digest('hex') }
function equal(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y) }
function base32(bytes) {
  let bits = 0, value = 0, result = ''; const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  for (const b of bytes) { value = (value << 8) | b; bits += 8; while (bits >= 5) { result += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5 } }
  if (bits) result += alphabet[(value << (5 - bits)) & 31]
  return result
}
function decode32(s) {
  let bits = 0, value = 0; const out = []
  for (const c of s) { const n = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c); if (n < 0) throw error('INVALID_MFA_SECRET'); value = (value << 5) | n; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 } }
  return Buffer.from(out)
}
function totp(secret, time = Date.now(), digits = 6) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(time / 30000)))
  const h = crypto.createHmac('sha1', decode32(secret)).update(counter).digest(), offset = h[h.length - 1] & 15
  return String((h.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits)).padStart(digits, '0')
}
class CompanySecurity {
  constructor({ dbPath, encryptionKey, now = Date.now }) {
    if (!Buffer.isBuffer(encryptionKey) || encryptionKey.length !== 32) throw error('SERVER_KEY_REQUIRED')
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    this.db = new DatabaseSync(dbPath); this.key = encryptionKey; this.now = now
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS company_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS company_users(id TEXT PRIMARY KEY,username TEXT UNIQUE COLLATE NOCASE,name TEXT,role TEXT,password TEXT,active INTEGER NOT NULL DEFAULT 1,overrides TEXT NOT NULL DEFAULT '{}',projects TEXT NOT NULL DEFAULT '[]',mfa TEXT,mfa_pending TEXT,last_step INTEGER NOT NULL DEFAULT -1,recovery TEXT NOT NULL DEFAULT '[]');
      CREATE TABLE IF NOT EXISTS company_sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES company_users(id),expires INTEGER,last_seen INTEGER,verified INTEGER NOT NULL DEFAULT 0,full INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS company_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,at INTEGER,actor TEXT,action TEXT,target TEXT,detail TEXT);
      CREATE TABLE IF NOT EXISTS company_attempts(key TEXT PRIMARY KEY,count INTEGER,until INTEGER);`)
  }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const v = fn(); this.db.exec('COMMIT'); return v } catch (e) { this.db.exec('ROLLBACK'); throw e } }
  seal(text) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', this.key, iv); const body = Buffer.concat([c.update(text, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64') }
  unseal(text) { const b = Buffer.from(text, 'base64'), c = crypto.createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12)); c.setAuthTag(b.subarray(12, 28)); return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString('utf8') }
  audit(actor, action, target = '', detail = {}) { this.db.prepare('INSERT INTO company_audit(at,actor,action,target,detail) VALUES(?,?,?,?,?)').run(this.now(), actor, action, target, JSON.stringify(detail)) }
  initialized() { return !!this.db.prepare('SELECT 1 FROM company_users LIMIT 1').get() }
  issueSetupToken() {
    if (this.initialized()) throw error('SETUP_CLOSED', 409)
    const token = crypto.randomBytes(32).toString('base64url')
    this.db.prepare("INSERT OR REPLACE INTO company_meta VALUES('setup',?)").run(JSON.stringify({ hash: digest(token), expires: this.now() + 15 * 60000 }))
    return token // Only the local server launcher can invoke this; never an HTTP endpoint.
  }
  passwordValid(password) { if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw error('PASSWORD_12_TO_256_CHARACTERS') }
  addUser(input) {
    this.passwordValid(input.password)
    if (!/^[A-Za-z0-9_.@-]{3,80}$/.test(input.username || '') || !Object.hasOwn(ROLES, input.role)) throw error('INVALID_USER')
    if (this.db.prepare('SELECT 1 FROM company_users WHERE username=?').get(input.username)) throw error('USERNAME_EXISTS', 409)
    const id = crypto.randomUUID()
    this.db.prepare('INSERT INTO company_users(id,username,name,role,password) VALUES(?,?,?,?,?)').run(id, input.username, String(input.name || input.username).slice(0, 120), input.role, hashPassword(input.password).encoded)
    return this.user(id)
  }
  bootstrap(token, input) {
    return this.transaction(() => {
      if (this.initialized()) throw error('SETUP_CLOSED', 409)
      const row = this.db.prepare("SELECT value FROM company_meta WHERE key='setup'").get(), setup = row && JSON.parse(row.value)
      if (!setup || this.now() > setup.expires || !equal(digest(token), setup.hash)) throw error('SETUP_DENIED', 403)
      const user = this.addUser({ ...input, role: 'administrator' })
      this.db.prepare("DELETE FROM company_meta WHERE key='setup'").run(); this.audit(user.id, 'company.initialized', user.id)
      return this.publicUser(user)
    })
  }
  user(id) { return this.db.prepare('SELECT * FROM company_users WHERE id=?').get(id) }
  permissions(user) {
    const p = new Set(ROLES[user.role] || []), overrides = JSON.parse(user.overrides)
    for (const [key, grant] of Object.entries(overrides)) {
      if (!PERMISSIONS.includes(key)) continue
      if (grant.expiresAt && grant.expiresAt <= this.now()) continue
      grant.allow ? p.add(key) : p.delete(key)
    }
    return [...p]
  }
  privileged(user) { return this.permissions(user).some(p => ['users.manage', 'projects.manage', 'progress.view', 'commercial.view', 'commercial.edit', 'approval.manage'].includes(p)) }
  publicUser(user) { return { id: user.id, username: user.username, name: user.name, role: user.role, active: !!user.active, permissions: this.permissions(user), overrides: JSON.parse(user.overrides), projects: JSON.parse(user.projects), mfaEnabled: !!user.mfa } }
  limit(key, maximum = 6) {
    const row = this.db.prepare('SELECT * FROM company_attempts WHERE key=?').get(key)
    if (row && row.until > this.now() && row.count >= maximum) throw error('TOO_MANY_ATTEMPTS', 429)
    this.db.prepare('INSERT INTO company_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN company_attempts.until<=? THEN 1 ELSE count+1 END,until=CASE WHEN company_attempts.until<=? THEN excluded.until ELSE until END').run(key, this.now() + 15 * 60000, this.now(), this.now())
  }
  clearLimit(key) { this.db.prepare('DELETE FROM company_attempts WHERE key=?').run(key) }
  consumeOtp(user, code) {
    if (!user.mfa || !/^\d{6}$/.test(String(code))) return false
    const secret = this.unseal(user.mfa), step = Math.floor(this.now() / 30000)
    for (const n of [step, step - 1, step + 1]) {
      if (n <= user.last_step || n < 0 || !equal(totp(secret, n * 30000), code)) continue
      const changed = this.db.prepare('UPDATE company_users SET last_step=? WHERE id=? AND last_step<?').run(n, user.id, n)
      return changed.changes === 1
    }
    return false
  }
  login({ username, password, code }, peer = '') {
    const key = 'login:' + String(username || '').toLowerCase(); this.limit('peer:' + peer, 100); this.limit(key)
    const user = this.db.prepare('SELECT * FROM company_users WHERE username=?').get(String(username || ''))
    if (typeof password !== 'string' || password.length > 256 || !user || !user.active || !verifyPassword(password, user.password)) throw error('AUTHENTICATION_FAILED', 401)
    if (user.mfa && !this.consumeOtp(user, code)) throw error('AUTHENTICATION_FAILED', 401)
    const token = crypto.randomBytes(32).toString('base64url'), full = !(this.privileged(user) && !user.mfa)
    this.db.prepare('INSERT INTO company_sessions VALUES(?,?,?,?,?,?)').run(digest(token), user.id, this.now() + (full ? 8 * 3600000 : 10 * 60000), this.now(), user.mfa ? this.now() : 0, full ? 1 : 0)
    this.clearLimit(key); this.audit(user.id, full ? 'auth.login' : 'auth.enrollment_required', user.id)
    return { token, user: this.publicUser(user), enrollmentRequired: !full }
  }
  session(token, { enrollment = false } = {}) {
    const s = this.db.prepare('SELECT * FROM company_sessions WHERE token=?').get(digest(token)), user = s && this.user(s.user_id)
    if (!s || s.expires <= this.now() || s.last_seen + 15 * 60000 <= this.now() || !user?.active) throw error('SESSION_EXPIRED', 401)
    if (!enrollment && (!s.full || (this.privileged(user) && !user.mfa))) throw error('MFA_ENROLLMENT_REQUIRED', 403)
    this.db.prepare('UPDATE company_sessions SET last_seen=? WHERE token=?').run(this.now(), s.token)
    return { user, session: s }
  }
  require(token, permission, projectId) {
    const auth = this.session(token)
    if (!this.permissions(auth.user).includes(permission)) throw error('PERMISSION_DENIED', 403)
    if (projectId && !this.permissions(auth.user).includes('projects.manage') && !JSON.parse(auth.user.projects).includes(projectId)) throw error('PROJECT_DENIED', 403)
    return auth
  }
  recent(token) { const a = this.session(token); if (!a.session.verified || a.session.verified + 5 * 60000 <= this.now()) throw error('REAUTHENTICATION_REQUIRED', 403); return a }
  reauthenticate(token, password, code) {
    const a = this.session(token); this.limit('reauth:' + a.user.id)
    if (typeof password !== 'string' || password.length > 256 || !verifyPassword(password, a.user.password) || !this.consumeOtp(a.user, code)) throw error('AUTHENTICATION_FAILED', 401)
    this.db.prepare('UPDATE company_sessions SET verified=? WHERE token=?').run(this.now(), a.session.token); this.clearLimit('reauth:' + a.user.id)
    this.audit(a.user.id, 'auth.reauthenticated')
  }
  beginMfa(token) {
    const a = this.session(token, { enrollment: true }); if (a.user.mfa) throw error('MFA_ALREADY_ENABLED', 409)
    const secret = base32(crypto.randomBytes(20))
    this.db.prepare('UPDATE company_users SET mfa_pending=? WHERE id=?').run(this.seal(secret), a.user.id)
    return { secret, uri: `otpauth://totp/QESTIMA:${encodeURIComponent(a.user.username)}?secret=${secret}&issuer=QESTIMA&algorithm=SHA1&digits=6&period=30` }
  }
  confirmMfa(token, code) {
    const a = this.session(token, { enrollment: true }); this.limit('mfa:' + a.user.id)
    if (!a.user.mfa_pending || a.user.mfa) throw error('MFA_NOT_PENDING')
    const candidate = { ...a.user, mfa: a.user.mfa_pending }
    return this.transaction(() => {
      if (!this.consumeOtp(candidate, code)) throw error('INVALID_OTP', 401)
      const recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(16).toString('hex'))
      this.db.prepare('UPDATE company_users SET mfa=mfa_pending,mfa_pending=NULL,recovery=? WHERE id=?').run(JSON.stringify(recoveryCodes.map(digest)), a.user.id)
      this.db.prepare('DELETE FROM company_sessions WHERE user_id=?').run(a.user.id)
      this.audit(a.user.id, 'auth.mfa_enabled'); return { recoveryCodes, loginRequired: true }
    })
  }
  recover({ username, password, recoveryCode, newPassword }) {
    const key = 'recovery:' + String(username || '').toLowerCase(); this.limit(key)
    const u = this.db.prepare('SELECT * FROM company_users WHERE username=?').get(String(username || ''))
    if (!u?.active || typeof password !== 'string' || password.length > 256 || !verifyPassword(password, u.password) || !JSON.parse(u.recovery).some(h => equal(h, digest(recoveryCode)))) throw error('RECOVERY_DENIED', 401)
    this.passwordValid(newPassword)
    this.transaction(() => {
      this.db.prepare("UPDATE company_users SET password=?,mfa=NULL,mfa_pending=NULL,last_step=-1,recovery='[]' WHERE id=?").run(hashPassword(newPassword).encoded, u.id)
      this.db.prepare('DELETE FROM company_sessions WHERE user_id=?').run(u.id); this.audit(u.id, 'auth.mfa_recovered')
    })
    this.clearLimit(key)
  }
  createUser(token, input) {
    const a = this.require(token, 'users.manage'); this.recent(token)
    return this.transaction(() => { const u = this.addUser(input); this.audit(a.user.id, 'user.created', u.id, { role: u.role }); return this.publicUser(u) })
  }
  changeUser(token, id, patch) {
    const a = this.require(token, 'users.manage'); this.recent(token)
    if (Object.keys(patch).some(k => !['role', 'active', 'overrides', 'projects'].includes(k))) throw error('INVALID_USER_PATCH')
    if (patch.role !== undefined && !Object.hasOwn(ROLES, patch.role)) throw error('INVALID_ROLE')
    if (patch.active !== undefined && typeof patch.active !== 'boolean') throw error('INVALID_ACTIVE')
    if (patch.projects !== undefined && (!Array.isArray(patch.projects) || patch.projects.some(p => typeof p !== 'string' || p.length > 128))) throw error('INVALID_PROJECTS')
    if (patch.overrides !== undefined) {
      if (!patch.overrides || Array.isArray(patch.overrides) || typeof patch.overrides !== 'object') throw error('INVALID_PERMISSIONS')
      for (const [k, v] of Object.entries(patch.overrides)) if (!PERMISSIONS.includes(k) || !v || typeof v.allow !== 'boolean' || (v.expiresAt !== undefined && (!Number.isSafeInteger(v.expiresAt) || v.expiresAt <= this.now()))) throw error('INVALID_PERMISSIONS')
    }
    return this.transaction(() => {
      const u = this.user(id); if (!u) throw error('USER_NOT_FOUND', 404)
      this.db.prepare('UPDATE company_users SET role=?,active=?,overrides=?,projects=? WHERE id=?').run(patch.role ?? u.role, patch.active === undefined ? u.active : Number(patch.active), JSON.stringify(patch.overrides ?? JSON.parse(u.overrides)), JSON.stringify(patch.projects ?? JSON.parse(u.projects)), id)
      // At least one active, enrolled, permanently authorized administrator must remain.
      const admins = this.db.prepare('SELECT * FROM company_users WHERE active=1 AND mfa IS NOT NULL').all().filter(x => {
        const override = JSON.parse(x.overrides)['users.manage']
        return this.permissions(x).includes('users.manage') && (override?.allow && !override.expiresAt || ROLES[x.role].includes('users.manage') && !override)
      })
      if (!admins.length) throw error('LAST_ADMINISTRATOR', 409)
      this.db.prepare('DELETE FROM company_sessions WHERE user_id=?').run(id)
      this.audit(a.user.id, 'user.permissions_changed', id, { before: this.publicUser(u), after: this.publicUser(this.user(id)) })
      return this.publicUser(this.user(id))
    })
  }
  logout(token) { this.db.prepare('DELETE FROM company_sessions WHERE token=?').run(digest(token)) }
  close() { this.db.close() }
}
module.exports = { CompanySecurity, PERMISSIONS, ROLES, totp, base32, error }
