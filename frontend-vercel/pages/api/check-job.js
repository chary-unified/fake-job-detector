const DEFAULT_HF_SPACE_URL = "https://your-username-your-space.hf.space";
const DEFAULT_HF_API_NAME = "detect_fake_job";
const DIRECT_ENDPOINTS = ["/run/predict", "/gradio_api/run/predict", "/gradio_api/run/detect_fake_job"];

function parseJsonSafe(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getBaseUrl() {
  const configuredUrl = (process.env.HF_SPACE_URL || DEFAULT_HF_SPACE_URL).trim();

  try {
    const parsedUrl = new URL(configuredUrl);

    // Allow users to set either huggingface.co/spaces/... or *.hf.space.
    if (parsedUrl.hostname === "huggingface.co") {
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      if (pathParts.length >= 3 && pathParts[0] === "spaces") {
        const owner = pathParts[1];
        const space = pathParts[2];
        return `https://${owner}-${space}.hf.space`;
      }
    }
  } catch {
    // Fall back to raw value below.
  }

  return configuredUrl.replace(/\/+$/, "");
}

function getApiName() {
  const configuredName = (process.env.HF_API_NAME || DEFAULT_HF_API_NAME).trim();
  return configuredName.startsWith("/") ? configuredName.slice(1) : configuredName;
}

function normalizePrediction(rawPrediction) {
  if (Array.isArray(rawPrediction)) {
    return normalizePrediction(rawPrediction[0]);
  }

  if (rawPrediction && typeof rawPrediction === "object") {
    if (typeof rawPrediction.result === "string") {
      return {
        result: rawPrediction.result,
        reason: typeof rawPrediction.reason === "string" ? rawPrediction.reason : "",
      };
    }

    if (typeof rawPrediction.label === "string") {
      return {
        result: rawPrediction.label,
        reason: typeof rawPrediction.reason === "string" ? rawPrediction.reason : "",
      };
    }
  }

  if (typeof rawPrediction === "string") {
    const looksFake = /\bfake\b|fraud|scam|fee|money|payment|warning/i.test(rawPrediction);
    return {
      result: looksFake ? "Fake Job" : "Real Job",
      reason: rawPrediction,
    };
  }

  return null;
}

function extractPredictionFromPayload(payload) {
  if (Array.isArray(payload?.data)) {
    return normalizePrediction(payload.data[0]);
  }

  return normalizePrediction(payload);
}

function parseSseDataByEvent(sseText, eventName) {
  if (typeof sseText !== "string" || !sseText) {
    return null;
  }

  const blocks = sseText.split("\n\n");

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim());
    const eventLine = lines.find((line) => line.startsWith("event:"));

    if (!eventLine) {
      continue;
    }

    const currentEvent = eventLine.replace("event:", "").trim();
    if (currentEvent !== eventName) {
      continue;
    }

    const dataLines = lines.filter((line) => line.startsWith("data:"));
    if (!dataLines.length) {
      return "";
    }

    return dataLines.map((line) => line.replace("data:", "").trim()).join("\n");
  }

  return null;
}

async function runDirectEndpoint(baseUrl, endpointPath, description) {
  const response = await fetch(`${baseUrl}${endpointPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [description],
    }),
  });

  const text = await response.text();
  const payload = parseJsonSafe(text);

  return { response, text, payload };
}

async function delay(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runQueuedEndpoint(baseUrl, apiName, description) {
  const startResponse = await fetch(`${baseUrl}/gradio_api/call/${apiName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [description],
    }),
  });

  const startText = await startResponse.text();
  const startPayload = parseJsonSafe(startText);

  if (!startResponse.ok) {
    throw new Error(`Queue start failed: ${startText.slice(0, 300)}`);
  }

  const eventId = typeof startPayload?.event_id === "string" ? startPayload.event_id : "";
  if (!eventId) {
    throw new Error(`Queue start returned no event_id: ${startText.slice(0, 300)}`);
  }

  const resultUrl = `${baseUrl}/gradio_api/call/${apiName}/${eventId}`;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const resultResponse = await fetch(resultUrl, {
      method: "GET",
      headers: {
        Accept: "text/event-stream, application/json",
      },
    });

    const resultText = await resultResponse.text();

    if (!resultResponse.ok) {
      throw new Error(`Queue read failed: ${resultText.slice(0, 300)}`);
    }

    const completeData = parseSseDataByEvent(resultText, "complete");
    if (completeData !== null) {
      const parsedComplete = parseJsonSafe(completeData);

      if (Array.isArray(parsedComplete)) {
        return parsedComplete[0];
      }

      if (parsedComplete && Array.isArray(parsedComplete.data)) {
        return parsedComplete.data[0];
      }

      return parsedComplete ?? completeData;
    }

    const errorData = parseSseDataByEvent(resultText, "error");
    if (errorData !== null) {
      throw new Error(`Queue returned error: ${errorData.slice(0, 300)}`);
    }

    await delay(700);
  }

  throw new Error("Timed out waiting for Hugging Face queue result");
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

  const baseUrl = getBaseUrl();
  const apiName = getApiName();
  const directErrors = [];

  try {
    for (const endpointPath of DIRECT_ENDPOINTS) {
      const { response, text, payload } = await runDirectEndpoint(baseUrl, endpointPath, description);

      const prediction = extractPredictionFromPayload(payload);
      if (response.ok && prediction) {
        return res.status(200).json({ prediction });
      }

      directErrors.push({
        endpoint: endpointPath,
        status: response.status,
        details: payload ?? text.slice(0, 300),
      });

      const detailText = typeof payload?.detail === "string" ? payload.detail : "";
      const queueOnly = /does not accept direct HTTP POST requests/i.test(detailText);
      const looksMissing = response.status === 404 || /not found/i.test(detailText);

      if (queueOnly || looksMissing) {
        break;
      }
    }

    const queueResult = await runQueuedEndpoint(baseUrl, apiName, description);
    const queuePrediction = normalizePrediction(queueResult);

    if (!queuePrediction) {
      return res.status(502).json({
        error: "Unexpected Hugging Face response format",
        details: queueResult,
      });
    }

    return res.status(200).json({ prediction: queuePrediction });
  } catch (error) {
    return res.status(502).json({
      error: "Hugging Face backend returned an error",
      details: error instanceof Error ? error.message : "Unknown error",
      directEndpointAttempts: directErrors,
      hint: "Set HF_SPACE_URL to the runtime *.hf.space URL. For queue mode Spaces, set HF_API_NAME to the endpoint name.",
    });
  }
}
