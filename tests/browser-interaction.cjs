// Run separately on a machine with Playwright Chromium installed.
// Uses an isolated browser context and test-only demo data, not user profiles.
const { chromium } = require("playwright")
const { createServer } = require("node:http")
const fs = require("node:fs")
const path = require("node:path")
const assert = require("node:assert/strict")
const C = require("../app/core.js")
async function main() {
  const root = path.resolve(__dirname, "../app")
  const server = createServer((req, res) => {
    const file = path.resolve(root, "." + (req.url === "/" ? "/index.html" : req.url.split("?")[0]))
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return }
    const type = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[path.extname(file)] || "application/octet-stream"
    try { res.setHeader("Content-Type", type); res.end(fs.readFileSync(file)) } catch { res.writeHead(404).end() }
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    const fixture = C.seedState()
    await page.addInitScript((value) => localStorage.setItem("qestima-v6", JSON.stringify(value)), fixture)
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.locator('#workspace button[data-action="new-project"]').first().waitFor({ state: 'visible' })
    assert.equal(await page.locator('#login-screen:visible').count(), 0)
    await page.locator('#main-nav button[data-view="tender_review"]').click()
    const editor = page.locator('textarea[data-summary-id]').first()
    await editor.click()
    await editor.pressSequentially("Tender input stays focused")
    assert.equal(await editor.inputValue(), "Tender input stays focused")
    await page.locator('#main-nav button[data-view="projects"]').click()
    await page.locator("#project-search").fill("no-project-matches-this")
    assert.equal(await page.locator(".project-open:visible").count(), 0)
    await page.locator("#project-search").fill("")
    await page.locator('#workspace button[data-action="new-project"]').first().click()
    await page.locator("#project-form").waitFor({ state: "visible" })
    await page.locator('#modal-root button[data-action="close-modal"]').first().click()
    await page.locator('#main-nav button[data-view="reports"]').click()
    await page.locator('[data-report-tab="pricedBoq"]').click()
    assert.equal(await page.locator('[data-report-tab="pricedBoq"]').getAttribute("class"), "active")
    await page.locator('#main-nav button[data-view="boq"]').click()
    fs.mkdirSync(path.resolve(__dirname, "../artifacts"), { recursive: true })
    await page.screenshot({ path: path.resolve(__dirname, "../artifacts/workbench-actual.png"), fullPage: true })
    assert.deepEqual(errors, [])
    console.log("PASS: login, ordinary typing, filtering, internal button routing, report tabs; screenshot saved.")
  } finally { if (browser) await browser.close(); await new Promise((resolve) => server.close(resolve)) }
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
