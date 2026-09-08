// Real installed Electron startup test. Run only on a disposable Windows CI runner.
const { _electron: electron } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
async function main() {
  assert.equal(process.platform, 'win32', 'Windows required')
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Disposable CI runner required')
  const executablePath = path.resolve(process.argv[2])
  assert.ok(fs.existsSync(executablePath))
  fs.mkdirSync('artifacts', { recursive: true })
  const errors = []
  const password = crypto.randomBytes(24).toString('hex')
  let app
  try {
    app = await electron.launch({ executablePath, timeout: 60000 })
    let page = await app.firstWindow()
    page.on('pageerror', error => errors.push(error.message))
    await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 60000 })
    await page.locator('#setup-form [name=name]').fill('Windows Test')
    await page.locator('#setup-form [name=username]').fill('windows-test')
    await page.locator('#setup-form [name=password]').fill(password)
    await page.locator('#setup-form button[type=submit]').click()
    await page.locator('#login-username').waitFor({ state: 'visible' })
    await page.locator('#login-username').fill('windows-test')
    await page.locator('#login-password').fill(password)
    await page.locator('#login-form button[type=submit]').click()
    await page.locator('#main-nav button[data-view=projects]').waitFor({ state: 'visible' })
    await page.screenshot({ path: 'artifacts/windows-first-run.png', fullPage: true })
    await app.close()
    app = null
    app = await electron.launch({ executablePath, timeout: 60000 })
    page = await app.firstWindow()
    page.on('pageerror', error => errors.push(error.message))
    await page.locator('#login-username').waitFor({ state: 'visible', timeout: 60000 })
    await page.locator('#login-username').fill('windows-test')
    await page.locator('#login-password').fill(password)
    await page.locator('#login-form button[type=submit]').click()
    await page.locator('#main-nav button[data-view=projects]').waitFor({ state: 'visible' })
    await page.locator('#workspace button[data-action=new-project]').first().click()
    await page.locator('#project-form').waitFor({ state: 'visible' })
    await page.screenshot({ path: 'artifacts/windows-project-dialog.png', fullPage: true })
    assert.deepEqual(errors, [])
    fs.writeFileSync('artifacts/windows-startup-result.json', JSON.stringify({
      passed: true, checks: ['installer output launches', 'first-run account setup', 'account persists across restart', 'login', 'project dialog opens'],
      scope: 'Startup smoke test only; not full application acceptance', timestamp: new Date().toISOString()
    }, null, 2))
  } catch (error) {
    fs.writeFileSync('artifacts/windows-startup-error.txt', String(error.stack || error))
    throw error
  } finally { if (app) await app.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
