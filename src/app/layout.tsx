import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// The only typeface (§4.2). next/font downloads it at build time and serves it
// from our own origin, so the service worker can precache it for offline use.
const mono = JetBrains_Mono({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TheShotList",
  description: "Plan a shot list around the day, the format and the gear you've packed.",
  applicationName: "TheShotList",
  appleWebApp: { capable: true, title: "TheShotList", statusBarStyle: "default" },
};

// theme-color can't read a CSS variable, so these two mirror --ground in
// tokens.css (day / night). syncThemeColor() overrides them when a theme is pinned.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2EBDD" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0E0D" },
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
      <body>{children}</body>
    </html>
  );
}
