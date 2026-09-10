import { AxiosInstance } from "axios"

export type Config = {
  github: {
    token: string
    owner: string
    repo: string
  }
  gitlab: {
    token: string
    owner: string
    repo: string
  }
  docker: {
    ghcrToken?: string
    ghcrOwner?: string
    ghcrPackage?: string
    gitlabToken?: string
    gitlabProject?: string
    dockerHubToken?: string
    dockerHubUsername?: string
    dockerHubRepository?: string
  }
}

export type APIs = {
  githubApi: AxiosInstance
  gitlabApi: AxiosInstance
  ghcrApi?: AxiosInstance
  gitlabRegistryApi?: AxiosInstance
  dockerHubApi?: AxiosInstance
}

export type GitHubRelease = {
  id: number
  tag_name: string
  name?: string
}

export type GitHubTag = {
  name: string
}

export type GitLabRelease = {
  tag_name: string
  name?: string
}

export type GitLabTag = {
  name: string
}

export type DockerImage = {
  id?: number | string
  name: string
  tags?: string[]
  digest?: string
  created_at?: string
  versions?: DockerImageVersion[]
}

export type DockerImageVersion = {
  id: number | string
  name?: string
  tags: string[]
  digest?: string
  created_at?: string
  size?: number
  package_name?: string
}

export type ImageGroup = {
  baseName: string
  registries: {
    ghcr?: DockerImage
    gitlab?: DockerImage
    dockerHub?: DockerImage
  }
  totalVersions: number
}

export type GroupedVersionSelection = {
  baseName: string
  ghcr: DockerImageVersion[]
  gitlab: DockerImageVersion[]
  dockerHub: DockerImageVersion[]
}

export type Items = {
  github: {
    releases: GitHubRelease[]
    tags: GitHubTag[]
  } | null
  gitlab: {
    releases: GitLabRelease[]
    tags: GitLabTag[]
  } | null
  docker: {
    ghcr: DockerImage[]
    gitlab: DockerImage[]
    dockerHub: DockerImage[]
  } | null
}

export type ItemsToDelete = {
  github: {
    releases: GitHubRelease[]
    tags: GitHubTag[]
  } | null
  gitlab: {
    releases: GitLabRelease[]
    tags: GitLabTag[]
  } | null
  docker: {
    ghcr: DockerImageVersion[]
    gitlab: DockerImageVersion[]
    dockerHub: DockerImageVersion[]
  } | null
}

export type PlatformNeeds = {
  github: boolean
  gitlab: boolean
  ghcr: boolean
  gitlabRegistry: boolean
  dockerHub: boolean
}
