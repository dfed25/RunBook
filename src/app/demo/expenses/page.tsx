import { RunbookWidget } from "@/components/demo/RunbookWidget";

export default function DemoExpensesPage() {
  return (
    <main className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Northstar AI Finance
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Expense Submission
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Submit reimbursement requests for approved onboarding expenses.
            </p>
          </div>
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Receipt Attached
          </span>
        </div>

        <section className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Employee Name
            <input
              readOnly
              value="Alex Chen"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Team
            <input
              readOnly
              value="Platform Engineering"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Expense Category
            <input
              readOnly
              value="Home Office Equipment"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Date Purchased
            <input
              readOnly
              value="2026-04-23"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </section>

        <section className="mt-6 grid gap-5">
          <label className="text-sm font-medium text-slate-700">
            Vendor
            <input
              readOnly
              value="Staples"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Amount
            <input
              readOnly
              value="$249.00"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Business Justification
            <textarea
              readOnly
              value="Monitor and ergonomic keyboard needed for remote onboarding and daily engineering tasks."
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </section>

        <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Policy checks</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Under $300 onboarding budget threshold.</li>
            <li>Manager pre-approval confirmed.</li>
            <li>Receipt upload required before final submission.</li>
          </ul>
        </div>
      </div>
      <RunbookWidget pageKey="expenses" />
    </main>
  );
}
