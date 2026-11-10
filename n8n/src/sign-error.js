// Report a failed workflow run to LendLoop so admins see it. No loan data is sent.
const crypto = require('crypto');
const { execution, workflow } = $input.first().json;
const message = (execution?.error?.message || 'Unknown error').slice(0, 120);
const body = JSON.stringify({
  idempotencyKey: `wf-error:${execution?.id ?? Date.now()}`,
  kind: 'workflow_failed',
  detail: `${workflow?.name ?? 'Workflow'}: ${message}`,
});
const t = Math.floor(Date.now() / 1000);
const v1 = crypto.createHmac('sha256', $env.CONVEX_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
return [{ json: { body, signature: `t=${t},v1=${v1}` } }];
