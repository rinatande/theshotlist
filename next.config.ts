import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// A new commit is a new app version, so the precached start page is refetched.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

// @serwist/next is a webpack plugin, so production builds run with --webpack
// (package.json). Dev stays on Turbopack with the service worker off.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The start page, so a cold launch with no signal opens the app (§3).
  additionalPrecacheEntries: [{ url: "/", revision }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
