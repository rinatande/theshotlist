import { LIMITS, remaining, store } from "@/lib/server/quota";

/** Reads left today for this phone or invite — shown on the brief screen. Reserves nothing. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const device = url.searchParams.get("device") ?? "";
  const invite = url.searchParams.get("invite") ?? undefined;
  const s = store();
  if (!process.env.ANTHROPIC_API_KEY || !s || !/^[0-9a-f-]{36}$/i.test(device)) {
    return Response.json({ available: false, remaining: 0 });
  }
  const left = await remaining(s, { device, address: "", invite });
  return Response.json({ available: true, remaining: left, perDevice: LIMITS.perDevice });
}
