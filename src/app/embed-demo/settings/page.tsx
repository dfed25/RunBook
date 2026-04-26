import { FeatureCard } from "@/components/demo/FeatureCard";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <FeatureCard
        feature="settings-panel"
        title="Settings Panel"
        description="Control branding, permissions, and onboarding defaults."
        className="rounded-2xl border border-white/10 bg-slate-900 p-4"
      >
        <h2 className="text-lg font-semibold">Workspace settings</h2>
        <p className="text-sm text-slate-400">Adjust defaults for widget behavior and team-level access.</p>
      </FeatureCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <FeatureCard
          feature="branding-settings"
          title="Branding"
          description="Customize assistant name and colors to match your product."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <div className="space-y-2">
            <div>
              <label htmlFor="assistantName" className="mb-1 block text-xs text-slate-400">
                Assistant name
              </label>
              <input
                id="assistantName"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                defaultValue="Runbook Assistant"
              />
            </div>
            <div>
              <label htmlFor="brandColor" className="mb-1 block text-xs text-slate-400">
                Brand color
              </label>
              <input
                id="brandColor"
                type="color"
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                defaultValue="#6366f1"
              />
            </div>
          </div>
        </FeatureCard>

        <FeatureCard
          feature="permissions-settings"
          title="Permissions"
          description="Set who can edit workflows, secrets, and deploy policies."
          className="rounded-2xl border border-white/10 bg-slate-900 p-4"
        >
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between rounded-lg bg-slate-950/70 px-3 py-2">
              Admins can deploy to production
              <input type="checkbox" defaultChecked />
            </label>
            <label className="flex items-center justify-between rounded-lg bg-slate-950/70 px-3 py-2">
              Editors can create API keys
              <input type="checkbox" defaultChecked />
            </label>
          </div>
        </FeatureCard>
      </div>
    </div>
  );
}
