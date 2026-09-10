/**
 * Monorepo build script — builds packages that have a build target.
 * Usage: bun scripts/build.ts [--package nkrn] [--all]
 */

import { mkdirSync } from "node:fs"

type BuildTarget = {
  target: string
  name: string
}

type BuildPackageConfig = {
  name: string
  entry: string
  binaries: BuildTarget[]
}

const BUILD_PACKAGES: Record<string, BuildPackageConfig> = {
  nkrn: {
    name: "nkrn",
    entry: "packages/nkrn/src/index.ts",
    binaries: [
      { target: "bun-linux-x64", name: "nkrn-linux-x64" },
      { target: "bun-linux-arm64", name: "nkrn-linux-arm64" },
      { target: "bun-darwin-x64", name: "nkrn-macos-x64" },
      { target: "bun-darwin-arm64", name: "nkrn-macos-arm64" },
      { target: "bun-windows-x64", name: "nkrn-windows-x64.exe" },
    ],
  },
}

function buildJS(entry: string, outfile: string, banner?: string): boolean {
  console.log(`  JS bundle → ${outfile}`)
  const args = ["bun", "build", entry, "--target=bun", "--outfile", outfile]
  if (banner) args.push(`--banner=${banner}`)
  const proc = Bun.spawnSync(args)
  if (!proc.success) {
    console.error(`  FAILED: ${proc.stderr.toString()}`)
    return false
  }
  return true
}

function buildBinary(entry: string, target: string, outfile: string): boolean {
  console.log(`  ${target} → ${outfile}`)
  const proc = Bun.spawnSync([
    "bun",
    "build",
    "--compile",
    "--target",
    target,
    entry,
    "--outfile",
    outfile,
  ])
  if (!proc.success) {
    console.error(`  FAILED: ${proc.stderr.toString()}`)
    return false
  }
  return true
}

function buildPackage(pkg: BuildPackageConfig): boolean {
  console.log(`\nBuilding @dmrzl/${pkg.name}...`)

  // Ensure dist/ exists
  const distDir = `packages/${pkg.name}/dist`
  mkdirSync(distDir, { recursive: true })

  // JS bundle
  const jsOk = buildJS(pkg.entry, `${distDir}/index.js`, "#!/usr/bin/env bun")

  // Platform binaries
  let allBinOk = true
  for (const bin of pkg.binaries) {
    const ok = buildBinary(pkg.entry, bin.target, `${distDir}/${bin.name}`)
    if (!ok) allBinOk = false
  }

  const ok = jsOk && allBinOk
  console.log(ok ? `  ✓ ${pkg.name} done` : `  ✗ ${pkg.name} had failures`)
  return ok
}

function buildMain() {
  const args = process.argv.slice(2)
  const pkgIdx = args.indexOf("--package")
  const targetPkg = pkgIdx !== -1 ? args[pkgIdx + 1] : null

  if (pkgIdx !== -1 && !targetPkg) {
    console.error("--package requires a package name")
    process.exit(1)
  }

  const packages = targetPkg
    ? [BUILD_PACKAGES[targetPkg]].filter(Boolean)
    : Object.values(BUILD_PACKAGES)

  if (packages.length === 0) {
    console.error(`Unknown package: ${targetPkg}`)
    console.error(`Available: ${Object.keys(BUILD_PACKAGES).join(", ")}`)
    process.exit(1)
  }

  console.log("dmrzl monorepo build")
  console.log("=".repeat(40))

  let allOk = true
  for (const pkg of packages) {
    if (!buildPackage(pkg)) allOk = false
  }

  console.log("\n" + "=".repeat(40))
  console.log(allOk ? "✓ All builds succeeded" : "✗ Some builds failed")
  process.exit(allOk ? 0 : 1)
}

buildMain()
