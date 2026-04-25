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
    assigneeId: string;
    assignee: string;
    status: "todo" | "in_progress" | "complete";
    sourceTitle: string;
    estimatedTime: string;
  };

  export type Hire = {
    id: string;
    name: string;
    role?: string;
    email?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  };

  export type KnowledgeSourceType =
    | "notion_page"
    | "notion_database"
    | "google_doc"
    | "google_drive_folder"
    | "google_drive_file"
    | "slack_channel"
    | "url";

  export type HireKnowledgeSource = {
    id: string;
    hireId: string;
    type: KnowledgeSourceType;
    title: string;
    url: string;
    providerRef?: string;
    createdAt: string;
    updatedAt: string;
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