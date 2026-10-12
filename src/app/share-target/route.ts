/**
 * The share target's POST reaches the server only when the service worker
 * isn't running yet (first open, or just updated). The files can't be kept
 * here — nothing is stored on the server — so the share screen says so.
 */
export function POST(request: Request) {
  return Response.redirect(new URL("/look/share?nosw=1", request.url), 303);
}
