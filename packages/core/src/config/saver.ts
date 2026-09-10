import { homedir } from "node:os"
import { join } from "node:path"
import { chmod } from "node:fs/promises"
import type { PlatformNeeds } from "../types"

export const DEFAULT_RC_PATH = join(homedir(), ".rlscleanerrc")

export async function saveConfig(
  answers: Record<string, string>,
  platforms: PlatformNeeds,
  rcPath: string = DEFAULT_RC_PATH,
): Promise<void> {
  const file = Bun.file(rcPath)

  let content = ""
  let originalContent = ""

  if (await file.exists()) {
    originalContent = await file.text()
    content = originalContent
  }

  const newVars: string[] = []

  const addVar = (key: string, value: string | undefined) => {
    const trimmed = value?.trim()
    if (trimmed && !/[\r\n]/.test(trimmed)) {
      const newLine = `${key}="${trimmed}"`
      const regex = new RegExp(`^${key}=.*$`, "gm")

      if (regex.test(content)) {
        content = content.replace(regex, () => newLine)
      } else if (!newVars.includes(newLine)) {
        newVars.push(newLine)
      }
    }
  }

  addVar("GH_TOKEN", answers.githubToken)
  addVar("GH_OWNER", answers.githubOwner)
  addVar("GH_REPO", answers.githubRepo)

  addVar("GL_TOKEN", answers.gitlabToken)
  addVar("GL_OWNER", answers.gitlabOwner)
  addVar("GL_REPO", answers.gitlabRepo)
  addVar("GL_PROJECT", answers.gitlabProject)

  if (platforms.ghcr) {
    addVar("GHCR_TOKEN", answers.githubToken)
    addVar("GHCR_OWNER", answers.githubOwner)
  }

  addVar("DOCKERHUB_TOKEN", answers.dockerHubToken)
  addVar("DOCKER_HUB_USERNAME", answers.dockerHubUsername)

  const shouldWrite = newVars.length > 0 || content !== originalContent
  if (shouldWrite) {
    const header =
      originalContent.length === 0
        ? "# Release Cleanup Global Configuration\n# Auto-generated - DO NOT COMMIT\n\n"
        : ""

    const appendedVars =
      newVars.length > 0
        ? (content.endsWith("\n") || content === "" ? "" : "\n") +
          newVars.join("\n") +
          "\n"
        : ""

    const newContent = header + content + appendedVars

    await Bun.write(rcPath, newContent)
  }

  // Always enforce restrictive permissions on config files that may hold tokens
  if (await file.exists()) {
    await chmod(rcPath, 0o600)
  }
}
