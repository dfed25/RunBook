import { Fragment, type ReactNode } from "react";

function formatInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (m) {
      return (
        <strong key={i} className="font-semibold text-slate-50">
          {m[1]}
        </strong>
      );
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

function isBulletLine(line: string): boolean {
  return /^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
}

function stripBulletPrefix(line: string): string {
  return line.replace(/^\s*[-*]\s+/, "").replace(/^\s*\d+\.\s+/, "");
}

/**
 * Renders assistant chat with readable structure (markdown-lite from the model).
 * User messages stay plain.
 */
export function ChatMessageBody({ role, text }: { role: "user" | "assistant"; text: string }) {
  if (role === "user") {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }

  const blocks = text.trim().split(/\n\n+/).filter((b) => b.trim());
  if (blocks.length === 0) {
    return <span className="text-slate-500">—</span>;
  }

  return (
    <div className="max-w-none space-y-4 text-left text-sm leading-relaxed">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const first = lines[0]?.trim() ?? "";

        if (first.startsWith("## ")) {
          const title = first.replace(/^##\s+/, "");
          const rest = lines
            .slice(1)
            .join("\n")
            .trim();
          return (
            <div key={bi} className="space-y-2 border-b border-slate-700/60 pb-3 last:border-0 last:pb-0">
              <h4 className="text-[13px] font-semibold tracking-wide text-cyan-200">{formatInline(title)}</h4>
              {rest ? (
                <p className="whitespace-pre-wrap break-words text-slate-200">{formatInline(rest)}</p>
              ) : null}
            </div>
          );
        }

        const nonEmpty = lines.filter((l) => l.trim());
        const allBullets = nonEmpty.length > 0 && nonEmpty.every((l) => isBulletLine(l));
        if (allBullets) {
          return (
            <ul
              key={bi}
              className="list-disc space-y-2 pl-5 text-slate-200 marker:text-cyan-400 [&>li]:pl-1"
            >
              {nonEmpty.map((line, li) => (
                <li key={li} className="whitespace-pre-wrap break-words pl-0.5">
                  {formatInline(stripBulletPrefix(line))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={bi} className="whitespace-pre-wrap break-words text-slate-200">
            {lines.map((line, li) => (
              <Fragment key={li}>
                {li > 0 ? <br /> : null}
                {formatInline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
