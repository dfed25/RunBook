import { FeatureCard } from "@/components/demo/FeatureCard";

export default function ApiKeysPage() {
  return (
    <div className="space-y-5">
      <FeatureCard
        feature="api-key-setup"
        title="API Key Setup"
        description="Generate scoped credentials for staging and production."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <h2 className="text-lg font-semibold">Create API key</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm" placeholder="Key name (e.g. web-prod)" />
          <select className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option>Environment: Staging</option>
            <option>Environment: Production</option>
          </select>
          <button className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white">Generate key</button>
        </div>
      </FeatureCard>

      <FeatureCard
        feature="api-key-list"
        title="Active API Keys"
        description="Rotate, disable, or scope keys as your app grows."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <div className="space-y-2 text-sm">
          {[
            ["web-staging", "sk_live_****************wY2", "Last used 2h ago"],
            ["web-production", "sk_live_****************mP9", "Last used 9m ago"]
          ].map(([name, masked, usage]) => (
            <div key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950/70 px-3 py-2">
              <div>
                <p className="font-medium text-slate-100">{name}</p>
                <p className="text-xs text-slate-400">{masked}</p>
              </div>
              <p className="text-xs text-slate-400">{usage}</p>
            </div>
          ))}
        </div>
      </FeatureCard>
    </div>
  );
}
