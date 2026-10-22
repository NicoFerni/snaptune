// The Zoho Mail inboxes (nicolas@ and support@getsnaptune.com) for the admin panel, over Zoho's REST
// API. Each Zoho user needs its own OAuth "Self Client" from api-console.zoho.com:
//
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN                     the first user
//   ZOHO_<NAME>_CLIENT_ID, ZOHO_<NAME>_CLIENT_SECRET, ZOHO_<NAME>_REFRESH_TOKEN   any more (e.g. SUPPORT)
//   ZOHO_DOMAIN   optional, the data centre: zoho.com (default), zoho.eu, zoho.in, …
//
// Scopes: ZohoMail.accounts.READ,ZohoMail.folders.READ,ZohoMail.messages.ALL
// (with ZohoMail.messages.READ instead, reading works and sending, marking and deleting fail).

const domain = process.env.ZOHO_DOMAIN ?? "zoho.com";

type Credential = { name: string; clientId: string; clientSecret: string; refreshToken: string };

const credentials: Credential[] = [""]
  .concat(Object.keys(process.env).flatMap((k) => k.match(/^ZOHO_(\w+)_REFRESH_TOKEN$/)?.[1] ?? []))
  .flatMap((name) => {
    const p = name ? `ZOHO_${name}_` : "ZOHO_";
    const [clientId, clientSecret, refreshToken] = ["CLIENT_ID", "CLIENT_SECRET", "REFRESH_TOKEN"].map((k) => process.env[p + k]);
    return clientId && clientSecret && refreshToken ? [{ name: name || "MAIN", clientId, clientSecret, refreshToken }] : [];
  });

export const mailConfigured = credentials.length > 0;
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

export type Attachment = { attachmentId: string; name: string; size: number };

// Access tokens last an hour, and Zoho limits how often one may be minted, so keep them per instance.
const tokens = new Map<string, { token: string; expires: number }>();

async function accessToken(c: Credential): Promise<string> {
  const cached = tokens.get(c.name);
  if (cached && cached.expires > Date.now()) return cached.token;

  const params = new URLSearchParams({
    refresh_token: c.refreshToken,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(`https://accounts.${domain}/oauth/v2/token`, { method: "POST", body: params, cache: "no-store" });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!body.access_token) throw new Error(`Zoho token (${c.name}): ${body.error ?? res.status}`);

  tokens.set(c.name, { token: body.access_token, expires: Date.now() + ((body.expires_in ?? 3600) - 120) * 1000 });
  return body.access_token;
}

async function request(c: Credential, path: string, init: { method?: string; body?: unknown; accept?: string } = {}): Promise<Response> {
  const raw = init.body instanceof FormData;
  return fetch(`https://mail.${domain}/api${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: init.accept ?? "application/json",
      ...(init.body === undefined || raw ? {} : { "Content-Type": "application/json" }),
      Authorization: `Zoho-oauthtoken ${await accessToken(c)}`,
    },
    body: init.body === undefined ? undefined : raw ? (init.body as FormData) : JSON.stringify(init.body),
    cache: "no-store",
  });
}

async function zoho<T>(c: Credential, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await request(c, path, init);
  const body = (await res.json().catch(() => ({}))) as { data?: T & { moreInfo?: string }; status?: { description?: string } };
  if (!res.ok || ((init.method ?? "GET") === "GET" && body.data === undefined)) {
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

// Which credential opens which mailbox, filled by accounts().
const owner = new Map<string, Credential>();

export async function accounts(): Promise<MailAccount[]> {
  const perCredential = await Promise.all(
    credentials.map(async (c) => {
      const list = await zoho<
        { accountId: string; primaryEmailAddress?: string; mailboxAddress?: string; sendMailDetails?: { fromAddress: string }[] }[]
      >(c, "/accounts");
      return list.map((a) => {
        const accountId = String(a.accountId);
        owner.set(accountId, c);
        const address = a.primaryEmailAddress ?? a.mailboxAddress ?? accountId;
        const sendFrom = (a.sendMailDetails ?? []).map((d) => d.fromAddress).filter(Boolean);
        return { accountId, address, sendFrom: sendFrom.length ? [...new Set(sendFrom)] : [address] };
      });
    }),
  );
  // Two credentials can share a mailbox (a shared or delegated one): list it once.
  return [...new Map(perCredential.flat().map((a) => [a.accountId, a])).values()];
}

async function credentialFor(accountId: string): Promise<Credential> {
  if (!ids(accountId)) throw new Error("Bad account id");
  if (!owner.has(accountId)) await accounts();
  const c = owner.get(accountId);
  if (!c) throw new Error("No Zoho credential opens that mailbox");
  return c;
}

async function folderId(accountId: string, type: FolderType): Promise<string | null> {
  const c = await credentialFor(accountId);
  const folders = await zoho<{ folderId: string; folderType: string; folderName: string }[]>(c, `/accounts/${accountId}/folders`);
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

/** One folder across every mailbox, newest first. `start` counts from 0. */
export async function readFolder(type: FolderType = "Inbox", { start = 0, limit = 30 } = {}) {
  const list = await accounts();
  const perAccount = await Promise.all(
    list.map(async (a) => {
      const folder = await folderId(a.accountId, type);
      if (!folder) return [];
      // Each mailbox gives its first start + limit, so the merged page is right across mailboxes.
      const raw = await zoho<RawMessage[]>(
        owner.get(a.accountId)!,
        `/accounts/${a.accountId}/messages/view?folderId=${folder}&limit=${Math.min(200, start + limit)}&includeto=true`,
      );
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

/** One message's headers, HTML body and attachments. The body is untrusted: show it only in a sandboxed iframe. */
export async function readMessage(accountId: string, folder: string, messageId: string) {
  if (!ids(accountId, folder, messageId)) throw new Error("Bad message id");
  const c = await credentialFor(accountId);
  const base = `/accounts/${accountId}/folders/${folder}/messages/${messageId}`;
  const [details, content, info] = await Promise.all([
    zoho<{ subject?: string; sender?: string; fromAddress?: string; toAddress?: string; ccAddress?: string; receivedTime?: string }>(
      c,
      `${base}/details`,
    ),
    zoho<{ content: string }>(c, `${base}/content`),
    zoho<{ attachments?: { attachmentId: string; attachmentName: string; attachmentSize: number }[] }>(c, `${base}/attachmentinfo`).catch(() => ({
      attachments: [],
    })),
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
    attachments: (info.attachments ?? []).map((a): Attachment => ({ attachmentId: String(a.attachmentId), name: a.attachmentName, size: Number(a.attachmentSize) })),
  };
}

/** An attachment's bytes, straight from Zoho. */
export async function downloadAttachment(accountId: string, folder: string, messageId: string, attachmentId: string): Promise<Response> {
  if (!ids(accountId, folder, messageId, attachmentId)) throw new Error("Bad attachment id");
  const c = await credentialFor(accountId);
  const res = await request(c, `/accounts/${accountId}/folders/${folder}/messages/${messageId}/attachments/${attachmentId}`, { accept: "*/*" });
  if (!res.ok) throw new Error(`Zoho Mail ${res.status}`);
  return res;
}

export type Outgoing = {
  accountId: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  html: string;
  /** The original's messageId, for a reply (Zoho threads it). */
  replyTo?: string;
  files?: File[];
};

/** Sends a new message or a reply, uploading any files to Zoho first. */
export async function sendMail(m: Outgoing): Promise<void> {
  if (m.replyTo && !ids(m.replyTo)) throw new Error("Bad message id");
  const c = await credentialFor(m.accountId);

  let attachments: { storeName: string; attachmentPath: string; attachmentName: string }[] = [];
  if (m.files?.length) {
    const form = new FormData();
    for (const f of m.files) form.append("attach", f, f.name);
    const uploaded = await zoho<{ storeName: string; attachmentPath: string; attachmentName: string }[]>(
      c,
      `/accounts/${m.accountId}/messages/attachments?uploadType=multipart`,
      { method: "POST", body: form },
    );
    attachments = uploaded.map(({ storeName, attachmentPath, attachmentName }) => ({ storeName, attachmentPath, attachmentName }));
  }

  const body = {
    fromAddress: m.from,
    toAddress: m.to,
    ...(m.cc ? { ccAddress: m.cc } : {}),
    subject: m.subject,
    content: m.html,
    mailFormat: "html",
    ...(m.replyTo ? { action: "reply" } : {}),
    ...(attachments.length ? { attachments } : {}),
  };
  await zoho(c, `/accounts/${m.accountId}/messages${m.replyTo ? `/${m.replyTo}` : ""}`, { method: "POST", body });
}

export async function markRead(accountId: string, messageId: string, read: boolean): Promise<void> {
  if (!ids(messageId)) throw new Error("Bad message id");
  const c = await credentialFor(accountId);
  await zoho(c, `/accounts/${accountId}/updatemessage`, {
    method: "PUT",
    body: { mode: read ? "markAsRead" : "markAsUnread", messageId: [messageId] },
  });
}

/** Moves a message to the trash (Zoho empties it on its own schedule). */
export async function trash(accountId: string, folder: string, messageId: string): Promise<void> {
  if (!ids(folder, messageId)) throw new Error("Bad message id");
  const c = await credentialFor(accountId);
  await zoho(c, `/accounts/${accountId}/folders/${folder}/messages/${messageId}`, { method: "DELETE" });
}
