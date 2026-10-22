// The Zoho Mail inboxes (nicolas@ and support@getsnaptune.com) for the admin panel, over Zoho's REST
// API. One OAuth "Self Client" refresh token covers every mailbox its user can open.
//
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN   from api-console.zoho.com
//   ZOHO_DOMAIN   optional, the data centre: zoho.com (default), zoho.eu, zoho.in, …
//
// Scopes: ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL
// (with ZohoMail.messages.READ instead, reading works and sending, marking and deleting fail).

const clientId = process.env.ZOHO_CLIENT_ID;
const clientSecret = process.env.ZOHO_CLIENT_SECRET;
const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
const domain = process.env.ZOHO_DOMAIN ?? "zoho.com";

export const mailConfigured = Boolean(clientId && clientSecret && refreshToken);
export const webmail = `https://mail.${domain}/zm/`;

/** The folders the panel shows, by Zoho's folderType. */
export const FOLDERS = ["Inbox", "Sent", "Spam", "Trash"] as const;
export type FolderType = (typeof FOLDERS)[number];

export type MailAccount = { accountId: string; address: string; sendFrom: string[] };

export type MailMessage = {
  accountId: string;
  folderId: string;
  messageId: string;
  inbox: string;
  from: string;
  fromAddress: string;
  to: string;
  subject: string;
  summary: string;
  received: number;
  unread: boolean;
  attachment: boolean;
};

// Access tokens last an hour, and Zoho limits how often one may be minted, so keep it per instance.
let cached: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.token;
  if (!mailConfigured) throw new Error("Zoho Mail is not configured");

  const params = new URLSearchParams({
    refresh_token: refreshToken!,
    client_id: clientId!,
    client_secret: clientSecret!,
    grant_type: "refresh_token",
  });
  const res = await fetch(`https://accounts.${domain}/oauth/v2/token`, { method: "POST", body: params, cache: "no-store" });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!body.access_token) throw new Error(`Zoho token: ${body.error ?? res.status}`);

  cached = { token: body.access_token, expires: Date.now() + ((body.expires_in ?? 3600) - 120) * 1000 };
  return cached.token;
}

async function zoho<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`https://mail.${domain}/api${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Zoho-oauthtoken ${await accessToken()}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T & { moreInfo?: string }; status?: { description?: string } };
  if (!res.ok || (init.method ?? "GET") === "GET" && body.data === undefined) {
    throw new Error(`Zoho Mail ${res.status}: ${body.data?.moreInfo ?? body.status?.description ?? "no data"}`);
  }
  return body.data as T;
}

// Addresses come back HTML-escaped ("Name"&lt;a@b.com&gt;); React escapes again on output.
function unescape(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/** The bare addresses in a header like `"Ana"<ana@x.com>, bo@y.com` ("Not Provided" gives none). */
export function addresses(header: string): string[] {
  return header.match(/[^\s<>,;"]+@[^\s<>,;"]+/g) ?? [];
}

const ids = (...values: string[]) => values.every((v) => /^\d+$/.test(v));

export async function accounts(): Promise<MailAccount[]> {
  const list = await zoho<
    { accountId: string; primaryEmailAddress?: string; mailboxAddress?: string; sendMailDetails?: { fromAddress: string }[] }[]
  >("/accounts");
  return list.map((a) => {
    const address = a.primaryEmailAddress ?? a.mailboxAddress ?? String(a.accountId);
    const sendFrom = (a.sendMailDetails ?? []).map((d) => d.fromAddress).filter(Boolean);
    return { accountId: String(a.accountId), address, sendFrom: sendFrom.length ? [...new Set(sendFrom)] : [address] };
  });
}

async function folderId(accountId: string, type: FolderType): Promise<string | null> {
  const folders = await zoho<{ folderId: string; folderType: string; folderName: string }[]>(`/accounts/${accountId}/folders`);
  const folder = folders.find((f) => f.folderType === type) ?? folders.find((f) => f.folderName.toLowerCase() === type.toLowerCase());
  return folder ? String(folder.folderId) : null;
}

type RawMessage = {
  messageId: string;
  folderId: string;
  sender: string;
  fromAddress: string;
  toAddress?: string;
  subject: string;
  summary: string;
  receivedTime: string;
  status: string;
  hasAttachment: string;
};

/** One folder across every mailbox the token can read, newest first. `start` counts from 0. */
export async function readFolder(type: FolderType = "Inbox", { start = 0, limit = 30 } = {}) {
  const list = await accounts();
  const perAccount = await Promise.all(
    list.map(async (a) => {
      const folder = await folderId(a.accountId, type);
      if (!folder) return [];
      // Each mailbox gives its first start + limit, so the merged page is right across mailboxes.
      const raw = await zoho<RawMessage[]>(`/accounts/${a.accountId}/messages/view?folderId=${folder}&limit=${Math.min(200, start + limit)}&includeto=true`);
      return raw.map(
        (m): MailMessage => ({
          accountId: a.accountId,
          folderId: String(m.folderId),
          messageId: String(m.messageId),
          inbox: a.address,
          from: unescape(m.sender || m.fromAddress),
          fromAddress: unescape(m.fromAddress),
          to: unescape(m.toAddress ?? ""),
          subject: unescape(m.subject || "(no subject)"),
          summary: unescape(m.summary ?? ""),
          received: Number(m.receivedTime),
          unread: m.status === "0",
          attachment: m.hasAttachment === "1",
        }),
      );
    }),
  );
  const all = perAccount.flat().sort((a, b) => b.received - a.received);
  return { accounts: list, messages: all.slice(start, start + limit), more: all.length > start + limit };
}

/** The latest inbox messages, for the summary on /admin. */
export const readInboxes = (limit = 30) => readFolder("Inbox", { limit });

/** One message's headers and HTML body. The body is untrusted: show it only in a sandboxed iframe. */
export async function readMessage(accountId: string, folder: string, messageId: string) {
  if (!ids(accountId, folder, messageId)) throw new Error("Bad message id");
  const base = `/accounts/${accountId}/folders/${folder}/messages/${messageId}`;
  const [details, content] = await Promise.all([
    zoho<{ subject?: string; sender?: string; fromAddress?: string; toAddress?: string; ccAddress?: string; receivedTime?: string; status?: string }>(
      `${base}/details`,
    ),
    zoho<{ content: string }>(`${base}/content`),
  ]);
  return {
    accountId,
    folderId: folder,
    messageId,
    subject: unescape(details.subject || "(no subject)"),
    from: unescape(details.sender ? `${details.sender} <${details.fromAddress}>` : details.fromAddress ?? ""),
    fromAddress: unescape(details.fromAddress ?? ""),
    to: unescape(details.toAddress ?? ""),
    cc: details.ccAddress && details.ccAddress !== "Not Provided" ? unescape(details.ccAddress) : "",
    received: Number(details.receivedTime),
    html: content.content,
  };
}

export type Outgoing = { accountId: string; from: string; to: string; cc?: string; subject: string; html: string; replyTo?: string };

/** Sends a new message, or a reply when `replyTo` is the original's messageId (Zoho threads it). */
export async function sendMail(m: Outgoing): Promise<void> {
  if (!ids(m.accountId) || (m.replyTo && !ids(m.replyTo))) throw new Error("Bad message id");
  const body = {
    fromAddress: m.from,
    toAddress: m.to,
    ...(m.cc ? { ccAddress: m.cc } : {}),
    subject: m.subject,
    content: m.html,
    mailFormat: "html",
    ...(m.replyTo ? { action: "reply" } : {}),
  };
  await zoho(`/accounts/${m.accountId}/messages${m.replyTo ? `/${m.replyTo}` : ""}`, { method: "POST", body });
}

export async function markRead(accountId: string, messageId: string, read: boolean): Promise<void> {
  if (!ids(accountId, messageId)) throw new Error("Bad message id");
  await zoho(`/accounts/${accountId}/updatemessage`, {
    method: "PUT",
    body: { mode: read ? "markAsRead" : "markAsUnread", messageId: [messageId] },
  });
}

/** Moves a message to the trash (Zoho empties it on its own schedule). */
export async function trash(accountId: string, folder: string, messageId: string): Promise<void> {
  if (!ids(accountId, folder, messageId)) throw new Error("Bad message id");
  await zoho(`/accounts/${accountId}/folders/${folder}/messages/${messageId}`, { method: "DELETE" });
}
