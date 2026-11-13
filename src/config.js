// All settings come from environment variables (see .env.example).
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
process.env.TZ = process.env.TZ || 'Asia/Manila'; // clinic time zone – keep before any Date use

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : process.env[k]);
const isProd = env('NODE_ENV', 'development') === 'production';

const config = {
  isProd,
  port: Number(env('PORT', 3000)),
  databaseUrl: env('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/mirror'),
  databaseSsl: env('DATABASE_SSL', isProd || /[?&]sslmode=(require|verify-ca|verify-full)(?:&|$)/i.test(env('DATABASE_URL', '')) ? 'true' : 'false') === 'true',
  jwtSecret: env('JWT_SECRET', isProd ? null : 'dev-only-secret-change-me'),
  sessionHours: Number(env('SESSION_HOURS', 12)),
  publicUrl: env('PUBLIC_URL', 'http://localhost:3000').replace(/\/$/, ''),
  trustProxy: env('TRUST_PROXY', '1'),
  admin: { email: env('ADMIN_EMAIL', ''), password: env('ADMIN_PASSWORD', ''), name: env('ADMIN_NAME', 'Clinic Admin') },
  smtp: {
    host: env('SMTP_HOST', ''), port: Number(env('SMTP_PORT', 587)), secure: env('SMTP_SECURE', 'false') === 'true',
    user: env('SMTP_USER', ''), pass: env('SMTP_PASS', ''), from: env('MAIL_FROM', ''),
  },
  notifyEmail: env('NOTIFY_EMAIL', ''), // clinic inbox that receives "new booking" alerts
  maxUploadMb: Number(env('MAX_UPLOAD_MB', 8)),
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  if (isProd) { console.error('FATAL: JWT_SECRET must be set to a random string of 32+ characters.'); process.exit(1); }
}
module.exports = config;
