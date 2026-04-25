export type DemoTaskContext = {
  taskId: string;
  title: string;
  description: string;
  nextStep: string;
};

const taskMap: Record<string, DemoTaskContext> = {
  github: {
    taskId: "get-github-access",
    title: "Get GitHub Access",
    description: "Request access to the Northstar AI GitHub organization.",
    nextStep:
      "Copy your GitHub username and submit it in the IT portal. Expect approval within one business day.",
  },
  expenses: {
    taskId: "submit-first-expense",
    title: "Submit First Expense",
    description: "Submit your onboarding equipment reimbursement request.",
    nextStep:
      "Attach receipt details and submit before Friday for same-week reimbursement.",
  },
};

export function getDemoTaskContext(pageKey: string): DemoTaskContext {
  return (
    taskMap[pageKey] ?? {
      taskId: "generic-onboarding-task",
      title: "Complete Onboarding Task",
      description: "Review instructions and complete the current onboarding step.",
      nextStep: "Follow the on-screen instructions, then mark this step complete.",
    }
  );
}
