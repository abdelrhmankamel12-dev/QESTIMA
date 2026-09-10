const http = require('node:http'), https = require('node:https'), crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path')
const { CompanySecurity, PERMISSIONS, ROLES, error } = require('./company-security.cjs')
const ROOT = path.join(__dirname, 'company-ui')
function send(res, status, value, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" })
  res.end(type.startsWith('application/json') ? JSON.stringify(value) : value)
}
async function body(req) {
  let size = 0; const chunks = []
  for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) throw error('BODY_TOO_LARGE', 413); chunks.push(chunk) }
  try { const b = JSON.parse(Buffer.concat(chunks).toString() || '{}'); if (!b || typeof b !== 'object' || Array.isArray(b)) throw 0; return b } catch { throw error('INVALID_JSON') }
}
function exact(value, keys) { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw error('UNKNOWN_FIELD') }
function amount(v) { if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e12) throw error('INVALID_AMOUNT'); return v }
function dryData(value) {
  exact(value, ['items']); if (!Array.isArray(value.items) || value.items.length > 50000) throw error('INVALID_ITEMS')
  const ids = new Set()
  return { items: value.items.map(i => {
    exact(i, ['id', 'description', 'unit', 'quantity', 'unitCost', 'priced', 'source'])
    if (typeof i.id !== 'string' || !i.id || i.id.length > 128 || ids.has(i.id)) throw error('INVALID_ITEM_ID'); ids.add(i.id)
    if (typeof i.description !== 'string' || i.description.length > 5000 || typeof i.unit !== 'string' || i.unit.length > 30 || typeof i.priced !== 'boolean' || (i.source !== undefined && (typeof i.source !== 'string' || i.source.length > 500))) throw error('INVALID_ITEM')
    return { id: i.id, description: i.description, unit: i.unit, quantity: amount(i.quantity), unitCost: amount(i.unitCost), priced: i.priced, source: i.source || '' }
  }) }
}
function commercialData(value) {
  exact(value, ['indirectPercent', 'riskPercent', 'profitPercent', 'profitBasis'])
  const out = { indirectPercent: amount(value.indirectPercent), riskPercent: amount(value.riskPercent), profitPercent: amount(value.profitPercent), profitBasis: value.profitBasis }
  if (!['cost', 'margin'].includes(out.profitBasis) || out.indirectPercent > 100 || out.riskPercent > 100 || out.profitPercent > 100 || out.profitBasis === 'margin' && out.profitPercent >= 100) throw error('INVALID_PERCENT')
  return out
}
function createCompanyServer(options) {
  const security = options.security || new CompanySecurity(options), db = security.db
  db.exec(`CREATE TABLE IF NOT EXISTS company_projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,dry TEXT NOT NULL,commercial TEXT NOT NULL,version INTEGER NOT NULL,approved_version INTEGER,updated_at INTEGER,updated_by TEXT);
    CREATE TABLE IF NOT EXISTS company_project_history(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT,version INTEGER,dry TEXT,commercial TEXT,actor TEXT,at INTEGER);`)
  function project(id) { const p = db.prepare('SELECT * FROM company_projects WHERE id=?').get(id); if (!p) throw error('PROJECT_NOT_FOUND', 404); return p }
  function visible(user, p) { return security.permissions(user).includes('projects.manage') || JSON.parse(user.projects).includes(p.id) }
  function summary(p) {
    const items = JSON.parse(p.dry).items, priced = items.filter(i => i.priced).length
    return { id: p.id, name: p.name, version: p.version, updatedAt: p.updated_at, updatedBy: p.updated_by, totalItems: items.length, pricedItems: priced, progressPercent: items.length ? Math.round(100 * priced / items.length) : 0, approved: p.approved_version === p.version, dryCost: items.reduce((a,i) => a + i.quantity * i.unitCost, 0) }
  }
  async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost'), route = url.pathname, method = req.method
      // No credentialed cross-origin API. The company portal is served by this server.
      const origin = req.headers.origin
      if (origin && origin !== `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host}`) throw error('ORIGIN_DENIED', 403)
      if (method === 'GET' && ['/', '/company.js', '/company.css'].includes(route)) {
        const filename = route === '/' ? 'index.html' : route.slice(1)
        return send(res, 200, fs.readFileSync(path.join(ROOT, filename)), filename.endsWith('.js') ? 'text/javascript; charset=utf-8' : filename.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8')
      }
      if (method === 'GET' && route === '/health') return send(res, 200, { ok: true, service: 'qestima-company', initialized: security.initialized(), licensing: false })
      if (method === 'POST' && req.headers['content-type']?.split(';')[0] !== 'application/json' || method === 'PUT' && req.headers['content-type']?.split(';')[0] !== 'application/json') throw error('JSON_REQUIRED', 415)
      const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
      if (method === 'POST' && route === '/company/setup') {
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) throw error('SETUP_ON_SERVER_ONLY', 403)
        security.limit('setup'); const b = await body(req)
        return send(res, 201, { user: security.bootstrap(b.setupToken, b) })
      }
      if (method === 'POST' && route === '/company/login') return send(res, 200, security.login(await body(req), req.socket.remoteAddress))
      if (method === 'POST' && route === '/company/recover') { security.limit('recover-peer:' + req.socket.remoteAddress); security.recover(await body(req)); return send(res, 200, { ok: true }) }
      if (method === 'POST' && route === '/company/mfa/start') return send(res, 200, security.beginMfa(token))
      if (method === 'POST' && route === '/company/mfa/confirm') return send(res, 200, security.confirmMfa(token, (await body(req)).code))
      if (method === 'POST' && route === '/company/logout') { security.logout(token); return send(res, 200, { ok: true }) }
      const auth = security.session(token)
      const describe = p => { const value = summary(p); if (!security.permissions(auth.user).includes("dry.view")) delete value.dryCost; return value }
      if (method === 'GET' && route === '/company/me') return send(res, 200, { user: security.publicUser(auth.user), permissions: PERMISSIONS, roles: Object.keys(ROLES) })
      if (method === 'POST' && route === '/company/reauth') { const b = await body(req); security.reauthenticate(token, b.password, b.code); return send(res, 200, { ok: true }) }
      if (route === '/company/users' && method === 'GET') { security.require(token, 'users.manage'); return send(res, 200, { users: db.prepare('SELECT * FROM company_users ORDER BY username').all().map(u => security.publicUser(u)) }) }
      if (route === '/company/users' && method === 'POST') return send(res, 201, { user: security.createUser(token, await body(req)) })
      if (/^\/company\/users\/[^/]+$/.test(route) && method === 'PUT') return send(res, 200, { user: security.changeUser(token, route.split('/')[3], await body(req)) })
      if (route === '/company/audit' && method === 'GET') { security.require(token, 'users.manage'); return send(res, 200, { entries: db.prepare('SELECT * FROM company_audit ORDER BY id DESC LIMIT 200').all() }) }
      if (route === '/company/progress' && method === 'GET') { security.require(token, 'progress.view'); return send(res, 200, { serverTime: security.now(), projects: db.prepare('SELECT * FROM company_projects').all().filter(p => visible(auth.user, p)).map(describe) }) }
      if (route === '/company/projects' && method === 'GET') { security.require(token, 'dry.view'); return send(res, 200, { projects: db.prepare('SELECT * FROM company_projects').all().filter(p => visible(auth.user, p)).map(describe) }) }
      if (route === '/company/projects' && method === 'POST') {
        security.require(token, 'projects.manage'); const b = await body(req); exact(b, ['name']); if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 200) throw error('PROJECT_NAME_REQUIRED')
        const id = crypto.randomUUID()
        security.transaction(() => { db.prepare('INSERT INTO company_projects VALUES(?,?,?,?,1,NULL,?,?)').run(id, b.name.trim(), '{"items":[]}', '{"indirectPercent":0,"riskPercent":0,"profitPercent":0,"profitBasis":"cost"}', security.now(), auth.user.id); security.audit(auth.user.id, 'project.created', id) })
        return send(res, 201, describe(project(id)))
      }
      const match = route.match(/^\/company\/projects\/([^/]+)\/(dry|commercial|approve|export)$/)
      if (match) {
        const [, id, section] = match
        const permission = section === 'approve' ? 'approval.manage' : section === 'export' ? 'reports.export' : `${section}.${method === 'GET' ? 'view' : 'edit'}`
        security.require(token, permission, id)
        if (section === 'commercial' || section === 'approve') security.recent(token)
        const p = project(id)
        if (method === 'GET' && ['dry', 'commercial'].includes(section)) return send(res, 200, { id, version: p.version, data: JSON.parse(p[section]) })
        if (method === 'GET' && section === 'export') {
          security.require(token, 'dry.view', id)
          const result = { ...summary(p), dry: JSON.parse(p.dry) }
          if (url.searchParams.get('commercial') === 'true') { security.require(token, 'commercial.view', id); security.recent(token); result.commercial = JSON.parse(p.commercial) }
          return send(res, 200, result)
        }
        if (method === 'PUT' && ['dry', 'commercial'].includes(section) || method === 'POST' && section === 'approve') {
          const b = await body(req); exact(b, section === 'approve' ? ['version'] : ['version', 'data'])
          if (!Number.isInteger(b.version)) throw error('VERSION_REQUIRED', 428)
          const next = section === 'approve' ? null : section === 'dry' ? dryData(b.data) : commercialData(b.data)
          const result = security.transaction(() => {
            const current = project(id)
            if (current.version !== b.version) throw error('VERSION_CONFLICT', 409) // Never include commercial payload in conflict response.
            if (section === 'approve') {
              const items = JSON.parse(current.dry).items; if (!items.length || items.some(i => !i.priced)) throw error('UNPRICED_ITEMS', 409)
              db.prepare('UPDATE company_projects SET approved_version=version WHERE id=?').run(id)
            } else {
              db.prepare('INSERT INTO company_project_history(project_id,version,dry,commercial,actor,at) VALUES(?,?,?,?,?,?)').run(id, current.version, current.dry, current.commercial, auth.user.id, security.now())
              db.prepare(`UPDATE company_projects SET ${section}=?,version=version+1,approved_version=NULL,updated_at=?,updated_by=? WHERE id=?`).run(JSON.stringify(next), security.now(), auth.user.id, id)
            }
            security.audit(auth.user.id, `project.${section}`, id, { previousVersion: current.version })
            return describe(project(id))
          })
          return send(res, 200, result)
        }
      }
      throw error('NOT_FOUND', 404)
    } catch (e) { if (!res.headersSent) send(res, e.status || 500, { ok: false, reason: e.status ? e.message : 'INTERNAL_ERROR' }) }
  }
  const server = options.tls ? https.createServer(options.tls, handler) : http.createServer(handler)
  server.requestTimeout = 30000; server.headersTimeout = 15000
  return { server, security }
}
if (require.main === module) {
  const folder = path.resolve(process.env.QESTIMA_COMPANY_DATA || './company-data'); fs.mkdirSync(folder, { recursive: true })
  const keyFile = path.join(folder, 'server.key')
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32), { flag: 'wx', mode: 0o600 })
  const host = process.env.QESTIMA_COMPANY_HOST || '127.0.0.1', port = Number(process.env.QESTIMA_COMPANY_PORT || 47610)
  const tls = process.env.QESTIMA_TLS_CERT && process.env.QESTIMA_TLS_KEY ? { cert: fs.readFileSync(process.env.QESTIMA_TLS_CERT), key: fs.readFileSync(process.env.QESTIMA_TLS_KEY) } : undefined
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && !tls) throw error('HTTPS_REQUIRED_FOR_COMPANY_NETWORK')
  const app = createCompanyServer({ dbPath: path.join(folder, 'company.db'), encryptionKey: fs.readFileSync(keyFile), tls })
  if (!app.security.initialized()) {
    const setupFile = path.join(folder, 'first-setup.txt'); fs.writeFileSync(setupFile, app.security.issueSetupToken(), { mode: 0o600 })
    console.log('Open the portal on this server. The temporary setup token is in ' + setupFile + ' (15 minutes).')
  }
  app.server.listen(port, host, () => console.log(`QESTIMA Company: ${tls ? 'https' : 'http'}://${host}:${port} — no licensing`))
  function stop() { app.server.close(() => { app.security.close(); process.exit(0) }) }
  process.on('SIGINT', stop); process.on('SIGTERM', stop)
}
module.exports = { createCompanyServer, dryData, commercialData }
