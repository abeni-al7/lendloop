// Sign the request for the overdue list.
const crypto = require('crypto');
const body = JSON.stringify({ requestedAt: new Date().toISOString() });
const t = Math.floor(Date.now() / 1000);
const v1 = crypto.createHmac('sha256', $env.CONVEX_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
return [{ json: { body, signature: `t=${t},v1=${v1}` } }];
