import axios from "axios"
import { Config, APIs, DockerImage } from "../types"

/**
 * Create Docker registry API clients
 */
export function createDockerApis(config: Config, apis: APIs): APIs {
  // GHCR API (uses GitHub token)
  if (config.docker.ghcrToken) {
    apis.ghcrApi = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `token ${config.docker.ghcrToken}`,
        Accept: "application/vnd.github.package-deletes-preview+json",
      },
    })
  }

  // GitLab Container Registry API
  if (config.docker.gitlabToken) {
    apis.gitlabRegistryApi = axios.create({
      baseURL: "https://gitlab.com/api/v4",
      headers: {
        "PRIVATE-TOKEN": config.docker.gitlabToken,
      },
    })
  }

  // Docker Hub API
  if (config.docker.dockerHubToken) {
    apis.dockerHubApi = axios.create({
      baseURL: "https://hub.docker.com/v2",
    })
  }

  return apis
}

/**
 * Fetch container images from multiple registries
 */
export async function fetchDockerImages(
  apis: APIs,
  config: Config,
  registries?: Array<"ghcr" | "gitlab" | "dockerhub">,
): Promise<{
  ghcr: DockerImage[]
  gitlab: DockerImage[]
  dockerHub: DockerImage[]
}> {
  const targetRegistries = registries || ["ghcr", "gitlab", "dockerhub"]

  const results = {
    ghcr: [] as DockerImage[],
    gitlab: [] as DockerImage[],
    dockerHub: [] as DockerImage[],
  }

  // Fetch GHCR images
  if (
    targetRegistries.includes("ghcr") &&
    apis.ghcrApi &&
    config.docker.ghcrOwner
  ) {
    try {
      const response = await apis.ghcrApi.get(
        `/users/${config.docker.ghcrOwner}/packages?package_type=container&per_page=100`,
      )

      const packages: DockerImage[] = []
      for (const pkg of response.data) {
        try {
          const versionsResponse = await apis.ghcrApi.get(
            `/users/${config.docker.ghcrOwner}/packages/container/${encodeURIComponent(pkg.name)}/versions`,
          )
          packages.push({
            id: pkg.id,
            name: pkg.name,
            created_at: pkg.created_at,
            tags: versionsResponse.data
              .map((v: any) => v.metadata?.container?.tags || [])
              .flat(),
          })
        } catch (err) {
          console.error(
            ` Error fetching versions for ${pkg.name}:`,
            err instanceof Error ? err.message : String(err),
            "- Check network connectivity and GitHub API permissions.",
          )
        }
      }
      results.ghcr = packages
    } catch (error) {
      console.error(
        " Error fetching GHCR images:",
        error instanceof Error ? error.message : String(error),
        "- Verify GitHub token has read:packages permission and owner name is correct.",
      )
    }
  }

  // Fetch GitLab Registry images
  if (
    targetRegistries.includes("gitlab") &&
    apis.gitlabRegistryApi &&
    config.docker.gitlabProject
  ) {
    try {
      const projectId = encodeURIComponent(config.docker.gitlabProject)
      const response = await apis.gitlabRegistryApi.get(
        `/projects/${projectId}/registry/repositories`,
      )
      results.gitlab = response.data.map((repo: any) => ({
        id: repo.id,
        name: repo.path || repo.name,
        created_at: repo.created_at,
      }))
    } catch (error) {
      console.error(
        " Error fetching GitLab images:",
        error instanceof Error ? error.message : String(error),
        "- Verify GitLab token has api permission and project ID is correct.",
      )
    }
  }

  // Fetch Docker Hub images
  if (
    targetRegistries.includes("dockerhub") &&
    apis.dockerHubApi &&
    config.docker.dockerHubUsername &&
    config.docker.dockerHubToken
  ) {
    try {
      const authResponse = await axios.post(
        "https://hub.docker.com/v2/users/login",
        {
          username: config.docker.dockerHubUsername,
          password: config.docker.dockerHubToken,
        },
      )

      apis.dockerHubApi.defaults.headers.Authorization = `Bearer ${authResponse.data.token}`

      const reposResponse = await apis.dockerHubApi.get(
        `/repositories/${config.docker.dockerHubUsername}/`,
      )

      results.dockerHub = reposResponse.data.results.map((repo: any) => ({
        name: repo.name,
        id: `${repo.namespace}/${repo.name}`,
        created_at: repo.last_updated,
        tags: [],
      }))
    } catch (error) {
      console.error(
        " Error fetching Docker Hub images:",
        error instanceof Error ? error.message : String(error),
        "- Check Docker Hub credentials and ensure the token has repository read permissions.",
      )
    }
  }

  return results
}

/**
 * Fetch versions for a specific Docker image
 */
export async function fetchDockerImageVersions(
  apis: APIs,
  config: Config,
  registry: "ghcr" | "gitlab" | "dockerhub",
  image: any,
): Promise<any[]> {
  try {
    if (registry === "ghcr" && apis.ghcrApi && config.docker.ghcrOwner) {
      const response = await apis.ghcrApi.get(
        `/users/${config.docker.ghcrOwner}/packages/container/${encodeURIComponent(image.name)}/versions`,
      )

      return response.data.map((v: any) => ({
        id: v.id,
        name: v.name,
        tags: v.metadata?.container?.tags || [],
        digest: v.name,
        created_at: v.created_at,
        package_name: image.name,
      }))
    }

    if (
      registry === "gitlab" &&
      apis.gitlabRegistryApi &&
      config.docker.gitlabProject
    ) {
      const projectId = encodeURIComponent(config.docker.gitlabProject)
      const response = await apis.gitlabRegistryApi.get(
        `/projects/${projectId}/registry/repositories/${image.id}/tags`,
      )

      return response.data.map((tag: any) => ({
        id: tag.name,
        name: tag.name,
        tags: [tag.name],
        digest: tag.digest,
        created_at: tag.created_at,
        size: tag.total_size,
        package_name: image.name,
        repository_id: image.id,
      }))
    }

    if (
      registry === "dockerhub" &&
      apis.dockerHubApi &&
      config.docker.dockerHubUsername
    ) {
      const response = await apis.dockerHubApi.get(
        `/repositories/${config.docker.dockerHubUsername}/${image.name}/tags?page_size=100`,
      )

      return response.data.results.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        tags: [tag.name],
        digest: tag.digest,
        created_at: tag.last_updated,
        size: tag.full_size,
        package_name: image.name,
      }))
    }
  } catch (error) {
    console.error(
      ` Error fetching versions for ${image.name}:`,
      error instanceof Error ? error.message : String(error),
      "- Verify API credentials and network connectivity.",
    )
  }

  return []
}

/**
 * Delete Docker image versions across registries
 */
export async function deleteDockerImages(
  apis: APIs,
  config: Config,
  items: {
    ghcr?: any[]
    gitlab?: any[]
    dockerHub?: any[]
  },
) {
  // Delete GHCR image versions
  if (apis.ghcrApi && items.ghcr && config.docker.ghcrOwner) {
    for (const version of items.ghcr) {
      try {
        await apis.ghcrApi.delete(
          `/users/${config.docker.ghcrOwner}/packages/container/${encodeURIComponent(version.package_name)}/versions/${version.id}`,
        )
        const tagInfo =
          version.tags && version.tags.length > 0
            ? ` (${version.tags.join(", ")})`
            : ""
        console.log(` Deleted GHCR version: ${version.package_name}${tagInfo}`)
      } catch (error) {
        console.error(
          ` Error deleting GHCR version ${version.package_name}:`,
          error instanceof Error ? error.message : String(error),
          "- Ensure GitHub token has delete:packages permission.",
        )
      }
    }
  }

  // Delete GitLab Registry image tags
  if (apis.gitlabRegistryApi && items.gitlab && config.docker.gitlabProject) {
    for (const version of items.gitlab) {
      if (!version.repository_id) {
        console.error(
          ` Skipping GitLab tag ${version.package_name}:${version.name}: missing repository_id`,
        )
        continue
      }
      try {
        const projectId = encodeURIComponent(config.docker.gitlabProject)
        await apis.gitlabRegistryApi.delete(
          `/projects/${projectId}/registry/repositories/${version.repository_id}/tags/${version.name}`,
        )
        console.log(
          ` Deleted GitLab Registry tag: ${version.package_name}:${version.name}`,
        )
      } catch (error) {
        console.error(
          ` Error deleting GitLab tag ${version.package_name}:${version.name}:`,
          error instanceof Error ? error.message : String(error),
          "- Verify GitLab token has api permission and repository access.",
        )
      }
    }
  }

  // Delete Docker Hub image tags
  if (
    apis.dockerHubApi &&
    items.dockerHub &&
    config.docker.dockerHubUsername &&
    config.docker.dockerHubToken
  ) {
    try {
      const authResponse = await axios.post(
        "https://hub.docker.com/v2/users/login",
        {
          username: config.docker.dockerHubUsername,
          password: config.docker.dockerHubToken,
        },
      )

      apis.dockerHubApi.defaults.headers.Authorization = `Bearer ${authResponse.data.token}`

      for (const version of items.dockerHub) {
        try {
          await apis.dockerHubApi.delete(
            `/repositories/${config.docker.dockerHubUsername}/${version.package_name}/tags/${version.name}/`,
          )
          console.log(
            ` Deleted Docker Hub tag: ${version.package_name}:${version.name}`,
          )
        } catch (error) {
          console.error(
            ` Error deleting Docker Hub tag ${version.package_name}:${version.name}:`,
            error instanceof Error ? error.message : String(error),
            "- Confirm Docker Hub token has write permissions for the repository.",
          )
        }
      }
    } catch (error) {
      console.error(
        " Error authenticating with Docker Hub:",
        error instanceof Error ? error.message : String(error),
        "- Verify Docker Hub username and token are correct.",
      )
    }
  }
}
