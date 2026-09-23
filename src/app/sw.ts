import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

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
  precacheOptions: { ignoreURLParametersMatching: [/^(id|step|shot|loc|day|beat|view|from|item|kit|cat|back|tab|invite)$/] },
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

serwist.addEventListeners();
