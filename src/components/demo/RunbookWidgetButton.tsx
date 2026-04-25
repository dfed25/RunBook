type RunbookWidgetButtonProps = {
  onClick: () => void;
};

export function RunbookWidgetButton({ onClick }: RunbookWidgetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed right-6 bottom-6 z-50 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      aria-label="Open Runbook assistant"
    >
      Runbook Assistant
    </button>
  );
}
