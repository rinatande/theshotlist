import { describe, expect, it } from "vitest";
import { clearInbox, findUrl, readInbox, receiveShare } from "./shareInbox";

/** Cache Storage, as far as the inbox uses it. */
function fakeCaches(): CacheStorage {
  const stores = new Map<string, Map<string, Response>>();
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name)!;
    return {
      put: async (key: string, res: Response) => void m.set(key, res),
      match: async (key: string) => m.get(key)?.clone(),
    } as unknown as Cache;
  };
  return { open, delete: async (name: string) => stores.delete(name) } as unknown as CacheStorage;
}

const png = (name: string) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });

describe("the share target (L8)", () => {
  it("keeps shared images and the link they came with, then sends you to L8", async () => {
    const caches = fakeCaches();
    const form = new FormData();
    form.append("images", png("a.png"));
    form.append("images", png("b.png"));
    form.append("text", "Watch this https://www.instagram.com/reel/C9xYz12/?igsh=abc.");
    expect(await receiveShare(caches, form)).toBe("/look/share");
    const inbox = await readInbox(caches);
    expect(inbox?.meta).toEqual({ count: 2, url: "https://www.instagram.com/reel/C9xYz12/?igsh=abc", title: undefined });
    expect(inbox?.files.map((f) => f.size)).toEqual([4, 4]);
  });

  it("sends a link on its own to the link screen, filled in", async () => {
    const form = new FormData();
    form.append("url", "https://youtu.be/abc123?t=40");
    expect(await receiveShare(fakeCaches(), form)).toBe(`/look/link?url=${encodeURIComponent("https://youtu.be/abc123?t=40")}&shared=1`);
  });

  it("ignores anything that isn't an image, and clears after", async () => {
    const caches = fakeCaches();
    const form = new FormData();
    form.append("images", new File(["x"], "a.txt", { type: "text/plain" }));
    await receiveShare(caches, form);
    expect((await readInbox(caches))?.meta.count).toBe(0);
    await clearInbox(caches);
    expect(await readInbox(caches)).toBeUndefined();
  });

  it("finds the first link in shared text", () => {
    expect(findUrl(undefined, "see (https://youtu.be/x)")).toBe("https://youtu.be/x");
    expect(findUrl("no link")).toBeUndefined();
  });
});
