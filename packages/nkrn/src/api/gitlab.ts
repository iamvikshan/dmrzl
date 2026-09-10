import axios from "axios"
import { Config, APIs, GitLabRelease, GitLabTag } from "../types"

/**
 * Create GitLab API client
 */
export function createGitLabApi(config: Config) {
  return axios.create({
    baseURL: "https://gitlab.com/api/v4",
    headers: {
      "PRIVATE-TOKEN": config.gitlab.token,
    },
  })
}

/**
 * Fetch GitLab releases and tags
 */
export async function fetchGitlabItems(
  gitlabApi: APIs["gitlabApi"],
  config: Config,
) {
  const projectId = encodeURIComponent(
    `${config.gitlab.owner}/${config.gitlab.repo}`,
  )

  const [releases, tags] = await Promise.all([
    gitlabApi
      .get<GitLabRelease[]>(`/projects/${projectId}/releases`)
      .then(res => res.data),
    gitlabApi
      .get<GitLabTag[]>(`/projects/${projectId}/repository/tags`)
      .then(res => res.data),
  ])

  return { releases, tags }
}

/**
 * Delete GitLab releases and tags
 */
export async function deleteGitlabItems(
  gitlabApi: APIs["gitlabApi"],
  config: Config,
  items: { releases?: GitLabRelease[]; tags?: GitLabTag[] },
) {
  const projectId = encodeURIComponent(
    `${config.gitlab.owner}/${config.gitlab.repo}`,
  )

  for (const release of items.releases || []) {
    await gitlabApi.delete(
      `/projects/${projectId}/releases/${release.tag_name}`,
    )
    console.log(` Deleted GitLab release: ${release.tag_name}`)
  }

  for (const tag of items.tags || []) {
    await gitlabApi.delete(`/projects/${projectId}/repository/tags/${tag.name}`)
    console.log(` Deleted GitLab tag: ${tag.name}`)
  }
}
