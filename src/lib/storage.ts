import { Storage } from "@plasmohq/storage"

// Shared storage instance for the entire extension
export const storage = new Storage({
  area: "local"
})
