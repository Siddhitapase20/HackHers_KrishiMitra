/**
 * routes/market.js
 *
 * GET /api/market/prices           Latest prices for all crops
 * GET /api/market/prices/:crop     7-day trend + sell/wait verdict
 * GET /api/market/mandis           Nearby mandis with prices
 */
const router        = require('express').Router();
const { db }        = require('../config/firebase');
const { optionalToken } = require('../middleware/auth');

// Fallback base prices if Firestore is empty
const BASE = { wheat:221, rice:320, soybean:420, cotton:590, tomato:820, onion:280 };
const MANDIS = [
  { name:'Nashik APMC',      district:'Nashik'      },
  { name:'Pune APMC',        district:'Pune'        },
  { name:'Nagpur APMC',      district:'Nagpur'      },
  { name:'Aurangabad APMC',  district:'Aurangabad'  },
  { name:'Solapur APMC',     district:'Solapur'     },
  { name:'Jalgaon APMC',     district:'Jalgaon'     },
];

function generateTrend(crop, days = 7) {
  const base = BASE[crop] || 300;
  const trend = [];
  let price = base * (0.9 + Math.random() * 0.2);
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    price = price * (0.96 + Math.random() * 0.08);
    price = Math.max(base * 0.7, Math.min(base * 1.3, price));
    trend.push({ date: date.toISOString().split('T')[0], price: Math.round(price) });
  }
  return trend;
}

/* ── GET /api/market/prices ────────────────────────────────────── */
router.get('/prices', optionalToken, async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snap  = await db.collection('market_prices')
      .where('date', '==', today).limit(50).get();

    if (!snap.empty) {
      const prices = snap.docs.map(d => d.data());
      return res.json({ success: true, data: { date: today, prices } });
    }

    // Fallback: generate prices
    const prices = Object.entries(BASE).map(([crop, base]) => ({
      crop, date: today,
      mandi: 'Nashik APMC',
      price: Math.round(base * (0.92 + Math.random() * 0.16)),
    }));
    res.json({ success: true, data: { date: today, prices } });
  } catch (e) { next(e); }
});

/* ── GET /api/market/prices/:crop ──────────────────────────────── */
router.get('/prices/:crop', optionalToken, async (req, res, next) => {
  try {
    const { crop } = req.params;
    const validCrops = Object.keys(BASE);
    if (!validCrops.includes(crop))
      return res.status(400).json({ success: false, message: `Invalid crop. Choose from: ${validCrops.join(', ')}` });

    // Try Firestore for 7-day data
    const snap = await db.collection('market_prices')
      .where('crop', '==', crop)
      .where('mandi', '==', 'Nashik APMC')
      .orderBy('date', 'desc')
      .limit(7)
      .get();

    let trend;
    if (!snap.empty) {
      trend = snap.docs.map(d => d.data()).sort((a, b) => a.date.localeCompare(b.date));
    } else {
      trend = generateTrend(crop, 7);
    }

    const prices  = trend.map(t => t.price);
    const today   = prices[prices.length - 1];
    const avg     = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
    const diff    = today - avg;
    const pct     = Math.round(Math.abs(diff / avg) * 100);

    let verdict, reason, suggestion;
    if (diff > avg * 0.06) {
      verdict    = 'SELL NOW';
      reason     = `Today ₹${today}/q is ${pct}% above the 7-day avg ₹${avg}/q.`;
      suggestion = 'Prices are above average. Sell within the next 2–3 days.';
    } else if (diff < -avg * 0.06) {
      verdict    = 'WAIT';
      reason     = `Today ₹${today}/q is ${pct}% below the 7-day avg ₹${avg}/q.`;
      suggestion = 'Prices are low. Hold for 1–2 weeks before selling.';
    } else {
      verdict    = 'NEUTRAL';
      reason     = `Price ₹${today}/q is close to 7-day avg ₹${avg}/q.`;
      suggestion = 'Prices are stable. Monitor for 2–3 days before deciding.';
    }

    res.json({
      success: true,
      data: { crop, trend, today_price: today, avg_price: avg, verdict, reason, suggestion, pct_diff: diff > 0 ? pct : -pct },
    });
  } catch (e) { next(e); }
});

/* ── GET /api/market/mandis ────────────────────────────────────── */
router.get('/mandis', optionalToken, async (req, res, next) => {
  try {
    const { crop = 'wheat' } = req.query;
    const base = BASE[crop] || 300;
    const mandiData = MANDIS.map((m, i) => ({
      ...m,
      price: Math.round(base * (0.88 + Math.random() * 0.24)),
      distance_km: Math.round(10 + Math.random() * 60),
      is_best: false,
    })).sort((a, b) => b.price - a.price);
    mandiData[0].is_best = true;

    res.json({ success: true, data: { crop, mandis: mandiData } });
  } catch (e) { next(e); }
});

module.exports = router;
