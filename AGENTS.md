# AGENTS.md — dmrzl

**dmrzl** is a monorepo housing CLI tools and GitHub Actions for managing
releases, secrets, and cross-platform git sync.

This document is the project constitution. Read it before writing code.

---

## Naming Convention

### Pattern

All tool names are **vowel-compressed references** — pronounceable, short,
and terminal-native. Four characters is the sweet spot. Five is the ceiling.

| Name      | Tool                 | Source        | Compressed from |
| --------- | -------------------- | ------------- | --------------- |
| **dmrzl** | Org / unified binary | Demerzel      | 8 → 5 chars     |
| **nkrn**  | Release cleaner      | Anacreon      | 8 → 4 chars     |
| **whspr** | R2 backup            | Whisper Ships | 13 → 5 chars    |
| **rdnt**  | Git sync             | Prime Radiant | 13 → 4 chars    |

### Rules

1. **Pronounceable without vowels.** `nkrn` → "nu-kern". `dmrzl` → "demer-zel".
   If your mouth can't infer the gaps, the name is wrong.
2. **Subcommand verbs are practical words.** `sweep`, `burn`, `launch`,
   `drift` — each one describes exactly what it does. No lore knowledge required.
3. **Keep git-standard verbs untouched.** `add`, `rm`, `status`, `clone`,
   `log` — developers already know these. Don't rename them.
4. **Easter egg lives in the name and menu labels, nowhere else.** Terminal output, help text,
   and error messages are clean, professional, and direct.

---

## Tools

### nkrn — Release Cleaner (MVP)

**Status:** First candidate. Migrating from `iamvikshan/release-cleanup`.
**State:** Fully interactive CLI, no subcommands. Bun-powered.
**Platforms:** GitHub, GitLab, GHCR, GitLab Container Registry, Docker Hub.

#### Current Behavior (being preserved)

Interactive wizard:

```
Scope selection → Platform filter → Item multi-select → Confirmation
```

No subcommands yet — the wizard IS the product. The interactive flow
stays as the default experience.

#### Planned Subcommands

```bash
nkrn            # alias for nkrn sweep
nkrn sweep      # interactive mode — the full wizard
nkrn sweep --scope releases    # pre-select scope, interactive for selection
nkrn sweep --platform github   # pre-select platform
nkrn sweep --all               # all scope, all platforms, still confirms

nkrn burn       # automation mode — flag-driven, minimal prompts
nkrn burn --scope releases --platform github --tag "v0.*" --yes
nkrn burn --scope images --platform all --image "myapp" --keep 3

nkrn status     # read-only — list what exists, nothing deleted
nkrn status --platform github
nkrn status --scope images --platform all

nkrn decay      # find stale or orphaned artifacts
nkrn decay --platform all --min-age 30d
```

#### Command Verbs

| Verb     | Mode            | Purpose                                      |
| -------- | --------------- | -------------------------------------------- |
| `sweep`  | Interactive     | Default experience. Full wizard walkthrough. |
| `burn`   | Non-interactive | CI-friendly. Flag-driven. Requires `--yes`.  |
| `status` | Read-only       | List what exists without touching anything.  |
| `decay`  | Read-only       | Find stale, orphaned, or aged-out artifacts. |

#### Key Details

- Config hierarchy: `~/.rlscleanerrc` → `~/.atlasrc` → `.env`
  (migrates to `~/.dmrzl/config` in Phase 2)
- Container images auto-group across registries: same image name becomes
  one menu element, drill down per-registry
- `GITHUB_TOKEN` (Actions runner token) intentionally ignored to avoid
  CI permission issues
- All deletions require explicit confirmation in `sweep` mode
- `burn` requires `--yes` or falls back to interactive

---

## Migration Plan

### Phase 1 — nkrn

1. Create `iamvikshan/dmrzl` with the directory structure above
2. Move `iamvikshan/release-cleanup` source into `packages/nkrn/`
3. Verify: tests pass, `bun install -g` from root works
4. Extract config + prompts into `@dmrzl/core`
5. Verify: nkrn still works with core imports
6. Build `apps/cli` dispatcher (stub `whspr` and `rdnt`)
7. Verify: both `dmrzl nkrn sweep` and `nkrn sweep` work
8. Archive `iamvikshan/release-cleanup`
9. First dmrzl release

### Phase 2 — whspr

1. Move `iamvikshan/r2git` into `packages/whspr/`
2. Rename: `push`→`launch`, `pull`→`retrieve`, `diff`→`drift`, `cleanup`→`scavenge`
3. Migrate config to `~/.dmrzl/config` (backward compat with `~/.r2gitrc`)
4. Extract `vault.ts` into `@dmrzl/core`
5. Archive `iamvikshan/r2git`

### Phase 3 — rdnt

1. Extract sync engine from `iamvikshan/gitsync` GHA into `packages/rdnt/`
2. Build CLI: `tide`, `drift`, `anchor`, `rift`, `link`
3. Convert GHA to thin wrapper
4. Extract `github.ts`, `gitlab.ts` into `@dmrzl/core`
5. Archive `iamvikshan/gitsync`

---

## Development Guidelines

### Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Build:** `bun build --compile` for standalone binaries
- **Testing:** `bun test`
- **Package management:** Bun workspaces

### Code Style

- No emojis in output
- Spinners via `@clack/prompts` or equivalent
- Destructive operations: require confirmation in interactive, `--yes` in non-interactive
- Error messages are actionable: what went wrong AND what to do about it
- All multi-select menus support `a` (all), `i` (invert), `↑↓` navigation,
  and space to toggle

### Commit Convention

```
nkrn: add --keep flag to burn subcommand
whspr: fix symlink restoration on Windows
core: extract GitHub API client from nkrn
cli: add version output to --help
```

Prefix with the package name.

### Testing

```bash
# Per-package
cd packages/nkrn && bun test

# All
bun run --workspaces test

# Build standalone binary
bun run build:all

# Interactive smoke test
bun run src/index.ts
```

---

## Quick Reference

```
dmrzl  Unified binary. The org.
nkrn   Release cleaner. Sweep, burn, decay across GitHub, GitLab, registries.
whspr  R2 backup. Track, launch, retrieve, drift, scavenge.
rdnt   Git sync. Tide, drift, anchor, rift between GitHub and GitLab.
```
