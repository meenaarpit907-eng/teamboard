import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { isClerkConfigured } from "@/lib/env";

const isWorkspaceRoute = createRouteMatcher(["/app(.*)"]);

/**
 * Clerk middleware: verifies the session on every request so auth() works in
 * Server Components and Server Actions, and sends signed-out visitors of /app
 * to sign-in. This is the first gate, not the only one: Postgres RLS checks
 * the Clerk token's user and active organization on every query.
 */
const withClerk = clerkMiddleware(async (auth, request) => {
  if (isWorkspaceRoute(request)) {
    await auth.protect();
  }
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // Without Clerk keys the app runs in "not configured" mode: the landing
  // page works and /app renders a setup checklist instead of redirecting.
  if (!isClerkConfigured()) {
    return NextResponse.next();
  }
  return withClerk(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
