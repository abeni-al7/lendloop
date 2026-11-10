import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { currentUser, requireAdmin } from "./lib/auth";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

type Profile = { firstName: string; email?: string };

/** Read first name and primary email from Clerk. Nothing else is kept. */
async function fetchProfile(clerkId: string): Promise<Profile | null> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const user = (await res.json()) as {
    first_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: { id: string; email_address: string }[];
  };
  const email = user.email_addresses?.find((e) => e.id === user.primary_email_address_id)?.email_address;
  return { firstName: user.first_name ?? "", email };
}

/**
 * Create or refresh the user record. Called once after sign-in.
 * The profile comes from the token claims when present, otherwise from Clerk's API
 * on the server, so a client can never claim an admin email it does not own.
 */
export const store = action({
  args: {},
  handler: async (ctx): Promise<void> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not signed in.");
    let profile: Profile | null =
      identity.email || identity.givenName
        ? { firstName: identity.givenName ?? identity.name ?? "", email: identity.email }
        : null;
    profile ??= await fetchProfile(identity.subject);
    await ctx.runMutation(internal.users.upsert, {
      clerkId: identity.subject,
      firstName: profile?.firstName ?? "",
      email: profile?.email,
    });
  },
});

export const upsert = internalMutation({
  args: { clerkId: v.string(), firstName: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = args.email?.toLowerCase();
    const firstName = (args.firstName.trim() || email?.split(/[@+]/)[0] || "Neighbor").split(" ")[0].slice(0, 40);
    const isListedAdmin = email ? adminEmails().includes(email) : false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      const patch: { firstName?: string; email?: string; role?: "admin" } = {};
      if (existing.firstName !== firstName) patch.firstName = firstName;
      if (existing.email !== email) patch.email = email;
      if (isListedAdmin && existing.role !== "admin") patch.role = "admin";
      if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch);
      return;
    }

    await ctx.db.insert("users", {
      clerkId: args.clerkId,
      firstName,
      email,
      role: isListedAdmin ? "admin" : "user",
      trustedLender: false,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await currentUser(ctx);
    if (!user) return null;
    return { _id: user._id, firstName: user.firstName, role: user.role, trustedLender: user.trustedLender };
  },
});

/** Admin: everyone on the board, with counts. Emails stay on the server. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return await Promise.all(
      users.map(async (u) => {
        const tools = await ctx.db
          .query("tools")
          .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
          .collect();
        const lent = await ctx.db
          .query("loans")
          .withIndex("by_owner", (q) => q.eq("ownerId", u._id))
          .collect();
        return {
          _id: u._id,
          firstName: u.firstName,
          role: u.role,
          trustedLender: u.trustedLender,
          toolCount: tools.filter((t) => !t.removedAt).length,
          returnedCount: lent.filter((l) => l.status === "returned").length,
        };
      }),
    );
  },
});

export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    await requireAdmin(ctx);
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");
    await ctx.db.patch(userId, { trustedLender: trusted });
  },
});

/** CLI only: npx convex run users:setRole '{"email":"...","role":"admin"}' */
export const setRole = internalMutation({
  args: { email: v.string(), role: v.union(v.literal("admin"), v.literal("user")) },
  handler: async (ctx, { email, role }) => {
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.email === email.toLowerCase());
    if (!user) throw new Error("No user with that email. They must sign in once first.");
    await ctx.db.patch(user._id, { role });
  },
});
