import { SourceDoc } from "./types";

export const demoDocs: SourceDoc[] = [
  {
    id: "engineering-setup",
    title: "Engineering Setup Guide",
    content: `
New engineers should join #eng-onboarding, #dev-help, and #eng-access.
To get GitHub access, ask your manager for approval and post in #eng-access.
After access is approved, clone the starter repo, run npm install, then npm run dev.
If stuck, ask in #dev-help and tag your onboarding buddy.
Your first engineering task is to make a small documentation change and open a pull request.
`
  },
  {
    id: "expense-policy",
    title: "Expense Policy",
    content: `
Employees must submit expenses within 14 days.
Receipts are required for expenses over $25.
Expenses over $100 need manager approval.
Use the Ramp reimbursement form.
For questions, contact #people-ops.
`
  },
  {
    id: "security-policy",
    title: "Security Policy",
    content: `
All employees must enable two-factor authentication.
Do not paste passwords, API keys, tokens, or secrets into Slack, email, GitHub, or documents.
Use the company password manager for work credentials.
Report suspicious emails in #security.
New engineers must complete security training before merging production code.
`
  },
  {
    id: "first-week",
    title: "First Week Onboarding Plan",
    content: `
Day 1: Complete HR profile, join Slack, meet your manager, and review the company handbook.
Day 2: Set up your engineering environment and request GitHub access.
Day 3: Read the product overview and shadow one customer call recording.
Day 4: Make your first small pull request and review the security policy.
Day 5: Meet your manager for a first-week retro and set goals for week two.
`
  },
  {
    id: "product-overview",
    title: "Product Overview",
    content: `
Northstar AI helps operations teams automate repetitive cross-system workflows.
Core product areas include workflow orchestration, policy automation, and analytics.
The first teams new engineers should meet are Platform, Product Design, and Support Operations.
Current enterprise integrations include Slack, Notion, and Google Drive knowledge syncing.
Customer value focus: faster onboarding, fewer process errors, and better visibility for managers.
`
  }
];