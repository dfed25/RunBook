"use client";

import { useEffect, useState } from "react";
import { EmbeddedRunbookAssistant } from "@/components/EmbeddedRunbookAssistant";
import { loadDemoBundle, type DemoBundle } from "@/lib/studioDemoStorage";

export default function EmbedDemoPage() {
  const [bundle, setBundle] = useState<DemoBundle>(() => loadDemoBundle());

  useEffect(() => {
    const refresh = () => setBundle(loadDemoBundle());
    window.addEventListener("storage", refresh);
    window.addEventListener("runbook-demo-update", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("runbook-demo-update", refresh);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              N
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Northstar AI</p>
              <h1 className="text-lg font-semibold text-slate-900">Developer Portal</h1>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm font-medium text-slate-600 sm:flex">
            <span className="text-indigo-600">Docs</span>
            <span className="cursor-default hover:text-slate-900">API</span>
            <span className="cursor-default hover:text-slate-900">Support</span>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 md:grid-cols-[220px_1fr]">
        <aside className="hidden text-sm md:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">On this page</p>
          <ul className="space-y-2 text-slate-600">
            <li>
              <a href="#getting-started" className="hover:text-indigo-600">
                Getting Started
              </a>
            </li>
            <li>
              <a href="#api-keys" className="hover:text-indigo-600">
                API Keys
              </a>
            </li>
            <li>
              <a href="#github" className="hover:text-indigo-600">
                GitHub Setup
              </a>
            </li>
            <li>
              <a href="#deploy" className="hover:text-indigo-600">
                Deploying Your First Workflow
              </a>
            </li>
          </ul>
        </aside>

        <article className="prose prose-slate max-w-none">
          <p className="text-sm text-slate-500">
            This page mirrors a customer app. The assistant is the same <strong>React embed</strong> used in Studio
            preview; production sites typically load <code className="rounded bg-slate-100 px-1">/runbook-embed.js</code>{" "}
            instead. Config and manual sources sync from <strong>Studio</strong> via this browser&apos;s{" "}
            <code className="rounded bg-slate-100 px-1">localStorage</code>.
          </p>

          <section id="getting-started" className="scroll-mt-24">
            <h2 className="mt-10 text-2xl font-bold text-slate-900">Getting Started</h2>
            <p>
              Welcome to the Northstar AI developer portal. Here you will connect your workspace, generate API keys, and
              link GitHub so workflows can run against your repositories.
            </p>
            <p>
              Most teams finish initial setup in under an hour. Follow the sections below in order — each builds on the
              previous one.
            </p>
          </section>

          <section id="api-keys" className="scroll-mt-24">
            <h2 className="mt-10 text-2xl font-bold text-slate-900">API Keys</h2>
            <p>
              API keys authenticate requests from your apps and CI pipelines. Create a <strong>development</strong> key
              first; promote to production only after you have validated your integration in staging.
            </p>
            <p>
              Never commit keys to source control. Use environment variables or your platform secret manager. Rotate keys
              immediately if they are exposed.
            </p>
          </section>

          <section id="github" className="scroll-mt-24">
            <h2 className="mt-10 text-2xl font-bold text-slate-900">GitHub Setup</h2>
            <p>
              Northstar syncs workflow definitions from GitHub. Install the GitHub app for your organization, select the
              repositories you want to automate, and grant read access to workflow files in <code>.github/</code> paths.
            </p>
            <p>
              If you are unsure which repos to connect, start with a single sandbox repository and expand once your first
              workflow runs successfully.
            </p>
          </section>

          <section id="deploy" className="scroll-mt-24">
            <h2 className="mt-10 text-2xl font-bold text-slate-900">Deploying Your First Workflow</h2>
            <p>
              After GitHub is linked, pick a template workflow from the catalog or author YAML in your repo. Push to a
              feature branch; Northstar validates the definition and offers a one-click deploy to your staging environment.
            </p>
            <p>
              Use the Runbook assistant (bottom-right) to ask how access, keys, and rollout fit together — answers use
              keyword retrieval over seeded docs plus any manual sources you added in Studio.
            </p>
          </section>
        </article>
      </div>

      <EmbeddedRunbookAssistant
        key={`${bundle.assistantName}-${bundle.primaryColor}-${bundle.manualSources.length}-${bundle.suggestedQuestions.join("|")}`}
        assistantName={bundle.assistantName}
        welcomeMessage={bundle.welcome}
        primaryColor={bundle.primaryColor}
        suggestedQuestions={bundle.suggestedQuestions}
        manualSources={bundle.manualSources}
        position="page"
      />
    </div>
  );
}
