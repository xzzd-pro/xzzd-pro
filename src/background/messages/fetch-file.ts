import type { PlasmoMessaging } from "@plasmohq/messaging";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    res.send({ error: "No URL provided" });
    return;
  }

  try {
    const response = await fetch(url, {
      credentials: "include"
    });

    if (!response.ok) {
      res.send({
        error: `Fetch failed: ${response.status} ${response.statusText}`,
      });
      return;
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const dataUri = `data:${contentType};base64,${arrayBufferToBase64(
      await response.arrayBuffer()
    )}`;

    res.send({
      dataUri,
      contentType,
    });
  } catch (error) {
    console.error("Background fetch error:", error);
    res.send({
      error:
        "Background fetch failed. VPN/proxy may trigger extension CORS restrictions."
    });
  }
};

export default handler;
