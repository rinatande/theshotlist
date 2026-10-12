import type { MetadataRoute } from "next";

// §3: installable, standalone, maskable icon. Colours mirror day --ground in
// tokens.css; a manifest can't follow the theme, so the page's theme-color
// meta does that job at runtime.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TheShotList",
    short_name: "ShotList",
    description: "Plan a shot list around the day, the format and the gear you've packed.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2EBDD",
    theme_color: "#F2EBDD",
    // Android, installed: screenshots and links from other apps' share sheets
    // go to the look (§5.16, L8). The service worker catches the POST.
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "images", accept: ["image/*"] }] },
    },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
