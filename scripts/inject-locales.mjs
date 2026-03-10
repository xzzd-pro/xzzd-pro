#!/usr/bin/env node

import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const projectRoot = process.cwd()
const buildRoot = path.join(projectRoot, "build")
const localesRoot = path.join(projectRoot, "_locales")

if (!fs.existsSync(localesRoot)) {
  console.warn(`[inject-locales] _locales directory not found: ${localesRoot}`)
  process.exit(0)
}

const localeEntries = fs.readdirSync(localesRoot, { withFileTypes: true })
const localeDirs = localeEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((locale) =>
    fs.existsSync(path.join(localesRoot, locale, "messages.json"))
  )

if (localeDirs.length === 0) {
  console.warn("[inject-locales] No locale with messages.json found in _locales")
  process.exit(0)
}

const copyLocalesTo = (targetRoot) => {
  const targetLocalesRoot = path.join(targetRoot, "_locales")
  fs.rmSync(targetLocalesRoot, { recursive: true, force: true })
  fs.mkdirSync(targetLocalesRoot, { recursive: true })

  for (const locale of localeDirs) {
    const sourceDir = path.join(localesRoot, locale)
    const targetDir = path.join(targetLocalesRoot, locale)
    fs.cpSync(sourceDir, targetDir, { recursive: true })
  }
}

const patchZipLocales = (zipPath) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "extension-locales-"))

  try {
    execFileSync("unzip", ["-q", zipPath, "-d", tmpDir], {
      stdio: "inherit"
    })

    copyLocalesTo(tmpDir)
    fs.rmSync(zipPath, { force: true })
    execFileSync("zip", ["-qr", zipPath, "."], {
      cwd: tmpDir,
      stdio: "inherit"
    })

    console.log(`[inject-locales] repacked zip: ${zipPath}`)
    return true
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

if (!fs.existsSync(buildRoot)) {
  console.warn(`[inject-locales] build directory not found: ${buildRoot}`)
  process.exit(0)
}

const entries = fs.readdirSync(buildRoot)
let processedCount = 0

for (const entry of entries) {
  const entryPath = path.join(buildRoot, entry)
  const stat = fs.statSync(entryPath)
  const isExtensionOutput =
    entry.startsWith("chrome-") || entry.startsWith("firefox-")

  if (!isExtensionOutput) {
    continue
  }

  if (stat.isDirectory()) {
    copyLocalesTo(entryPath)
    processedCount += 1
    console.log(`[inject-locales] copied locales to: ${entryPath}`)
    continue
  }

  if (stat.isFile() && entry.endsWith(".zip")) {
    if (patchZipLocales(entryPath)) {
      processedCount += 1
    }
  }
}

if (processedCount === 0) {
  console.warn("[inject-locales] No extension build output found")
} else {
  console.log(`[inject-locales] Done. Processed ${processedCount} output(s).`)
}
