"use strict"

// Reproducible Windows release builder.  It stages a pinned Electron
// distribution, validates the embedded runtime, compiles the NSIS installer
// and writes a SHA-256 sidecar plus a release manifest.  Commercial release
// mode must be run with --require-signed after the runtime and installer have
// been signed with the company's certificate on Windows.

const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const { spawnSync } = require("node:child_process")
const { stageRuntime } = require("./prepare-runtime.cjs")
const { validateRuntimeCandidate } = require("./release-preflight.cjs")

const SOURCE_ROOT = path.resolve(__dirname, "..")
const BUILD_ROOT = path.join(SOURCE_ROOT, "build")
const PACKAGE = require(path.join(SOURCE_ROOT, "package.json"))

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")
}

function parseArgs(argv = process.argv.slice(2)) {
  const result = {
    electronDist: process.env.ELECTRON_DIST || "",
    targetPlatform: process.env.QESTIMA_TARGET_PLATFORM || "win32",
    targetArchitecture: process.env.QESTIMA_TARGET_ARCH || "x64",
    electronVersion: process.env.ELECTRON_VERSION || "37.2.6",
    outputDir: path.join(SOURCE_ROOT, "release"),
    requireSigned: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--electron-dist") result.electronDist = argv[++index]
    else if (arg === "--platform") result.targetPlatform = argv[++index]
    else if (arg === "--arch") result.targetArchitecture = argv[++index]
    else if (arg === "--electron-version") result.electronVersion = argv[++index]
    else if (arg === "--output-dir") result.outputDir = path.resolve(argv[++index])
    else if (arg === "--outfile") result.outfile = path.resolve(argv[++index])
    else if (arg === "--nsis") result.nsis = path.resolve(argv[++index])
    else if (arg === "--nsis-dir") result.nsisDir = path.resolve(argv[++index])
    else if (arg === "--require-signed") result.requireSigned = true
    else if (arg === "--certificate-thumbprint") result.certificateThumbprint = argv[++index]
    else if (arg === "--help" || arg === "-h") result.help = true
  }
  return result
}

function printHelp() {
  console.log([
    "QESTIMA release builder",
    "  --electron-dist <folder>  official Electron distribution (required)",
    "  --platform <win32|linux|darwin>  target platform (default: win32)",
    "  --arch <x64|arm64|ia32>          target architecture (default: x64)",
    "  --electron-version <version>     pinned Electron version",
    "  --outfile <file>                 installer output path",
    "  --nsis <file>                    makensis executable",
    "  --nsis-dir <folder>              NSISDIR containing Include/Stubs",
    "  --require-signed                fail unless runtime manifest is signed",
  ].join("\n"))
}

function defaultNsis() {
  if (process.platform === "win32") return "makensis.exe"
  const candidate = path.join(BUILD_ROOT, "tools", "linux", process.arch === "arm64" ? "arm64" : "x64", "makensis")
  return fs.existsSync(candidate) ? candidate : "makensis"
}

function runRelease(options = {}) {
  if (options.help) { printHelp(); return { help: true } }
  if (!options.electronDist) throw new Error("ELECTRON_DIST_REQUIRED")
  const platform = String(options.targetPlatform || "win32").toLowerCase()
  const architecture = String(options.targetArchitecture || "x64").toLowerCase()
  const outputDir = path.resolve(options.outputDir || path.join(SOURCE_ROOT, "release"))
  const outfile = path.resolve(options.outfile || path.join(outputDir, `QESTIMA-Setup-${PACKAGE.version}-${platform}-${architecture}-${options.requireSigned ? "Signed" : "Preview-Unsigned"}.exe`))
  if (!outfile.startsWith(`${outputDir}${path.sep}`)) throw new Error("RELEASE_OUTPUT_OUTSIDE_OUTPUT_DIR")
  fs.mkdirSync(outputDir, { recursive: true })

  const staging = path.join(BUILD_ROOT, "runtime-staging")
  const staged = stageRuntime({
    electronDist: options.electronDist,
    outputDir: staging,
    sourceRoot: SOURCE_ROOT,
    electronVersion: options.electronVersion,
    targetPlatform: platform,
    targetArchitecture: architecture,
  })
  const sign = (args) => {
    if (process.platform !== "win32" || !options.certificateThumbprint) throw new Error("WINDOWS_SIGNING_CERTIFICATE_REQUIRED")
    const result = spawnSync("powershell.exe", ["-NoProfile", "-File", path.join(BUILD_ROOT, "sign-release.ps1"), "-CertificateThumbprint", options.certificateThumbprint, ...args], { stdio: "inherit" })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error("SIGNATURE_VERIFICATION_FAILED")
  }
  if (options.requireSigned) {
    sign(["-RuntimeDirectory", staging])
    staged.manifest.signed = true
    staged.manifest.files.forEach((file) => { file.sha256 = sha256(path.join(staging, file.path)) })
    fs.writeFileSync(path.join(staging, "runtime-manifest.json"), JSON.stringify(staged.manifest, null, 2))
  }
  const candidate = validateRuntimeCandidate(staging, { expectedAppVersion: PACKAGE.version, requireSigned: options.requireSigned === true })
  if (platform !== "win32") throw new Error("NSIS_RELEASE_REQUIRES_WIN32_TARGET")

  const installerScript = path.join(BUILD_ROOT, "installer.nsi")
  const nsis = options.nsis || defaultNsis()
  if (path.isAbsolute(nsis) && !fs.existsSync(nsis)) throw new Error(`NSIS_NOT_FOUND:${nsis}`)
  const nsisDir = path.resolve(options.nsisDir || path.join(BUILD_ROOT, "tools", "windows"))
  const relativeOut = path.relative(BUILD_ROOT, outfile).replace(/\//g, "\\")
  const args = [`-DQESTIMA_OUTFILE=${relativeOut}`, "-V4", installerScript]
  const result = spawnSync(nsis, args, {
    cwd: SOURCE_ROOT,
    env: { ...process.env, NSISDIR: nsisDir },
    stdio: "inherit",
    windowsHide: true,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`NSIS_FAILED:${result.status}`)
  if (!fs.existsSync(outfile)) throw new Error("INSTALLER_OUTPUT_MISSING")
  if (options.requireSigned) sign(["-Installer", outfile])

  const digest = sha256(outfile)
  const hashPath = `${outfile}.sha256`
  fs.writeFileSync(hashPath, `${digest}  ${path.basename(outfile)}\n`, "utf8")
  const releaseManifest = {
    format: "qestima-release",
    appVersion: PACKAGE.version,
    electronVersion: options.electronVersion,
    platform,
    architecture,
    installer: path.basename(outfile),
    installerSha256: digest,
    runtimeManifest: staged.manifest,
    signed: staged.manifest.signed === true,
    distributionStatus: staged.manifest.signed === true ? "signed" : "preview-unsigned",
    signingRequiredBeforeCommercialDistribution: true,
    generatedAt: new Date().toISOString(),
  }
  const manifestPath = `${outfile}.release.json`
  fs.writeFileSync(manifestPath, JSON.stringify(releaseManifest, null, 2), "utf8")
  return { outfile, hashPath, manifestPath, staging, releaseManifest, candidate }
}

if (require.main === module) {
  try {
    const result = runRelease(parseArgs())
    if (!result.help) {
      console.log(`Release built: ${result.outfile}`)
      console.log(`SHA-256: ${result.hashPath}`)
      if (result.releaseManifest.signed !== true) console.warn("WARNING: preview-unsigned build; sign runtime and installer before commercial distribution.")
    }
  } catch (error) {
    console.error(error.message || error)
    process.exitCode = 1
  }
}

module.exports = { parseArgs, runRelease, sha256 }
