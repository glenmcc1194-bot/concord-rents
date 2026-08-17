import { getEquipment, upsertEquipment, deleteEquipment, slugify } from '../lib/store.js';
import { isAuthed } from '../lib/auth.js';

export default async function handler(req, res) {
  // Public read
  if (req.method === 'GET') {
    let list = await getEquipment();
    const { category, featured, slug } = req.query || {};
    if (slug) list = list.filter(e => e.slug === slug);
    if (category) list = list.filter(e => (e.category || '').toLowerCase() === String(category).toLowerCase());
    if (featured === '1' || featured === 'true') list = list.filter(e => e.featured);
    list = list.filter(e => slug || e.status !== 'hidden');
    return res.status(200).json({ equipment: list });
  }

  // Admin writes
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'POST' || req.method === 'PUT') {
    const b = req.body || {};
    if (!b.name || !b.category) return res.status(400).json({ error: 'name and category are required' });
    const item = {
      id: b.id || undefined,
      name: String(b.name).slice(0, 160),
      slug: b.slug ? slugify(b.slug) : slugify(b.name),
      category: String(b.category),
      brand: String(b.brand || '').slice(0, 80),
      status: ['available', 'unavailable', 'hidden'].includes(b.status) ? b.status : 'available',
      featured: Boolean(b.featured),
      shortDesc: String(b.shortDesc || '').slice(0, 300),
      description: String(b.description || '').slice(0, 4000),
      image: String(b.image || '').slice(0, 1000),
      gallery: Array.isArray(b.gallery) ? b.gallery.slice(0, 12).map(s => String(s).slice(0, 1000)) : [],
      specs: Array.isArray(b.specs) ? b.specs.slice(0, 30).map(s => ({ k: String(s.k || '').slice(0, 60), v: String(s.v || '').slice(0, 120) })).filter(s => s.k || s.v) : [],
      rates: {
        day: String(b.rates?.day || '').slice(0, 40),
        week: String(b.rates?.week || '').slice(0, 40),
        month: String(b.rates?.month || '').slice(0, 40)
      },
      bookUrl: String(b.bookUrl || '').slice(0, 1000),
      sortOrder: Number(b.sortOrder) || 0
    };
    try {
      const saved = await upsertEquipment(item);
      return res.status(200).json({ ok: true, item: saved });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  if (req.method === 'DELETE') {
    const id = (req.query && req.query.id) || (req.body && req.body.id);
    if (!id) return res.status(400).json({ error: 'id required' });
    try { await deleteEquipment(id); return res.status(200).json({ ok: true }); }
    catch (e) { return res.status(500).json({ error: String(e.message || e) }); }
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
