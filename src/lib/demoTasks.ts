import { OnboardingTask } from "./types";

export const initialTasks: OnboardingTask[] = [
  {
    id: "hr-profile",
    title: "Complete HR profile",
    description:
      "Objective:\nFinish all HR records so payroll and compliance are complete.\n\nSteps:\n1) Open the HR portal from your welcome email.\n2) Complete personal profile, tax details, and emergency contact.\n3) Confirm direct deposit and benefits enrollment status.\n\nVerification:\n- HR portal shows profile completion at 100%.\n- You receive a confirmation email from HR.\n\nIf blocked:\n- Contact HR in #help-it with screenshot + exact error message.",
    assigneeId: "hire-alex-chen",
    assignee: "Alex Chen",
    status: "complete",
    sourceTitle: "First Week Onboarding Plan",
    estimatedTime: "20 min"
  },
  {
    id: "slack-channels",
    title: "Join Slack channels",
    description:
      "Objective:\nJoin the required channels for support, access, and security updates.\n\nSteps:\n1) Join #eng-onboarding, #dev-help, #eng-access, and #security.\n2) Introduce yourself in #eng-onboarding.\n3) Pin onboarding guidance messages for quick reference.\n\nVerification:\n- You can post in each required channel.\n- Team lead confirms visibility in #eng-onboarding.\n\nIf blocked:\n- Ask workspace admins in #help-it to grant channel access.",
    assigneeId: "hire-alex-chen",
    assignee: "Alex Chen",
    status: "complete",
    sourceTitle: "Engineering Setup Guide",
    estimatedTime: "10 min"
  },
  {
    id: "github-access",
    title: "Request GitHub access",
    description:
      "Objective:\nGet repository access required to start contribution work.\n\nSteps:\n1) Ask your manager to approve engineering org access.\n2) Post request in #eng-access with your GitHub username.\n3) Accept org invite email and verify repo visibility.\n\nVerification:\n- You can view the onboarding/starter repository.\n- `git clone` succeeds without auth errors.\n\nIf blocked:\n- Share the invite or permission error text in #eng-access.",
    assigneeId: "hire-alex-chen",
    assignee: "Alex Chen",
    status: "todo",
    sourceTitle: "Engineering Setup Guide",
    estimatedTime: "15 min"
  },
  {
    id: "local-dev",
    title: "Set up local dev environment",
    description:
      "Objective:\nRun the starter app locally and confirm your environment is contribution-ready.\n\nSteps:\n1) Clone starter repo and open it in your editor.\n2) Run dependency install command from README.\n3) Start dev server and open the local URL.\n4) Run lint/tests once to validate setup health.\n\nVerification:\n- App loads locally without runtime crash.\n- Lint/tests complete (or known failures documented).\n\nIf blocked:\n- Post terminal output and Node version in #dev-help.",
    assigneeId: "hire-priya-sharma",
    assignee: "Priya Sharma",
    status: "todo",
    sourceTitle: "Engineering Setup Guide",
    estimatedTime: "45 min"
  },
  {
    id: "security-training",
    title: "Complete security training",
    description:
      "Objective:\nMeet minimum security requirements before production access.\n\nSteps:\n1) Complete required security module assigned by IT.\n2) Enable 2FA for company-critical tools.\n3) Review secure coding and secret-handling policy.\n\nVerification:\n- Training shows completed status.\n- 2FA is enabled on GitHub and core internal tools.\n\nIf blocked:\n- Contact Security/IT with account and tool name.",
    assigneeId: "hire-jordan-lee",
    assignee: "Jordan Lee",
    status: "todo",
    sourceTitle: "Security Policy",
    estimatedTime: "30 min"
  }
];