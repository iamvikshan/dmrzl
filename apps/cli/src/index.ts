import { cleanup } from "@dmrzl/nkrn"

const args = process.argv.slice(2)
const tool = args[0]

if (!tool || tool === "--help" || tool === "-h") {
  console.log(`
dmrzl — unified CLI for release cleanup, backup, and sync

USAGE
  dmrzl <tool> [args...]

TOOLS
  nkrn    Release cleaner for GitHub, GitLab, and container registries.
  whspr   R2 backup. (coming soon)
  rdnt    Git sync. (coming soon)

Run 'dmrzl <tool> --help' for tool-specific help.
`)
  process.exit(0)
}

switch (tool) {
  case "nkrn":
    await cleanup()
    break
  case "whspr":
    console.error("whspr: not yet implemented")
    process.exit(1)
  case "rdnt":
    console.error("rdnt: not yet implemented")
    process.exit(1)
  default:
    console.error(`Unknown tool: ${tool}`)
    console.log("Run 'dmrzl --help' for available tools.")
    process.exit(1)
}
