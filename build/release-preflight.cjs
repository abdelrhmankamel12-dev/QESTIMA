"use strict"

// Release preflight helpers.  They deliberately stop at a filesystem
// simulation: the production pipeline must still obtain an official Electron
// distribution, sign it on Windows, and run the real NSIS installer.  These
// helpers let CI exercise the failure/rollback paths without producing an
// installer or touching a user's AppData.

const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { verifyRuntimeManifest } = require("../electron/recovery.cjs")

function existsDirectory(folder) {
  try { return fs.statSync(folder).isDirectory() } catch { return false }
}

function existsFile(file) {
  try { return fs.statSync(file).isFile() } catch { return false }
}

function safeChild(root, relative) {
  const base = path.resolve(root)
  const child = path.resolve(base, relative)
  if (!child.startsWith(`${base}${path.sep}`)) throw new Error("PREFLIGHT_PATH_INVALID")
  return child
}

function validateRuntimeCandidate(root, options = {}) {
  const base = path.resolve(String(root || ""))
  if (!existsDirectory(base)) throw new Error("RUNTIME_STAGING_NOT_FOUND")
  let verified
  try { verified = verifyRuntimeManifest(base) } catch (error) { throw new Error(`RUNTIME_MANIFEST_INVALID:${error.message || error}`) }
  if (!verified.ok) throw new Error(`RUNTIME_MANIFEST_INVALID:${verified.failures.join(",")}`)
  const manifest = verified.manifest || {}
  if (manifest.format !== "qestima-embedded-runtime") throw new Error("RUNTIME_MANIFEST_FORMAT_INVALID")
  if (options.expectedAppVersion && String(manifest.appVersion) !== String(options.expectedAppVersion)) throw new Error("RUNTIME_APP_VERSION_MISMATCH")
  if (options.requireSigned && manifest.signed !== true) throw new Error("RUNTIME_UNSIGNED")
  const executable = safeChild(base, manifest.executable || (process.platform === "win32" ? "QESTIMA.exe" : "QESTIMA"))
  const required = [
    executable,
    safeChild(base, "resources/app/package.json"),
    safeChild(base, "resources/app/electron/main.cjs"),
    safeChild(base, "resources/app/electron/preload.cjs"),
  ]
  const missing = required.filter((file) => !existsFile(file)).map((file) => path.relative(base, file))
  if (missing.length) throw new Error(`RUNTIME_FILES_MISSING:${missing.join(",")}`)
  return { ok: true, root: base, manifest, executable, missing: [] }
}

function uniqueSibling(target, label) {
  const stamp = `${Date.now()}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`
  return `${target}.${label}-${stamp}`
}

function copyDirectory(source, destination) {
  if (!existsDirectory(source)) throw new Error("RUNTIME_STAGING_NOT_FOUND")
  if (path.resolve(source) === path.resolve(destination)) throw new Error("PREFLIGHT_SOURCE_EQUALS_DESTINATION")
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(source, destination, { recursive: true, force: true, errorOnExist: false })
}

function installStagedRuntime(options = {}) {
  const candidate = validateRuntimeCandidate(options.staging, { expectedAppVersion: options.expectedAppVersion, requireSigned: options.requireSigned === true })
  const rawTarget = String(options.installDir || "")
  if (!rawTarget) throw new Error("PREFLIGHT_INSTALL_TARGET_INVALID")
  const target = path.resolve(rawTarget)
  if (target === path.parse(target).root) throw new Error("PREFLIGHT_INSTALL_TARGET_INVALID")
  const incoming = uniqueSibling(target, "incoming")
  const backup = existsDirectory(target) ? uniqueSibling(target, "backup") : ""
  copyDirectory(candidate.root, incoming)
  try {
    if (backup) fs.renameSync(target, backup)
    fs.renameSync(incoming, target)
  } catch (error) {
    try { if (existsDirectory(incoming)) fs.rmSync(incoming, { recursive: true, force: true }) } catch {}
    try { if (backup && existsDirectory(backup) && !existsDirectory(target)) fs.renameSync(backup, target) } catch {}
    throw error
  }
  return { ok: true, installDir: target, backupDir: backup || null, manifest: candidate.manifest }
}

function recoverInstalledRuntime(options = {}) {
  const rawTarget = String(options.installDir || "")
  const rawBackup = String(options.backupDir || "")
  if (!rawTarget || !rawBackup) throw new Error("PREFLIGHT_RECOVERY_TARGET_INVALID")
  const target = path.resolve(rawTarget)
  const backup = path.resolve(rawBackup)
  if (target === path.parse(target).root || backup === path.parse(backup).root) throw new Error("PREFLIGHT_RECOVERY_TARGET_INVALID")
  if (!existsDirectory(backup)) throw new Error("PREFLIGHT_BACKUP_NOT_FOUND")
  const failed = uniqueSibling(target, "failed")
  if (existsDirectory(target)) fs.renameSync(target, failed)
  try {
    fs.renameSync(backup, target)
  } catch (error) {
    try { if (existsDirectory(failed) && !existsDirectory(target)) fs.renameSync(failed, target) } catch {}
    throw error
  }
  return { ok: true, installDir: target, failedDir: failed }
}

function upgradeStagedRuntime(options = {}) { return installStagedRuntime(options) }

module.exports = { validateRuntimeCandidate, installStagedRuntime, upgradeStagedRuntime, recoverInstalledRuntime, copyDirectory }
