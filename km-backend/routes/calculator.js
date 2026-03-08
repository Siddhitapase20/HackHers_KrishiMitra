/**
 * routes/calculator.js
 *
 * POST /api/calculator/calculate   Save a profit calculation
 * GET  /api/calculator/history     User's saved calculations
 * DELETE /api/calculator/:id       Delete a calculation
 */
const router          = require('express').Router();
const { admin, db }   = require('../config/firebase');
const { verifyToken, optionalToken } = require('../middleware/auth');

/* ── POST /api/calculator/calculate ──────────────────────────────── */
router.post('/calculate', optionalToken, async (req, res, next) => {
  try {
    const { crop = '', land_size = 1, seed, fertilizer, labour, water, machinery, yield_kg, price_per_kg } = req.body;

    const total_cost = [seed, fertilizer, labour, water, machinery]
      .map(v => parseFloat(v) || 0)
      .reduce((s, v) => s + v, 0);

    const yld     = parseFloat(yield_kg)    || 0;
    const price   = parseFloat(price_per_kg) || 0;
    const revenue = Math.round(yld * price);
    const profit  = revenue - total_cost;
    const roi     = total_cost > 0 ? Math.round((profit / total_cost) * 100) : 0;

    const result = {
      crop, land_size: parseFloat(land_size) || 1,
      costs: { seed: parseFloat(seed)||0, fertilizer: parseFloat(fertilizer)||0,
               labour: parseFloat(labour)||0, water: parseFloat(water)||0,
               machinery: parseFloat(machinery)||0, total: total_cost },
      yield_kg: yld, price_per_kg: price, revenue, profit, roi,
      is_profitable: profit > 0,
    };

    // Save if authenticated
    if (req.user) {
      const ref = await db.collection('profit_calculations').add({
        uid: req.user.uid, ...result,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(201).json({ success: true, data: { id: ref.id, ...result } });
    }

    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

/* ── GET /api/calculator/history ─────────────────────────────────── */
router.get('/history', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('profit_calculations')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    res.json({ success: true, data: { history: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (e) { next(e); }
});

/* ── DELETE /api/calculator/:id ──────────────────────────────────── */
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const ref  = db.collection('profit_calculations').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Calculation not found.' });
    if (snap.data().uid !== req.user.uid)
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    await ref.delete();
    res.json({ success: true, message: 'Deleted.' });
  } catch (e) { next(e); }
});

module.exports = router;
