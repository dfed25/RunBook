import { OnboardingTask } from "./types";

export const initialTasks: OnboardingTask[] = [
  {
    id: "hr-profile",
    title: "Complete HR profile",
    description: "Finish employee profile and tax information.",
    status: "complete",
    sourceTitle: "First Week Onboarding Plan",
    estimatedTime: "20 min"
  },
  {
    id: "slack-channels",
    title: "Join Slack channels",
    description: "Join #eng-onboarding, #dev-help, #eng-access, and #security.",
    status: "complete",
    sourceTitle: "Engineering Setup Guide",
    estimatedTime: "10 min"
  },
  {
    id: "github-access",
    title: "Request GitHub access",
    description: "Ask your manager for approval and post in #eng-access.",
    status: "todo",
    sourceTitle: "Engineering Setup Guide",
    estimatedTime: "15 min"
  },
  {
    id: "local-dev",
    title: "Set up local dev environment",
    description: "Clone starter repo, install dependencies, and run the app locally.",
    status: "todo",
    sourceTitle: "Engineering Setup Guide",
    estimatedTime: "45 min"
  },
  {
    id: "security-training",
    title: "Complete security training",
    description: "Review security policy and enable 2FA.",
    status: "todo",
    sourceTitle: "Security Policy",
    estimatedTime: "30 min"
  }
];