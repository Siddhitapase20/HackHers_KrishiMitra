/**
 * middleware/auth.js
 * Verifies Firebase ID tokens sent as:  Authorization: Bearer <idToken>
 */
const { auth, db } = require('../config/firebase');

/**
 * Requires a valid Firebase ID token.
 * Attaches req.user (decoded token) and req.userDoc (Firestore profile).
 */
async function verifyToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token)
    return res.status(401).json({ success: false, message: 'Not authenticated. Please sign in.' });

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;

    const snap = await db.collection('users').doc(decoded.uid).get();
    req.userDoc = snap.exists ? snap.data() : null;
    next();
  } catch (e) {
    const msg = e.code === 'auth/id-token-expired'
      ? 'Session expired. Please sign in again.'
      : 'Invalid or expired token.';
    res.status(401).json({ success: false, message: msg, code: e.code });
  }
}

/**
 * Optionally parses a token if present, but never blocks the request.
 */
async function optionalToken(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next();
  try {
    req.user = await auth.verifyIdToken(token);
    const snap = await db.collection('users').doc(req.user.uid).get();
    req.userDoc = snap.exists ? snap.data() : null;
  } catch (_) { /* ignore */ }
  next();
}

/**
 * Requires role === 'admin' in the Firestore user document.
 * Must be used after verifyToken.
 */
function requireAdmin(req, res, next) {
  if (req.userDoc?.role !== 'admin')
    return res.status(403).json({ success: false, message: 'Admin access only.' });
  next();
}

module.exports = { verifyToken, optionalToken, requireAdmin };
