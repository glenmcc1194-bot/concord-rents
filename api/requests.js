import { addRequest, getRequests, setRequestStatus } from '../lib/store.js';
import { notify } from '../lib/notify.js';
import { isAuthed } from '../lib/auth.js';

const TYPES = ['quote', 'availability', 'delivery'];

export default async function handler(req, res) {
  // Public: submit a request
  if (req.method === 'POST') {
    const b = req.body || {};
    const type = TYPES.includes(b.type) ? b.type : 'quote';
    if (!b.name || (!b.phone && !b.email)) {
      return res.status(400).json({ error: 'Name and a phone or email are required.' });
    }
    if (b.company) return res.status(200).json({ ok: true }); // honeypot
    const record = await addRequest({
      type,
      name: String(b.name).slice(0, 120),
      phone: String(b.phone || '').slice(0, 40),
      email: String(b.email || '').slice(0, 160),
      equipment: String(b.equipment || '').slice(0, 160),
      dates: String(b.dates || '').slice(0, 120),
      location: String(b.location || '').slice(0, 200),
      message: String(b.message || '').slice(0, 2000)
    });
    const n = await notify(record);
    return res.status(200).json({ ok: true, id: record.id, notify: n });
  }

  // Admin: list / update requests
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    return res.status(200).json({ requests: await getRequests() });
  }
  if (req.method === 'PATCH') {
    const b = req.body || {};
    if (!b.id) return res.status(400).json({ error: 'id required' });
    await setRequestStatus(b.id, b.status === 'handled' ? 'handled' : 'new');
    return res.status(200).json({ ok: true });
  }
  res.setHeader('Allow', 'POST, GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
