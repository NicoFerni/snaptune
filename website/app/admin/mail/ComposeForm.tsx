"use client";

import { useActionState, useState } from "react";
import { MAX_UPLOAD } from "@/lib/mail-limits";
import { sendAction, type ComposeState } from "./actions";

export type ComposeDefaults = {
  mode: "new" | "reply" | "all" | "forward";
  from: { value: string; label: string }[];
  defaultFrom: string;
  to: string;
  cc: string;
  subject: string;
  original?: { a: string; f: string; m: string };
  /** A forward's attachments, sent along unless unticked. */
  forwarded?: string[];
};

const input = "w-full rounded-lg border border-line bg-deep px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-line-bright focus:outline-none";

export function ComposeForm({ defaults }: { defaults: ComposeDefaults }) {
  const [state, action, pending] = useActionState<ComposeState, FormData>(sendAction, {});
  const [tooBig, setTooBig] = useState(false);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="mode" value={defaults.mode} />
      {defaults.original && (
        <>
          <input type="hidden" name="a" value={defaults.original.a} />
          <input type="hidden" name="f" value={defaults.original.f} />
          <input type="hidden" name="m" value={defaults.original.m} />
        </>
      )}

      <Row label="From">
        <select name="from" defaultValue={defaults.defaultFrom} className={input}>
          {defaults.from.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </Row>
      <Row label="To">
        <input name="to" defaultValue={defaults.to} className={input} placeholder="name@example.com, …" autoFocus={!defaults.to} />
      </Row>
      <Row label="Cc">
        <input name="cc" defaultValue={defaults.cc} className={input} />
      </Row>
      <Row label="Subject">
        <input name="subject" defaultValue={defaults.subject} className={input} />
      </Row>
      <textarea name="body" rows={12} className={input} autoFocus={Boolean(defaults.to)} placeholder="Write here…" />

      <Row label="Attach">
        <input
          type="file"
          name="files"
          multiple
          className="text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-line file:bg-deep file:px-3 file:py-1.5 file:text-ink"
          onChange={(e) => setTooBig([...(e.target.files ?? [])].reduce((sum, f) => sum + f.size, 0) > MAX_UPLOAD)}
        />
      </Row>
      {tooBig && <p className="text-sm text-coral">Over 4 MB together: this won&apos;t send. Send big files from Zoho.</p>}
      {defaults.forwarded && defaults.forwarded.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="keepAttachments" defaultChecked />
          Include the original&apos;s attachments: {defaults.forwarded.join(", ")}
        </label>
      )}

      {state.error && <p className="rounded-lg border border-coral/40 bg-coral/10 px-4 py-3 text-sm">{state.error}</p>}

      <div className="flex items-center gap-4">
        <button disabled={pending || tooBig} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-60">
          {pending ? "Sending…" : "Send"}
        </button>
        {defaults.mode !== "new" && (
          <span className="text-sm text-faint">{defaults.mode === "forward" ? "The original goes below your text." : "The original is quoted below your text."}</span>
        )}
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[4.5rem_1fr] items-center gap-3 text-sm">
      <span className="text-faint">{label}</span>
      {children}
    </label>
  );
}
