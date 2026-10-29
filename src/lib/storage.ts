import { Storage } from "@plasmohq/storage"

import { installExtensionContextGuard } from "./extension-context-guard"

installExtensionContextGuard()

// Shared storage instance for the entire extension
export const storage = new Storage({
  area: "local"
})
