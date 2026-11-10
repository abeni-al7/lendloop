import { httpRouter } from "convex/server";
import { z } from "zod";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireSecret, SIGNATURE_HEADER, verifySignature } from "./lib/hmac";

const MAX_BODY_BYTES = 16_384;

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Read the raw body and check the n8n signature before parsing anything. */
async function verified(request: Request): Promise<{ ok: true; body: string } | { ok: false; res: Response }> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return { ok: false, res: json(413, { error: "Body too large" }) };
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return { ok: false, res: json(413, { error: "Body too large" }) };
  const good = await verifySignature(
    requireSecret("CONVEX_WEBHOOK_SECRET"),
    request.headers.get(SIGNATURE_HEADER),
    body,
  );
  // Same answer for a missing, bad or stale signature: no hints for a guesser.
  if (!good) return { ok: false, res: json(401, { error: "Invalid signature" }) };
  return { ok: true, body };
}

const eventSchema = z.object({
  idempotencyKey: z.string().min(8).max(200),
  loanId: z.string().max(64).optional(),
  kind: z.enum(["owner_notified", "borrower_notified", "reminder_sent", "workflow_failed"]),
  detail: z.string().max(200).optional(),
});

const http = httpRouter();

/** n8n daily job: list overdue loans. */
http.route({
  path: "/n8n/overdue",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const check = await verified(request);
    if (!check.ok) return check.res;
    const loans = await ctx.runQuery(internal.automation.overdueLoans, {});
    return json(200, { loans });
  }),
});

/** n8n write-back: record what an automation did. Idempotent by key. */
http.route({
  path: "/n8n/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const check = await verified(request);
    if (!check.ok) return check.res;
    let parsed;
    try {
      parsed = eventSchema.safeParse(JSON.parse(check.body));
    } catch {
      return json(400, { error: "Body is not JSON" });
    }
    if (!parsed.success) return json(400, { error: "Invalid event" });
    const result = await ctx.runMutation(internal.automation.recordEvent, parsed.data);
    if (result.status === "unknown_loan" || result.status === "loan_required") {
      return json(422, { error: result.status });
    }
    return json(200, result);
  }),
});

export default http;
