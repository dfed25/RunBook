import { RunbookWidget } from "@/components/demo/RunbookWidget";

export default function DemoGithubPage() {
  return (
    <main className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Northstar AI IT Helpdesk
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              GitHub Access Request
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Submit this form to request repository and organization access.
            </p>
          </div>
          <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Pending Manager Approval
          </span>
        </div>

        <section className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Full Name
            <input
              readOnly
              value="Alex Chen"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Work Email
            <input
              readOnly
              value="alex.chen@northstar.ai"
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
            Manager
            <input
              readOnly
              value="Maya Patel"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </section>

        <section className="mt-6 grid gap-5">
          <label className="text-sm font-medium text-slate-700">
            GitHub Username
            <input
              readOnly
              value="alexchen-dev"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Repositories Needed
            <textarea
              readOnly
              value={"northstar/web-app\nnorthstar/onboarding-docs"}
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Access Justification
            <textarea
              readOnly
              value="I need access to complete setup steps and contribute to onboarding-related issues in my first week."
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </section>

        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-semibold">Review notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Security training completed on Apr 22.</li>
            <li>Manager approval received.</li>
            <li>Expected fulfillment: within 1 business day.</li>
          </ul>
        </div>
      </div>
      <RunbookWidget key="github" pageKey="github" />
    </main>
  );
}
