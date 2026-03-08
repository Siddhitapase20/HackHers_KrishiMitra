/**
 * KrishiMitra — server.js
 * Express + Firebase Admin SDK
 */
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();

/* ── Security middleware ─────────────────────────────────────────── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── CORS ────────────────────────────────────────────────────────── */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) =>
    (!origin || ALLOWED_ORIGINS.includes(origin))
      ? cb(null, true)
      : cb(new Error(`CORS: ${origin} not allowed`)),
  credentials: true,
}));

/* ── Rate limiting ───────────────────────────────────────────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
}));

/* ── Serve frontend (place KrishiMitra.html in /public/index.html) ── */
app.use(express.static(path.join(__dirname, 'public')));

/* ── API Routes ──────────────────────────────────────────────────── */
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/crops',      require('./routes/crops'));
app.use('/api/market',     require('./routes/market'));
app.use('/api/calculator', require('./routes/calculator'));
app.use('/api/equipment',  require('./routes/equipment'));
app.use('/api/upload',     require('./routes/upload'));

/* ── Health check ────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: '🌾 KrishiMitra API is running!', ts: new Date() })
);

/* ── SPA fallback ────────────────────────────────────────────────── */
app.get('*', (req, res) => {
  if (req.path.startsWith('/api'))
    return res.status(404).json({ success: false, message: 'API route not found' });
  const indexPath = path.join(__dirname, 'public', 'index.html');
  res.sendFile(indexPath, err => {
    if (err) res.json({ message: 'KrishiMitra API v1 — place your frontend in /public/index.html' });
  });
});

/* ── Global error handler ────────────────────────────────────────── */
app.use((err, _req, res, _next) => {
  console.error('❌ Server error:', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

/* ── Start ───────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🌾 KrishiMitra API → http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Mode:   ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
