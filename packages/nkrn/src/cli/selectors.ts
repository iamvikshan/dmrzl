import inquirer from "inquirer"
import { GitHubRelease, GitHubTag, GitLabRelease, GitLabTag } from "../types"

/**
 * Step 3: Select specific releases or tags to delete
 */
export async function selectItems<
  T extends GitHubRelease | GitHubTag | GitLabRelease | GitLabTag,
>(items: T[], type: "releases" | "tags", platform: string): Promise<T[]> {
  if (items.length === 0) {
    console.log(` No ${type} found on ${platform}`)
    return []
  }

  const choices = items.map(item => ({
    name:
      type === "releases"
        ? `${(item as GitHubRelease | GitLabRelease).tag_name} - ${(item as GitHubRelease | GitLabRelease).name || "No title"}`
        : (item as GitHubTag | GitLabTag).name,
    value: item,
  }))

  const { selected } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selected",
      message: ` Select ${platform} ${type} to delete (space to select, enter to confirm):`,
      choices,
      pageSize: 15,
    },
  ])

  if (selected.length === 0) {
    console.log(` No ${type} selected from ${platform}. Skipping...`)
    return []
  }

  return selected
}
