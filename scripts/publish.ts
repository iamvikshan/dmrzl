/**
 * nkrn release publisher — interactive, local-first.
 * Usage: bun scripts/publish.ts [--package nkrn]
 *
 * Requires: gh CLI, clean working tree.
 */

type PackageConfig = {
  name: string
  entry: string
  distDir: string
  artifacts: Array<{ path: string; label: string }>
}

const PACKAGES: Record<string, PackageConfig> = {
  nkrn: {
    name: "nkrn",
    entry: "packages/nkrn/src/index.ts",
    distDir: "packages/nkrn/dist",
    artifacts: [
      {
        path: "packages/nkrn/dist/index.js",
        label: "Universal JS Bundle (Node/Bun)",
      },
      { path: "packages/nkrn/dist/nkrn-linux-x64", label: "nkrn Linux (x64)" },
      {
        path: "packages/nkrn/dist/nkrn-linux-arm64",
        label: "nkrn Linux (ARM64)",
      },
      { path: "packages/nkrn/dist/nkrn-macos-x64", label: "nkrn macOS (x64)" },
      {
        path: "packages/nkrn/dist/nkrn-macos-arm64",
        label: "nkrn macOS (Apple Silicon)",
      },
      {
        path: "packages/nkrn/dist/nkrn-windows-x64.exe",
        label: "nkrn Windows (x64)",
      },
    ],
  },
}

function log(msg: string) {
  console.log(msg)
}

function err(msg: string): never {
  console.error(`\n  ✗ ${msg}`)
  process.exit(1)
}

function run(cmd: string[], opts?: { cwd?: string }): string {
  const proc = Bun.spawnSync(cmd, { cwd: opts?.cwd })
  if (!proc.success) {
    err(`${cmd[0]} failed: ${proc.stderr.toString()}`)
  }
  return proc.stdout.toString().trim()
}

function nextPatch(current: string): string {
  const m = current.match(/v?(\d+)\.(\d+)\.(\d+)/)
  if (!m) return "v0.1.0"
  return `v${m[1]}.${m[2]}.${Number(m[3]) + 1}`
}

function parseVersion(tag: string): string {
  return tag.replace(/^[a-z]+-v?/, "")
}

async function prompt(message: string, fallback?: string): Promise<string> {
  const label = fallback ? `${message} (${fallback}): ` : `${message}: `
  process.stdout.write(label)
  const buf = Buffer.alloc(1024)
  const n = await new Promise<number>(resolve => {
    process.stdin.once("data", data => {
      Buffer.from(data).copy(buf)
      resolve(data.length)
    })
  })
  const val = buf.toString("utf8", 0, n).trim()
  return val || fallback || ""
}

async function confirm(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `)
  const buf = Buffer.alloc(10)
  const n = await new Promise<number>(resolve => {
    process.stdin.once("data", data => {
      Buffer.from(data).copy(buf)
      resolve(data.length)
    })
  })
  return buf.toString("utf8", 0, n).trim().toLowerCase() === "y"
}

async function main() {
  const args = process.argv.slice(2)
  const pkgIdx = args.indexOf("--package")
  const targetPkg = pkgIdx !== -1 ? args[pkgIdx + 1] ?? "nkrn" : "nkrn"

  const pkg = PACKAGES[targetPkg]
  if (!pkg)
    err(
      `Unknown package: ${targetPkg}. Available: ${Object.keys(PACKAGES).join(", ")}`,
    )

  log(`\n  @dmrzl/${pkg.name} release publisher\n`)

  // Preflight checks
  if (!Bun.which("gh"))
    err("GitHub CLI (gh) required. Install: https://cli.github.com/")

  const status = run(["git", "status", "--porcelain"])
  if (status) err("Working directory not clean. Commit or stash changes first.")

  const branch = run(["git", "branch", "--show-current"])
  if (!branch) err("Could not determine current branch")
  log(`  Branch: ${branch}`)

  // Get latest tag for this package
  const latestTag = (() => {
    const proc = Bun.spawnSync([
      "git",
      "describe",
      "--tags",
      "--abbrev=0",
      "--match",
      `${pkg.name}-v*`,
    ])
    return proc.success ? proc.stdout.toString().trim() : `${pkg.name}-v0.0.0`
  })()
  const suggested = nextPatch(latestTag.replace(`${pkg.name}-`, ""))
  log(`  Latest tag: ${latestTag}`)
  log(`  Suggested:  ${pkg.name}-${suggested}\n`)

  // Gather release info
  const tag = await prompt(
    `Tag (e.g. ${pkg.name}-v1.0.4)`,
    `${pkg.name}-${suggested}`,
  )
  if (!tag) err("Tag is required")

  const name = await prompt("Release name", tag)
  if (!name) err("Release name is required")
  const notes = await prompt("Release notes (optional)", "")

  log(`\n  Tag:     ${tag}`)
  log(`  Name:    ${name}`)
  log(`  Notes:   ${notes || "(none)"}`)
  log("")

  const ok = await confirm("Build, tag, and publish?")
  if (!ok) err("Aborted.")

  // Build
  log("\n  Building...")
  const buildProc = Bun.spawnSync([
    "bun",
    "scripts/build.ts",
    "--package",
    pkg.name,
  ])
  if (!buildProc.success) err(`Build failed: ${buildProc.stderr.toString()}`)
  log("  ✓ Build complete")

  // Archive binaries
  log("  Archiving binaries...")
  Bun.spawnSync(["mkdir", "-p", `${pkg.distDir}/archives`])
  for (const art of pkg.artifacts) {
    if (art.path.endsWith(".exe")) {
      const zipName = art.path
        .replace(".exe", ".zip")
        .replace("dist/", "dist/archives/")
      Bun.spawnSync(["zip", "-q", "-j", zipName, art.path])
    } else if (!art.path.endsWith(".js")) {
      const tarName = art.path.replace("dist/", "dist/archives/") + ".tar.gz"
      Bun.spawnSync([
        "tar",
        "-czf",
        tarName,
        "-C",
        pkg.distDir,
        art.path.split("/").pop()!,
      ])
    }
  }
  log("  ✓ Archives ready")

  // Create and push tag
  log(`  Creating tag ${tag}...`)
  run(["git", "tag", tag])
  run(["git", "push", "origin", tag])
  log(`  ✓ Tag ${tag} pushed`)

  // Create GitHub release
  log("  Creating GitHub release...")
  const ghArgs: string[] = ["release", "create", tag, "--title", name, "--target"]
  ghArgs.push(branch)
  if (notes) {
    ghArgs.push("--notes", notes)
  } else {
    ghArgs.push("--generate-notes")
  }

  // Add artifacts
  for (const art of pkg.artifacts) {
    ghArgs.push(`${art.path}#${art.label}`)
  }

  // Add archives
  const archiveDir = `${pkg.distDir}/archives`
  const archives = Bun.spawnSync(["ls", archiveDir])
  if (archives.success) {
    for (const f of archives.stdout.toString().trim().split("\n")) {
      if (f) ghArgs.push(`${archiveDir}/${f}`)
    }
  }

  const gh = Bun.spawnSync(["gh", ...ghArgs])
  if (!gh.success) err(`GitHub release failed: ${gh.stderr.toString()}`)
  log(`  ✓ Release ${tag} published`)

  // Update package.json version
  const version = parseVersion(tag)
  const pkgJsonPath = `packages/${pkg.name}/package.json`
  const pkgJson = JSON.parse(await Bun.file(pkgJsonPath).text())
  pkgJson.version = version
  await Bun.write(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n")
  log(`  ✓ package.json version → ${version}`)

  log(`\n  ✓ Release ${tag} complete!\n`)
}

main().catch(e => {
  console.error(`Fatal: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
