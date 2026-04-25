async function generateFromOpenAI(
  systemPrompt: string,
  userContext: string
): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContext },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${err}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Invalid structure from OpenAI");
  }
  return text.trim();
}

async function generateFromGeminiOnly(
  systemPrompt: string, 
  userContext: string
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userContext}` }] }],
  });
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  const timeoutMsByAttempt = [45_000, 75_000];

  let lastGeminiError = "";
  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let response: Response | null = null;
    for (let attempt = 0; attempt < timeoutMsByAttempt.length; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMsByAttempt[attempt]);
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body,
          signal: controller.signal,
        });
        break;
      } catch (error) {
        const isAbort = error instanceof Error && error.name === "AbortError";
        const isLastAttempt = attempt === timeoutMsByAttempt.length - 1;
        if (!isAbort || isLastAttempt) {
          throw error;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!response) {
      throw new Error("Gemini request failed before receiving a response");
    }
    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") {
        throw new Error("Invalid structure from Gemini");
      }
      return text.trim();
    }

    const err = await response.text();
    lastGeminiError = err;
    const isQuotaError = response.status === 429 && /RESOURCE_EXHAUSTED|quota/i.test(err);
    if (!isQuotaError) {
      throw new Error(`Gemini error: ${err}`);
    }
  }

  throw new Error(`Gemini error: ${lastGeminiError || "All Gemini models failed"}`);
}

export async function generateFromGemini(
  systemPrompt: string, 
  userContext: string
): Promise<string> {
  try {
    return await generateFromGeminiOnly(systemPrompt, userContext);
  } catch (error) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
    if (!OPENAI_API_KEY) throw error;
    console.warn("Gemini unavailable, falling back to OpenAI for text generation.");
    return generateFromOpenAI(systemPrompt, userContext);
  }
}

export async function generateJsonFromGemini<T>(
  systemPrompt: string, 
  userContext: string
): Promise<T> {
  const msgText = await generateFromGemini(systemPrompt, userContext);
  const jsonStr = msgText.replace(/```json/g, "").replace(/```/g, "").trim();
  return JSON.parse(jsonStr) as T;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
  if (!GEMINI_API_KEY) return null;

  try {
    const embeddingModel = "models/gemini-embedding-001";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${embeddingModel}:embedContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: embeddingModel,
          content: { parts: [{ text }] },
          outputDimensionality: 768,
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("Embedding API request failed:", response.status, errorBody);
      return null;
    }
    const data = await response.json();
    return data.embedding?.values || null;
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return null;
  }
}
