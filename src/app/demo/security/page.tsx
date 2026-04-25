import { DemoFormShell, DemoPageLayout } from "@/components/demo/DemoFormShell";
import { RunbookWidget } from "@/components/demo/RunbookWidget";

export default function DemoSecurityPage() {
  return (
    <DemoPageLayout>
      <DemoFormShell
        eyebrow="Northstar Security Portal"
        title="Security onboarding checklist"
        subtitle="Complete required training and access controls before production work."
        badge={{
          text: "Training in progress",
          className: "bg-violet-100 text-violet-900",
        }}
        gridFields={[
          { label: "Employee", value: "Jordan Lee" },
          { label: "Department", value: "Engineering" },
          { label: "Manager", value: "Sam Rivera" },
          { label: "Due date", value: "2026-04-28" },
        ]}
        detailFields={[
          {
            label: "Assigned modules",
            value: "Security essentials · Phishing awareness · Secret handling for engineers",
            multiline: true,
          },
          {
            label: "2FA status",
            value: "GitHub: required · SSO: required · VPN: enrolled",
            multiline: true,
          },
          {
            label: "Acknowledgements",
            value:
              "I will report suspicious messages to #security and will not paste secrets in Slack, email, or tickets.",
            multiline: true,
          },
        ]}
        callout={{
          title: "Before you continue",
          items: [
            "Use only the company password manager for shared credentials.",
            "Complete all modules before requesting production access.",
            "Screenshot any portal errors and send to security@northstar.ai.",
          ],
          containerClassName: "border border-violet-200 bg-violet-50 text-violet-950",
          titleClassName: "font-semibold text-violet-950",
        }}
      />
      <RunbookWidget key="security" pageKey="security" />
    </DemoPageLayout>
  );
}
