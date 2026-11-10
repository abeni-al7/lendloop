import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { eventKind } from "./schema";
import { daysBetween, today } from "./lib/dates";

/** Approved loans whose end date has passed. Minimal fields for the reminder. */
export const overdueLoans = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = today();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_end", (q) => q.eq("status", "approved").lt("endDate", now))
      .collect();
    return await Promise.all(
      loans.map(async (loan) => {
        const [tool, owner, borrower] = await Promise.all([
          ctx.db.get(loan.toolId),
          ctx.db.get(loan.ownerId),
          ctx.db.get(loan.borrowerId),
        ]);
        return {
          loanId: loan._id,
          tool: { ref: `LL-${String(tool?.ref ?? 0).padStart(3, "0")}`, name: tool?.name ?? "Tool" },
          endDate: loan.endDate,
          daysOverdue: daysBetween(loan.endDate, now),
          borrower: { firstName: borrower?.firstName ?? "Neighbor", email: borrower?.email ?? null },
          owner: { firstName: owner?.firstName ?? "Neighbor" },
          lastReminderAt: loan.lastReminderAt ?? null,
        };
      }),
    );
  },
});

/**
 * Write-back from n8n. The idempotency key makes retries safe:
 * the same key is applied once, later copies are acknowledged and ignored.
 */
export const recordEvent = internalMutation({
  args: {
    idempotencyKey: v.string(),
    loanId: v.optional(v.string()),
    kind: eventKind,
    detail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const seen = await ctx.db
      .query("processedKeys")
      .withIndex("by_key", (q) => q.eq("key", args.idempotencyKey))
      .unique();
    if (seen) return { status: "duplicate" as const };

    const loanId = args.loanId ? ctx.db.normalizeId("loans", args.loanId) : null;
    if (args.loanId && !loanId) return { status: "unknown_loan" as const };
    const loan = loanId ? await ctx.db.get(loanId) : null;
    if (loanId && !loan) return { status: "unknown_loan" as const };
    if (args.kind !== "workflow_failed" && !loan) return { status: "loan_required" as const };

    const at = Date.now();
    await ctx.db.insert("processedKeys", { key: args.idempotencyKey, at });
    await ctx.db.insert("automationEvents", {
      loanId: loan?._id,
      kind: args.kind,
      detail: args.detail?.slice(0, 200),
      at,
    });
    if (loan && args.kind === "reminder_sent") {
      await ctx.db.patch(loan._id, { lastReminderAt: at });
    }
    return { status: "applied" as const };
  },
});
