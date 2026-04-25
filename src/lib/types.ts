export type SourceDoc = {
    id: string;
    title: string;
    content: string;
    url?: string;
  };
  
  export type OnboardingTask = {
    id: string;
    title: string;
    description: string;
    assignee: string;
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