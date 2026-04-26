import { FeatureCard } from "@/components/demo/FeatureCard";

export default function DeploymentsPage() {
  return (
    <div className="space-y-5">
      <FeatureCard
        feature="deployment-status"
        title="Deployment Status"
        description="Monitor deploy phases and rollback health."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <h2 className="text-lg font-semibold">Current rollout</h2>
        <div className="mt-3 h-2 rounded-full bg-slate-800">
          <div className="h-2 w-3/4 rounded-full bg-emerald-400" />
        </div>
        <p className="mt-2 text-sm text-slate-400">75% complete · Production canary in progress</p>
      </FeatureCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard
          feature="deployment-history"
          title="Deployment History"
          description="Review latest releases and health checks."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <ul className="space-y-2 text-sm">
            <li className="rounded-lg bg-slate-950/70 px-3 py-2">v1.42.0 · Completed · 2h ago</li>
            <li className="rounded-lg bg-slate-950/70 px-3 py-2">v1.41.3 · Completed · Yesterday</li>
            <li className="rounded-lg bg-slate-950/70 px-3 py-2">v1.41.2 · Rolled back · 2 days ago</li>
          </ul>
        </FeatureCard>

        <FeatureCard
          feature="rollback-controls"
          title="Rollback Controls"
          description="Pause rollout or rollback instantly if metrics degrade."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <div className="flex gap-2">
            <button className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">Pause rollout</button>
            <button className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">Rollback now</button>
          </div>
        </FeatureCard>
      </div>
    </div>
  );
}
