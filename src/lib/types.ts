import type { TraineeName } from "./trainees";

export type SourceDoc = {
    id: string;
    title: string;
    content: string;
    url?: string;
    sourceType?: "seed" | "text" | "upload";
    createdAt?: string;
  };
  
  export type OnboardingTask = {
    id: string;
    title: string;
    description: string;
    assignee: TraineeName;
    status: "todo" | "in_progress" | "complete";
    sourceTitle: string;
    estimatedTime: string;
  };
  
  export type ChatSource = {
    title: string;
    excerpt: string;
  };
  
  export type ChatResponse = {
    answer: string;
    sources: ChatSource[];
  };

  export type LessonSlide = {
    title: string;
    body: string;
  };
  
  export type Lesson = {
    title: string;
    summary: string;
    slides: LessonSlide[];
    narrationScript: string;
  };