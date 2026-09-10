import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { join } from "node:path"
import { readFile, writeFile, unlink, mkdir, mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { saveConfig } from "./saver"
import type { PlatformNeeds } from "./reader"

const ALL_PLATFORMS: PlatformNeeds = {
  github: true,
  gitlab: true,
  ghcr: true,
  gitlabRegistry: true,
  dockerHub: true,
}

describe("saveConfig", () => {
  let testDir: string
  let testRcPath: string

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "saver-test-"))
    testRcPath = join(testDir, ".rlscleanerrc")
  })

  afterEach(async () => {
    try {
      await unlink(testRcPath)
    } catch {
      // file might not exist, that's fine
    }
  })

  test("creates new rc file with provided values", async () => {
    await saveConfig(
      { githubToken: "ghp_test_abc123", githubOwner: "testuser" },
      ALL_PLATFORMS,
      testRcPath,
    )

    const content = await readFile(testRcPath, "utf8")
    expect(content).toContain('GH_TOKEN="ghp_test_abc123"')
    expect(content).toContain('GH_OWNER="testuser"')
    expect(content).toContain("Release Cleanup Global Configuration")
  })

  test("updates existing values instead of duplicating", async () => {
    await writeFile(testRcPath, 'GH_TOKEN="old_value"\nGH_OWNER="olduser"\n')

    await saveConfig(
      { githubToken: "new_token_value", githubOwner: "newuser" },
      ALL_PLATFORMS,
      testRcPath,
    )

    const content = await readFile(testRcPath, "utf8")
    expect(content).toContain('GH_TOKEN="new_token_value"')
    expect(content).toContain('GH_OWNER="newuser"')
    expect(content).not.toContain("old_value")
    // Should not have duplicates
    const tokenLines = content
      .split("\n")
      .filter(l => l.startsWith("GH_TOKEN="))
    expect(tokenLines).toHaveLength(1)
  })

  test("skips empty values", async () => {
    await saveConfig(
      { githubToken: "", githubOwner: "user" },
      ALL_PLATFORMS,
      testRcPath,
    )

    const content = await readFile(testRcPath, "utf8")
    expect(content).not.toContain("GH_TOKEN")
    expect(content).toContain('GH_OWNER="user"')
  })
})
