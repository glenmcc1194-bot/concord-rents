import { scrapeConcordEquipment } from '../lib/sandhills.js';

// Read-only scrape of Concord Equipment's public sales inventory, for the admin "Sync" tool.
// Cached briefly to avoid hammering the source. Pushing a listing to the rentals site is a
// separate, admin-authenticated action (POST /api/equipment).
let _cache = null, _cacheAt = 0;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const now = Date.now();
  const force = req.query && (req.query.force === '1' || req.query.refresh === '1');
  if (_cache && !force && (now - _cacheAt) < 120000) {
    return res.status(200).json({ ..._cache, cached: true });
  }
  let data;
  try {
    data = await scrapeConcordEquipment();
  } catch (e) {
    data = { listings: [], count: 0, blocked: true, error: String(e.message || e) };
  }
  // Vercel's datacenter IP is Cloudflare-challenged, so a live server fetch is often blocked.
  // Fall back to the committed snapshot so the admin Sync tool still works.
  if (data.blocked || !data.count) {
    try {
      const proto = (req.headers['x-forwarded-proto'] || 'https');
      const host = req.headers.host;
      const snapRes = await fetch(`${proto}://${host}/data/sandhills-snapshot.json`);
      if (snapRes.ok) {
        const snap = await snapRes.json();
        const out = { ...snap, source: 'snapshot', liveBlocked: !!data.blocked, fetchedAt: snap.fetchedAt || null };
        _cache = out; _cacheAt = now;
        return res.status(200).json({ ...out, cached: false });
      }
    } catch (e) { /* fall through */ }
    return res.status(200).json({ ...data, source: 'live-blocked', listings: data.listings || [], count: data.count || 0, cached: false });
  }
  data.source = 'live';
  data.fetchedAt = new Date().toISOString();
  _cache = data; _cacheAt = now;
  return res.status(200).json({ ...data, cached: false });
}
