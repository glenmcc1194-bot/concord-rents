import crypto from 'node:crypto';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

// Full fleet (38 machines) is hosted as JSON on the repo CDN and loaded as the pre-database seed.
const INVENTORY_URL = 'https://cdn.jsdelivr.net/gh/glenmcc1194-bot/concord-rents@main/data/inventory.json';

export const CATEGORIES = ['Telehandlers','Boom Lifts','Scissor Lifts','Bulldozers','Excavators','Wheel Loaders','Forklifts','Heavy Forklifts','Graders'];

export function kvConfigured() { return Boolean(URL && TOKEN); }

async function redis(cmd) {
  const res = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!res.ok) throw new Error(`KV ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result;
}

export function newId() { return crypto.randomUUID(); }

export function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

let _seedCache = null;
async function seedInventory() {
  if (_seedCache) return _seedCache;
  try {
    const r = await fetch(INVENTORY_URL);
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data) && data.length) { _seedCache = data; return data; }
    }
  } catch { /* fall back below */ }
  return SEED_EQUIPMENT;
}

export async function getEquipment() {
  if (kvConfigured()) {
    const raw = await redis(['GET', 'equipment']);
    if (raw) { try { return JSON.parse(raw); } catch { return []; } }
  }
  return seedInventory();
}

export async function saveEquipment(list) {
  if (!kvConfigured()) throw new Error('Database not configured');
  await redis(['SET', 'equipment', JSON.stringify(list)]);
  return list;
}

export async function upsertEquipment(item) {
  const list = kvConfigured() ? (JSON.parse((await redis(['GET', 'equipment'])) || '[]')) : [...(await seedInventory())];
  const now = new Date().toISOString();
  if (item.id) {
    const i = list.findIndex(e => e.id === item.id);
    if (i >= 0) list[i] = { ...list[i], ...item, updatedAt: now };
    else list.push({ ...item, createdAt: now, updatedAt: now });
  } else {
    item.id = newId();
    item.createdAt = now; item.updatedAt = now;
    list.push(item);
  }
  if (!item.slug) item.slug = slugify(item.name);
  await saveEquipment(list);
  return item;
}

export async function deleteEquipment(id) {
  const list = await getEquipment();
  await saveEquipment(list.filter(e => e.id !== id));
}

export async function getRequests() {
  if (!kvConfigured()) return [];
  const raw = await redis(['GET', 'requests']);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export async function addRequest(req) {
  const record = { id: newId(), createdAt: new Date().toISOString(), status: 'new', ...req };
  if (kvConfigured()) {
    const list = await getRequests();
    list.unshift(record);
    await redis(['SET', 'requests', JSON.stringify(list.slice(0, 1000))]);
  }
  return record;
}

export async function setRequestStatus(id, status) {
  if (!kvConfigured()) return;
  const list = await getRequests();
  const i = list.findIndex(r => r.id === id);
  if (i >= 0) { list[i].status = status; await redis(['SET', 'requests', JSON.stringify(list)]); }
}

// Site settings (e.g. the customer-facing "Text About This" number). Stored in the DB.
export async function getSettings() {
  if (!kvConfigured()) return {};
  const raw = await redis(['GET', 'settings']);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function saveSettings(patch) {
  if (!kvConfigured()) throw new Error('Database not configured');
  const next = { ...(await getSettings()), ...patch };
  await redis(['SET', 'settings', JSON.stringify(next)]);
  return next;
}

// Minimal fallback used only if the CDN inventory can't be reached.
export const SEED_EQUIPMENT = [
  { id: 'seed-brute', slug: 'brute-bt120', name: 'Brute BT120 Forklift 120,000 lb capacity', category: 'Heavy Forklifts', brand: 'Brute', status: 'available', featured: true, shortDesc: 'Heavy-duty vertical lift rated to 120,000 lbs.', image: 'https://cdn.jsdelivr.net/gh/glenmcc1194-bot/concord-rents@main/img/inv-brute-bt120-forklift-120-000-lb-capacity.jpg', specs: [{ k: 'Capacity', v: '120,000 lb' }], rates: { week: '$5,000', month: '$15,000' }, sortOrder: 0 },
  { id: 'seed-d4k2', slug: 'cat-d4k2', name: 'Caterpillar D4K2 Bulldozer', category: 'Bulldozers', brand: 'Caterpillar', status: 'available', featured: true, shortDesc: 'Compact track dozer for grading and clearing.', image: 'https://cdn.jsdelivr.net/gh/glenmcc1194-bot/concord-rents@main/img/inv-caterpillar-d4k2-bulldozer.jpg', specs: [], rates: {}, sortOrder: 1 },
  { id: 'seed-lull', slug: 'jlg-lull-9000', name: 'JLG Lull 9000lb 42ft Telehandler', category: 'Telehandlers', brand: 'JLG', status: 'available', featured: true, shortDesc: '9,000 lb capacity, 42 ft reach, frame leveling.', image: 'https://cdn.jsdelivr.net/gh/glenmcc1194-bot/concord-rents@main/img/inv-jlg-lull-9000lb-42ft-telehandler.jpg', specs: [{ k: 'Capacity', v: '9,000 lb' }, { k: 'Reach', v: '42 ft' }], rates: { day: '$800', week: '$1,350', month: '$2,600' }, sortOrder: 2 }
];
