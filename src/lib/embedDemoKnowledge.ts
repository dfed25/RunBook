import { demoDocs } from "./demoDocs";

/** Public demo project — no API key required for `/api/embed/chat`. */
export const NORTHSTAR_DEMO_PROJECT_ID = "northstar-demo";

export type DemoChatResult = {
  answer: string;
  bullets: string[];
  sources: { title: string; excerpt: string; url?: string }[];
  steps: string[];
  suggestions: string[];
};

function docById(id: string) {
  return demoDocs.find((d) => d.id === id);
}

function excerptFromContent(content: string, max = 180): string {
  return content.replace(/\s+/g, " ").trim().slice(0, max) + (content.length > max ? "…" : "");
}

function compact(text: string, words = 12): string {
  const parts = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return parts.slice(0, words).join(" ");
}

function createResult(input: {
  answer: string;
  bullets: string[];
  sources: { title: string; excerpt: string; url?: string }[];
  steps: string[];
  suggestions?: string[];
}): DemoChatResult {
  return {
    answer: compact(input.answer, 12),
    bullets: input.bullets.slice(0, 3).map((b) => compact(b, 14)),
    sources: input.sources,
    steps: input.steps.slice(0, 7),
    suggestions: (input.suggestions || ["Guide me step-by-step", "Explain this page", "What can I do next?"]).slice(0, 3)
  };
}

/** Deterministic demo responses for hackathon reliability. */
export function buildNorthstarDemoResponse(message: string, pageContext: string): DemoChatResult {
  const m = message.toLowerCase().trim();
  const ctx = (pageContext || "").toLowerCase();

  const eng = docById("engineering-setup");
  const first = docById("first-week");
  const sec = docById("security-policy");
  const product = docById("product-overview");
  const expense = docById("expense-policy");

  const explainPage =
    m.includes("explain this page") ||
    m.includes("what is this page") ||
    m.includes("summarize this page") ||
    (m.includes("explain") && m.includes("page"));

  if (explainPage) {
    return createResult({
      answer: "This page helps you launch quickly in the Northstar portal.",
      bullets: ["Create dev keys", "Connect GitHub", "Deploy first workflow"],
      sources: product
        ? [{ title: product.title, excerpt: excerptFromContent(product.content), url: undefined }]
        : [],
      steps: [
        "Open Getting Started and review prerequisites.",
        "Create a development API key in API Keys.",
        "Connect GitHub repository access.",
        "Deploy your first workflow to staging."
      ]
    });
  }

  if (m.includes("github") && (m.includes("access") || m.includes("permission") || m.includes("repo"))) {
    return createResult({
      answer: "GitHub access takes four quick onboarding actions.",
      bullets: ["Request org access", "Share GitHub username", "Wait for approval"],
      sources: eng
        ? [{ title: eng.title, excerpt: excerptFromContent(eng.content), url: undefined }]
        : [],
      steps: [
        "Ask your manager for org access approval.",
        "Post your GitHub username in #eng-access.",
        "Wait for DevOps confirmation.",
        "Clone the starter repo, run `npm install`, then `npm run dev` to verify access."
      ]
    });
  }

  if (
    m.includes("local") ||
    m.includes("environment") ||
    m.includes("npm install") ||
    m.includes("dev setup") ||
    m.includes("machine")
  ) {
    return createResult({
      answer: "Local setup is quick when done in this order.",
      bullets: ["Install Node LTS", "Clone starter repo", "Run install and dev"],
      sources: eng
        ? [{ title: eng.title, excerpt: excerptFromContent(eng.content), url: undefined }]
        : [],
      steps: [
        "Install Node.js LTS and Git.",
        "Clone the starter repository after GitHub access is granted.",
        "Run `npm install` in the repo root, then `npm run dev`.",
        "If blocked, post the error in #dev-help."
      ]
    });
  }

  if (
    m.includes("first") ||
    m.includes("today") ||
    m.includes("onboarding") ||
    m.includes("what should i do next") ||
    (m.includes("do next") && (m.includes("what") || m.includes("should"))) ||
    m.includes("start") ||
    m.includes("week one")
  ) {
    return createResult({
      answer: "Start with first-week milestones in this order.",
      bullets: ["Day 1 admin + intro", "Day 2 tooling setup", "Day 3-5 ship and review"],
      sources: first
        ? [{ title: first.title, excerpt: excerptFromContent(first.content), url: undefined }]
        : [],
      steps: [
        "Day 1: HR profile, Slack, manager intro, handbook (see First Week plan).",
        "Day 2: Engineering environment + request GitHub access.",
        "Day 3: Product overview + shadow a customer call recording.",
        "Day 4: Small pull request + read the security policy.",
        "Day 5: First-week retro with your manager and goals for week two."
      ]
    });
  }

  if (
    m.includes("security rules") ||
    (m.includes("rules") && m.includes("security")) ||
    m.includes("2fa") ||
    m.includes("password") ||
    m.includes("secret")
  ) {
    return createResult({
      answer: "Follow these security rules before shipping anything.",
      bullets: ["Enable 2FA", "Never share secrets", "Finish required training"],
      sources: sec
        ? [{ title: sec.title, excerpt: excerptFromContent(sec.content), url: undefined }]
        : [],
      steps: [
        "Enable two-factor authentication on GitHub and company SSO.",
        "Store credentials only in the approved password manager.",
        "Do not paste API keys or tokens into Slack, email, or public GitHub issues.",
        "Complete security training before merging production-bound code."
      ]
    });
  }

  if (m.includes("expense") || m.includes("ramp") || m.includes("reimburs")) {
    return createResult({
      answer: "Expense reimbursement follows a simple Ramp process.",
      bullets: ["Submit within 14 days", "Attach receipts over $25", "Get approval over $100"],
      sources: expense
        ? [{ title: expense.title, excerpt: excerptFromContent(expense.content), url: undefined }]
        : [],
      steps: [
        "Submit expenses within 14 days of incurring them.",
        "Attach receipts for any expense over $25.",
        "Get manager approval for expenses over $100.",
        "Use the Ramp reimbursement form; ask **#people-ops** if blocked."
      ]
    });
  }

  if (m.includes("api key") || m.includes("apikey") || ctx.includes("api key")) {
    return createResult({
      answer: "Create and secure API keys from this page.",
      bullets: ["Generate dev key first", "Store in env manager", "Rotate if exposed"],
      sources: product
        ? [{ title: product.title, excerpt: excerptFromContent(product.content), url: undefined }]
        : [],
      steps: [
        "Open **API Keys** in the sidebar.",
        "Create a **development** key for local testing first.",
        "Store the key in your env file or secret manager — not in the repo.",
        "Rotate the key if it is ever exposed."
      ]
    });
  }

  // Default: blend product + first week
  const sources: { title: string; excerpt: string; url?: string }[] = [];
  if (product) sources.push({ title: product.title, excerpt: excerptFromContent(product.content) });
  if (first) sources.push({ title: first.title, excerpt: excerptFromContent(first.content) });

  return createResult({
    answer: "Here are the main things you can do right now.",
    bullets: ["Set up local environment", "Get GitHub access", "Explore page capabilities"],
    sources,
    steps: [
      "Check Getting Started for prerequisites.",
      "Use Engineering Setup for tooling blockers.",
      "Click Explain this page for guided discovery."
    ]
  });
}

export function getDemoKnowledgeContextBlock(): string {
  return demoDocs.map((d) => `## ${d.title}\n${d.content.trim()}`).join("\n\n---\n\n");
}
