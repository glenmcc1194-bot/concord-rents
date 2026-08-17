// Minimal admin auth — no accounts, single shared password (ADMIN_PASSWORD env).
// Token = HMAC-SHA256(ADMIN_PASSWORD, "concord-admin"). Stateless; verified per request.
import crypto from 'node:crypto';

const SECRET = process.env.ADMIN_PASSWORD || '';

export function expectedToken() {
  if (!SECRET) return '';
  return crypto.createHmac('sha256', SECRET).update('concord-admin').digest('hex');
}

export function checkPassword(pw) {
  if (!SECRET) return false;
  const a = Buffer.from(String(pw));
  const b = Buffer.from(SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAuthed(req) {
  const exp = expectedToken();
  if (!exp) return false;
  const hdr = req.headers['authorization'] || '';
  const token = hdr.replace(/^Bearer\s+/i, '').trim();
  if (!token || token.length !== exp.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(exp)); }
  catch { return false; }
}
