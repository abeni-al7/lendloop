import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const category = v.union(
  v.literal("power"),
  v.literal("hand"),
  v.literal("garden"),
  v.literal("ladders"),
  v.literal("cleaning"),
  v.literal("other"),
);

export const loanStatus = v.union(
  v.literal("requested"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("returned"),
);

export const eventKind = v.union(
  v.literal("owner_notified"),
  v.literal("borrower_notified"),
  v.literal("reminder_sent"),
  v.literal("notify_failed"),
  v.literal("workflow_failed"),
);

export default defineSchema({
  // Only what the app needs: a first name to show, an email to send mock notices to.
  users: defineTable({
    clerkId: v.string(),
    firstName: v.string(),
    email: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("user")),
    trustedLender: v.boolean(),
  }).index("by_clerk_id", ["clerkId"]),

  tools: defineTable({
    ref: v.number(),
    ownerId: v.id("users"),
    name: v.string(),
    category,
    note: v.optional(v.string()),
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
  })
    .index("by_owner", ["ownerId"])
    .index("by_category", ["category"]),

  loans: defineTable({
    toolId: v.id("tools"),
    ownerId: v.id("users"),
    borrowerId: v.id("users"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD, inclusive
    status: loanStatus,
    message: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    lastReminderAt: v.optional(v.number()),
  })
    .index("by_tool", ["toolId"])
    .index("by_owner", ["ownerId"])
    .index("by_borrower", ["borrowerId"])
    .index("by_status_end", ["status", "endDate"]),

  // What the automations did. Shown on each loan and to admins.
  automationEvents: defineTable({
    loanId: v.optional(v.id("loans")),
    kind: eventKind,
    detail: v.optional(v.string()),
    at: v.number(),
  }).index("by_loan", ["loanId"]),

  // Outgoing webhooks to n8n (outbox pattern with retries).
  outbox: defineTable({
    loanId: v.id("loans"),
    event: v.union(v.literal("loan.requested"), v.literal("loan.status_changed")),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    attempts: v.number(),
    lastError: v.optional(v.string()),
  }).index("by_loan", ["loanId"]),

  // Idempotency keys for write-backs from n8n.
  processedKeys: defineTable({ key: v.string(), at: v.number() }).index("by_key", ["key"]),

  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),
});
