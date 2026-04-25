// TODO: Reuse in richer landing-page/company profile modules.
export const DEMO_COMPANY = {
  name: "Northstar AI",
  industry: "AI workflow automation",
  size: "120 employees",
  onboardingGoal: "Help new hires complete first-week setup with less manager overhead."
};

export const DEMO_PERSONAS = {
  newHire: {
    name: "Alex Rivera",
    role: "Software Engineer I"
  },
  manager: {
    name: "Maya Chen",
    role: "Engineering Manager"
  }
};

// TODO: Reuse in scripted demo runner and walkthrough UI.
export const DEMO_STORY_STEPS: string[] = [
  "Alex signs in and opens the new hire dashboard.",
  "Alex reviews checklist tasks and current progress.",
  "Alex asks Runbook: How do I get GitHub access?",
  "Runbook answers with exact steps and source citations from company docs.",
  "Alex marks the GitHub access task as complete.",
  "Maya opens the manager dashboard and sees Alex's progress update in real time."
];

// TODO: Reuse in seeded question chips for chat experience.
export const DEMO_QUESTIONS: string[] = [
  "How do I get GitHub access?",
  "What is required before I can merge production code?",
  "How do I submit an expense and when do I need manager approval?",
  "What should I do on my first day at Northstar AI?",
  "Who should I ask if local setup fails?"
];
