import inquirer from "inquirer"
import { Items, ItemsToDelete } from "../types"
import {
  createApis,
  fetchGithubItems,
  fetchGitlabItems,
  fetchDockerImages,
  deleteGithubItems,
  deleteGitlabItems,
} from "../api"
import { getConfig } from "./config"
import {
  selectWhatToDelete,
  selectPlatforms,
  selectItems,
  selectImageGroups,
  selectVersionsForGroup,
  confirmAndDeleteGroup,
} from "../cli"
import { groupImagesByName } from "../helpers"

/**
 * Main cleanup orchestration function
 */
export async function cleanup(): Promise<void> {
  try {
    console.log(" Welcome to Release Cleanup Tool!\n")

    let whatToDelete
    let platforms

    // Step 1: What to delete? (with back navigation loop)
    while (true) {
      whatToDelete = await selectWhatToDelete()

      if (whatToDelete.goBack) {
        // Can't go back from first step, restart
        continue
      }

      // Step 2: From where? (with back navigation)
      const platformsResult = await selectPlatforms({
        needGitPlatforms:
          whatToDelete.deleteReleases || whatToDelete.deleteTags,
        needContainerRegistries: whatToDelete.deleteContainers,
      })

      if (platformsResult.goBack) {
        // Go back to step 1
        console.log("\n")
        continue
      }

      platforms = platformsResult
      break // Both steps completed, exit loop
    }

    // Check if any platform was selected
    const anyPlatformSelected =
      platforms.github ||
      platforms.gitlab ||
      platforms.ghcr ||
      platforms.gitlabRegistry ||
      platforms.dockerHub

    if (!anyPlatformSelected) {
      console.log(" No platforms selected. Exiting...")
      return
    }

    console.log("\n Configuration Summary:")
    console.log("━".repeat(50))
    if (whatToDelete.deleteReleases) console.log("✓ Deleting releases")
    if (whatToDelete.deleteTags) console.log("✓ Deleting tags")
    if (whatToDelete.deleteContainers) console.log("✓ Deleting containers")
    console.log("\n From platforms:")
    if (platforms.github) console.log(" • GitHub")
    if (platforms.gitlab) console.log(" • GitLab")
    if (platforms.ghcr) console.log(" • GitHub Container Registry (GHCR)")
    if (platforms.gitlabRegistry) console.log(" • GitLab Container Registry")
    if (platforms.dockerHub) console.log(" • Docker Hub")
    console.log("━".repeat(50) + "\n")

    // Get configuration (will prompt for missing credentials and save to .env)
    const config = await getConfig(platforms)
    const apis = createApis(config)

    // Fetch items from selected platforms
    console.log(" Fetching items...\n")

    const items: Items = {
      github: platforms.github
        ? await fetchGithubItems(apis.githubApi, config)
        : null,
      gitlab: platforms.gitlab
        ? await fetchGitlabItems(apis.gitlabApi, config)
        : null,
      docker:
        platforms.ghcr || platforms.gitlabRegistry || platforms.dockerHub
          ? await fetchDockerImages(apis, config, [
              ...(platforms.ghcr ? ["ghcr" as const] : []),
              ...(platforms.gitlabRegistry ? ["gitlab" as const] : []),
              ...(platforms.dockerHub ? ["dockerhub" as const] : []),
            ])
          : null,
    }

    // Step 3: Select specific items to delete
    const toDelete: ItemsToDelete = {
      github:
        items.github && platforms.github
          ? {
              releases: whatToDelete.deleteReleases
                ? await selectItems(items.github.releases, "releases", "GitHub")
                : [],
              tags: whatToDelete.deleteTags
                ? await selectItems(items.github.tags, "tags", "GitHub")
                : [],
            }
          : null,
      gitlab:
        items.gitlab && platforms.gitlab
          ? {
              releases: whatToDelete.deleteReleases
                ? await selectItems(items.gitlab.releases, "releases", "GitLab")
                : [],
              tags: whatToDelete.deleteTags
                ? await selectItems(items.gitlab.tags, "tags", "GitLab")
                : [],
            }
          : null,
      docker: null, // Will be handled differently with grouped approach
    }

    // Handle container cleanup with grouped approach
    if (items.docker && whatToDelete.deleteContainers) {
      // Group images by base name across registries
      const imageGroups = groupImagesByName(items.docker)

      if (imageGroups.length > 0) {
        // Select which groups to work with
        const selectedGroups = await selectImageGroups(imageGroups)

        if (selectedGroups.length > 0) {
          for (const group of selectedGroups) {
            // Select versions for this group across all registries
            const versionSelection = await selectVersionsForGroup(
              group,
              apis,
              config,
            )

            // Confirm and delete this group
            await confirmAndDeleteGroup(versionSelection, apis, config)

            // Ask if user wants to continue with next group
            if (selectedGroups.indexOf(group) < selectedGroups.length - 1) {
              const { continueNext } = await inquirer.prompt([
                {
                  type: "confirm",
                  name: "continueNext",
                  message: " Continue with next image group?",
                  default: true,
                },
              ])

              if (!continueNext) {
                console.log("\n Skipping remaining groups...")
                break
              }
            }
          }
        }
      }
    }

    // Count total items to delete (releases and tags only, containers already handled)
    const totalToDelete =
      (toDelete.github?.releases.length || 0) +
      (toDelete.github?.tags.length || 0) +
      (toDelete.gitlab?.releases.length || 0) +
      (toDelete.gitlab?.tags.length || 0)

    if (totalToDelete === 0) {
      console.log("\n Cleanup completed.")
      return
    }

    console.log(`\n Total releases/tags to delete: ${totalToDelete}`)

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: " Are you sure you want to delete the selected releases/tags?",
        default: false,
      },
    ])

    if (!confirm) {
      console.log(" Operation cancelled")
      return
    }

    console.log("\n Starting cleanup...\n")

    const operations: Promise<void>[] = []

    if (
      toDelete.github &&
      (toDelete.github.releases.length > 0 || toDelete.github.tags.length > 0)
    ) {
      operations.push(
        deleteGithubItems(apis.githubApi, config, toDelete.github).catch(
          error => {
            console.error(" GitHub Error:", error.message)
          },
        ),
      )
    }

    if (
      toDelete.gitlab &&
      (toDelete.gitlab.releases.length > 0 || toDelete.gitlab.tags.length > 0)
    ) {
      operations.push(
        deleteGitlabItems(apis.gitlabApi, config, toDelete.gitlab).catch(
          error => {
            console.error(" GitLab Error:", error.message)
          },
        ),
      )
    }

    await Promise.all(operations)
    console.log("\n Cleanup completed successfully!")
  } catch (error) {
    console.error(
      "\n Error:",
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}
