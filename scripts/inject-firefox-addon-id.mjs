#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const projectRoot = process.cwd()
const buildRoot = path.join(projectRoot, "build")
const packageJsonPath = path.join(projectRoot, "package.json")

if (!fs.existsSync(packageJsonPath)) {
  console.error("[inject-firefox-addon-id] package.json not found")
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
const addonIdFromPackage =
  pkg?.manifest?.browser_specific_settings?.gecko?.id ?? ""
const addonId = process.env.FIREFOX_ADDON_ID || addonIdFromPackage

if (!addonId) {
  console.error(
    "[inject-firefox-addon-id] Missing addon id. Set FIREFOX_ADDON_ID or package.json manifest.browser_specific_settings.gecko.id"
  )
  process.exit(1)
}

const injectAddonId = (manifestPath) => {
  if (!fs.existsSync(manifestPath)) {
    return false
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  const beforeId = manifest?.browser_specific_settings?.gecko?.id
  const nextManifest = {
    ...manifest,
    browser_specific_settings: {
      ...(manifest.browser_specific_settings ?? {}),
      gecko: {
        ...(manifest.browser_specific_settings?.gecko ?? {}),
        id: addonId
      }
    }
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`)

  if (beforeId === addonId) {
    console.log(`[inject-firefox-addon-id] already set: ${manifestPath}`)
  } else {
    console.log(`[inject-firefox-addon-id] injected: ${manifestPath}`)
  }

  return true
}

const patchZipManifest = (zipPath) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "firefox-addon-id-"))

  try {
    execFileSync("unzip", ["-q", zipPath, "-d", tmpDir], {
      stdio: "inherit"
    })

    const manifestPath = path.join(tmpDir, "manifest.json")
    const patched = injectAddonId(manifestPath)

    if (!patched) {
      console.warn(
        `[inject-firefox-addon-id] manifest.json not found in zip: ${zipPath}`
      )
      return
    }

    fs.rmSync(zipPath, { force: true })
    execFileSync("zip", ["-qr", zipPath, "."], {
      cwd: tmpDir,
      stdio: "inherit"
    })
    console.log(`[inject-firefox-addon-id] repacked: ${zipPath}`)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (!fs.existsSync(buildRoot)) {
  console.warn(`[inject-firefox-addon-id] build directory not found: ${buildRoot}`)
  process.exit(0)
}

const entries = fs.readdirSync(buildRoot)
let patchedCount = 0

for (const entry of entries) {
  if (!entry.startsWith("firefox-")) {
    continue
  }

  const entryPath = path.join(buildRoot, entry)
  const stat = fs.statSync(entryPath)

  if (stat.isDirectory()) {
    const manifestPath = path.join(entryPath, "manifest.json")
    if (injectAddonId(manifestPath)) {
      patchedCount += 1
    }
    continue
  }

  if (stat.isFile() && entry.endsWith(".zip")) {
    patchZipManifest(entryPath)
    patchedCount += 1
  }
}

if (patchedCount === 0) {
  console.warn("[inject-firefox-addon-id] No Firefox build outputs were found")
} else {
  console.log(
    `[inject-firefox-addon-id] Done. Processed ${patchedCount} Firefox output(s).`
  )
}
