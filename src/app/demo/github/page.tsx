import { DemoFormShell, DemoPageLayout } from "@/components/demo/DemoFormShell";
import { RunbookWidget } from "@/components/demo/RunbookWidget";

export default function DemoGithubPage() {
  return (
    <DemoPageLayout>
      <DemoFormShell
        eyebrow="Northstar AI IT Helpdesk"
        title="GitHub Access Request"
        subtitle="Submit this form to request repository and organization access."
        badge={{
          text: "Pending Manager Approval",
          className: "bg-amber-100 text-amber-800",
        }}
        gridFields={[
          { label: "Full Name", value: "Alex Chen" },
          { label: "Work Email", value: "alex.chen@northstar.ai" },
          { label: "Team", value: "Platform Engineering" },
          { label: "Manager", value: "Maya Patel" },
        ]}
        detailFields={[
          { label: "GitHub Username", value: "alexchen-dev" },
          {
            label: "Repositories Needed",
            value: "northstar/web-app\nnorthstar/onboarding-docs",
            multiline: true,
          },
          {
            label: "Access Justification",
            value:
              "I need access to complete setup steps and contribute to onboarding-related issues in my first week.",
            multiline: true,
          },
        ]}
        callout={{
          title: "Review notes",
          items: [
            "Security training completed on Apr 22.",
            "Manager approval received.",
            "Expected fulfillment: within 1 business day.",
          ],
          containerClassName: "border border-blue-200 bg-blue-50 text-blue-900",
        }}
      />
      <div className="mx-auto mt-4 flex max-w-3xl items-center justify-end">
        <button
          id="request-access-btn"
          type="button"
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
        >
          Request Access
        </button>
      </div>
      <RunbookWidget key="github" pageKey="github" />
    </DemoPageLayout>
  );
}
