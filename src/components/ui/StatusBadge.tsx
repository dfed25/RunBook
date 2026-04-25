type StatusBadgeProps = {
  tone: "success" | "warning" | "neutral";
  children: string;
};

const toneMap: Record<StatusBadgeProps["tone"], string> = {
  success: "bg-emerald-500/20 text-emerald-200 border border-emerald-400/30",
  warning: "bg-amber-500/20 text-amber-200 border border-amber-400/30",
  neutral: "bg-slate-700 text-slate-200 border border-slate-600",
};

export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneMap[tone]}`}>{children}</span>;
}
