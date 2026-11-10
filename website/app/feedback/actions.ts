"use server";

import { headers } from "next/headers";
import { allowFeedback, saveFeedback } from "@/lib/feedback";
import { storageConfigured } from "@/lib/telemetry";

// The feedback form's only action: keep the message for the admin panel. Open to anyone, so it
// limits what it takes: lengths, five messages an hour per IP, and a field people never see.

export type FeedbackState = { sent?: boolean; error?: string };

const field = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().slice(0, max);

export async function sendFeedback(_: FeedbackState, form: FormData): Promise<FeedbackState> {
  // Hidden from people; a script that fills every field gets a thank-you and nothing is kept.
  if (field(form, "website", 200)) return { sent: true };

  const message = field(form, "message", 4000);
  const email = field(form, "email", 200);
  if (message.length < 3) return { error: "Write a few words first." };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "That email address doesn't look right. Leave it empty if you don't want an answer." };
  if (!storageConfigured) return { error: "The form isn't working right now. Write to support@getsnaptune.com instead." };

  const request = await headers();
  const ip = request.get("x-forwarded-for")?.split(",")[0]?.trim();

  try {
    if (ip && !(await allowFeedback(ip))) return { error: "That's a lot of messages in one hour. Try again later, or write to support@getsnaptune.com." };
    await saveFeedback({
      t: Date.now(),
      message,
      email,
      version: field(form, "v", 20),
      os: field(form, "os", 60),
      host: field(form, "host", 60),
      format: field(form, "format", 20),
      // Vercel geolocates the request; only the country is kept, never the IP.
      country: request.get("x-vercel-ip-country") ?? "",
    });
  } catch {
    return { error: "It didn't go through. Try again, or write to support@getsnaptune.com." };
  }

  return { sent: true };
}
