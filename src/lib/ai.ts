export async function generateFromGemini(
  systemPrompt: string, 
  userContext: string
): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: `${systemPrompt}\n\n${userContext}` }] }
          ]
        }),
        signal: controller.signal,
      }
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error("Invalid structure from Gemini");
  }
  
  return text.trim();
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
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return null;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] }
        })
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return data.embedding?.values || null;
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return null;
  }
}
