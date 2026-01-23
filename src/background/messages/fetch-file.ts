import type { PlasmoMessaging } from "@plasmohq/messaging";

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { url } = req.body;

  if (!url) {
    res.send({ error: "No URL provided" });
    return;
  }

  try {
    // Fetch from background
    const response = await fetch(url);

    if (!response.ok) {
      res.send({
        error: `Fetch failed: ${response.status} ${response.statusText}`,
      });
      return;
    }

    const blob = await response.blob();

    // Convert Blob to Base64 Data URI
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64DataUri = reader.result as string;
      // Send the full Data URL (e.g. "data:application/pdf;base64,.....")
      res.send({
        dataUri: base64DataUri,
        contentType: response.headers.get("content-type") || blob.type,
      });
    };
    reader.onerror = () => {
      res.send({ error: "Failed to read blob" });
    };
  } catch (error) {
    console.error("Background fetch error:", error);
    res.send({ error: String(error) });
  }
};

export default handler;
