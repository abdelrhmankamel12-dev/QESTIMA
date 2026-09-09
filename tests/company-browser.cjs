const assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto')
const { chromium } = require('playwright')
const { createCompanyServer } = require('../server/company-api.cjs')
const { totp } = require('../server/company-security.cjs')
async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'qestima-company-browser-')); let time = 1800000000000
  const app = createCompanyServer({ dbPath:path.join(dir,'company.db'), encryptionKey:crypto.randomBytes(32), now:()=>time })
  const setup = app.security.issueSetupToken(); await new Promise(r=>app.server.listen(0,'127.0.0.1',r))
  const browser = await chromium.launch({headless:true}); const page = await browser.newPage({viewport:{width:1440,height:1000}}); const errors=[]
  page.on('pageerror',e=>errors.push(e.message)); const url = 'http://127.0.0.1:' + app.server.address().port
  const evidence = path.resolve('build/company-evidence'); fs.mkdirSync(evidence,{recursive:true})
  async function fill(form, fields) { for(const [key,value] of Object.entries(fields)) await page.locator(form + ' [name="'+key+'"]').fill(value) }
  async function submit(form) { await page.locator(form+' button').last().click() }
  try {
    await page.goto(url); await page.locator('#setup:visible').waitFor()
    await fill('#setup-form',{setupToken:setup,username:'director',name:'مدير التسعير',password:'director-password-123'}); await submit('#setup-form')
    await page.locator('#login:visible').waitFor(); await fill('#login-form',{username:'director',password:'director-password-123'}); await submit('#login-form')
    await page.locator('#mfa:visible').waitFor(); await page.locator('#begin-mfa').click(); await page.waitForFunction(()=>document.querySelector('#mfa-secret').textContent.length>0)
    const secret = await page.locator('#mfa-secret').textContent(); await fill('#mfa-form',{code:totp(secret,time)}); await submit('#mfa-form')
    await page.locator('#recovery-codes:visible').waitFor(); assert.equal((await page.locator('#codes').textContent()).split('\n').length,8)
    await page.locator('#saved-codes').click(); time+=30000
    await fill('#login-form',{username:'director',password:'director-password-123',code:totp(secret,time)}); await submit('#login-form')
    await page.locator('#users table').waitFor(); await page.locator('#create-user-form').locator('..').locator('summary').click()
    await fill('#create-user-form',{username:'engineer',name:'مهندس تسعير',password:'engineer-password-123'}); await submit('#create-user-form')
    await page.waitForFunction(()=>document.querySelector('#users').textContent.includes('مهندس تسعير'))
    await page.locator('#show-progress').click(); await fill('#project-form',{name:'مشروع اختبار MEP'}); await submit('#project-form')
    await page.waitForFunction(()=>document.querySelector('#progress').textContent.includes('مشروع اختبار MEP'))
    await page.locator('#show-users').click(); await page.locator('#users tr').filter({hasText:'مهندس تسعير'}).locator('button').click()
    await page.locator('#permissions-dialog[open]').waitFor(); await page.locator('#project-grants').selectOption({label:'مشروع اختبار MEP'})
    await page.screenshot({path:path.join(evidence,'company-permissions.png'),fullPage:true})
    await page.locator('#permissions-form button').first().click(); await page.locator('#permissions-dialog').waitFor({state:'hidden'})
    await page.locator('#show-progress').click(); await page.screenshot({path:path.join(evidence,'company-progress.png'),fullPage:true})
    await page.locator('#logout').click(); await fill('#login-form',{username:'engineer',password:'engineer-password-123'}); await submit('#login-form')
    await page.locator('#workspace:visible').waitFor(); assert.equal(await page.locator('#show-users').isVisible(),false); assert.equal(await page.locator('#show-progress').isVisible(),false)
    assert.equal(await page.evaluate(()=>localStorage.length),0)
    assert.deepEqual(errors,[])
    fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({ok:true,checks:['setup','mandatory-manager-mfa','recovery-codes','create-user','project-assignment','permission-editor','manager-progress','estimator-restrictions','no-persisted-browser-token'],pageErrors:errors},null,2))
    console.log('Company browser flow passed')
  } finally { await browser.close(); await new Promise(r=>app.server.close(r)); app.security.close(); fs.rmSync(dir,{recursive:true,force:true}) }
}
main().catch(e=>{console.error(e);process.exitCode=1})
