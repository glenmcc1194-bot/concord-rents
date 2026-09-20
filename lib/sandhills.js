// Scrape Concord Equipment's public Sandhills-hosted sales inventory for the admin "Sync" tool.
// Source is server-rendered HTML with a schema.org JSON-LD offers list plus per-card rental prices/hours.
const BASE = 'https://concordequipment.com/inventory/?/listings/search?DSCompanyID=168588&dlr=1&SettingsCRMID=32194054';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

function decodeEnt(s) {
  return String(s == null ? '' : s)
    .replace(/\\u0026/g, '&').replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}
function clean(s) { return decodeEnt(s).replace(/\s+/g, ' ').trim(); }

// Map the Sandhills category (from the detail-URL slug, falling back to the JSON-LD category) to a rentals-site category.
function catFrom(url, jsonCat) {
  const m = /for-sale\/\d+\/([^?"]+)/.exec(url || '');
  const s = ((m ? m[1] : '') + ' ' + (jsonCat || '')).toLowerCase();
  if (/telehandler/.test(s)) return 'Telehandlers';
  if (/scissor/.test(s)) return 'Scissor Lifts';
  if (/articulating|boom-lift|boom lift/.test(s)) return 'Boom Lifts';
  if (/crawler|dozer/.test(s)) return 'Bulldozers';
  if (/excavator/.test(s)) return 'Excavators';
  if (/wheel-loader|wheel loader/.test(s)) return 'Wheel Loaders';
  if (/grader/.test(s)) return 'Graders';
  if (/telescopic|rough-terrain|rough terrain/.test(s)) return 'Telehandlers';
  if (/forklift|pneumatic|cushion|lift truck/.test(s)) return 'Forklifts';
  return '';
}

function priceStr(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return '';
  return '$' + n.toLocaleString('en-US');
}

async function fetchPage(page) {
  const url = BASE + (page > 1 ? ('&Page=' + page) : '');
  const res = await fetch(url, { headers: {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  } });
  return await res.text();
}

function looksBlocked(html) {
  return !html || html.length < 20000 ||
    /Just a moment|challenge-platform|cf-mitigated|Attention Required|Access denied/i.test(html);
}

function parsePage(html) {
  let offers = [];
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  // Card HTML (with rental prices/hours) lives after the JSON-LD block; search from there so we
  // don't match the id inside the JSON-LD itself.
  const bodyStart = m ? (m.index + m[0].length) : 0;
  if (m) {
    try {
      const d = JSON.parse(m[1]);
      const arr = d && d.offers && d.offers.offers;
      if (Array.isArray(arr)) offers = arr;
    } catch (e) { /* ignore */ }
  }
  const recs = [];
  for (const o of offers) {
    if (!o || typeof o !== 'object') continue;
    const p = o.itemOffered || {};
    const url = decodeEnt(o.url || '');
    const id = String((p['@id'] || (/for-sale\/(\d+)/.exec(url) || [])[1] || '')).trim();
    if (!id) continue;
    recs.push({
      id,
      name: clean(p.name),
      make: clean(p.manufacturer),
      model: clean(p.model),
      category: catFrom(url, p.category),
      sourceCategory: clean(p.category),
      description: clean(p.description),
      image: (p.image || '').replace(/&amp;/g, '&'),
      salePrice: priceStr(o.price),
      sourceUrl: url,
      region: (o.availableAtOrFrom && o.availableAtOrFrom.address && o.availableAtOrFrom.address.addressRegion) || '',
      rates: {}, hours: ''
    });
  }
  // Associate rental prices + hours by locating each listing's card region in the HTML body.
  const withPos = recs.map(r => ({ r, pos: html.indexOf('for-sale/' + r.id + '/', bodyStart) })).filter(x => x.pos >= 0).sort((a, b) => a.pos - b.pos);
  for (let i = 0; i < withPos.length; i++) {
    const start = withPos[i].pos;
    const end = (i + 1 < withPos.length) ? withPos[i + 1].pos : html.length;
    const region = html.slice(start, end);
    const rates = {};
    const rr = region.match(/<strong>(Daily|Weekly|Monthly):\s*<\/strong><\/span><span class="rent-lease-price">([^<]+)</g) || [];
    for (const seg of rr) {
      const mm = /<strong>(Daily|Weekly|Monthly):\s*<\/strong><\/span><span class="rent-lease-price">([^<]+)</.exec(seg);
      if (mm) rates[mm[1].toLowerCase()] = mm[2].replace(/USD\s*/i, '').trim();
    }
    withPos[i].r.rates = rates;
    const hm = /Hours[\s\S]{0,60}?class="spec-value">([^<]+)</.exec(region);
    if (hm) withPos[i].r.hours = hm[1].replace(/[^0-9,]/g, '').trim();
  }
  return recs;
}

export async function scrapeConcordEquipment(maxPages = 6) {
  let all = [], pages = 0, blocked = false, error = '';
  for (let pg = 1; pg <= maxPages; pg++) {
    let html;
    try { html = await fetchPage(pg); }
    catch (e) { error = String(e.message || e); break; }
    if (looksBlocked(html)) { if (pg === 1) blocked = true; break; }
    const recs = parsePage(html);
    if (!recs.length) break;
    all = all.concat(recs);
    pages = pg;
    if (recs.length < 20) break; // last page
  }
  const seen = new Set(), out = [];
  for (const r of all) { if (seen.has(r.id)) continue; seen.add(r.id); out.push(r); }
  return { listings: out, count: out.length, pages, blocked, error };
}
