import { Storage } from "@plasmohq/storage"
import { installExtensionContextGuard } from "./extensionContextGuard"

installExtensionContextGuard()

// Shared storage instance for the entire extension
export const storage = new Storage({
  area: "local"
})
