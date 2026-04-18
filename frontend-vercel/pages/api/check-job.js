const DEFAULT_HF_SPACE_URL = "https://your-username-your-space.hf.space";

function getPredictEndpoint() {
  const baseUrl = (process.env.HF_SPACE_URL || DEFAULT_HF_SPACE_URL).replace(/\/+$/, "");
  return `${baseUrl}/run/predict`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";

  if (!description) {
    return res.status(400).json({ error: "description is required" });
  }

  const endpoint = getPredictEndpoint();

  try {
    const hfResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: [description],
      }),
    });

    const responseText = await hfResponse.text();
    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch {
      return res.status(502).json({
        error: "Invalid response from Hugging Face backend",
        details: responseText.slice(0, 300),
      });
    }

    if (!hfResponse.ok) {
      return res.status(hfResponse.status).json({
        error: "Hugging Face backend returned an error",
        details: payload,
      });
    }

    const prediction = Array.isArray(payload?.data) ? payload.data[0] : null;

    if (!prediction) {
      return res.status(502).json({
        error: "Unexpected Hugging Face response format",
        details: payload,
      });
    }

    return res.status(200).json({ prediction });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to reach Hugging Face backend",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
