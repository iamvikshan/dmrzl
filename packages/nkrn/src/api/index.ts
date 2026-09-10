import { Config, APIs } from "../types"
import { createGitHubApi } from "./github"
import { createGitLabApi } from "./gitlab"
import { createDockerApis } from "./docker"

export * from "./github"
export * from "./gitlab"
export * from "./docker"

/**
 * Create all API clients based on configuration
 */
export function createApis(config: Config): APIs {
  const githubApi = createGitHubApi(config)
  const gitlabApi = createGitLabApi(config)

  let apis: APIs = { githubApi, gitlabApi }

  // Add Docker registry APIs
  apis = createDockerApis(config, apis)

  return apis
}
