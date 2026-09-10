import axios from "axios"
import { Config, APIs, GitHubRelease, GitHubTag } from "../types"

/**
 * Create GitHub API client
 */
export function createGitHubApi(config: Config) {
  return axios.create({
    baseURL: "https://api.github.com",
    headers: {
      Authorization: `token ${config.github.token}`,
      Accept: "application/vnd.github.v3+json",
    },
  })
}

/**
 * Fetch GitHub releases and tags
 */
export async function fetchGithubItems(
  githubApi: APIs["githubApi"],
  config: Config,
) {
  const { owner, repo } = config.github

  const [releases, tags] = await Promise.all([
    githubApi
      .get<GitHubRelease[]>(`/repos/${owner}/${repo}/releases`)
      .then(res => res.data),
    githubApi
      .get<GitHubTag[]>(`/repos/${owner}/${repo}/tags`)
      .then(res => res.data),
  ])

  return { releases, tags }
}

/**
 * Delete GitHub releases and tags
 */
export async function deleteGithubItems(
  githubApi: APIs["githubApi"],
  config: Config,
  items: { releases?: GitHubRelease[]; tags?: GitHubTag[] },
) {
  const { owner, repo } = config.github

  for (const release of items.releases || []) {
    await githubApi.delete(`/repos/${owner}/${repo}/releases/${release.id}`)
    console.log(` Deleted GitHub release: ${release.tag_name}`)
  }

  for (const tag of items.tags || []) {
    await githubApi.delete(`/repos/${owner}/${repo}/git/refs/tags/${tag.name}`)
    console.log(` Deleted GitHub tag: ${tag.name}`)
  }
}
