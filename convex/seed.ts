import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { today } from "./lib/dates";

/**
 * Synthetic demo data: fake neighbors and tools on one street.
 * Run once with: npx convex run seed:run
 * Fake users use example.com emails and can't sign in.
 */
const NEIGHBORS = ["Ruth", "Tom", "Sam", "Ana", "Mo"] as const;

const TOOLS: Array<[(typeof NEIGHBORS)[number], string, Doc<"tools">["category"], string?]> = [
  ["Tom", "Cordless drill, 18 V", "power", "Two batteries. Bits in the case."],
  ["Tom", "Tile cutter", "hand"],
  ["Ruth", "Extension ladder, 6 m", "ladders", "Heavy. You will need two people."],
  ["Ruth", "Wheelbarrow", "garden"],
  ["Sam", "Pressure washer", "cleaning", "Hose included, bring your own detergent."],
  ["Sam", "Mitre saw", "power"],
  ["Ana", "Hedge trimmer", "garden"],
  ["Ana", "Step ladder, 3 steps", "ladders"],
  ["Mo", "Carpet cleaner", "cleaning"],
  ["Mo", "Spirit level, 120 cm", "hand"],
  ["Mo", "Socket set", "hand"],
  ["Ruth", "Lawn aerator", "garden"],
];

function shift(days: number) {
  return today(Date.now() + days * 86_400_000);
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("tools").first()) return "Already seeded.";

    const ids = {} as Record<(typeof NEIGHBORS)[number], Id<"users">>;
    for (const name of NEIGHBORS) {
      ids[name] = await ctx.db.insert("users", {
        clerkId: `seed:${name.toLowerCase()}`,
        firstName: name,
        email: `${name.toLowerCase()}@example.com`,
        role: "user",
        trustedLender: name === "Ruth",
      });
    }

    const toolIds: Id<"tools">[] = [];
    let ref = 0;
    for (const [owner, name, category, note] of TOOLS) {
      toolIds.push(await ctx.db.insert("tools", { ref: ++ref, ownerId: ids[owner], name, category, note }));
    }
    await ctx.db.insert("counters", { name: "toolRef", value: ref });

    const loan = (tool: number, borrower: (typeof NEIGHBORS)[number], start: number, end: number, status: Doc<"loans">["status"]) =>
      ctx.db.insert("loans", {
        toolId: toolIds[tool],
        ownerId: ids[TOOLS[tool][0]],
        borrowerId: ids[borrower],
        startDate: shift(start),
        endDate: shift(end),
        status,
        decidedAt: status === "requested" ? undefined : Date.now(),
        returnedAt: status === "returned" ? Date.now() : undefined,
      });

    await loan(2, "Sam", -9, -2, "approved"); // ladder: overdue
    await loan(1, "Ana", -1, 4, "approved"); // tile cutter: out
    await loan(8, "Tom", -12, -8, "returned");
    await loan(6, "Mo", 2, 4, "requested");
    return "Seeded.";
  },
});

/** Clear every table, keeping real (signed-in) users. Then run seed:run again. */
export const reset = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of ["tools", "loans", "automationEvents", "outbox", "processedKeys", "counters"] as const) {
      for (const doc of await ctx.db.query(table).collect()) await ctx.db.delete(doc._id);
    }
    for (const user of await ctx.db.query("users").collect()) {
      if (user.clerkId.startsWith("seed:")) await ctx.db.delete(user._id);
    }
    return "Cleared.";
  },
});
