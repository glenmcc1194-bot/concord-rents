// Data layer — Upstash Redis / Vercel KV over REST (no npm deps).
// Works with either Vercel KV (KV_REST_API_URL/TOKEN) or Upstash (UPSTASH_REDIS_REST_URL/TOKEN).
import crypto from 'node:crypto';

const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const CATEGORIES = [
  'Telehandlers', 'Boom Lifts', 'Scissor Lifts', 'Bulldozers', 'Excavators',
  'Wheel Loaders', 'Forklifts', 'Heavy Forklifts', 'Graders'
];

export function kvConfigured() { return Boolean(URL && TOKEN); }

async function redis(cmd) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  if (!res.ok) throw new Error(`KV ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.result;
}

export function newId() { return crypto.randomUUID(); }

export function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

// ---- Equipment ----
export async function getEquipment() {
  if (!kvConfigured()) return SEED_EQUIPMENT;
  const raw = await redis(['GET', 'equipment']);
  if (!raw) return SEED_EQUIPMENT;
  try { return JSON.parse(raw); } catch { return []; }
}

export async function saveEquipment(list) {
  if (!kvConfigured()) throw new Error('Database not configured');
  await redis(['SET', 'equipment', JSON.stringify(list)]);
  return list;
}

export async function upsertEquipment(item) {
  const list = kvConfigured() ? (JSON.parse((await redis(['GET', 'equipment'])) || '[]')) : [...SEED_EQUIPMENT];
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

// ---- Requests ----
export async function getRequests() {
  if (!kvConfigured()) return [];
  const raw = await redis(['GET', 'requests']);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export async function addRequest(req) {
  const record = {
    id: newId(),
    createdAt: new Date().toISOString(),
    status: 'new',
    ...req
  };
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

// Seed catalog so the site is populated before the DB is connected.
export const SEED_EQUIPMENT = [
  {
    id: 'seed-cat-d4k2', slug: 'caterpillar-d4k2-dozer', name: 'Caterpillar D4K2 Dozer',
    category: 'Bulldozers', brand: 'Caterpillar', status: 'available', featured: true,
    shortDesc: 'Reliable track dozer for grading, clearing and pushing.',
    image: '/img/feat-cat-d4k2.jpg',
    specs: [{ k: 'Type', v: 'Track dozer' }, { k: 'Use', v: 'Grading & clearing' }]
  },
  {
    id: 'seed-jlg-9443', slug: 'jlg-lull-9443-telehandler', name: 'JLG / Lull 9443 Telehandler',
    category: 'Telehandlers', brand: 'JLG', status: 'available', featured: true,
    shortDesc: '9,000 lb capacity, 42 ft reach rough-terrain telehandler.',
    image: '/img/feat-jlg.jpg',
    specs: [{ k: 'Capacity', v: '9,000 lb' }, { k: 'Reach', v: '42 ft' }, { k: 'Terrain', v: 'Rough' }]
  },
  {
    id: 'seed-brute-bt120', slug: 'brute-bt120-forklift', name: 'Brute BT120 Forklift',
    category: 'Heavy Forklifts', brand: 'Brute', status: 'available', featured: true,
    shortDesc: '120,000 lb capacity heavy forklift for industrial lifting.',
    image: '/img/feat-brute.jpg',
    specs: [{ k: 'Capacity', v: '120,000 lb' }, { k: 'Use', v: 'Steel & machinery' }]
  }
];
