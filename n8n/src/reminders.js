// One item per overdue loan: send a mock reminder, then sign the write-back.
// Key = loan + day, so running the job twice on one day sends and records one reminder.
const crypto = require('crypto');
const loans = $input.first().json.loans || [];
const day = new Date().toISOString().slice(0, 10);
const out = [];
for (const loan of loans) {
  if (loan.lastReminderAt && Date.now() - loan.lastReminderAt < 20 * 3600 * 1000) continue;
  const subject = `Please return the ${loan.tool.name} to ${loan.owner.firstName}`;
  console.log(`[mock email] to=${loan.borrower.email ?? 'no-email'} subject="${subject}" overdue=${loan.daysOverdue}d`);
  const body = JSON.stringify({
    idempotencyKey: `reminder:${loan.loanId}:${day}`,
    loanId: loan.loanId,
    kind: 'reminder_sent',
    detail: `${loan.daysOverdue} day(s) late`,
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', $env.CONVEX_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
  out.push({ json: { loanId: loan.loanId, subject, body, signature: `t=${t},v1=${v1}` } });
}
return out;
