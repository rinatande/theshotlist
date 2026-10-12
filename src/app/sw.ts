import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { receiveShare } from "@/lib/shareInbox";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Offline first (§3): the build's assets — JS, CSS, the self-hosted font files
// and the icons — plus the start page are precached on install, so the app
// opens with no signal.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Pages take their subject from the query (/project?id=…), so one precached
  // page serves every project offline.
  precacheOptions: { ignoreURLParametersMatching: [/^(id|step|shot|loc|day|beat|view|from|item|kit|cat|back|tab|invite|who|copy|dir|at|ref|url|shared|nosw)$/] },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

// The share target (§5.16, L8): shared images wait in the inbox, and the
// person lands on the screen that asks where they go. Registered before
// Serwist's own listener, so this POST never reaches the network.
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || url.pathname !== "/share-target") return;
  event.respondWith(
    (async () => {
      const to = await receiveShare(self.caches, await event.request.formData());
      return Response.redirect(new URL(to, self.location.origin).href, 303);
    })(),
  );
});

serwist.addEventListeners();
