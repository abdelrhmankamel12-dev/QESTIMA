const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto')
const { createCompanyServer } = require('../server/company-api.cjs')
const { totp } = require('../server/company-security.cjs')
test('company HTTP lifecycle: no licenses, scoped dry costs, private commercial data, conflicts, approvals and audit', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qestima-company-api-')); let time = 1800000000000
  const app = createCompanyServer({ dbPath: path.join(dir, 'company.db'), encryptionKey: crypto.randomBytes(32), now: () => time })
  await new Promise(r => app.server.listen(0,'127.0.0.1',r)); const base = 'http://127.0.0.1:' + app.server.address().port
  t.after(async () => { await new Promise(r => app.server.close(r)); app.security.close(); fs.rmSync(dir,{recursive:true,force:true}) })
  async function request(route, method = 'GET', data, token, extra = {}) { const r = await fetch(base + route, { method, headers:{'Content-Type':'application/json',...(token ? {Authorization:'Bearer ' + token}:{}),...extra}, ...(data ? {body:JSON.stringify(data)}:{}) }); return { status:r.status, data:await r.json() } }
  const setupToken = app.security.issueSetupToken()
  assert.equal((await request('/company/setup','POST',{setupToken,username:'director',password:'director-password-123'})).status,201)
  const login = await request('/company/login','POST',{username:'director',password:'director-password-123'}), enrollment = login.data.token
  assert.equal((await request('/company/users','GET',null,enrollment)).status,403)
  const secret = (await request('/company/mfa/start','POST',{},enrollment)).data.secret
  assert.equal((await request('/company/mfa/confirm','POST',{code:totp(secret,time)},enrollment)).status,200)
  assert.equal((await request('/company/me','GET',null,enrollment)).status,401)
  time += 30000
  const manager = (await request('/company/login','POST',{username:'director',password:'director-password-123',code:totp(secret,time)})).data.token
  const h = await request('/health'); assert.equal(h.data.licensing,false)
  assert.equal((await request('/api/v1/provision','POST',{},manager)).status,404)
  assert.equal((await request('/company/projects','POST',{name:'Hospital MEP'},manager,{Origin:'https://attacker.invalid'})).status,403)
  const project = (await request('/company/projects','POST',{name:'Hospital MEP'},manager)).data
  const engineer = (await request('/company/users','POST',{username:'engineer',password:'engineer-password-123',role:'estimator'},manager)).data.user
  await request('/company/users/' + engineer.id,'PUT',{projects:[project.id]},manager)
  const est = (await request('/company/login','POST',{username:'engineer',password:'engineer-password-123'})).data.token
  assert.equal((await request('/company/users/' + engineer.id,'PUT',{role:'administrator'},est)).status,403)
  assert.equal((await request('/company/projects/' + project.id + '/commercial','GET',null,est)).status,403)
  const dry = {items:[{id:'P-001',description:'PPR pipe',unit:'m',quantity:120,unitCost:25.5,priced:true}]}
  const saved = await request('/company/projects/' + project.id + '/dry','PUT',{version:1,data:dry},est)
  assert.equal(saved.status,200); assert.equal(saved.data.dryCost,3060)
  const commercial = {indirectPercent:5,riskPercent:2,profitPercent:15,profitBasis:'margin'}
  assert.equal((await request('/company/projects/' + project.id + '/commercial','PUT',{version:2,data:commercial},est)).status,403)
  assert.equal((await request('/company/projects/' + project.id + '/commercial','PUT',{version:2,data:commercial},manager)).status,200)
  for (const route of ['/company/projects','/company/projects/' + project.id + '/dry','/company/projects/' + project.id + '/export']) {
    const read = await request(route,'GET',null,est); assert.equal(read.status,200); assert.ok(!JSON.stringify(read.data).includes('profitPercent')); assert.ok(!JSON.stringify(read.data).includes('commercial'))
  }
  assert.equal((await request('/company/projects/' + project.id + '/export?commercial=true','GET',null,est)).status,403)
  assert.equal((await request('/company/audit','GET',null,est)).status,403)
  const conflict = await request('/company/projects/' + project.id + '/dry','PUT',{version:2,data:dry},est)
  assert.equal(conflict.status,409); assert.ok(!JSON.stringify(conflict.data).includes('profitPercent'))
  const inject = await request('/company/projects/' + project.id + '/dry','PUT',{version:3,data:{...dry,profitPercent:50}},est)
  assert.equal(inject.status,400)
  assert.equal((await request('/company/projects/' + project.id + '/approve','POST',{version:3},manager)).status,200)
  assert.equal((await request('/company/progress','GET',null,manager)).data.projects[0].approved,true)
  const change = await request('/company/projects/' + project.id + '/dry','PUT',{version:3,data:{items:[{...dry.items[0],unitCost:26}]}},est)
  assert.equal(change.status,200); assert.equal(change.data.approved,false)
  const audit = await request('/company/audit','GET',null,manager)
  assert.ok(audit.data.entries.some(a => a.action === 'project.dry'))
  assert.ok(!JSON.stringify(audit).includes('director-password'))
  const other = (await request('/company/projects','POST',{name:'Other project'},manager)).data
  assert.equal((await request('/company/projects/' + other.id + '/dry','GET',null,est)).status,403)
  await request('/company/users/' + engineer.id,'PUT',{overrides:{'dry.edit':{allow:false}}},manager)
  assert.equal((await request('/company/projects','GET',null,est)).status,401)
  const html = await fetch(base); assert.equal(html.status,200); assert.ok(html.headers.get('content-security-policy').includes("frame-ancestors 'none'")); assert.ok((await html.text()).includes('سيرفر الشركة'))
})
