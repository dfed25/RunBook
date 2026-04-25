"use client";

import type { ReactNode } from "react";
import { useEffect, useId } from "react";
import type { DemoTaskContext } from "./demoTaskMap";

type RunbookWidgetPanelProps = {
  task: DemoTaskContext;
  onClose: () => void;
  children?: ReactNode;
};

export function RunbookWidgetPanel({
  task,
  onClose,
  children,
}: RunbookWidgetPanelProps) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className="fixed right-6 bottom-24 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Runbook Assistant
          </p>
          <h2 id={titleId} className="mt-1 text-lg font-semibold text-slate-900">
            {task.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      <p className="mt-3 text-sm text-slate-700">{task.description}</p>
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
          Next step
        </p>
        <p className="mt-1 text-sm text-blue-900">{task.nextStep}</p>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </aside>
  );
}
