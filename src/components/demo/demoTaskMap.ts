export type DemoTaskContext = {
  taskId: string;
  title: string;
  description: string;
  /** Shown when no server steps yet */
  nextStep: string;
  actionSteps: string[];
};

const taskMap: Record<string, DemoTaskContext> = {
  github: {
    taskId: "github-access",
    title: "Request GitHub access",
    description:
      "Use the IT portal and Slack to get Northstar GitHub org access before you clone repos.",
    nextStep:
      "Confirm manager approval, then submit your GitHub username in the access form.",
    actionSteps: [
      "Confirm manager approval for org access",
      "Open the IT GitHub request form and enter your username",
      "Post your GitHub handle in #eng-access for visibility",
      "Accept the org invite and verify repo access",
    ],
  },
  expenses: {
    taskId: "expense-submission",
    title: "Submit onboarding expense",
    description: "Complete your Ramp reimbursement with receipt and manager approval path.",
    nextStep: "Attach receipt details and submit before the payroll cutoff.",
    actionSteps: [
      "Gather receipt and purchase details",
      "Create reimbursement in Ramp with correct category",
      "Attach receipt image or PDF",
      "Submit for approval and note expected pay date",
    ],
  },
  security: {
    taskId: "security-training",
    title: "Complete security training",
    description: "Finish security modules, 2FA, and policy acknowledgements in the portal.",
    nextStep: "Start with assigned training modules, then enable 2FA on required tools.",
    actionSteps: [
      "Sign in to the security training portal",
      "Finish assigned modules and pass the quiz",
      "Enable 2FA on GitHub and core SSO apps",
      "Acknowledge secure handling of secrets and phishing reporting",
    ],
  },
};

export function getDemoTaskContext(pageKey: string): DemoTaskContext {
  return (
    taskMap[pageKey] ?? {
      taskId: "generic-onboarding-task",
      title: "Complete onboarding task",
      description: "Review instructions and complete the current onboarding step.",
      nextStep: "Follow the on-screen instructions, then mark this step complete.",
      actionSteps: ["Follow on-screen instructions", "Mark complete when done"],
    }
  );
}
