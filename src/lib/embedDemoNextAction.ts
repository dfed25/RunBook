export type DemoAppState = {
  githubConnected: boolean;
  apiKeyCreated: boolean;
  workflowCreated: boolean;
  deployed: boolean;
};

export type DemoNextAction = {
  id: "connect-github" | "create-api-key" | "build-workflow" | "deploy" | "complete";
  title: string;
  message: string;
  targetFeature: "integrations" | "api-keys" | "create-workflow" | "deployments" | null;
  buttonLabel: string;
};

export function getNextAction(state: DemoAppState): DemoNextAction {
  if (!state.githubConnected) {
    return {
      id: "connect-github",
      title: "Connect GitHub",
      message: "Connect GitHub so workflows can react to repo events.",
      targetFeature: "integrations",
      buttonLabel: "Guide me"
    };
  }
  if (!state.apiKeyCreated) {
    return {
      id: "create-api-key",
      title: "Create API key",
      message: "Generate a key so the embedded assistant can connect securely.",
      targetFeature: "api-keys",
      buttonLabel: "Show me"
    };
  }
  if (!state.workflowCreated) {
    return {
      id: "build-workflow",
      title: "Build first workflow",
      message: "Create a GitHub to Deploy workflow to validate setup.",
      targetFeature: "create-workflow",
      buttonLabel: "Start"
    };
  }
  if (!state.deployed) {
    return {
      id: "deploy",
      title: "Deploy to staging",
      message: "Push your onboarding assistant to staging.",
      targetFeature: "deployments",
      buttonLabel: "Deploy"
    };
  }
  return {
    id: "complete",
    title: "Ready to launch",
    message: "Your embedded assistant is live and ready to guide users.",
    targetFeature: null,
    buttonLabel: "Try assistant"
  };
}
