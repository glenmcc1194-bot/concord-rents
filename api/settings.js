import { getSettings, saveSettings } from '../lib/store.js';
import { isAuthed } from '../lib/auth.js';

const DEFAULT_SMS = '+12487943519';

// Normalize a user-typed phone number to an sms:-friendly form (E.164-ish, US-aware).
function normalizePhone(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  return (raw[0] === '+' ? '+' : '') + digits;
}

export default async function handler(req, res) {
  // Public read — the catalog page needs the customer-facing text number.
  if (req.method === 'GET') {
    const s = await getSettings();
    return res.status(200).json({ smsNumber: s.smsNumber || DEFAULT_SMS });
  }

  // Admin writes.
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST' || req.method === 'PUT') {
    const b = req.body || {};
    const smsNumber = normalizePhone(b.smsNumber);
    if (!smsNumber || smsNumber.replace(/[^0-9]/g, '').length < 10) {
      return res.status(400).json({ error: 'Enter a valid 10-digit phone number.' });
    }
    try {
      const saved = await saveSettings({ smsNumber });
      return res.status(200).json({ ok: true, smsNumber: saved.smsNumber });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT');
  return res.status(405).json({ error: 'Method not allowed' });
}
