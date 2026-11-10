import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "../convex/_generated/api";
import schema from "../convex/schema";
import { modules } from "./setup";
import { signBody, verifySignature } from "../convex/lib/hmac";
import { today } from "../convex/lib/dates";

const day = (offset: number) => today(Date.now() + offset * 86_400_000);

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const mk = (name: string, role: "admin" | "user") =>
      ctx.db.insert("users", { clerkId: name, firstName: name, email: `${name}@example.com`, role, trustedLender: false });
    const owner = await mk("owner", "user");
    const borrower = await mk("borrower", "user");
    const other = await mk("other", "user");
    const admin = await mk("admin", "admin");
    const tool = await ctx.db.insert("tools", { ref: 1, ownerId: owner, name: "Drill", category: "power" });
    return { owner, borrower, other, admin, tool };
  });
  const as = (subject: string) => t.withIdentity({ subject });
  return { t, ids, owner: as("owner"), borrower: as("borrower"), other: as("other"), admin: as("admin") };
}

describe("public board", () => {
  test("shows name and category only", async () => {
    const { t } = await setup();
    const tools = await t.query(api.tools.listPublic, {});
    expect(Object.keys(tools[0]).sort()).toEqual(["_id", "category", "name", "ref"]);
  });

  test("signed-out users can't read the full board", async () => {
    const { t } = await setup();
    await expect(t.query(api.tools.list, {})).rejects.toThrow("Sign in");
  });
});

describe("loans", () => {
  test("full flow: request, approve, return", async () => {
    const { ids, owner, borrower } = await setup();
    const loanId = await borrower.mutation(api.loans.request, { toolId: ids.tool, startDate: day(0), endDate: day(2) });
    await owner.mutation(api.loans.decide, { loanId, decision: "approved" });
    await owner.mutation(api.loans.markReturned, { loanId });
    const [loan] = await borrower.query(api.loans.myRequests, {});
    expect(loan.status).toBe("returned");
  });

  test("only the owner can approve", async () => {
    const { ids, borrower, other, admin } = await setup();
    const loanId = await borrower.mutation(api.loans.request, { toolId: ids.tool, startDate: day(0), endDate: day(1) });
    for (const who of [borrower, other, admin]) {
      await expect(who.mutation(api.loans.decide, { loanId, decision: "approved" })).rejects.toThrow("Only the owner");
    }
  });

  test("you can't borrow your own tool", async () => {
    const { ids, owner } = await setup();
    await expect(
      owner.mutation(api.loans.request, { toolId: ids.tool, startDate: day(0), endDate: day(1) }),
    ).rejects.toThrow("your own tool");
  });

  test("rejects bad date ranges", async () => {
    const { ids, borrower } = await setup();
    const req = (startDate: string, endDate: string) =>
      borrower.mutation(api.loans.request, { toolId: ids.tool, startDate, endDate });
    await expect(req(day(-1), day(1))).rejects.toThrow("past");
    await expect(req(day(3), day(1))).rejects.toThrow("before the start");
    await expect(req(day(0), day(40))).rejects.toThrow("30 days");
    await expect(req("2026-02-30", day(1))).rejects.toThrow("valid dates");
  });

  test("can't approve two loans that overlap", async () => {
    const { ids, owner, borrower, other } = await setup();
    const a = await borrower.mutation(api.loans.request, { toolId: ids.tool, startDate: day(1), endDate: day(3) });
    const b = await other.mutation(api.loans.request, { toolId: ids.tool, startDate: day(2), endDate: day(4) });
    await owner.mutation(api.loans.decide, { loanId: a, decision: "approved" });
    await expect(owner.mutation(api.loans.decide, { loanId: b, decision: "approved" })).rejects.toThrow("already lent");
  });

  test("a status change queues a webhook in the same transaction", async () => {
    const { t, ids, borrower } = await setup();
    await borrower.mutation(api.loans.request, { toolId: ids.tool, startDate: day(0), endDate: day(1) });
    const outbox = await t.run((ctx) => ctx.db.query("outbox").collect());
    expect(outbox).toHaveLength(1);
    expect(outbox[0].event).toBe("loan.requested");
  });
});

describe("privacy", () => {
  test("only people in a loan see that it is late", async () => {
    const { t, ids, owner, borrower, other } = await setup();
    await t.run((ctx) =>
      ctx.db.insert("loans", {
        toolId: ids.tool, ownerId: ids.owner, borrowerId: ids.borrower,
        startDate: day(-5), endDate: day(-2), status: "approved",
      }),
    );
    const [seenByOther] = await other.query(api.tools.list, {});
    expect(seenByOther.out).toEqual({ until: null, overdue: false });
    for (const who of [owner, borrower]) {
      const [tool] = await who.query(api.tools.list, {});
      expect(tool.out?.overdue).toBe(true);
    }
  });
});

describe("admin rules", () => {
  test("only admins see all loans and set trusted lenders", async () => {
    const { ids, other, admin } = await setup();
    await expect(other.query(api.loans.all, {})).rejects.toThrow("Only admins");
    await expect(other.mutation(api.users.setTrustedLender, { userId: ids.owner, trusted: true })).rejects.toThrow(
      "Only admins",
    );
    await admin.mutation(api.users.setTrustedLender, { userId: ids.owner, trusted: true });
  });

  test("admins can remove any listing, users only their own", async () => {
    const { ids, other, admin } = await setup();
    await expect(other.mutation(api.tools.remove, { toolId: ids.tool })).rejects.toThrow("your own tools");
    await admin.mutation(api.tools.remove, { toolId: ids.tool });
    expect(await admin.query(api.tools.list, {})).toHaveLength(0);
  });
});

describe("n8n write-backs", () => {
  test("the same idempotency key is applied once", async () => {
    const { t, ids, borrower, owner } = await setup();
    const loanId = await borrower.mutation(api.loans.request, { toolId: ids.tool, startDate: day(0), endDate: day(1) });
    await owner.mutation(api.loans.decide, { loanId, decision: "approved" });
    const event = { idempotencyKey: `reminder:${loanId}:x`, loanId, kind: "reminder_sent" as const };
    expect((await t.mutation(internal.automation.recordEvent, event)).status).toBe("applied");
    expect((await t.mutation(internal.automation.recordEvent, event)).status).toBe("duplicate");
    const [loan] = await borrower.query(api.loans.myRequests, {});
    expect(loan.events).toHaveLength(1);
  });

  test("unknown loans are refused", async () => {
    const { t } = await setup();
    const res = await t.mutation(internal.automation.recordEvent, {
      idempotencyKey: "reminder:nope",
      loanId: "not-an-id",
      kind: "reminder_sent",
    });
    expect(res.status).toBe("unknown_loan");
  });
});

describe("HMAC signatures", () => {
  const secret = "x".repeat(64);
  test("accepts a fresh, matching signature", async () => {
    const header = await signBody(secret, '{"a":1}');
    expect(await verifySignature(secret, header, '{"a":1}')).toBe(true);
  });
  test("rejects a changed body, wrong secret, or old timestamp", async () => {
    const header = await signBody(secret, '{"a":1}');
    expect(await verifySignature(secret, header, '{"a":2}')).toBe(false);
    expect(await verifySignature("y".repeat(64), header, '{"a":1}')).toBe(false);
    const old = await signBody(secret, "{}", Date.now() - 10 * 60_000);
    expect(await verifySignature(secret, old, "{}")).toBe(false);
    expect(await verifySignature(secret, null, "{}")).toBe(false);
  });
});
