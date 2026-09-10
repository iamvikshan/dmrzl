import { describe, test, expect } from "bun:test"
import { extractBaseName, groupImagesByName } from "./image-grouping"
import type { DockerImage } from "../types"

describe("extractBaseName", () => {
  test("extracts from ghcr.io path", () => {
    expect(extractBaseName("ghcr.io/user/gitpod-bun")).toBe("gitpod-bun")
  })

  test("extracts from gitlab registry path", () => {
    expect(extractBaseName("registry.gitlab.com/user/project/myapp")).toBe(
      "myapp",
    )
  })

  test("extracts from simple user/name", () => {
    expect(extractBaseName("devcontainers/bun-node")).toBe("bun-node")
  })

  test("returns full name when no slashes", () => {
    expect(extractBaseName("myapp")).toBe("myapp")
  })
})

describe("groupImagesByName", () => {
  test("groups same-name images across registries", () => {
    const images = {
      ghcr: [
        { name: "ghcr.io/user/myapp", id: 1, tags: ["v1", "v2"] },
      ] satisfies DockerImage[],
      gitlab: [
        { name: "registry.gitlab.com/user/proj/myapp", id: 2, tags: ["v3"] },
      ] satisfies DockerImage[],
      dockerHub: [] satisfies DockerImage[],
    }

    const groups = groupImagesByName(images)
    expect(groups).toHaveLength(1)
    expect(groups[0].baseName).toBe("myapp")
    expect(groups[0].registries.ghcr).toBeDefined()
    expect(groups[0].registries.gitlab).toBeDefined()
    expect(groups[0].registries.dockerHub).toBeUndefined()
    expect(groups[0].totalVersions).toBe(3)
  })

  test("keeps different images separate", () => {
    const images = {
      ghcr: [
        { name: "ghcr.io/user/app-a", id: 1, tags: ["v1"] },
        { name: "ghcr.io/user/app-b", id: 2, tags: ["v1"] },
      ] satisfies DockerImage[],
      gitlab: [] satisfies DockerImage[],
      dockerHub: [] satisfies DockerImage[],
    }

    const groups = groupImagesByName(images)
    expect(groups).toHaveLength(2)
    expect(groups.map(g => g.baseName).sort()).toEqual(["app-a", "app-b"])
  })

  test("sorts groups alphabetically", () => {
    const images = {
      ghcr: [
        { name: "ghcr.io/user/zebra", id: 1, tags: [] },
        { name: "ghcr.io/user/alpha", id: 2, tags: [] },
      ] satisfies DockerImage[],
      gitlab: [] satisfies DockerImage[],
      dockerHub: [] satisfies DockerImage[],
    }

    const groups = groupImagesByName(images)
    expect(groups[0].baseName).toBe("alpha")
    expect(groups[1].baseName).toBe("zebra")
  })

  test("handles empty inputs", () => {
    const groups = groupImagesByName({
      ghcr: [],
      gitlab: [],
      dockerHub: [],
    })
    expect(groups).toEqual([])
  })
})
