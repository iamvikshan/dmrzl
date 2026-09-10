import inquirer from "inquirer"

export const BACK_OPTION = "← Go Back"

/**
 * Step 1: Ask what to delete
 */
export async function selectWhatToDelete(): Promise<
  | {
      deleteReleases: boolean
      deleteTags: boolean
      deleteContainers: boolean
      goBack: false
    }
  | { goBack: true }
> {
  const { whatToDelete } = await inquirer.prompt([
    {
      type: "select",
      name: "whatToDelete",
      message: " What do you want to delete?",
      default: "releases",
      choices: [
        { name: "Releases only", value: "releases" },
        { name: "Tags only", value: "tags" },
        { name: "Containers only", value: "containers" },
        { name: "Releases & Tags", value: "releases-tags" },
        {
          name: "Everything Everywhere All at Once ",
          value: "everything",
        },
        new inquirer.Separator(),
        { name: " Exit", value: "exit" },
      ],
    },
  ])

  if (whatToDelete === "exit") {
    process.exit(0)
  }

  return {
    deleteReleases: ["releases", "releases-tags", "everything"].includes(
      whatToDelete,
    ),
    deleteTags: ["tags", "releases-tags", "everything"].includes(whatToDelete),
    deleteContainers: ["containers", "everything"].includes(whatToDelete),
    goBack: false,
  }
}

/**
 * Step 2: Ask which platforms to use
 */
export async function selectPlatforms(options: {
  needGitPlatforms: boolean
  needContainerRegistries: boolean
}): Promise<
  | {
      github: boolean
      gitlab: boolean
      ghcr: boolean
      gitlabRegistry: boolean
      dockerHub: boolean
      goBack: false
    }
  | { goBack: true }
> {
  const platforms: {
    github: boolean
    gitlab: boolean
    ghcr: boolean
    gitlabRegistry: boolean
    dockerHub: boolean
  } = {
    github: false,
    gitlab: false,
    ghcr: false,
    gitlabRegistry: false,
    dockerHub: false,
  }

  // Ask for Git platforms if we need releases/tags
  if (options.needGitPlatforms) {
    const { gitPlatforms } = await inquirer.prompt([
      {
        type: "select",
        name: "gitPlatforms",
        message: " From where do you want to delete?",
        default: "github",
        choices: [
          { name: "GitHub", value: "github" },
          { name: "GitLab", value: "gitlab" },
          { name: "Everywhere", value: "everywhere" },
          new inquirer.Separator(),
          { name: BACK_OPTION, value: "back" },
        ],
      },
    ])

    if (gitPlatforms === "back") {
      return { goBack: true }
    }

    platforms.github = ["github", "everywhere"].includes(gitPlatforms)
    platforms.gitlab = ["gitlab", "everywhere"].includes(gitPlatforms)

    // If selecting containers and chose "everywhere", auto-select all container registries
    if (options.needContainerRegistries && gitPlatforms === "everywhere") {
      platforms.ghcr = true
      platforms.gitlabRegistry = true
      platforms.dockerHub = true
      return { ...platforms, goBack: false as const }
    }

    // If we also need containers and GitHub is selected, auto-select GHCR
    if (options.needContainerRegistries && platforms.github) {
      platforms.ghcr = true
    }
  }

  // Ask for container registries if we need them and didn't select "everywhere"
  if (options.needContainerRegistries) {
    const choices = []

    // Only show GHCR if GitHub wasn't already selected
    if (!platforms.ghcr) {
      choices.push({
        name: "GitHub Container Registry (GHCR)",
        value: "ghcr",
        checked: true,
      })
    }

    choices.push(
      { name: "GitLab Container Registry", value: "gitlab-registry" },
      { name: "Docker Hub", value: "dockerhub" },
      { name: "Everywhere", value: "all-containers" },
      new inquirer.Separator(),
      { name: BACK_OPTION, value: "back" },
    )

    const { containerRegistries } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "containerRegistries",
        message:
          " Select container registries (space to select, enter to confirm):",
        choices,
      },
    ])

    // Check if back was selected
    if (containerRegistries.includes("back")) {
      return { goBack: true }
    }

    if (containerRegistries.includes("all-containers")) {
      platforms.ghcr = true
      platforms.gitlabRegistry = true
      platforms.dockerHub = true
    } else {
      if (!platforms.ghcr) {
        platforms.ghcr = containerRegistries.includes("ghcr")
      }
      platforms.gitlabRegistry = containerRegistries.includes("gitlab-registry")
      platforms.dockerHub = containerRegistries.includes("dockerhub")
    }
  }

  return { ...platforms, goBack: false as const }
}
