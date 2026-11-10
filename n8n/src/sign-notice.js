// Sign the write-back to LendLoop. The idempotency key is the Convex event id,
// so a retried webhook never records the same notice twice.
const crypto = require('crypto');
const { event, mail } = $input.first().json;
const payload = {
  idempotencyKey: `notify:${event.eventId}`,
  loanId: event.loan.id,
  kind: event.recipient.role === 'owner' ? 'owner_notified' : 'borrower_notified',
  detail: mail.subject,
};
const body = JSON.stringify(payload);
const t = Math.floor(Date.now() / 1000);
const v1 = crypto.createHmac('sha256', $env.CONVEX_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
return [{ json: { body, signature: `t=${t},v1=${v1}` } }];
