import { DemoFormShell, DemoPageLayout } from "@/components/demo/DemoFormShell";
import { RunbookWidget } from "@/components/demo/RunbookWidget";

export default function DemoExpensesPage() {
  return (
    <DemoPageLayout>
      <DemoFormShell
        eyebrow="Northstar AI Finance"
        title="Expense Submission"
        subtitle="Submit reimbursement requests for approved onboarding expenses."
        badge={{
          text: "Receipt Attached",
          className: "bg-emerald-100 text-emerald-800",
        }}
        gridFields={[
          { label: "Employee Name", value: "Alex Chen" },
          { label: "Team", value: "Platform Engineering" },
          { label: "Expense Category", value: "Home Office Equipment" },
          { label: "Date Purchased", value: "2026-04-23" },
        ]}
        detailFields={[
          { label: "Vendor", value: "Staples" },
          { label: "Amount", value: "$249.00" },
          {
            label: "Business Justification",
            value:
              "Monitor and ergonomic keyboard needed for remote onboarding and daily engineering tasks.",
            multiline: true,
          },
        ]}
        callout={{
          title: "Policy checks",
          items: [
            "Under $300 onboarding budget threshold.",
            "Manager pre-approval confirmed.",
            "Receipt upload required before final submission.",
          ],
          containerClassName: "border border-slate-200 bg-slate-50 text-slate-700",
          titleClassName: "font-semibold text-slate-900",
        }}
      />
      <div className="mx-auto mt-4 flex max-w-3xl items-center justify-end">
        <button
          id="submit-expense-btn"
          type="button"
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          Submit Expense
        </button>
      </div>
      <RunbookWidget key="expenses" pageKey="expenses" />
    </DemoPageLayout>
  );
}
