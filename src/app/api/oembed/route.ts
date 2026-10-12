import { parseVideo } from "@/lib/look";

/**
 * A YouTube link's title and channel for the look (§5.16, L7), from YouTube's
 * own oEmbed. YouTube only: the link is read here and rebuilt from its video
 * id, so this can't be pointed anywhere else. Instagram's oEmbed needs an API
 * token, so its links keep "Instagram" and the URL. Nothing is stored.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url") ?? "";
  const video = parseVideo(raw);
  if (!video || video.site !== "youtube" || !video.id || !/^[\w-]{6,20}$/.test(video.id)) {
    return Response.json({ error: "Only YouTube links are looked up." }, { status: 400 });
  }
  const watch = `https://www.youtube.com/watch?v=${video.id}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return Response.json({ error: "YouTube didn't know that video." }, { status: 404 });
    const data = (await res.json()) as { title?: unknown; author_name?: unknown };
    const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : undefined);
    return Response.json({ title: text(data.title), channel: text(data.author_name) }, { headers: { "cache-control": "public, max-age=86400" } });
  } catch {
    return Response.json({ error: "Couldn't reach YouTube." }, { status: 502 });
  }
}
