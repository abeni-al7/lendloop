import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin, requireUser } from "./lib/auth";
import { daysBetween, isValidDate, overlaps, today } from "./lib/dates";
import { enqueueWebhook } from "./notify";

const MAX_LOAN_DAYS = 30;
const MAX_BOOK_AHEAD_DAYS = 90;

/** Shape a loan for the UI, with first names only and its automation history. */
async function present(ctx: QueryCtx, loan: Doc<"loans">) {
  const [tool, owner, borrower, events] = await Promise.all([
    ctx.db.get(loan.toolId),
    ctx.db.get(loan.ownerId),
    ctx.db.get(loan.borrowerId),
    ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", loan._id))
      .collect(),
  ]);
  return {
    _id: loan._id,
    _creationTime: loan._creationTime,
    status: loan.status,
    overdue: loan.status === "approved" && loan.endDate < today(),
    startDate: loan.startDate,
    endDate: loan.endDate,
    message: loan.message,
    decidedAt: loan.decidedAt,
    returnedAt: loan.returnedAt,
    tool: tool
      ? { _id: tool._id, ref: tool.ref, name: tool.name, category: tool.category, removed: !!tool.removedAt }
      : null,
    owner: { firstName: owner?.firstName ?? "Neighbor", trustedLender: owner?.trustedLender ?? false },
    borrower: { firstName: borrower?.firstName ?? "Neighbor" },
    events: events
      .sort((a, b) => b.at - a.at)
      .map((e) => ({ _id: e._id, kind: e.kind, detail: e.detail, at: e.at })),
  };
}

export type LoanView = Awaited<ReturnType<typeof present>>;

function newestFirst(a: Doc<"loans">, b: Doc<"loans">) {
  return b._creationTime - a._creationTime;
}

export const request = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(args.toolId);
    if (!tool || tool.removedAt) throw new ConvexError("This tool is no longer on the board.");
    if (tool.ownerId === me._id) throw new ConvexError("You can't borrow your own tool.");

    const { startDate, endDate } = args;
    if (!isValidDate(startDate) || !isValidDate(endDate)) throw new ConvexError("Pick valid dates.");
    const now = today();
    if (startDate < now) throw new ConvexError("The start date is in the past.");
    if (endDate < startDate) throw new ConvexError("The end date is before the start date.");
    if (daysBetween(startDate, endDate) + 1 > MAX_LOAN_DAYS) {
      throw new ConvexError(`A loan can be ${MAX_LOAN_DAYS} days at most.`);
    }
    if (daysBetween(now, startDate) > MAX_BOOK_AHEAD_DAYS) {
      throw new ConvexError(`You can book up to ${MAX_BOOK_AHEAD_DAYS} days ahead.`);
    }
    const message = args.message?.trim() || undefined;
    if (message && message.length > 280) throw new ConvexError("Message must be 280 characters or less.");

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
      .collect();
    if (loans.some((l) => l.borrowerId === me._id && l.status === "requested")) {
      throw new ConvexError("You already have a request open for this tool.");
    }
    if (loans.some((l) => l.status === "approved" && overlaps(l.startDate, l.endDate, startDate, endDate))) {
      throw new ConvexError("The tool is already booked for some of those days.");
    }

    const loanId = await ctx.db.insert("loans", {
      toolId: tool._id,
      ownerId: tool.ownerId,
      borrowerId: me._id,
      startDate,
      endDate,
      status: "requested",
      message,
    });
    await enqueueWebhook(ctx, loanId, "loan.requested");
    return loanId;
  },
});

/** Only the tool's owner answers a request. */
export const decide = mutation({
  args: { loanId: v.id("loans"), decision: v.union(v.literal("approved"), v.literal("declined")) },
  handler: async (ctx, { loanId, decision }) => {
    const me = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Request not found.");
    if (loan.ownerId !== me._id) throw new ConvexError("Only the owner can answer this request.");
    if (loan.status !== "requested") throw new ConvexError("This request was already answered.");

    if (decision === "approved") {
      if (loan.endDate < today()) throw new ConvexError("These dates have passed. Decline it instead.");
      const clash = await ctx.db
        .query("loans")
        .withIndex("by_tool", (q) => q.eq("toolId", loan.toolId))
        .collect();
      if (clash.some((l) => l.status === "approved" && overlaps(l.startDate, l.endDate, loan.startDate, loan.endDate))) {
        throw new ConvexError("You already lent it for some of those days.");
      }
    }
    await ctx.db.patch(loanId, { status: decision, decidedAt: Date.now() });
    await enqueueWebhook(ctx, loanId, "loan.status_changed");
  },
});

/** The owner confirms the tool came back. Admins can do it too. */
export const markReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const me = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan) throw new ConvexError("Loan not found.");
    if (loan.ownerId !== me._id && me.role !== "admin") {
      throw new ConvexError("Only the owner can mark it returned.");
    }
    if (loan.status !== "approved") throw new ConvexError("Only an approved loan can be returned.");
    await ctx.db.patch(loanId, { status: "returned", returnedAt: Date.now() });
    await enqueueWebhook(ctx, loanId, "loan.status_changed");
  },
});

/** The borrower takes back a request the owner hasn't answered yet. */
export const withdraw = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const me = await requireUser(ctx);
    const loan = await ctx.db.get(loanId);
    if (!loan || loan.borrowerId !== me._id) throw new ConvexError("Request not found.");
    if (loan.status !== "requested") throw new ConvexError("This request was already answered.");
    await ctx.db.delete(loanId);
  },
});

export const myRequests = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", me._id))
      .collect();
    return await Promise.all(loans.sort(newestFirst).map((l) => present(ctx, l)));
  },
});

export const incoming = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    return await Promise.all(loans.sort(newestFirst).map((l) => present(ctx, l)));
  },
});

/** Admin view of every loan. */
export const all = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").collect();
    return await Promise.all(loans.sort(newestFirst).map((l) => present(ctx, l)));
  },
});

/** Badge counts for the nav. */
export const counts = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const incoming = await ctx.db
      .query("loans")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    const mine = await ctx.db
      .query("loans")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", me._id))
      .collect();
    const now = today();
    return {
      incomingPending: incoming.filter((l) => l.status === "requested").length,
      myOverdue: mine.filter((l) => l.status === "approved" && l.endDate < now).length,
    };
  },
});

/** Admin: automation failures that are not tied to a loan (from the n8n error workflow). */
export const automationFailures = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_loan", (q) => q.eq("loanId", undefined))
      .collect();
    return events.sort((a, b) => b.at - a.at).slice(0, 20);
  },
});
