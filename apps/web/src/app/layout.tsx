import type { Metadata } from "next";
import "@/styles/tokens.css";
import "@/styles/tokens-v2.css";
import "@/styles/globals.css";
import "@/styles/lanes/home.css";
import "@/styles/lanes/problems.css";
import "@/styles/lanes/case.css";
import "@/styles/lanes/pages.css";
import "@/styles/lanes/help.css";
import "@/styles/lanes/auth.css";
import "@/styles/lanes/lab.css";
import "@/styles/lanes/agentic.css";
import "@/styles/lanes/assistant.css";
import "@/styles/lanes/a11y.css";
// dark tokens last, so [data-theme="dark"] wins over every light value above
import "@/styles/lanes/theme-dark.css";
import { LiveRegion, SkipLink } from "@/components/ui/states";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { THEME_SCRIPT } from "@/lib/theme/script";

export const metadata: Metadata = {
  title: "STRATA",
  description: "Detect problems before they become business losses. Prototype with synthetic data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme is set by THEME_SCRIPT before React hydrates, hence suppressHydrationWarning on <html> only
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* first focusable element on every page; targets <main id="main"> */}
        <SkipLink />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
        {/* polite/assertive live regions for announce() after async actions */}
        <LiveRegion />
      </body>
    </html>
  );
}
