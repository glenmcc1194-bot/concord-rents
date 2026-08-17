import { checkPassword, expectedToken } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin not configured (set ADMIN_PASSWORD).' });
  const b = req.body || {};
  if (!checkPassword(b.password)) return res.status(401).json({ error: 'Incorrect password' });
  return res.status(200).json({ ok: true, token: expectedToken() });
}
