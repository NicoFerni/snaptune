"use client";

import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the command is still selectable.
    }
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-2xl bg-bg/60 p-2 pl-4 font-mono text-[13px] leading-relaxed tracking-normal">
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all py-1.5 text-ink/90">
        <span className="select-none text-teal">$ </span>
        {command}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="min-h-8 shrink-0 rounded-full bg-panel-2 px-4 font-sans text-[13px] font-medium tracking-[-0.01em] text-ink transition hover:bg-teal hover:text-bg"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Command copied" : ""}
      </span>
    </div>
  );
}
