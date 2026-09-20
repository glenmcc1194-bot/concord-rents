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
  try {
    const data = await scrapeConcordEquipment();
    _cache = data; _cacheAt = now;
    return res.status(200).json({ ...data, cached: false, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e), listings: [], count: 0 });
  }
}
