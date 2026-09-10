import inquirer from "inquirer"
import {
  ImageGroup,
  GroupedVersionSelection,
  DockerImageVersion,
  APIs,
  Config,
} from "../types"
import { fetchDockerImageVersions, deleteDockerImages } from "../api"

/**
 * Format version display name with tag/digest and localized date
 */
function formatVersionChoice(version: DockerImageVersion): string {
  const identifier =
    version.tags && version.tags.length > 0
      ? version.tags.join(", ")
      : version.digest?.substring(0, 12) || version.id
  const date = version.created_at
    ? new Date(version.created_at).toLocaleDateString()
    : "unknown date"
  return `${identifier} (${date})`
}

/**
 * Select image groups to work with
 */
export async function selectImageGroups(
  groups: ImageGroup[],
): Promise<ImageGroup[]> {
  if (groups.length === 0) {
    console.log(" No container images found")
    return []
  }

  const choices = groups.map(group => {
    const registries = []
    if (group.registries.ghcr) registries.push("GHCR")
    if (group.registries.gitlab) registries.push("GitLab")
    if (group.registries.dockerHub) registries.push("Docker Hub")

    return {
      name: `${group.baseName} (${registries.join(", ")}) - ${group.totalVersions} total versions`,
      value: group,
      checked: true,
    }
  })

  // Set only first as checked
  if (choices.length > 0) {
    choices.forEach((c, i) => (c.checked = i === 0))
  }

  const { selected } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selected",
      message:
        " Select image groups to clean up (space to select, enter to confirm):",
      choices,
      pageSize: 15,
    },
  ])

  return selected
}

/**
 * Select versions for an image group across all registries
 */
export async function selectVersionsForGroup(
  group: ImageGroup,
  apis: APIs,
  config: Config,
): Promise<GroupedVersionSelection> {
  console.log(`\n Working on: ${group.baseName}`)

  const selection: GroupedVersionSelection = {
    baseName: group.baseName,
    ghcr: [],
    gitlab: [],
    dockerHub: [],
  }

  // GHCR versions
  if (group.registries.ghcr) {
    console.log(`\n Fetching GHCR versions...`)
    const versions = await fetchDockerImageVersions(
      apis,
      config,
      "ghcr",
      group.registries.ghcr,
    )

    if (versions.length > 0) {
      const versionChoices = versions.map((version: DockerImageVersion) => ({
        name: formatVersionChoice(version),
        value: version,
      }))

      const { selectedVersions } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "selectedVersions",
          message: ` [GHCR] Select versions of "${group.baseName}" to delete:`,
          choices: versionChoices,
          pageSize: 15,
        },
      ])

      selection.ghcr = selectedVersions
    }
  }

  // GitLab Registry versions
  if (group.registries.gitlab) {
    console.log(`\n Fetching GitLab Registry versions...`)
    const versions = await fetchDockerImageVersions(
      apis,
      config,
      "gitlab",
      group.registries.gitlab,
    )

    if (versions.length > 0) {
      const versionChoices = versions.map((version: DockerImageVersion) => ({
        name: formatVersionChoice(version),
        value: version,
      }))

      const { selectedVersions } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "selectedVersions",
          message: ` [GitLab] Select versions of "${group.baseName}" to delete:`,
          choices: versionChoices,
          pageSize: 15,
        },
      ])

      selection.gitlab = selectedVersions
    }
  }

  // Docker Hub versions
  if (group.registries.dockerHub) {
    console.log(`\n Fetching Docker Hub versions...`)
    const versions = await fetchDockerImageVersions(
      apis,
      config,
      "dockerhub",
      group.registries.dockerHub,
    )

    if (versions.length > 0) {
      const versionChoices = versions.map((version: DockerImageVersion) => ({
        name: formatVersionChoice(version),
        value: version,
      }))

      const { selectedVersions } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "selectedVersions",
          message: ` [Docker Hub] Select versions of "${group.baseName}" to delete:`,
          choices: versionChoices,
          pageSize: 15,
        },
      ])

      selection.dockerHub = selectedVersions
    }
  }

  return selection
}

/**
 * Confirm and delete one image group
 */
export async function confirmAndDeleteGroup(
  selection: GroupedVersionSelection,
  apis: APIs,
  config: Config,
): Promise<void> {
  const totalVersions =
    selection.ghcr.length + selection.gitlab.length + selection.dockerHub.length

  if (totalVersions === 0) {
    console.log(
      `\n No versions selected for "${selection.baseName}". Skipping...`,
    )
    return
  }

  console.log(`\n Summary for "${selection.baseName}":`)
  if (selection.ghcr.length > 0) {
    console.log(` • GHCR: ${selection.ghcr.length} versions`)
  }
  if (selection.gitlab.length > 0) {
    console.log(` • GitLab: ${selection.gitlab.length} versions`)
  }
  if (selection.dockerHub.length > 0) {
    console.log(` • Docker Hub: ${selection.dockerHub.length} versions`)
  }

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: ` Delete ${totalVersions} total versions of "${selection.baseName}"?`,
      default: false,
    },
  ])

  if (!confirm) {
    console.log(` Skipped "${selection.baseName}"`)
    return
  }

  // Perform deletion
  await deleteDockerImages(apis, config, {
    ghcr: selection.ghcr,
    gitlab: selection.gitlab,
    dockerHub: selection.dockerHub,
  })

  console.log(` Deleted versions of "${selection.baseName}"`)
}
