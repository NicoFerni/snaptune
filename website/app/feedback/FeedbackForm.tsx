"use client";

import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "./actions";

export type FeedbackContext = { v: string; os: string; host: string; format: string };

export function FeedbackForm({ context }: { context: FeedbackContext }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});
  const sentWith = [context.v && `SnapTune ${context.v}`, context.format, context.host, context.os].filter(Boolean).join(" · ");

  if (state.sent) {
    return (
      <div className="feedback-card" role="status">
        <h2 className="guide-heading">Got it, thank you</h2>
        <p>I read every message. If you left an email address, I&apos;ll answer there.</p>
      </div>
    );
  }

  return (
    <form action={action} className="feedback-card">
      {Object.entries(context).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <label htmlFor="feedback-message">Your message</label>
      <textarea id="feedback-message" name="message" rows={7} required minLength={3} maxLength={4000} placeholder="What works, what doesn't, what's missing…" />

      <label htmlFor="feedback-email">
        Email <span>(optional, only if you want an answer)</span>
      </label>
      <input id="feedback-email" name="email" type="email" maxLength={200} autoComplete="email" />

      {/* Not for people: scripts that fill every field give themselves away here. */}
      <div className="feedback-trap" aria-hidden="true">
        <label htmlFor="feedback-website">Website</label>
        <input id="feedback-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {sentWith && <p className="feedback-context">Sent along with it: {sentWith}.</p>}
      {state.error && (
        <p className="feedback-error" role="alert">
          {state.error}
        </p>
      )}

      <button type="submit" className="button button-ink" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
