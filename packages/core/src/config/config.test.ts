import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { join } from "node:path"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { readRcFile, maskSecret } from "./reader"

describe("maskSecret", () => {
  test("masks long token showing first and last 4", () => {
    const result = maskSecret("ghp_abcdefghij1234")
    expect(result).toBe("ghp_********1234")
  })

  test("masks short token completely", () => {
    expect(maskSecret("short")).toBe("********")
  })

  test("returns empty for empty string", () => {
    expect(maskSecret("")).toBe("")
  })
})

describe("readRcFile", () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "dmrzl-test-"))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test("parses simple KEY=value", async () => {
    const path = join(tmpDir, ".env")
    await writeFile(path, "GH_TOKEN=abc123\nGH_OWNER=testuser\n")

    const result = await readRcFile(path)
    expect(result).toEqual({ GH_TOKEN: "abc123", GH_OWNER: "testuser" })
  })

  test("strips quotes from values", async () => {
    const path = join(tmpDir, ".env")
    await writeFile(path, "GH_TOKEN=\"quoted\"\nGL_TOKEN='single'\n")

    const result = await readRcFile(path)
    expect(result.GH_TOKEN).toBe("quoted")
    expect(result.GL_TOKEN).toBe("single")
  })

  test("skips comments and empty lines", async () => {
    const path = join(tmpDir, ".env")
    await writeFile(path, "# comment\n\nGH_TOKEN=abc\n# another\n")

    const result = await readRcFile(path)
    expect(Object.keys(result)).toEqual(["GH_TOKEN"])
  })

  test("returns empty object for missing file", async () => {
    const result = await readRcFile(join(tmpDir, "nonexistent"))
    expect(result).toEqual({})
  })

  test("handles values with = signs", async () => {
    const path = join(tmpDir, ".env")
    await writeFile(path, "TOKEN=base64==value\n")

    const result = await readRcFile(path)
    expect(result.TOKEN).toBe("base64==value")
  })
})
