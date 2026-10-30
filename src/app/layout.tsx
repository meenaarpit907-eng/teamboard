import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "sonner";
import { getSiteUrl, isClerkConfigured } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { themeColor: "#121118", colorScheme: "dark" };

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: { default: "TeamBoard · Multi-tenant workspace on Clerk + Supabase + Vercel", template: "%s · TeamBoard" },
  description:
    "Open-source reference SaaS: Clerk Organizations, Supabase third-party auth with org-scoped Row Level Security, Realtime, Storage, Edge Functions and pg_cron, deployed on Vercel.",
  openGraph: { type: "website", siteName: "TeamBoard", url: "/" },
  twitter: { card: "summary_large_image" },
};

const clerkAppearance = {
  variables: {
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--card)",
    colorForeground: "var(--card-foreground)",
    colorMuted: "var(--muted)",
    colorMutedForeground: "var(--muted-foreground)",
    colorInput: "var(--input)",
    colorInputForeground: "var(--foreground)",
    colorNeutral: "var(--foreground)",
    colorDanger: "var(--destructive)",
    borderRadius: "0.625rem",
    fontFamily: "var(--font-geist-sans)",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <>
      {children}
      <Toaster theme="dark" position="bottom-right" richColors />
      <Analytics />
      <SpeedInsights />
    </>
  );

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        {isClerkConfigured() ? (
          <ClerkProvider
            appearance={clerkAppearance}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/app"
            signUpFallbackRedirectUrl="/app"
            afterSignOutUrl="/"
          >
            {body}
          </ClerkProvider>
        ) : (
          body
        )}
      </body>
    </html>
  );
}
