// Non-secret config status, so the admin dashboard can show what's wired up.
export default async function handler(req, res) {
  const env = process.env;
  res.status(200).json({
    db: Boolean((env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL) && (env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN)),
    blob: Boolean(env.BLOB_READ_WRITE_TOKEN),
    admin: Boolean(env.ADMIN_PASSWORD),
    email: Boolean(env.RESEND_API_KEY),
    sms: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM),
    notifyEmail: env.NOTIFY_EMAIL || 'ch@concord-equipment.com',
    notifySms: env.NOTIFY_SMS || '+12486874515'
  });
}
