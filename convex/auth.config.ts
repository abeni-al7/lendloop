import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // Set with: npx convex env set CLERK_FRONTEND_API_URL https://<your-app>.clerk.accounts.dev
      domain: process.env.CLERK_FRONTEND_API_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
