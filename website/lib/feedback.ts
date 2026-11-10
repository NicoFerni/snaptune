import { hashIp, redis } from "@/lib/telemetry";

// Messages from the feedback form (app/feedback) and the notice the plugin shows in its header
// (app/api/version), in the same Upstash Redis as the usage pings.
//
//   feedback  list, newest first, capped at MAX_FEEDBACK: every message
//   notice    the header notice as JSON, absent when there's none

export type Feedback = {
  t: number;
  message: string;
  /** Only when the sender wants an answer. */
  email: string;
  /** Where it was sent from, as the plugin's Feedback button put it in the address; empty from the site. */
  version: string;
  os: string;
  host: string;
  format: string;
  country: string;
};

const MAX_FEEDBACK = 2000;
const PER_HOUR = 5;

/** False once an IP has sent PER_HOUR messages within the hour. Only a hash of the IP is kept, and it expires. */
export async function allowFeedback(ip: string): Promise<boolean> {
  const key = `fb:rate:${await hashIp(ip)}`;
  const [, count] = await redis(["SET", key, 0, "EX", 3600, "NX"], ["INCR", key]);
  return (count as number) <= PER_HOUR;
}

export async function saveFeedback(feedback: Feedback): Promise<void> {
  await redis(["LPUSH", "feedback", JSON.stringify(feedback)], ["LTRIM", "feedback", 0, MAX_FEEDBACK - 1]);
}

export async function readFeedback(limit = 50): Promise<{ total: number; messages: Feedback[] }> {
  const [total, list] = await redis(["LLEN", "feedback"], ["LRANGE", "feedback", 0, limit - 1]);
  return { total: total as number, messages: ((list as string[]) ?? []).map((m) => JSON.parse(m) as Feedback) };
}

/** A line for the plugin's header and the page of this site it opens. The plugin shows a notice
    until it's clicked, once per id, and refuses one longer than NOTICE_LENGTH or pointing off the site. */
export type HeaderNotice = { id: string; text: string; url: string };

export const NOTICE_LENGTH = 40;
export const NOTICE_ORIGIN = "https://getsnaptune.com/";

export async function readNotice(): Promise<HeaderNotice | null> {
  const [stored] = (await redis(["GET", "notice"])) as (string | null)[];
  return stored ? (JSON.parse(stored) as HeaderNotice) : null;
}

export async function saveNotice(text: string, url: string): Promise<void> {
  const notice: HeaderNotice = { id: String(Date.now()), text, url };
  await redis(["SET", "notice", JSON.stringify(notice)]);
}

export async function clearNotice(): Promise<void> {
  await redis(["DEL", "notice"]);
}
