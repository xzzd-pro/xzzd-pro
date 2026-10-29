import type { PlasmoMessaging } from "@plasmohq/messaging"

import { applyPayloadIndexOp, isPayloadIndexOp } from "../payload-index"

/**
 * Applies a change to the attachment payload index for a content script.
 * Request body: a PayloadIndexOp. Responds with `{ ok: true }`, or
 * `{ ok: false, error }` if the body is invalid or the write fails.
 */
const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  if (!isPayloadIndexOp(req.body)) {
    res.send({ ok: false, error: "Invalid payload index change" })
    return
  }
  try {
    await applyPayloadIndexOp(req.body)
    res.send({ ok: true })
  } catch (error) {
    res.send({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export default handler
