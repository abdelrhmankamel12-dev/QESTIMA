"use strict"

// Stage an embedded Electron runtime without creating an installer.  The
// release pipeline can run on a Windows build host or cross-stage an official
// Windows distribution from CI/Linux.  Keeping staging separate from NSIS
// makes it possible to test install/upgrade/recovery before signing.

const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

const SOURCE_ROOT = path.resolve(__dirname, "..")

function sha256(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex") }
function existsFile(filePath) { try { return fs.statSync(filePath).isFile() } catch { return false } }
function requireDirectory(folder, label) { if (!folder || !fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new Error(`${label}_NOT_FOUND`) }

function normalizeTarget(options = {}) {
  const platform = String(options.targetPlatform || options.platform || process.env.QESTIMA_TARGET_PLATFORM || process.platform).toLowerCase()
  const architecture = String(options.targetArchitecture || options.architecture || process.env.QESTIMA_TARGET_ARCH || process.arch).toLowerCase()
  if (!new Set(["win32", "linux", "darwin"]).has(platform)) throw new Error(`UNSUPPORTED_RUNTIME_PLATFORM:${platform}`)
  if (!new Set(["x64", "arm64", "ia32"]).has(architecture)) throw new Error(`UNSUPPORTED_RUNTIME_ARCHITECTURE:${architecture}`)
  return { platform, architecture }
}

function validateElectronRuntime(electronDist, targetPlatform = process.platform) {
  const root = path.resolve(String(electronDist || ""))
  requireDirectory(root, "ELECTRON_RUNTIME")
  const executableName = targetPlatform === "win32" ? "electron.exe" : "electron"
  const executable = path.join(root, executableName)
  const required = [executableName, "resources.pak", "icudtl.dat"]
  const missing = required.filter((name) => !existsFile(path.join(root, name)))
  if (missing.length) throw new Error(`ELECTRON_RUNTIME_INCOMPLETE:${missing.join(",")}`)
  return { root, executable, required, platform: targetPlatform }
}

function copyDirectory(source, destination) {
  requireDirectory(source, "SOURCE")
  fs.mkdirSync(destination, { recursive: true })
  fs.cpSync(source, destination, { recursive: true, force: true, errorOnExist: false })
}

function copyFileIfPresent(source, destination) {
  if (!existsFile(source)) return false
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.copyFileSync(source, destination)
  return true
}

function stageRuntime(options = {}) {
  const target = normalizeTarget(options)
  const electron = validateElectronRuntime(options.electronDist || process.env.ELECTRON_DIST, target.platform)
  const sourceRoot = path.resolve(options.sourceRoot || SOURCE_ROOT)
  const outputDir = path.resolve(options.outputDir || path.join(sourceRoot, "build", "runtime-staging"))
  requireDirectory(sourceRoot, "QESTIMA_SOURCE")
  if (path.resolve(outputDir) === path.resolve(sourceRoot)) throw new Error("RUNTIME_OUTPUT_CANNOT_BE_SOURCE")
  fs.mkdirSync(outputDir, { recursive: true })

  // Copy the official runtime as-is, then replace the executable name with
  // the branded launcher expected by shortcuts and the NSIS script.
  const electronExecutableName = target.platform === "win32" ? "electron.exe" : "electron"
  const brandedExecutableName = target.platform === "win32" ? "QESTIMA.exe" : "QESTIMA"
  for (const entry of fs.readdirSync(electron.root, { withFileTypes: true })) {
    const from = path.join(electron.root, entry.name)
    const to = path.join(outputDir, entry.name)
    if (entry.name.toLowerCase() === electronExecutableName.toLowerCase()) copyFileIfPresent(from, path.join(outputDir, brandedExecutableName))
    else if (entry.isDirectory()) copyDirectory(from, to)
    else if (entry.isFile()) copyFileIfPresent(from, to)
  }

  const appDir = path.join(outputDir, "resources", "app")
  fs.mkdirSync(appDir, { recursive: true })
  ;["app", "electron", "server"].forEach((folder) => copyDirectory(path.join(sourceRoot, folder), path.join(appDir, folder)))
  copyFileIfPresent(path.join(sourceRoot, "package.json"), path.join(appDir, "package.json"))
  copyFileIfPresent(path.join(sourceRoot, "license-public.pem"), path.join(appDir, "license-public.pem"))
  copyFileIfPresent(path.join(sourceRoot, "launcher.vbs"), path.join(outputDir, "launcher.vbs"))
  copyFileIfPresent(path.join(sourceRoot, "build", "icon.ico"), path.join(outputDir, "icon.ico"))
  if (options.toolsDir) copyDirectory(path.resolve(options.toolsDir), path.join(outputDir, "tools"))

  const runtimeExecutable = path.join(outputDir, brandedExecutableName)
  if (!existsFile(runtimeExecutable)) throw new Error("BRANDED_RUNTIME_EXECUTABLE_MISSING")
  const manifest = {
    format: "qestima-embedded-runtime",
    version: 1,
    appVersion: require(path.join(sourceRoot, "package.json")).version,
    electronVersion: options.electronVersion || "unknown",
    platform: target.platform,
    architecture: target.architecture,
    generatedAt: new Date().toISOString(),
    executable: path.basename(runtimeExecutable),
    signed: false,
    signingRequiredBeforeDistribution: true,
    files: [runtimeExecutable, path.join(outputDir, "resources", "app", "package.json")].map((file) => ({ path: path.relative(outputDir, file).replace(/\\/g, "/"), sha256: sha256(file) })),
  }
  fs.writeFileSync(path.join(outputDir, "runtime-manifest.json"), JSON.stringify(manifest, null, 2), { encoding: "utf8", mode: 0o600 })
  return { outputDir, manifest }
}

function parseArgs(argv = process.argv.slice(2)) {
  const result = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--electron-dist") result.electronDist = argv[++index]
    else if (arg === "--output") result.outputDir = argv[++index]
    else if (arg === "--source") result.sourceRoot = argv[++index]
    else if (arg === "--tools") result.toolsDir = argv[++index]
    else if (arg === "--electron-version") result.electronVersion = argv[++index]
    else if (arg === "--platform") result.targetPlatform = argv[++index]
    else if (arg === "--arch") result.targetArchitecture = argv[++index]
  }
  return result
}

if (require.main === module) {
  try {
    const result = stageRuntime(parseArgs())
    console.log(`Runtime staged at ${result.outputDir} for ${result.manifest.platform}/${result.manifest.architecture}.`)
  } catch (error) {
    console.error(error.message || error)
    process.exitCode = 1
  }
}

module.exports = { validateElectronRuntime, stageRuntime, parseArgs }
