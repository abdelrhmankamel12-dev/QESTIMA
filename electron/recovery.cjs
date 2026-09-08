"use strict"

const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

function sha256(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }

function atomicReplace(filePath, content) {
  const target = path.resolve(filePath); fs.mkdirSync(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.${crypto.randomBytes(5).toString("hex")}.tmp`
  let descriptor = null
  try {
    descriptor = fs.openSync(temporary, "w", 0o600)
    fs.writeFileSync(descriptor, content)
    fs.fsyncSync(descriptor); fs.closeSync(descriptor); descriptor = null
    fs.renameSync(temporary, target)
    return target
  } catch (error) {
    if (descriptor !== null) try { fs.closeSync(descriptor) } catch {}
    try { fs.unlinkSync(temporary) } catch {}
    throw error
  }
}

function verifyRuntimeManifest(root, manifestName = "runtime-manifest.json") {
  const base = path.resolve(root); const manifest = JSON.parse(fs.readFileSync(path.join(base, manifestName), "utf8")); const failures = []
  for (const entry of manifest.files || []) {
    const relative = path.posix.normalize(String(entry.path || "").replace(/\\/g, "/"))
    if (!relative || relative.startsWith("../") || path.posix.isAbsolute(relative)) { failures.push(entry.path); continue }
    const target = path.resolve(base, relative)
    if (!target.startsWith(`${base}${path.sep}`) || !fs.existsSync(target) || !fs.statSync(target).isFile() || sha256(target) !== entry.sha256) failures.push(entry.path)
  }
  return { ok: failures.length === 0, manifest, failures }
}

module.exports = { atomicReplace, verifyRuntimeManifest, sha256 }
