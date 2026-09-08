const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const crypto = require("node:crypto")
const { openStore, save, load, close, encrypt, decrypt } = require("../electron/store.cjs")
const { createProjectPackage, readProjectPackage, verifyProjectPackage } = require("../electron/project-package.cjs")
const { parseDxfText, inspectCadBuffer, detectCadFormat } = require("../electron/cad-engine.cjs")
const { stageRuntime } = require("../build/prepare-runtime.cjs")
const { validateRuntimeCandidate, installStagedRuntime, upgradeStagedRuntime, recoverInstalledRuntime } = require("../build/release-preflight.cjs")
const { parseArgs: parseReleaseArgs } = require("../build/create-release.cjs")
const { atomicReplace, verifyRuntimeManifest } = require("../electron/recovery.cjs")
const PdfEngine = require("../electron/pdf-engine.cjs")

function fakeApp(folder) { return { getPath(name) { assert.equal(name, "userData"); return folder } } }
function sampleState() {
  return { schemaVersion: 6, appVersion: "0.13.0", projects: [{ id: "project-1", tenantId: "tenant-company-pilot", workspaceId: "company", name: "Hospital", tenderCode: "TND-001", revisionNo: 2, status: "pricing", boq: [{ id: "item-1", itemNo: "M-01", description: "CHW Pipe 100 mm", unit: "m", quantity: 100 }], analyses: { "item-1": { lines: [{ resourceId: "res-1", factor: 1.05 }], extras: {} }, }, documents: [], quotes: [], revisions: [] }], resources: [{ id: "res-1", code: "MAT-01", name: "Pipe", type: "material", unit: "m", rate: 82 }], auditLog: [] }
}

test("SQLite vault persists normalized records and rejects tampering", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-store-test-"))
  try {
    const app = fakeApp(folder); const state = sampleState(); const store = openStore(app)
    assert.equal(store.kind, "sqlite"); assert.equal(save(store, state), true)
    assert.deepEqual(load(store).projects[0].boq[0].description, "CHW Pipe 100 mm")
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM project_records").get().n, 1)
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM boq_items").get().n, 1)
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM resources").get().n, 1)
    const indexedPayload = store.db.prepare("SELECT payload FROM resources WHERE resource_id=?").get("res-1").payload
    assert.doesNotMatch(indexedPayload, /\"name\":\"Pipe\"/)
    close(store)
    const reopened = openStore(app); assert.equal(load(reopened).projects[0].revisionNo, 2)
    const stored = reopened.db.prepare("SELECT payload FROM app_state WHERE id=1").get().payload
    const tamperedStorePayload = JSON.parse(stored); tamperedStorePayload.body = `${tamperedStorePayload.body.slice(0, -2)}zz`
    reopened.db.prepare("UPDATE app_state SET payload=? WHERE id=1").run(JSON.stringify(tamperedStorePayload)); close(reopened)
    const corrupted = openStore(app); assert.throws(() => load(corrupted), /STORE_DECRYPT_FAILED/); close(corrupted)
    const key = crypto.randomBytes(32); const payload = encrypt({ ok: true }, key); const tampered = JSON.parse(payload); tampered.body = `${tampered.body.slice(0, -2)}xx`
    assert.deepEqual(decrypt(payload, key), { ok: true }); assert.throws(() => decrypt(tampered, key))
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})

test("encrypted Project Package round-trips, verifies attachments and detects corruption", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-package-test-"))
  try {
    const attachments = path.join(folder, "source-attachments"); const root = path.join(folder, "package")
    fs.mkdirSync(attachments); fs.writeFileSync(path.join(attachments, "quotation.txt"), "Supplier quote 82 SAR")
    const key = crypto.randomBytes(32); const created = createProjectPackage({ targetRoot: root, state: sampleState(), sourceAttachments: attachments, key, appVersion: "0.13.0" })
    assert.equal(created.manifest.encryption.state, "encrypted"); assert.ok(created.manifest.checksumsSha256); assert.equal(verifyProjectPackage(root).manifest.packageId, created.manifest.packageId)
    const restored = readProjectPackage({ root, key }); assert.equal(restored.state.projects[0].boq[0].quantity, 100)
    fs.appendFileSync(path.join(root, "attachments", "quotation.txt"), " tampered")
    assert.throws(() => verifyProjectPackage(root), /PACKAGE_(?:CHECKSUM_MANIFEST_TAMPERED|INTEGRITY_FAILED)/)
    const portableRoot = path.join(folder, "portable")
    const portable = createProjectPackage({ targetRoot: portableRoot, state: sampleState(), sourceAttachments: attachments, passphrase: "portable-passphrase", appVersion: "0.13.0" })
    assert.equal(portable.manifest.encryption.keySource, "passphrase"); assert.equal(readProjectPackage({ root: portableRoot, passphrase: "portable-passphrase" }).state.projects[0].name, "Hospital"); assert.throws(() => readProjectPackage({ root: portableRoot, passphrase: "wrong" }), /PACKAGE_DECRYPT_FAILED/)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})

test("Project Package rejects an incomplete checksum inventory", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-package-inventory-"))
  try {
    const root = path.join(folder, "package"); const key = crypto.randomBytes(32)
    createProjectPackage({ targetRoot: root, state: sampleState(), key })
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"))
    const checksums = JSON.parse(fs.readFileSync(path.join(root, "checksums.json"), "utf8"))
    delete checksums.files[manifest.database]
    fs.writeFileSync(path.join(root, "checksums.json"), JSON.stringify(checksums, null, 2))
    assert.throws(() => verifyProjectPackage(root), /PACKAGE_(?:CHECKSUM_MANIFEST_TAMPERED|INTEGRITY_FAILED)/)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})

test("Project Package can carry an optional signed manifest", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-signed-package-"))
  try {
    const keys = crypto.generateKeyPairSync("ed25519"); const key = crypto.randomBytes(32); const root = path.join(folder, "package")
    const privateKeyPem = keys.privateKey.export({ type: "pkcs8", format: "pem" }); const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" })
    const created = createProjectPackage({ targetRoot: root, state: sampleState(), key, packagePrivateKeyPem: privateKeyPem, packagePublicKeyId: "package-key-1" })
    assert.equal(created.manifest.publicKeyId, "package-key-1"); assert.equal(verifyProjectPackage(root, { publicKeyPem, requireSignature: true }).manifest.signature.length > 10, true); assert.throws(() => verifyProjectPackage(root, { publicKeyPem: "bad", requireSignature: true }), /PACKAGE_SIGNATURE_INVALID/)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})

test("DXF engine indexes geometry, layers, systems and blocks without auto-approving quantities", () => {
  const text = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1027", "9", "$INSUNITS", "70", "6", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES", "0", "LINE", "8", "HVAC", "10", "0", "20", "0", "11", "3", "21", "4", "0", "LWPOLYLINE", "8", "Fire", "70", "1", "10", "0", "20", "0", "10", "2", "20", "0", "10", "2", "20", "2", "0", "INSERT", "8", "Plumbing", "2", "PUMP-01", "0", "ENDSEC", "0", "EOF"].join("\n")
  const model = parseDxfText(text); assert.equal(model.format, "DXF"); assert.equal(model.entityCount, 3); assert.equal(model.units, "Meters"); assert.ok(model.totalLength > 11); assert.ok(model.layers.some((layer) => layer.system === "HVAC")); assert.ok(model.typeCounts.INSERT === 1); assert.equal(model.entities.find((entity) => entity.type === "LINE").geometry.kind, "line"); assert.equal(model.entities.find((entity) => entity.type === "LWPOLYLINE").geometry.kind, "polyline")
  assert.equal(detectCadFormat(text, "plan.dxf"), "DXF"); assert.equal(inspectCadBuffer(Buffer.from("AC1032DWG"), { fileName: "plan.dwg" }).reason, "DWG_CONVERTER_REQUIRED")
})

test("PDF adapter distinguishes text, OCR and unavailable engines with page provenance", () => {
  const text = PdfEngine.classifyExtraction({ pages: [{ page: 2, text: "Submission deadline 01 October 2026 and retention 10%" }], pageCount: 4 })
  assert.equal(text.kind, "text"); assert.equal(text.pageCount, 4); assert.deepEqual(PdfEngine.searchPages(text.pages, "retention")[0], { page: 2, excerpt: "Submission deadline 01 October 2026 and retention 10%" })
  const ocr = PdfEngine.classifyExtraction({ pages: [], ocrPages: [{ page: 1, text: "شروط الدفع" }], pageCount: 1 }); assert.equal(ocr.kind, "ocr")
  assert.equal(PdfEngine.classifyExtraction({ pages: [], pageCount: 3 }).reason, "PDF_TEXT_UNAVAILABLE")
  assert.equal(PdfEngine.classifyExtraction({ pages: [], pageCount: 3 }).ok, false)
})

test("runtime staging embeds an official runtime and source without making an installer", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-runtime-test-"))
  try {
    const electronDist = path.join(folder, "electron"); const output = path.join(folder, "staging")
    fs.mkdirSync(electronDist); fs.writeFileSync(path.join(electronDist, "electron"), "runtime"); fs.writeFileSync(path.join(electronDist, "resources.pak"), "pak"); fs.writeFileSync(path.join(electronDist, "icudtl.dat"), "icu")
    const result = stageRuntime({ electronDist, outputDir: output, sourceRoot: path.resolve(__dirname, ".."), electronVersion: "37.2.6" })
    assert.equal(result.manifest.format, "qestima-embedded-runtime"); assert.equal(fs.existsSync(path.join(output, "QESTIMA")), true); assert.equal(fs.existsSync(path.join(output, "resources", "app", "electron", "main.cjs")), true); assert.equal(fs.existsSync(path.join(output, "runtime-manifest.json")), true); assert.equal(verifyRuntimeManifest(output).ok, true)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})

test("runtime staging can cross-target a Windows x64 runtime", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-runtime-win-test-"))
  try {
    const electronDist = path.join(folder, "electron-win"); const output = path.join(folder, "staging")
    fs.mkdirSync(electronDist); fs.writeFileSync(path.join(electronDist, "electron.exe"), "windows-runtime"); fs.writeFileSync(path.join(electronDist, "resources.pak"), "pak"); fs.writeFileSync(path.join(electronDist, "icudtl.dat"), "icu")
    const result = stageRuntime({ electronDist, outputDir: output, sourceRoot: path.resolve(__dirname, ".."), electronVersion: "37.2.6", targetPlatform: "win32", targetArchitecture: "x64" })
    assert.equal(result.manifest.platform, "win32"); assert.equal(result.manifest.architecture, "x64")
    assert.equal(fs.existsSync(path.join(output, "QESTIMA.exe")), true); assert.equal(fs.existsSync(path.join(output, "QESTIMA")), false)
    assert.equal(validateRuntimeCandidate(output, { expectedAppVersion: "0.13.0" }).ok, true)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})

test("release builder exposes explicit signed and target arguments", () => {
  const parsed = parseReleaseArgs(["--platform", "win32", "--arch", "x64", "--electron-version", "37.2.6", "--require-signed"])
  assert.equal(parsed.targetPlatform, "win32"); assert.equal(parsed.targetArchitecture, "x64"); assert.equal(parsed.electronVersion, "37.2.6"); assert.equal(parsed.requireSigned, true)
  const source = fs.readFileSync(path.join(__dirname, "..", "build", "create-release.cjs"), "utf8")
  assert.match(source, /QESTIMA_OUTFILE/); assert.match(source, /preview-unsigned/); assert.match(source, /INSTALLER_OUTPUT_MISSING/)
})

test("atomic recovery write leaves either the previous or complete next file", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-recovery-test-"))
  try {
    const target = path.join(folder, "state.json")
    atomicReplace(target, JSON.stringify({ revision: 1 })); assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { revision: 1 })
    atomicReplace(target, JSON.stringify({ revision: 2, payload: "complete" })); assert.deepEqual(JSON.parse(fs.readFileSync(target, "utf8")), { revision: 2, payload: "complete" })
    assert.equal(fs.readdirSync(folder).some((name) => name.endsWith(".tmp")), false)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})

test("distribution scripts require runtime staging and signed binaries", () => {
  const launcher = fs.readFileSync(path.join(__dirname, "..", "launcher.vbs"), "utf8")
  const installer = fs.readFileSync(path.join(__dirname, "..", "build", "installer.nsi"), "utf8")
  const signer = fs.readFileSync(path.join(__dirname, "..", "build", "sign-release.ps1"), "utf8")
  assert.match(launcher, /QESTIMA\.exe/); assert.match(installer, /runtime-staging\\\*\.\*|runtime-staging\\\*\.\*/); assert.match(installer, /QESTIMA\.exe/); assert.match(signer, /RuntimeDirectory/); assert.match(signer, /\.dll/)
})

test("release preflight simulates install, upgrade and rollback without creating an installer", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "qestima-release-preflight-"))
  try {
    const electronDist = path.join(folder, "electron"); const sourceRoot = path.resolve(__dirname, ".."); const staging = path.join(folder, "staging")
    fs.mkdirSync(electronDist); fs.writeFileSync(path.join(electronDist, "electron"), "runtime-v1"); fs.writeFileSync(path.join(electronDist, "resources.pak"), "pak"); fs.writeFileSync(path.join(electronDist, "icudtl.dat"), "icu")
    stageRuntime({ electronDist, outputDir: staging, sourceRoot, electronVersion: "37.2.6" })
    assert.equal(validateRuntimeCandidate(staging, { expectedAppVersion: "0.13.0" }).ok, true)
    const installDir = path.join(folder, "installed"); const first = installStagedRuntime({ staging, installDir, expectedAppVersion: "0.13.0" })
    assert.equal(fs.existsSync(path.join(installDir, "resources", "app", "electron", "main.cjs")), true); assert.equal(first.backupDir, null)
    fs.writeFileSync(path.join(installDir, "user-data-marker.txt"), "outside-data-is-not-in-program-folder")
    fs.writeFileSync(path.join(electronDist, "electron"), "runtime-v2"); const upgradedStaging = path.join(folder, "staging-v2")
    stageRuntime({ electronDist, outputDir: upgradedStaging, sourceRoot, electronVersion: "37.2.6" })
    const upgraded = upgradeStagedRuntime({ staging: upgradedStaging, installDir, expectedAppVersion: "0.13.0" })
    assert.ok(upgraded.backupDir); assert.equal(fs.existsSync(path.join(upgraded.backupDir, "user-data-marker.txt")), true)
    const recovered = recoverInstalledRuntime({ installDir, backupDir: upgraded.backupDir }); assert.equal(recovered.ok, true); assert.equal(fs.existsSync(path.join(installDir, "user-data-marker.txt")), true)
  } finally { fs.rmSync(folder, { recursive: true, force: true }) }
})
