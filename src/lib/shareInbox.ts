/**
 * The share inbox (§5.16, L8): where shared or picked images wait until the
 * person chooses where they go. It lives in Cache Storage so the service
 * worker can fill it without Dexie, and the page reads, resizes and saves.
 * No DOM here — it runs in the worker too.
 */

export const INBOX = "tsl-share-inbox";
const META = "/__inbox/meta";
const file = (i: number) => `/__inbox/${i}`;

export interface InboxMeta {
  count: number;
  /** A link that came with the share, if any — Instagram and YouTube share their URL as text. */
  url?: string;
  /** Whatever title the sharing app sent. */
  title?: string;
}

/** The first http(s) link in a piece of shared text. */
export function findUrl(...texts: (string | null | undefined)[]): string | undefined {
  for (const t of texts) {
    const m = t?.match(/https?:\/\/\S+/);
    if (m) return m[0].replace(/[).,]+$/, "");
  }
  return undefined;
}

/** Put files (and the link they came with) in the inbox, replacing whatever was there. */
export async function stashFiles(caches: CacheStorage, files: Blob[], meta: Omit<InboxMeta, "count"> = {}): Promise<void> {
  await caches.delete(INBOX);
  const cache = await caches.open(INBOX);
  await Promise.all(files.map((f, i) => cache.put(file(i), new Response(f, { headers: { "content-type": f.type || "application/octet-stream" } }))));
  await cache.put(META, new Response(JSON.stringify({ ...meta, count: files.length } satisfies InboxMeta), { headers: { "content-type": "application/json" } }));
}

/**
 * The share target's POST (manifest: images as "images", plus title, text
 * and url). Images wait in the inbox for L8; a link on its own — sharing a
 * reel or a video — goes to the link screen with it filled in.
 */
export async function receiveShare(caches: CacheStorage, form: FormData): Promise<string> {
  const images = form.getAll("images").filter((v): v is File => typeof v !== "string" && v.type.startsWith("image/"));
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  const url = findUrl(text("url"), text("text"), text("title"));
  if (images.length === 0 && url) return `/look/link?url=${encodeURIComponent(url)}&shared=1`;
  await stashFiles(caches, images, { url, title: text("title") });
  return "/look/share";
}

export async function readInbox(caches: CacheStorage): Promise<{ meta: InboxMeta; files: Blob[] } | undefined> {
  const cache = await caches.open(INBOX);
  const metaRes = await cache.match(META);
  if (!metaRes) return undefined;
  const meta = (await metaRes.json()) as InboxMeta;
  const files: Blob[] = [];
  for (let i = 0; i < meta.count; i++) {
    const r = await cache.match(file(i));
    if (r) files.push(await r.blob());
  }
  return { meta, files };
}

export async function clearInbox(caches: CacheStorage): Promise<void> {
  await caches.delete(INBOX);
}
