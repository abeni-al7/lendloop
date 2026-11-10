import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { category } from "./schema";
import { requireUser } from "./lib/auth";
import { today } from "./lib/dates";
import { enqueueWebhook } from "./notify";

const categoryFilter = v.optional(category);

async function activeTools(ctx: QueryCtx, cat?: Doc<"tools">["category"]) {
  const tools = cat
    ? await ctx.db
        .query("tools")
        .withIndex("by_category", (q) => q.eq("category", cat))
        .collect()
    : await ctx.db.query("tools").collect();
  return tools.filter((t) => !t.removedAt).sort((a, b) => a.name.localeCompare(b.name));
}

/** Public board: name and category only. No owner, no loan data. */
export const listPublic = query({
  args: { category: categoryFilter },
  handler: async (ctx, args) => {
    const tools = await activeTools(ctx, args.category);
    return tools.map((t) => ({ _id: t._id, ref: t.ref, name: t.name, category: t.category }));
  },
});

/** Signed-in board. Shows whether each tool is home, without saying who has it. */
export const list = query({
  args: { category: categoryFilter },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const tools = await activeTools(ctx, args.category);
    const now = today();

    return await Promise.all(tools.map((tool) => viewTool(ctx, tool, me, now)));
  },
});

/** One tool for its detail page. */
export const get = query({
  args: { toolId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const toolId = ctx.db.normalizeId("tools", args.toolId);
    const tool = toolId ? await ctx.db.get(toolId) : null;
    if (!tool || tool.removedAt) return null;
    return await viewTool(ctx, tool, me, today());
  },
});

async function viewTool(ctx: QueryCtx, tool: Doc<"tools">, me: Doc<"users">, now: string) {
  const owner = await ctx.db.get(tool.ownerId);
  const loans = await ctx.db
    .query("loans")
    .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
    .collect();
  const approved = loans.filter((l) => l.status === "approved");
  const out = approved.find((l) => l.startDate <= now);
  const involved = out && (out.borrowerId === me._id || out.ownerId === me._id || me.role === "admin");
  const myOpenRequest = loans.find(
    (l) => l.borrowerId === me._id && (l.status === "requested" || l.status === "approved"),
  );
  return {
    _id: tool._id,
    ref: tool.ref,
    name: tool.name,
    category: tool.category,
    note: tool.note,
    owner: { firstName: owner?.firstName ?? "Neighbor", trustedLender: owner?.trustedLender ?? false },
    isMine: tool.ownerId === me._id,
    // Only people in the loan (and admins) see that it is late. Others don't get the past
    // end date either, since that would give it away.
    out: out
      ? {
          until: involved || out.endDate >= now ? out.endDate : null,
          overdue: involved ? out.endDate < now : false,
        }
      : null,
    // Dates only, no names: enough to pick free days.
    booked: approved
      .filter((l) => l.endDate >= now)
      .map((l) => ({ start: l.startDate, end: l.endDate }))
      .sort((a, b) => a.start.localeCompare(b.start)),
    pendingCount: tool.ownerId === me._id ? loans.filter((l) => l.status === "requested").length : 0,
    myOpenRequest: myOpenRequest
      ? {
          loanId: myOpenRequest._id,
          status: myOpenRequest.status,
          startDate: myOpenRequest.startDate,
          endDate: myOpenRequest.endDate,
        }
      : null,
  };
}

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .collect();
    const now = today();
    return await Promise.all(
      tools
        .filter((t) => !t.removedAt)
        .sort((a, b) => b._creationTime - a._creationTime)
        .map(async (tool) => {
          const loans = await ctx.db
            .query("loans")
            .withIndex("by_tool", (q) => q.eq("toolId", tool._id))
            .collect();
          const out = loans.find((l) => l.status === "approved" && l.startDate <= now);
          const borrower = out ? await ctx.db.get(out.borrowerId) : null;
          return {
            _id: tool._id,
            ref: tool.ref,
            name: tool.name,
            category: tool.category,
            note: tool.note,
            pendingCount: loans.filter((l) => l.status === "requested").length,
            timesLent: loans.filter((l) => l.status === "returned").length,
            out: out
              ? {
                  loanId: out._id,
                  until: out.endDate,
                  overdue: out.endDate < now,
                  borrowerFirstName: borrower?.firstName ?? "Neighbor",
                }
              : null,
          };
        }),
    );
  },
});

async function nextRef(ctx: MutationCtx): Promise<number> {
  const counter = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", "toolRef"))
    .unique();
  if (!counter) {
    await ctx.db.insert("counters", { name: "toolRef", value: 1 });
    return 1;
  }
  await ctx.db.patch(counter._id, { value: counter.value + 1 });
  return counter.value + 1;
}

export const create = mutation({
  args: { name: v.string(), category, note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const name = args.name.trim();
    const note = args.note?.trim() || undefined;
    if (name.length < 2 || name.length > 60) throw new ConvexError("Name must be 2 to 60 characters.");
    if (note && note.length > 200) throw new ConvexError("Note must be 200 characters or less.");
    return await ctx.db.insert("tools", {
      ref: await nextRef(ctx),
      ownerId: me._id,
      name,
      category: args.category,
      note,
    });
  },
});

/**
 * Owner removes their own listing; an admin can remove any listing.
 * Soft delete keeps loan history intact. Open requests are declined.
 */
export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const me = await requireUser(ctx);
    const tool = await ctx.db.get(toolId);
    if (!tool || tool.removedAt) throw new ConvexError("This tool is not on the board.");
    if (tool.ownerId !== me._id && me.role !== "admin") {
      throw new ConvexError("You can only remove your own tools.");
    }
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_tool", (q) => q.eq("toolId", toolId))
      .collect();
    const now = today();
    if (me.role !== "admin" && loans.some((l) => l.status === "approved" && l.startDate <= now)) {
      throw new ConvexError("This tool is out on loan. Mark it returned first.");
    }
    for (const loan of loans) {
      if (loan.status === "requested" || loan.status === "approved") {
        await ctx.db.patch(loan._id, { status: "declined", decidedAt: Date.now() });
        await enqueueWebhook(ctx, loan._id as Id<"loans">, "loan.status_changed");
      }
    }
    await ctx.db.patch(toolId, { removedAt: Date.now(), removedBy: me._id });
  },
});
