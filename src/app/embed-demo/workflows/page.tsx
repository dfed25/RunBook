import { FeatureCard } from "@/components/demo/FeatureCard";

export default function WorkflowsPage() {
  return (
    <div className="space-y-5">
      <FeatureCard
        feature="create-workflow"
        title="Create Workflow"
        description="Choose a starter and build your first automation."
        className="rounded-2xl border border-indigo-400/30 bg-slate-900 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Workflow templates</h2>
            <p className="text-sm text-slate-400">Select a template, then customize trigger conditions and actions.</p>
          </div>
          <button className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white">Start from blank</button>
        </div>
      </FeatureCard>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Release automation", "Deploy after PR merge and run smoke checks."],
          ["Support escalation", "Route urgent tickets to on-call Slack channel."],
          ["User lifecycle sync", "Update CRM when trial converts to paid."]
        ].map(([title, description], idx) => (
          <FeatureCard
            key={title}
            feature={`workflow-template-${idx + 1}`}
            title={title}
            description={description}
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
            <button className="mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-xs">Use template</button>
          </FeatureCard>
        ))}
      </div>

      <FeatureCard
        feature="workflow-canvas"
        title="Workflow Canvas"
        description="Map trigger, conditions, and actions before testing."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs uppercase text-slate-500">Trigger</p>
            <p className="text-sm text-slate-200">Stripe payment succeeded</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs uppercase text-slate-500">Condition</p>
            <p className="text-sm text-slate-200">Amount {">"} $500</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <p className="text-xs uppercase text-slate-500">Action</p>
            <p className="text-sm text-slate-200">Notify #high-value-sales</p>
          </div>
        </div>
      </FeatureCard>
    </div>
  );
}
