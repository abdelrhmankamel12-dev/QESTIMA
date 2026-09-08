const test = require("node:test")
const assert = require("node:assert/strict")
const C = require("../app/core.js")
require("../app/auth.js")

test("new installation and reopening an empty workspace never seed demo projects or credentials", () => {
  for (const state of [C.createInitialState(), C.ensureState(C.createInitialState())]) {
    assert.equal(state.projects.length, 0)
    assert.equal(state.resources.length, 0)
    assert.equal(state.suppliers.length, 0)
    assert.equal(state.auth.accounts.length, 0)
    assert.equal(C.emptyProject(state).boq.length, 0)
  }
})

test("password hashes are salted and incorrect passwords fail", async () => {
  const first = await QESTIMAAuth.hash("test-password-only")
  const second = await QESTIMAAuth.hash("test-password-only")
  assert.notEqual(first, second)
  assert.equal(await QESTIMAAuth.verify("test-password-only", first), true)
  assert.equal(await QESTIMAAuth.verify("wrong", first), false)
  assert.equal(await QESTIMAAuth.verify("wrong", "corrupt"), false)
})

test("platform role cannot access project data from another active tenant", () => {
  const state = C.seedState()
  const project = state.projects[0]
  assert.equal(C.can(state, "project.view", project), true)
  state.session.tenantId = "unrelated-tenant"
  assert.equal(C.can(state, "project.view", project), false)
})
