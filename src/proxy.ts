import { clerkMiddleware } from "@clerk/nextjs/server";

// Clerk reads the session on every request. Access rules live in Convex functions,
// so this layer only keeps the session fresh; it does not decide who can do what.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
