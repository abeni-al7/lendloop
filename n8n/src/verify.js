// Verify the HMAC signature from LendLoop (Convex) on the raw request body.
const crypto = require('crypto');
const secret = $env.N8N_WEBHOOK_SECRET;
const item = $input.first();
const header = item.json.headers['x-lendloop-signature'] || '';
const raw = (await this.helpers.getBinaryDataBuffer(0, 'data')).toString('utf8');

const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=')));
const t = Number(parts.t);
const now = Math.floor(Date.now() / 1000);
let valid = Boolean(secret && secret.length >= 32 && Number.isInteger(t) && parts.v1 && Math.abs(now - t) <= 300);
if (valid) {
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  valid = expected.length === parts.v1.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}
// Never pass the body on when the signature is bad.
return [{ json: valid ? { valid: true, event: JSON.parse(raw) } : { valid: false } }];
