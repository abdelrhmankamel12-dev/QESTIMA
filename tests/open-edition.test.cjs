const test = require('node:test')
const assert = require('node:assert/strict')
const C = require('../app/core.js')
const Collab = require('../app/collaboration.js')
test('Open edition preserves projects and removes old expiry and suspension gates', () => {
  const state = C.seedState()
  const before = JSON.stringify(state.projects)
  state.license.status = 'suspended'
  state.license.expiresAt = '2001-01-01'
  C.prepareOpenEdition(state)
  assert.equal(JSON.stringify(state.projects), before)
  assert.equal(C.licenseStatus(state, new Date('2100-01-01')).expired, false)
  assert.equal(Collab.licenseEntitlements(state.license, new Date('2100-01-01')).readOnly, false)
  assert.equal(state.session.authenticated, true)
  assert.equal(C.canWrite(state), true)
})
