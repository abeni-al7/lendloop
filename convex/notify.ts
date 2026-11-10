import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { requireSecret, signBody, SIGNATURE_HEADER } from "./lib/hmac";

// Retry delays for the n8n webhook: 30 s, 2 min, 10 min, 1 h. Then we give up and log it.
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 3_600_000];

type WebhookEvent = "loan.requested" | "loan.status_changed";

/** Queue a webhook to n8n inside the same transaction as the loan change. */
export async function enqueueWebhook(ctx: MutationCtx, loanId: Id<"loans">, event: WebhookEvent) {
  const outboxId = await ctx.db.insert("outbox", { loanId, event, status: "pending", attempts: 0 });
  await ctx.scheduler.runAfter(0, internal.notify.deliver, { outboxId });
}

/**
 * Build the smallest payload n8n needs: first names, the tool, the dates,
 * and only the email of the person who gets the notice.
 */
export const payloadFor = internalQuery({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, { outboxId }) => {
    const item = await ctx.db.get(outboxId);
    if (!item || item.status !== "pending") return null;
    const loan = await ctx.db.get(item.loanId);
    if (!loan) return null;
    const [tool, owner, borrower] = await Promise.all([
      ctx.db.get(loan.toolId),
      ctx.db.get(loan.ownerId),
      ctx.db.get(loan.borrowerId),
    ]);
    if (!tool || !owner || !borrower) return null;
    const recipient = item.event === "loan.requested" ? owner : borrower;
    return {
      eventId: outboxId,
      event: item.event,
      attempt: item.attempts + 1,
      loan: {
        id: loan._id,
        status: loan.status,
        startDate: loan.startDate,
        endDate: loan.endDate,
        tool: { ref: `LL-${String(tool.ref).padStart(3, "0")}`, name: tool.name },
      },
      recipient: {
        role: item.event === "loan.requested" ? "owner" : "borrower",
        firstName: recipient.firstName,
        email: recipient.email ?? null,
      },
      otherParty: { firstName: (recipient === owner ? borrower : owner).firstName },
    };
  },
});

export const deliver = internalAction({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, { outboxId }) => {
    const payload = await ctx.runQuery(internal.notify.payloadFor, { outboxId });
    if (!payload) return;

    const url = process.env.N8N_REQUEST_WEBHOOK_URL;
    let error: string | null = null;
    if (!url) {
      error = "N8N_REQUEST_WEBHOOK_URL is not set";
    } else {
      try {
        const body = JSON.stringify(payload);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [SIGNATURE_HEADER]: await signBody(requireSecret("N8N_WEBHOOK_SECRET"), body),
            "Idempotency-Key": payload.eventId,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) error = `n8n answered ${res.status}`;
      } catch (e) {
        error = e instanceof Error ? e.message : "network error";
      }
    }
    await ctx.runMutation(internal.notify.recordAttempt, { outboxId, error: error ?? undefined });
  },
});

export const recordAttempt = internalMutation({
  args: { outboxId: v.id("outbox"), error: v.optional(v.string()) },
  handler: async (ctx, { outboxId, error }) => {
    const item = await ctx.db.get(outboxId);
    if (!item || item.status !== "pending") return;
    const attempts = item.attempts + 1;
    if (!error) {
      await ctx.db.patch(outboxId, { status: "sent", attempts, lastError: undefined });
      return;
    }
    const delay = RETRY_DELAYS_MS[attempts - 1];
    if (delay !== undefined) {
      await ctx.db.patch(outboxId, { attempts, lastError: error.slice(0, 200) });
      await ctx.scheduler.runAfter(delay, internal.notify.deliver, { outboxId });
      return;
    }
    await ctx.db.patch(outboxId, { status: "failed", attempts, lastError: error.slice(0, 200) });
    await ctx.db.insert("automationEvents", {
      loanId: item.loanId,
      kind: "notify_failed",
      detail: `Notice not sent after ${attempts} tries`,
      at: Date.now(),
    });
  },
});
