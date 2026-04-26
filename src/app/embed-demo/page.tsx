import Link from "next/link";
import { FeatureCard } from "@/components/demo/FeatureCard";

export default function EmbedDemoPage() {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FeatureCard
          feature="create-workflow"
          title="Create Workflow"
          description="Start a new automation by choosing a trigger and action."
          className="rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/25 to-slate-900 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-indigo-200">Quick action</p>
          <p className="mt-1 text-xl font-bold text-white">Create Workflow</p>
          <Link href="/embed-demo/workflows" className="mt-3 inline-block rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400">
            New workflow
          </Link>
        </FeatureCard>

        <FeatureCard
          feature="workflow-health"
          title="Workflow Health"
          description="See active runs, failures, and latency before deploying changes."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">Health</p>
          <p className="mt-1 text-2xl font-bold">98.4%</p>
          <p className="text-xs text-slate-400">7 active runs · 0 critical alerts</p>
        </FeatureCard>

        <FeatureCard
          feature="deployment-status"
          title="Deployment Status"
          description="Track staging and production rollout states for your latest workflow version."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">Deployments</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300">Staging healthy</p>
          <p className="text-xs text-slate-400">Prod rollout queued · ETA 6m</p>
        </FeatureCard>

        <FeatureCard
          feature="api-key-setup"
          title="API Key Setup"
          description="Create scoped keys for sandbox and production environments."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <p className="text-xs uppercase tracking-wide text-slate-400">API Keys</p>
          <p className="mt-1 text-2xl font-bold">2 active</p>
          <Link href="/embed-demo/api-keys" className="mt-3 inline-block rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:border-white/40">
            Manage keys
          </Link>
        </FeatureCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <FeatureCard
          feature="workflow-builder"
          title="Workflow Builder"
          description="Compose triggers and actions, then test before deployment."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workflow Builder</h2>
            <Link href="/embed-demo/workflows" className="rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-100">
              Open full builder
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {[
              ["Trigger", "GitHub push event"],
              ["Condition", "branch == main"],
              ["Action", "Deploy to staging"]
            ].map(([label, value], idx) => (
              <FeatureCard
                key={label}
                feature={`workflow-step-${idx + 1}`}
                title={String(label)}
                description={`Configure the ${String(label).toLowerCase()} step for this workflow.`}
                className="rounded-xl border border-white/10 bg-slate-950/70 p-3"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm text-slate-100">{value}</p>
              </FeatureCard>
            ))}
          </div>
        </FeatureCard>

        <div className="space-y-5">
          <FeatureCard
            feature="integrations-panel"
            title="Integrations"
            description="Connect external tools so workflows can trigger and notify automatically."
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Integrations</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["GitHub", "Connected"],
                ["Slack", "Connected"],
                ["PagerDuty", "Not connected"]
              ].map(([name, status]) => (
                <li key={name} className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2">
                  <span>{name}</span>
                  <span className={status === "Connected" ? "text-emerald-300" : "text-amber-300"}>{status}</span>
                </li>
              ))}
            </ul>
          </FeatureCard>

          <FeatureCard
            feature="settings-panel"
            title="Customization"
            description="Tune runtime settings and rollout preferences for your workspace."
            className="rounded-2xl border border-white/10 bg-slate-900 p-4"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Settings</h3>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <label className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2">
                Enable safe mode
                <input type="checkbox" defaultChecked />
              </label>
              <label className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2">
                Auto deploy to staging
                <input type="checkbox" defaultChecked />
              </label>
            </div>
          </FeatureCard>
        </div>
      </section>

      <FeatureCard
        feature="workflow-templates"
        title="Workflow Templates"
        description="Pick a starter template to accelerate setup for common automation patterns."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Workflow Templates</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {["CI build + deploy", "Incident alert routing", "Issue triage assistant"].map((template) => (
            <FeatureCard
              key={template}
              feature={`template-${template.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              title={template}
              description="Use this template as a base, then customize trigger conditions and actions."
              className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-left text-sm hover:border-indigo-400/40"
            >
              {template}
            </FeatureCard>
          ))}
        </div>
      </FeatureCard>
    </div>
  );
}
