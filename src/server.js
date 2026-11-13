const config = require('./config');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { query, migrate, pool } = require('./db');
const { seedContent, seedAdmin } = require('./seed');
const reminders = require('./lib/reminders');

const app = express();
app.set('trust proxy', /^\d+$/.test(config.trustProxy) ? Number(config.trustProxy) : config.trustProxy);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'blob:'],
      'frame-src': ['https://www.google.com', 'https://maps.google.com'], // Google Maps embed
      'script-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'connect-src': ["'self'"],
      'upgrade-insecure-requests': config.isProd ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '200kb' }));

app.get('/healthz', async (req, res) => { try { await query('SELECT 1'); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); } });

// Public images (gallery, team photos). Private images (client photos) are only served via /api/admin/media.
app.get('/media/:id', async (req, res, next) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.sendStatus(404);
    const { rows } = await query('SELECT mime, data FROM media WHERE id = $1 AND NOT private', [req.params.id]);
    if (!rows[0]) return res.sendStatus(404);
    res.set({ 'Content-Type': rows[0].mime, 'Cache-Control': 'public, max-age=31536000, immutable' });
    res.send(rows[0].data);
  } catch (e) { next(e); }
});

app.use('/api/admin', require('./routes/admin'));
app.use('/api', require('./routes/public'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

const pub = path.join(__dirname, '..', 'public');
app.use(express.static(pub, { extensions: ['html'], maxAge: config.isProd ? '1h' : 0, setHeaders: (res, p) => { if (p.endsWith('.html')) res.set('Cache-Control', 'no-cache'); } }));
app.get('/admin*', (req, res) => res.sendFile(path.join(pub, 'admin', 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(pub, 'index.html')));

// Error handler – friendly JSON for the front-end, no stack traces to the public
app.use((err, req, res, next) => {
  let status = err.status || 500;
  if (err.code === 'LIMIT_FILE_SIZE') { status = 413; err.message = `Image is too large (max ${config.maxUploadMb} MB).`; }
  if (err.type === 'entity.too.large') status = 413;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on our side. Please try again or call the clinic.' : err.message, fields: err.fields });
});

(async () => {
  try {
    await migrate();
    await seedContent();
    await seedAdmin();
  } catch (e) { console.error('Startup failed – check DATABASE_URL:', e.message); process.exit(1); }
  const server = app.listen(config.port, () => console.log(`Mirror Aesthetics running on ${config.publicUrl} (port ${config.port})`));
  reminders.start();
  const stop = () => { server.close(() => pool.end().then(() => process.exit(0))); setTimeout(() => process.exit(0), 8000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
})();
