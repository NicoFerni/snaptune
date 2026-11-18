"use client";

import { useState } from "react";

// Several views in one panel, one at a time. The views are rendered on the server and passed in;
// this only picks which shows.

export default function Tabs({ id, tabs }: { id: string; tabs: { label: string; content: React.ReactNode }[] }) {
  const [current, setCurrent] = useState(0);

  return (
    <div>
      <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto text-sm" role="tablist" aria-label={id}>
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === current}
            onClick={() => setCurrent(i)}
            className={`shrink-0 rounded-md px-3 py-1 ${i === current ? "bg-line-bright text-ink" : "text-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} role="tabpanel" hidden={i !== current}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
