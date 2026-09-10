# dmrzl

A monorepo housing CLI tools and GitHub Actions for managing releases, secrets,
and cross-platform git sync.

## Tools

| Tool | Status | Description |
|------|--------|-------------|
| **nkrn** | Active | Release cleaner. Sweep, burn, decay across GitHub, GitLab, registries. |
| **whspr** | Planned | R2 backup. Track, launch, retrieve, drift, scavenge. |
| **rdnt** | Planned | Git sync. Tide, drift, anchor, rift between GitHub and GitLab. |

## Quick Start

```bash
bun install
bun run build:nkrn
```

### Run nkrn (interactive wizard)

> **Warning:** nkrn permanently deletes releases, tags, and container images; these operations cannot be undone.

```bash
# From source
cd packages/nkrn && bun src/index.ts

# Via dispatcher
cd apps/cli && bun src/index.ts nkrn

# As standalone binary
./packages/nkrn/dist/nkrn-linux-x64
```

### Build all platform binaries

```bash
bun run build:nkrn
# Outputs: packages/nkrn/dist/nkrn-{linux-x64,linux-arm64,macos-x64,macos-arm64,windows-x64.exe}
```

## Development

```bash
# Install dependencies
bun install

# Type check all packages
bun run check

# Run tests
bun test --workspaces

# Lint (oxlint, type-aware)
bun run lint

# Format (oxfmt)
bun run fmt
```

## Project Structure

```
dmrzl/
  packages/
    core/       @dmrzl/core   Shared config, types, validation
    nkrn/       @dmrzl/nkrn   Release cleaner
    whspr/      @dmrzl/whspr  R2 backup (stub)
    rdnt/       @dmrzl/rdnt   Git sync (stub)
  apps/
    cli/        dmrzl         Unified dispatcher
  scripts/
    build.ts                  Monorepo build script
    publish.ts                Interactive release publisher
```

## Configuration

nkrn reads credentials from (highest to lowest precedence):

1. `~/.rlscleanerrc` -- dedicated cleaner config
2. `~/.atlasrc` -- shared bootstrap environment
3. `.env` -- local working directory

On first run, the tool presents an interactive review of discovered config
and prompts for any missing values. Edited values are saved back to
`~/.rlscleanerrc` for future runs.

## Releases

Local releases are interactive; CI releases are automated. Run the publish script:

```bash
bun run publish:nkrn
```

This builds binaries, creates a git tag (`nkrn-vX.Y.Z`), pushes it, and
creates a GitHub release with artifacts via `gh`.

In CI, pushes to `main` that touch `packages/nkrn/` or `packages/core/`
trigger a release workflow. Manual dispatch is also supported.

## License

MIT
