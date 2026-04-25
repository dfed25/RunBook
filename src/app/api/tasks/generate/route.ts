import { NextResponse } from "next/server";
import { initialTasks } from "@/lib/demoTasks";
import { TASK_GENERATION_SYSTEM_PROMPT } from "@/lib/prompts";
import { demoDocs } from "@/lib/demoDocs";
import { generateJsonFromGemini } from "@/lib/ai";
import { OnboardingTask } from "@/lib/types";

export async function POST() {
  const context = demoDocs.map(d => `Document Title: ${d.title}\nContent:\n${d.content}`).join("\n\n");
  const userPrompt = `Company Context:\n${context}\n\nGenerate the onboarding task array.`;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(initialTasks);
    }
    
    try {
      const parsedTasks = await generateJsonFromGemini<OnboardingTask[]>(TASK_GENERATION_SYSTEM_PROMPT, userPrompt);
      
      const valid = Array.isArray(parsedTasks) && parsedTasks.every(t => 
        t && typeof t.id === "string" && typeof t.title === "string" &&
        ["todo", "in_progress", "complete"].includes(t.status)
      );

      if (!valid) {
        console.error("Gemini returned invalid tasks shape");
        return NextResponse.json(initialTasks);
      }

      return NextResponse.json(parsedTasks);
    } catch (e) {
      console.error("Failed to parse JSON tasks:", e);
      return NextResponse.json(initialTasks);
    }

  } catch (error) {
    console.error(error);
    return NextResponse.json(initialTasks);
  }
}
