import { put } from '@vercel/blob';
import { isAuthed } from '../lib/auth.js';

// Accepts a base64 image data URL (JSON body { dataUrl, slug }) from the admin editor,
// stores it in Vercel Blob, and returns a public URL to save on the listing.
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed' }); }
  if (!isAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Photo storage not set up yet. Add a Vercel Blob store to the project.' });
  }

  const b = req.body || {};
  const dataUrl = String(b.dataUrl || '');
  const m = dataUrl.match(/^data:(image\/(png|jpe?g|webp));base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Expected a base64 image (png, jpg, or webp).' });

  const mime = m[1];
  const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Image too large.' });

  const base = String(b.slug || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'photo';
  const name = `equipment/${base}-${Date.now()}.${ext}`;

  try {
    const blob = await put(name, buf, { access: 'public', contentType: mime });
    return res.status(200).json({ ok: true, url: blob.url });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
