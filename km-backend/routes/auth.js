/**
 * routes/auth.js
 *
 * POST /api/auth/login           Sign in, return Firebase ID token + profile
 * POST /api/auth/register        Create account in Firebase Auth + Firestore
 * GET  /api/auth/me              Get current user's profile
 * PUT  /api/auth/profile         Update profile fields
 * PUT  /api/auth/change-password Change password via Admin SDK
 */
const router              = require('express').Router();
const { admin, db, auth } = require('../config/firebase');
const { verifyToken }     = require('../middleware/auth');

/* ── POST /api/auth/login ──────────────────────────────────────────────── */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;

    if (!WEB_API_KEY) {
      // ── Dev/demo fallback: look up user in Firestore, return custom token ──
      const snap = await db.collection('users').where('email', '==', email).limit(1).get();
      if (snap.empty)
        return res.status(401).json({ success: false, message: 'No account found with this email.' });
      const userData = snap.docs[0].data();
      const token = await auth.createCustomToken(userData.uid);
      return res.json({ success: true, data: { token, user: { id: userData.uid, ...userData } } });
    }

    // ── Production: use Firebase REST API to verify password ───────────────
    const fetch = (await import('node-fetch')).default;
    const fbRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    const fbData = await fbRes.json();

    if (!fbRes.ok) {
      const raw = fbData.error?.message || '';
      const msg = (raw.includes('EMAIL_NOT_FOUND') || raw.includes('INVALID_PASSWORD') || raw.includes('INVALID_LOGIN_CREDENTIALS'))
        ? 'Incorrect email or password.'
        : raw || 'Login failed.';
      return res.status(401).json({ success: false, message: msg });
    }

    // Fetch or create Firestore profile
    const snap = await db.collection('users').doc(fbData.localId).get();
    const userData = snap.exists
      ? snap.data()
      : { email, uid: fbData.localId, first_name: email.split('@')[0], last_name: '', role: 'farmer' };

    res.json({
      success: true,
      data: {
        token:        fbData.idToken,
        refreshToken: fbData.refreshToken,
        expiresIn:    fbData.expiresIn,
        user: { id: fbData.localId, ...userData },
      },
    });
  } catch (e) { next(e); }
});

/* ── POST /api/auth/register ───────────────────────────────────────────── */
router.post('/register', async (req, res, next) => {
  try {
    const { first_name, last_name = '', email, password, phone = '', district = '', land_size = 0, primary_crop = '' } = req.body;

    if (!first_name || !email || !password)
      return res.status(400).json({ success: false, message: 'first_name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    // Create in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: `${first_name} ${last_name}`.trim(),
    });

    // Save profile to Firestore
    const profile = {
      uid: userRecord.uid, email, first_name, last_name,
      phone, district, land_size: Number(land_size) || 0, primary_crop,
      role: 'farmer',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(userRecord.uid).set(profile);

    // Return custom token (client exchanges it for an ID token)
    const token = await auth.createCustomToken(userRecord.uid);

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      data: { token, user: { id: userRecord.uid, ...profile } },
    });
  } catch (e) {
    if (e.code === 'auth/email-already-exists')
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    next(e);
  }
});

/* ── GET /api/auth/me ──────────────────────────────────────────────────── */
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('users').doc(req.user.uid).get();
    if (!snap.exists) {
      // Profile missing — build minimal one from Auth record
      const rec = await auth.getUser(req.user.uid);
      return res.json({ success: true, data: { user: {
        id: rec.uid, email: rec.email,
        first_name: rec.displayName?.split(' ')[0] || '',
        last_name:  rec.displayName?.split(' ').slice(1).join(' ') || '',
        role: 'farmer',
      }}});
    }
    res.json({ success: true, data: { user: { id: snap.id, ...snap.data() } } });
  } catch (e) { next(e); }
});

/* ── PUT /api/auth/profile ─────────────────────────────────────────────── */
router.put('/profile', verifyToken, async (req, res, next) => {
  try {
    const ALLOWED = ['first_name', 'last_name', 'phone', 'district', 'land_size', 'primary_crop'];
    const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    for (const k of ALLOWED) if (req.body[k] !== undefined) updates[k] = req.body[k];

    await db.collection('users').doc(req.user.uid).set(updates, { merge: true });

    // Also update displayName in Firebase Auth
    if (updates.first_name || updates.last_name) {
      const snap = await db.collection('users').doc(req.user.uid).get();
      const d = snap.data();
      await auth.updateUser(req.user.uid, {
        displayName: `${d.first_name || ''} ${d.last_name || ''}`.trim()
      });
    }

    const snap = await db.collection('users').doc(req.user.uid).get();
    res.json({ success: true, data: { user: { id: snap.id, ...snap.data() } } });
  } catch (e) { next(e); }
});

/* ── PUT /api/auth/change-password ─────────────────────────────────────── */
router.put('/change-password', verifyToken, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    await auth.updateUser(req.user.uid, { password: newPassword });
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (e) { next(e); }
});

module.exports = router;
