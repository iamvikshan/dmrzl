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
  return tag.replace(/^[a-z]+-v?/, "").replace(/^v/, "")
}

function ask(message: string, fallback?: string): Promise<string> {
  const label = fallback ? `${message} (${fallback}): ` : `${message}: `
  process.stdout.write(label)
  const buf = Buffer.alloc(1024)
  return new Promise<string>(resolve => {
    process.stdin.once("data", data => {
      Buffer.from(data).copy(buf)
      const val = buf.toString("utf8", 0, data.length).trim()
      resolve(val === "" ? (fallback ?? "") : val)
    })
  })
}

function confirmAction(message: string): Promise<boolean> {
  process.stdout.write(`${message} [y/N] `)
  const buf = Buffer.alloc(10)
  return new Promise<boolean>(resolve => {
    process.stdin.once("data", data => {
      Buffer.from(data).copy(buf)
      resolve(buf.toString("utf8", 0, data.length).trim().toLowerCase() === "y")
    })
  })
}

function resolvePackage(targetPkg: string): PackageConfig {
  const pkg = PACKAGES[targetPkg] as PackageConfig | undefined
  if (!pkg) {
    err(
      `Unknown package: ${targetPkg}. Available: ${Object.keys(PACKAGES).join(", ")}`,
    )
  }
  return pkg
}

function preflight(): string {
  if (!Bun.which("gh"))
    err("GitHub CLI (gh) required. Install: https://cli.github.com/")

  const status = run(["git", "status", "--porcelain"])
  if (status) err("Working directory not clean. Commit or stash changes first.")

  const branch = run(["git", "branch", "--show-current"])
  if (!branch) err("Could not determine current branch")
  log(`  Branch: ${branch}`)

  return branch
}

function resolveLatestTag(pkg: PackageConfig): {
  tag: string
  suggested: string
} {
  // Use git tag -l with version sorting to find the highest stable tag.
  // git describe can pick a lower reachable tag after merged release branches.
  const proc = Bun.spawnSync([
    "git",
    "tag",
    "-l",
    `${pkg.name}-v*`,
    "--sort=-version:refname",
  ])
  const tags = proc.success
    ? proc.stdout.toString().trim().split("\n").filter(Boolean)
    : []
  // Prefer the highest stable (non-prerelease) tag; fall back to highest overall
  const stableTags = tags.filter(t => /-v\d+\.\d+\.\d+$/.test(t))
  const tag =
    stableTags.length > 0
      ? stableTags[0]
      : tags.length > 0
        ? tags[0]
        : `${pkg.name}-v0.0.0`
  const suggested = nextPatch(tag.replace(`${pkg.name}-`, ""))
  return { tag, suggested }
}

async function gatherReleaseInfo(pkg: PackageConfig, suggested: string) {
  const tag = await ask(
    `Tag (e.g. ${pkg.name}-v1.0.4)`,
    `${pkg.name}-${suggested}`,
  )
  if (!tag) err("Tag is required")

  const tagPattern = new RegExp(
    `^${pkg.name}-v\\d+\\.\\d+\\.\\d+(?:-(?:0|[1-9]\\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9]\\d*|[A-Za-z-][0-9A-Za-z-]*))*)?$`,
  )
  if (!tagPattern.test(tag))
    err(
      `Invalid tag format '${tag}'. Expected: ${pkg.name}-vX.Y.Z or ${pkg.name}-vX.Y.Z-prerelease`,
    )

  const name = await ask("Release name", tag)
  if (!name) err("Release name is required")
  const notes = await ask("Release notes (optional)", "")

  return { tag, name, notes }
}

function buildAndArchive(pkg: PackageConfig): void {
  log("\n  Building...")
  const buildProc = Bun.spawnSync([
    "bun",
    "scripts/build.ts",
    "--package",
    pkg.name,
  ])
  if (!buildProc.success) err(`Build failed: ${buildProc.stderr.toString()}`)
  log("  ✓ Build complete")

  log("  Archiving binaries...")
  Bun.spawnSync(["mkdir", "-p", `${pkg.distDir}/archives`])
  for (const art of pkg.artifacts) {
    if (art.path.endsWith(".exe")) {
      const zipName = art.path
        .replace(".exe", ".zip")
        .replace("dist/", "dist/archives/")
      const zipProc = Bun.spawnSync(["zip", "-q", "-j", zipName, art.path])
      if (!zipProc.success)
        err(`Failed to create ${zipName}: ${zipProc.stderr.toString()}`)
    } else if (!art.path.endsWith(".js")) {
      const tarName = art.path.replace("dist/", "dist/archives/") + ".tar.gz"
      const basename = art.path.split("/").pop() ?? art.path
      const tarProc = Bun.spawnSync([
        "tar",
        "-czf",
        tarName,
        "-C",
        pkg.distDir,
        basename,
      ])
      if (!tarProc.success)
        err(`Failed to create ${tarName}: ${tarProc.stderr.toString()}`)
    }
  }
  log("  ✓ Archives ready")
}

async function commitVersionBump(
  pkg: PackageConfig,
  tag: string,
): Promise<void> {
  const version = parseVersion(tag)
  const pkgJsonPath = `packages/${pkg.name}/package.json`
  const raw = await Bun.file(pkgJsonPath).text()
  const pkgJson: { version?: string } = JSON.parse(raw) as Record<
    string,
    unknown
  >
  pkgJson.version = version
  await Bun.write(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + "\n")
  log(`  ✓ package.json version → ${version}`)

  run(["git", "add", pkgJsonPath])
  const diffProc = Bun.spawnSync(["git", "diff", "--staged", "--quiet"])
  if (!diffProc.success) {
    run(["git", "commit", "-m", `${pkg.name}: release ${tag} [skip ci]`])
    run(["git", "push"])
    log("  ✓ Version bump committed")
  }
}

function createGitHubRelease(
  pkg: PackageConfig,
  tag: string,
  name: string,
  notes: string,
  branch: string,
): void {
  log("  Creating GitHub release...")
  const ghArgs: string[] = [
    "release",
    "create",
    tag,
    "--title",
    name,
    "--target",
    branch,
  ]
  const isPrerelease = /-/.test(tag.replace(`${pkg.name}-v`, ""))
  if (isPrerelease) {
    ghArgs.push("--prerelease")
  }
  if (notes) {
    ghArgs.push("--notes", notes)
  } else {
    ghArgs.push("--generate-notes")
  }

  for (const art of pkg.artifacts) {
    ghArgs.push(`${art.path}#${art.label}`)
  }

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
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const pkgIdx = args.indexOf("--package")
  const targetPkg = pkgIdx !== -1 ? (args[pkgIdx + 1] ?? "nkrn") : "nkrn"

  const pkg = resolvePackage(targetPkg)
  log(`\n  @dmrzl/${pkg.name} release publisher\n`)

  const branch = preflight()

  const { tag: latestTag, suggested } = resolveLatestTag(pkg)
  log(`  Latest tag: ${latestTag}`)
  log(`  Suggested:  ${pkg.name}-${suggested}\n`)

  const { tag, name, notes } = await gatherReleaseInfo(pkg, suggested)

  log(`\n  Tag:     ${tag}`)
  log(`  Name:    ${name}`)
  log(`  Notes:   ${notes === "" ? "(none)" : notes}`)
  log("")

  const ok = await confirmAction("Build, tag, and publish?")
  if (!ok) err("Aborted.")

  buildAndArchive(pkg)

  await commitVersionBump(pkg, tag)

  log(`  Creating tag ${tag}...`)
  run(["git", "tag", tag])
  run(["git", "push", "origin", tag])
  log(`  ✓ Tag ${tag} pushed`)

  createGitHubRelease(pkg, tag, name, notes, branch)

  log(`\n  ✓ Release ${tag} complete!\n`)
}

main().catch((e: unknown) => {
  console.error(`Fatal: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
