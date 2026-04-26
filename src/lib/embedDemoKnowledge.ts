import { demoDocs } from "./demoDocs";

/** Public demo project — no API key required for `/api/embed/chat`. */
export const NORTHSTAR_DEMO_PROJECT_ID = "northstar-demo";

export type DemoChatResult = {
  answer: string;
  sources: { title: string; excerpt: string; url?: string }[];
  steps: string[];
};

function docById(id: string) {
  return demoDocs.find((d) => d.id === id);
}

function excerptFromContent(content: string, max = 180): string {
  return content.replace(/\s+/g, " ").trim().slice(0, max) + (content.length > max ? "…" : "");
}

function isLocationIntent(text: string): boolean {
  return /(where|find|locate|click|open|go to|how do i|create account|sign up|signup|register|get started|log in|login)/i.test(
    text
  );
}

function extractLocationTarget(text: string): string {
  const m = text.match(/(?:where\s+is|find|locate|click|open|go\s+to)\s+(.+)$/i);
  if (m && m[1]) return m[1].trim().replace(/[?.!]+$/, "");
  if (/create\s*account/i.test(text)) return "Create account";
  if (/sign\s*up|signup/i.test(text)) return "Sign up";
  if (/get\s*started/i.test(text)) return "Get started";
  if (/log\s*in|login/i.test(text)) return "Log in";
  if (/register/i.test(text)) return "Register";
  return "the relevant action button";
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

  if (isLocationIntent(m)) {
    const target = extractLocationTarget(message);
    return {
      answer:
        "I can help you locate that action on this page. The exact account creation flow is not documented in the current demo excerpts, so I will guide by visible UI labels.",
      sources: product
        ? [{ title: product.title, excerpt: excerptFromContent(product.content), url: undefined }]
        : [],
      steps: [
        `Look for a control labeled **${target}** on the current page.`,
        "Use the highlighted element as your starting point if one appears.",
        "If multiple matches exist, choose the most prominent primary CTA in the onboarding section.",
        "If nothing is highlighted, ask with the exact visible label (for example: find Create account button)."
      ]
    };
  }

  const explainPage =
    m.includes("explain this page") ||
    m.includes("what is this page") ||
    m.includes("summarize this page") ||
    (m.includes("explain") && m.includes("page"));

  if (explainPage) {
    return {
      answer:
        "This is the **Northstar AI Developer Portal** — your hub for getting started, managing API keys, connecting GitHub, and shipping your first workflow. Use the sections on the left as a checklist: finish **Getting Started**, then **API Keys**, then wire up **GitHub** before you deploy.",
      sources: product
        ? [{ title: product.title, excerpt: excerptFromContent(product.content), url: undefined }]
        : [],
      steps: [
        "Skim **Getting Started** for prerequisites and timelines.",
        "Open **API Keys** and confirm you have a development key (or create one).",
        "Follow **GitHub Setup** so Runbook can sync workflows from your repo.",
        "Use **Deploying Your First Workflow** when you are ready to go to staging."
      ]
    };
  }

  if (m.includes("github") && (m.includes("access") || m.includes("permission") || m.includes("repo"))) {
    return {
      answer:
        "Here is how new engineers at Northstar typically get GitHub access. Your org may vary slightly — follow your manager’s guidance if it conflicts.",
      sources: eng
        ? [{ title: eng.title, excerpt: excerptFromContent(eng.content), url: undefined }]
        : [],
      steps: [
        "Ask your manager for approval to join the engineering GitHub org.",
        "Post your GitHub username in **#eng-access** (from the Engineering Setup Guide).",
        "Wait for DevOps or your onboarding buddy to confirm you have been added.",
        "Clone the starter repo, run `npm install`, then `npm run dev` to verify access."
      ]
    };
  }

  if (
    m.includes("local") ||
    m.includes("environment") ||
    m.includes("npm install") ||
    m.includes("dev setup") ||
    m.includes("machine")
  ) {
    return {
      answer:
        "For a smooth local setup, mirror what the Engineering Setup Guide recommends: join the right Slack channels first, then clone and install.",
      sources: eng
        ? [{ title: eng.title, excerpt: excerptFromContent(eng.content), url: undefined }]
        : [],
      steps: [
        "Install Node.js LTS and Git if you have not already.",
        "Clone the starter repository after GitHub access is granted.",
        "Run `npm install` in the repo root, then `npm run dev`.",
        "If the dev server fails, paste the error in **#dev-help** and tag your onboarding buddy."
      ]
    };
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
    return {
      answer:
        "Your first week is designed to ramp context, tooling, and safety. Use this portal alongside the First Week Onboarding Plan.",
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
    };
  }

  if (
    m.includes("security rules") ||
    (m.includes("rules") && m.includes("security")) ||
    m.includes("2fa") ||
    m.includes("password") ||
    m.includes("secret")
  ) {
    return {
      answer:
        "Security basics for Northstar engineers: enable 2FA, never paste secrets in chat, and complete training before shipping to production.",
      sources: sec
        ? [{ title: sec.title, excerpt: excerptFromContent(sec.content), url: undefined }]
        : [],
      steps: [
        "Enable two-factor authentication on GitHub and company SSO.",
        "Store credentials only in the approved password manager.",
        "Do not paste API keys or tokens into Slack, email, or public GitHub issues.",
        "Complete security training before merging production-bound code."
      ]
    };
  }

  if (m.includes("expense") || m.includes("ramp") || m.includes("reimburs")) {
    return {
      answer:
        "Expense submissions use Ramp with clear thresholds for receipts and approvals.",
      sources: expense
        ? [{ title: expense.title, excerpt: excerptFromContent(expense.content), url: undefined }]
        : [],
      steps: [
        "Submit expenses within 14 days of incurring them.",
        "Attach receipts for any expense over $25.",
        "Get manager approval for expenses over $100.",
        "Use the Ramp reimbursement form; ask **#people-ops** if blocked."
      ]
    };
  }

  if (m.includes("api key") || m.includes("apikey") || ctx.includes("api key")) {
    return {
      answer:
        "API keys for Northstar are created from this portal’s **API Keys** section (demo). In production you would rotate keys, scope them to environments, and never commit them to git.",
      sources: product
        ? [{ title: product.title, excerpt: excerptFromContent(product.content), url: undefined }]
        : [],
      steps: [
        "Open **API Keys** in the sidebar.",
        "Create a **development** key for local testing first.",
        "Store the key in your env file or secret manager — not in the repo.",
        "Rotate the key if it is ever exposed."
      ]
    };
  }

  // Default: blend product + first week
  const sources: { title: string; excerpt: string; url?: string }[] = [];
  if (product) sources.push({ title: product.title, excerpt: excerptFromContent(product.content) });
  if (first) sources.push({ title: first.title, excerpt: excerptFromContent(first.content) });

  return {
    answer:
      "I matched your question to our **Northstar** knowledge base (demo). For the strongest answers, ask about GitHub access, local setup, your first week, security, expenses, or say **explain this page** for a tour of this portal.",
    sources,
    steps: [
      "Check **Getting Started** for prerequisites.",
      "Skim **Engineering Setup** if you are blocked on tooling or access.",
      "Say **explain this page** anytime you want a guided tour of what you are looking at."
    ]
  };
}

export function getDemoKnowledgeContextBlock(): string {
  return demoDocs.map((d) => `## ${d.title}\n${d.content.trim()}`).join("\n\n---\n\n");
}
