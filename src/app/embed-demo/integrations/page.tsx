import { FeatureCard } from "@/components/demo/FeatureCard";

const INTEGRATIONS = [
  ["GitHub", "Connected", "Source events from repos and PRs."],
  ["Slack", "Connected", "Send status updates and approval prompts."],
  ["Salesforce", "Not connected", "Sync lead lifecycle milestones."],
  ["Zendesk", "Not connected", "Automate ticket triage workflows."],
  ["PagerDuty", "Not connected", "Trigger incident response playbooks."],
  ["HubSpot", "Connected", "Update CRM records in real-time."]
] as const;

export default function IntegrationsPage() {
  return (
    <div className="space-y-5">
      <FeatureCard
        feature="integrations-panel"
        title="Integrations Panel"
        description="Connect services that trigger or receive workflow actions."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <h2 className="text-lg font-semibold">Available integrations</h2>
        <p className="text-sm text-slate-400">Connect at least one source and one destination to launch onboarding flow.</p>
      </FeatureCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {INTEGRATIONS.map(([name, status, description], idx) => (
          <FeatureCard
            key={name}
            feature={`integration-${idx + 1}`}
            title={`${name} integration`}
            description={description}
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-white">{name}</p>
              <span className={status === "Connected" ? "text-emerald-300 text-xs" : "text-amber-300 text-xs"}>{status}</span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
            <button type="button" className="mt-3 rounded-lg border border-white/20 px-3 py-1.5 text-xs">
              {status === "Connected" ? "Manage" : "Connect"}
            </button>
          </FeatureCard>
        ))}
      </div>
    </div>
  );
}
