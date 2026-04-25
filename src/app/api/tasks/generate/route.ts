import { NextResponse } from "next/server";
import { initialTasks } from "@/lib/demoTasks";
import { TASK_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { demoDocs } from "@/lib/demoDocs";

export async function POST() {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      // P3-7: Static fallback task list
      return NextResponse.json(initialTasks);
    }

    const context = demoDocs.map(d => `Document Title: ${d.title}\nContent:\n${d.content}`).join("\n\n");
    
    // P3-6: Generate using Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${TASK_GENERATION_SYSTEM_PROMPT}\n\nCompany Context:\n${context}\n\nGenerate the onboarding task array.` }] }
        ]
      })
    });

    if (!response.ok) {
       console.error("Gemini error:", await response.text());
       return NextResponse.json(initialTasks);
    }

    const data = await response.json();
    const msgText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    
    // Strict parsing attempt
    try {
       const jsonStr = msgText.replace(/```json/g, "").replace(/```/g, "").trim();
       const parsedTasks = JSON.parse(jsonStr);
       return NextResponse.json(parsedTasks);
    } catch(e) {
       console.error("Failed to parse JSON tasks:", e, msgText);
       return NextResponse.json(initialTasks);
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json(initialTasks);
  }
}
