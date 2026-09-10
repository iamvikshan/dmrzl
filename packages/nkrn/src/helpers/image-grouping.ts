import { DockerImage, ImageGroup } from "../types"

/**
 * Extract base image name from full registry path
 * Examples:
 * - ghcr.io/user/gitpod-bun → gitpod-bun
 * - registry.gitlab.com/user/project/gitpod-bun → gitpod-bun
 * - user/gitpod-bun → gitpod-bun
 * - devcontainers/bun-node → bun-node
 */
export function extractBaseName(fullName: string): string {
  const parts = fullName.split("/")
  return parts[parts.length - 1] || fullName
}

/**
 * Group images by base name across all registries
 * Images with the same base name from different registries are grouped together
 */
export function groupImagesByName(dockerImages: {
  ghcr: DockerImage[]
  gitlab: DockerImage[]
  dockerHub: DockerImage[]
}): ImageGroup[] {
  const groupMap = new Map<string, ImageGroup>()

  // Process GHCR images
  for (const image of dockerImages.ghcr) {
    const baseName = extractBaseName(image.name)
    if (!groupMap.has(baseName)) {
      groupMap.set(baseName, {
        baseName,
        registries: {},
        totalVersions: 0,
      })
    }
    const group = groupMap.get(baseName)!
    group.registries.ghcr = image
    group.totalVersions += image.tags?.length || 0
  }

  // Process GitLab images
  for (const image of dockerImages.gitlab) {
    const baseName = extractBaseName(image.name)
    if (!groupMap.has(baseName)) {
      groupMap.set(baseName, {
        baseName,
        registries: {},
        totalVersions: 0,
      })
    }
    const group = groupMap.get(baseName)!
    group.registries.gitlab = image
    group.totalVersions += image.tags?.length || 0
  }

  // Process Docker Hub images
  for (const image of dockerImages.dockerHub) {
    const baseName = extractBaseName(image.name)
    if (!groupMap.has(baseName)) {
      groupMap.set(baseName, {
        baseName,
        registries: {},
        totalVersions: 0,
      })
    }
    const group = groupMap.get(baseName)!
    group.registries.dockerHub = image
    group.totalVersions += image.tags?.length || 0
  }

  return Array.from(groupMap.values()).sort((a, b) =>
    a.baseName.localeCompare(b.baseName),
  )
}
