import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AutoTheme } from "@/components/AutoTheme";
import { GROUND, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// The only typeface (§4.2), self-hosted from JetBrains' own release (OFL, see
// src/fonts/OFL.txt). Google's build leaves out ✓ ⋯ ← ⋮ ✕, which the status
// marks and controls need (design.md Appendix B). Served from our origin, so
// the service worker precaches it for offline use.
const mono = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-Regular.woff2", weight: "400" },
    { path: "../fonts/JetBrainsMono-Medium.woff2", weight: "500" },
    { path: "../fonts/JetBrainsMono-Bold.woff2", weight: "700" },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TheShotList",
  description: "Plan a shot list around the day, the format and the gear you've packed.",
  applicationName: "TheShotList",
  appleWebApp: { capable: true, title: "TheShotList", statusBarStyle: "default" },
};

// theme-color can't read a CSS variable, so these mirror --ground (GROUND in
// theme.ts). THEME_SCRIPT and syncThemeColor() override them when a theme is set.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: GROUND.day },
    { media: "(prefers-color-scheme: dark)", color: GROUND.night },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The head script may set data-theme before React hydrates.
    <html lang="en" className={mono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <AutoTheme />
      </body>
    </html>
  );
}
