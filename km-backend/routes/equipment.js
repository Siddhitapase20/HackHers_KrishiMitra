/**
 * routes/equipment.js
 *
 * GET    /api/equipment           List all equipment (filterable)
 * POST   /api/equipment           Create a new listing
 * GET    /api/equipment/:id       Get single listing
 * PUT    /api/equipment/:id       Update listing (owner only)
 * DELETE /api/equipment/:id       Delete listing (owner only)
 * POST   /api/equipment/:id/request  Submit a rental request
 * GET    /api/equipment/requests/mine  Current user's requests
 * PUT    /api/equipment/requests/:id  Approve/reject a request
 */
const router          = require('express').Router();
const { admin, db }   = require('../config/firebase');
const { verifyToken, optionalToken } = require('../middleware/auth');

/* ── GET /api/equipment ───────────────────────────────────────────── */
router.get('/', optionalToken, async (req, res, next) => {
  try {
    const { type, district, available } = req.query;
    let query = db.collection('equipment');

    // Firestore only allows one inequality filter; chain equality filters only
    if (type)     query = query.where('type', '==', type);
    if (district) query = query.where('district', '==', district);
    if (available !== undefined) query = query.where('available', '==', available === 'true');

    const snap = await query.orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, data: { equipment: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (e) { next(e); }
});

/* ── POST /api/equipment ──────────────────────────────────────────── */
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { type, name, location, district, rent_per_day, condition, contact } = req.body;
    if (!type || !name || !location || !rent_per_day)
      return res.status(400).json({ success: false, message: 'type, name, location and rent_per_day are required.' });

    const data = {
      type, name, location, district: district || '',
      rent_per_day: Number(rent_per_day),
      condition: condition || 'Good',
      contact: contact || req.userDoc?.phone || '',
      available: true,
      owner_uid:  req.user.uid,
      owner_name: req.userDoc ? `${req.userDoc.first_name} ${req.userDoc.last_name}`.trim() : 'Farmer',
      createdAt:  admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('equipment').add(data);
    res.status(201).json({ success: true, data: { id: ref.id, ...data } });
  } catch (e) { next(e); }
});

/* ── GET /api/equipment/:id ───────────────────────────────────────── */
router.get('/:id', optionalToken, async (req, res, next) => {
  try {
    const snap = await db.collection('equipment').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Equipment not found.' });
    res.json({ success: true, data: { equipment: { id: snap.id, ...snap.data() } } });
  } catch (e) { next(e); }
});

/* ── PUT /api/equipment/:id ───────────────────────────────────────── */
router.put('/:id', verifyToken, async (req, res, next) => {
  try {
    const ref  = db.collection('equipment').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Equipment not found.' });
    if (snap.data().owner_uid !== req.user.uid && req.userDoc?.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised.' });

    const allowed = ['name','location','district','rent_per_day','condition','contact','available'];
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

    await ref.update(updates);
    const updated = await ref.get();
    res.json({ success: true, data: { equipment: { id: updated.id, ...updated.data() } } });
  } catch (e) { next(e); }
});

/* ── DELETE /api/equipment/:id ────────────────────────────────────── */
router.delete('/:id', verifyToken, async (req, res, next) => {
  try {
    const ref  = db.collection('equipment').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Equipment not found.' });
    if (snap.data().owner_uid !== req.user.uid && req.userDoc?.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Not authorised.' });
    await ref.delete();
    res.json({ success: true, message: 'Listing deleted.' });
  } catch (e) { next(e); }
});

/* ── POST /api/equipment/:id/request ─────────────────────────────── */
router.post('/:id/request', verifyToken, async (req, res, next) => {
  try {
    const equipSnap = await db.collection('equipment').doc(req.params.id).get();
    if (!equipSnap.exists) return res.status(404).json({ success: false, message: 'Equipment not found.' });
    if (!equipSnap.data().available)
      return res.status(400).json({ success: false, message: 'Equipment is not available.' });

    const { date_needed, days = 1, message = '' } = req.body;
    if (!date_needed) return res.status(400).json({ success: false, message: 'date_needed is required.' });

    const request = {
      equipment_id:   req.params.id,
      equipment_name: equipSnap.data().name,
      equipment_type: equipSnap.data().type,
      owner_uid:      equipSnap.data().owner_uid,
      requester_uid:  req.user.uid,
      requester_name: req.userDoc ? `${req.userDoc.first_name} ${req.userDoc.last_name}`.trim() : 'Farmer',
      requester_phone:req.userDoc?.phone || '',
      date_needed, days: Number(days), message,
      total_cost: equipSnap.data().rent_per_day * Number(days),
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('equipment_requests').add(request);
    res.status(201).json({ success: true, message: 'Request sent!', data: { id: ref.id, ...request } });
  } catch (e) { next(e); }
});

/* ── GET /api/equipment/requests/mine ────────────────────────────── */
router.get('/requests/mine', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('equipment_requests')
      .where('requester_uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    res.json({ success: true, data: { requests: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (e) { next(e); }
});

/* ── PUT /api/equipment/requests/:id (approve/reject) ─────────────── */
router.put('/requests/:id', verifyToken, async (req, res, next) => {
  try {
    const ref  = db.collection('equipment_requests').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (snap.data().owner_uid !== req.user.uid)
      return res.status(403).json({ success: false, message: 'Only the equipment owner can update this request.' });

    const { status } = req.body;
    if (!['approved','rejected'].includes(status))
      return res.status(400).json({ success: false, message: 'status must be approved or rejected.' });

    await ref.update({ status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    // Mark equipment as unavailable if approved
    if (status === 'approved') {
      await db.collection('equipment').doc(snap.data().equipment_id).update({ available: false });
    }

    res.json({ success: true, message: `Request ${status}.` });
  } catch (e) { next(e); }
});

module.exports = router;
