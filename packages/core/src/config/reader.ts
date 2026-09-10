import inquirer from "inquirer"
import { homedir } from "node:os"
import { join } from "node:path"
import { Config, type PlatformNeeds } from "../types"
import { saveConfig, DEFAULT_RC_PATH } from "./saver"
import { validateRequired } from "../validation"

export type { PlatformNeeds }

type ConfigField = {
  id: string
  key: string
  label: string
  val: string
  isSecret?: boolean
  msg: string
}

export async function readRcFile(
  filePath: string,
): Promise<Record<string, string>> {
  const file = Bun.file(filePath)
  if (!(await file.exists())) return {}

  const content = await file.text()
  const result: Record<string, string> = {}

  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue

    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()

    if (/^['"].*['"]$/.test(value)) {
      value = value.slice(1, -1)
    }

    result[key] = value
  }
  return result
}

export function maskSecret(val: string): string {
  if (!val) return ""
  if (val.length <= 8) return "********"
  return `${val.slice(0, 4)}********${val.slice(-4)}`
}

export async function getConfig(platforms: PlatformNeeds): Promise<Config> {
  const localEnv = await readRcFile(join(process.cwd(), ".env"))
  const atlasRc = await readRcFile(join(homedir(), ".atlasrc"))
  const rlsCleanerRc = await readRcFile(DEFAULT_RC_PATH)

  const mergedEnv = {
    ...process.env,
    ...localEnv,
    ...atlasRc,
    ...rlsCleanerRc,
  }
  delete mergedEnv.GITHUB_TOKEN

  const fields: ConfigField[] = []

  if (platforms.github || platforms.ghcr) {
    fields.push({
      id: "githubToken",
      key: "GH_TOKEN",
      label: "GitHub Token",
      val: mergedEnv.GH_TOKEN || "",
      isSecret: true,
      msg: "Enter GitHub PAT:",
    })
    fields.push({
      id: "githubOwner",
      key: "GH_OWNER",
      label: "GitHub Owner",
      val: mergedEnv.GH_OWNER || mergedEnv.GL_OWNER || "",
      msg: "Enter GitHub username/org:",
    })
    if (platforms.github) {
      fields.push({
        id: "githubRepo",
        key: "GH_REPO",
        label: "GitHub Repo",
        val: mergedEnv.GH_REPO || mergedEnv.GL_REPO || "",
        msg: "Enter GitHub repo name:",
      })
    }
  }

  if (platforms.gitlab || platforms.gitlabRegistry) {
    fields.push({
      id: "gitlabToken",
      key: "GL_TOKEN",
      label: "GitLab Token",
      val: mergedEnv.GL_TOKEN || mergedEnv.GITLAB_TOKEN || "",
      isSecret: true,
      msg: "Enter GitLab PAT:",
    })
    fields.push({
      id: "gitlabOwner",
      key: "GL_OWNER",
      label: "GitLab Namespace",
      val: mergedEnv.GL_OWNER || mergedEnv.GH_OWNER || "",
      msg: "Enter GitLab namespace:",
    })
    if (platforms.gitlab) {
      fields.push({
        id: "gitlabRepo",
        key: "GL_REPO",
        label: "GitLab Repo",
        val: mergedEnv.GL_REPO || mergedEnv.GH_REPO || "",
        msg: "Enter GitLab repo name:",
      })
    }
    if (platforms.gitlabRegistry) {
      fields.push({
        id: "gitlabProject",
        key: "GL_PROJECT",
        label: "GitLab Project ID",
        val: mergedEnv.GL_PROJECT || "",
        msg: "Enter GitLab project ID/path:",
      })
    }
  }

  if (platforms.dockerHub) {
    fields.push({
      id: "dockerHubToken",
      key: "DOCKERHUB_TOKEN",
      label: "Docker Hub Token",
      val: mergedEnv.DOCKERHUB_TOKEN || "",
      isSecret: true,
      msg: "Enter Docker Hub token:",
    })
    fields.push({
      id: "dockerHubUsername",
      key: "DOCKER_HUB_USERNAME",
      label: "Docker Hub Username",
      val: mergedEnv.DOCKER_HUB_USERNAME || "",
      msg: "Enter Docker Hub username:",
    })
  }

  const existingFields = fields.filter(f => f.val.trim() !== "")
  const missingFields = fields.filter(f => f.val.trim() === "")

  const fieldsToPrompt = missingFields.map(f => f.id)
  let userAnswers: Record<string, string> = {}

  if (existingFields.length > 0) {
    console.log("")

    const { selectedToEdit } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedToEdit",
        message:
          "Review configuration. Select fields to edit (Space to select, Enter to confirm all):",
        choices: existingFields.map(f => ({
          name: `${f.label}: ${f.isSecret ? maskSecret(f.val) : f.val}`,
          value: f.id,
        })),
        pageSize: 15,
      },
    ])

    if (selectedToEdit.length > 0) {
      fieldsToPrompt.push(...selectedToEdit)
    }
  }

  if (fieldsToPrompt.length > 0) {
    console.log("")
    const questions = fields
      .filter(f => fieldsToPrompt.includes(f.id))
      .map(f => ({
        type: f.isSecret ? "password" : "input",
        name: f.id,
        message: f.msg,
        default: f.val || undefined,
        validate: (input: string) => validateRequired(input, f.label),
      }))

    userAnswers = await inquirer.prompt(questions)
  }

  const finalVals = fields.reduce(
    (acc, f) => {
      acc[f.id] = userAnswers[f.id] ?? f.val
      return acc
    },
    {} as Record<string, string>,
  )

  const finalConfig: Config = {
    github: {
      token: finalVals.githubToken || "",
      owner: finalVals.githubOwner || "",
      repo: finalVals.githubRepo || "",
    },
    gitlab: {
      token: finalVals.gitlabToken || "",
      owner: finalVals.gitlabOwner || "",
      repo: finalVals.gitlabRepo || "",
    },
    docker: {
      ghcrToken: finalVals.githubToken,
      ghcrOwner: finalVals.githubOwner,
      ghcrPackage: mergedEnv.GHCR_PACKAGE,
      gitlabToken: finalVals.gitlabToken,
      gitlabProject: finalVals.gitlabProject,
      dockerHubToken: finalVals.dockerHubToken,
      dockerHubUsername: finalVals.dockerHubUsername,
      dockerHubRepository: mergedEnv.DOCKER_HUB_REPO,
    },
  }

  if (Object.keys(userAnswers).length > 0) {
    console.log("\nSaving updated context to ~/.rlscleanerrc...")
    await saveConfig(userAnswers, platforms)
    console.log("Configuration updated for future runs.\n")
  }

  return finalConfig
}
