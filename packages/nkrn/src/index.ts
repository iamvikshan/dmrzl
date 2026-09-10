export { cleanup } from "./core"
export { getConfig, type PlatformNeeds } from "./core/config"

// Run the cleanup tool when executed directly
import { cleanup } from "./core"

if (import.meta.main) {
  cleanup().catch(console.error)
}
