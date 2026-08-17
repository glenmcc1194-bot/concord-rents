// Notifications — Resend (email) + Twilio (SMS) over REST. All optional/gated by env.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'ch@concord-equipment.com';
const NOTIFY_SMS = process.env.NOTIFY_SMS || '+12486874515';
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'Concord Rents <onboarding@resend.dev>';
const TW_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TW_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TW_FROM = process.env.TWILIO_FROM || '';

const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

export function formatRequest(r) {
  const label = { quote: 'Quote Request', availability: 'Availability Check', delivery: 'Delivery Inquiry' }[r.type] || 'Request';
  const lines = [
    ['Type', label], ['Name', r.name], ['Phone', r.phone], ['Email', r.email],
    ['Equipment', r.equipment], ['Dates', r.dates], ['Delivery location', r.location],
    ['Message', r.message]
  ].filter(([, v]) => v);
  return { label, lines };
}

export async function sendEmail(r) {
  if (!RESEND_KEY) return { skipped: 'no RESEND_API_KEY' };
  const { label, lines } = formatRequest(r);
  const html = `<h2>New ${esc(label)} — Concord Rents</h2><table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">${
    lines.map(([k, v]) => `<tr><td style="color:#5b6b82"><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('')
  }</table>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [NOTIFY_EMAIL], reply_to: r.email || undefined, subject: `Concord Rents — ${label} from ${r.name || 'website'}`, html })
  });
  return { ok: res.ok, status: res.status };
}

export async function sendSms(r) {
  if (!TW_SID || !TW_TOKEN || !TW_FROM) return { skipped: 'no Twilio config' };
  const { label } = formatRequest(r);
  const body = `Concord Rents: ${label} from ${r.name || 'website'}${r.phone ? ' (' + r.phone + ')' : ''}. ${r.equipment ? 'Equip: ' + r.equipment + '. ' : ''}${r.location ? 'To: ' + r.location + '. ' : ''}${r.dates ? 'Dates: ' + r.dates + '.' : ''}`.slice(0, 320);
  const auth = Buffer.from(`${TW_SID}:${TW_TOKEN}`).toString('base64');
  const form = new URLSearchParams({ To: NOTIFY_SMS, From: TW_FROM, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });
  return { ok: res.ok, status: res.status };
}

export async function notify(r) {
  const out = {};
  try { out.email = await sendEmail(r); } catch (e) { out.email = { error: String(e) }; }
  try { out.sms = await sendSms(r); } catch (e) { out.sms = { error: String(e) }; }
  return out;
}
