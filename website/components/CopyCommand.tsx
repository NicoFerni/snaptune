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
    <div className="group relative mt-3 rounded-xl border border-line bg-black/40 font-mono text-[13px] leading-relaxed">
      <pre className="overflow-x-auto px-4 py-3 pr-20 text-ink/90">
        <span className="select-none text-teal">$ </span>
        {command}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 rounded-md border border-line bg-panel px-2.5 py-1 font-sans text-xs font-medium text-muted transition hover:border-teal/50 hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Command copied" : ""}
      </span>
    </div>
  );
}
