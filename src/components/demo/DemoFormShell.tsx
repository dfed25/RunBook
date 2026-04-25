import type { ReactNode } from "react";

export type DemoReadonlyField = {
  label: string;
  value: string;
  multiline?: boolean;
};

type DemoFormShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  badge: { text: string; className: string };
  gridFields: DemoReadonlyField[];
  detailFields: DemoReadonlyField[];
  callout: {
    title: string;
    items: string[];
    containerClassName: string;
    titleClassName?: string;
    listClassName?: string;
  };
};

function FieldRow({ field }: { field: DemoReadonlyField }) {
  const inputClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900";
  return (
    <label className="text-sm font-medium text-slate-700">
      {field.label}
      {field.multiline ? (
        <textarea readOnly value={field.value} className={`${inputClass} min-h-24`} />
      ) : (
        <input readOnly value={field.value} className={inputClass} />
      )}
    </label>
  );
}

export function DemoFormShell({
  eyebrow,
  title,
  subtitle,
  badge,
  gridFields,
  detailFields,
  callout,
}: DemoFormShellProps) {
  const listClass = callout.listClassName ?? "list-disc space-y-1 pl-5";
  const titleClass = callout.titleClassName ?? "font-semibold";

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
        >
          {badge.text}
        </span>
      </div>

      <section className="grid gap-5 sm:grid-cols-2">
        {gridFields.map((field) => (
          <FieldRow key={field.label} field={field} />
        ))}
      </section>

      <section className="mt-6 grid gap-5">
        {detailFields.map((field) => (
          <FieldRow key={field.label} field={field} />
        ))}
      </section>

      <div className={`mt-8 rounded-lg p-4 text-sm ${callout.containerClassName}`}>
        <p className={titleClass}>{callout.title}</p>
        <ul className={`mt-2 ${listClass}`}>
          {callout.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DemoPageLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-100 py-10 px-4">{children}</main>;
}
