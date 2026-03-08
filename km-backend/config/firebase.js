/**
 * config/firebase.js
 * ──────────────────────────────────────────────────────────────────
 * Initialises Firebase Admin SDK (Firestore + Auth + Storage).
 *
 * HOW TO SET UP:
 * ──────────────────────────────────────────────────────────────────
 * 1. Go to Firebase Console → https://console.firebase.google.com
 * 2. Create a project (or open existing one)
 * 3. Enable Firestore Database (Start in test mode for dev)
 * 4. Enable Authentication → Email/Password provider
 * 5. Project Settings → Service Accounts → Generate new private key
 *    → Save as  config/serviceAccountKey.json
 * 6. Copy .env.example to .env and fill in FIREBASE_WEB_API_KEY
 *    (found in Project Settings → General → Your apps → Web API key)
 * ──────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

if (!admin.apps.length) {
  let credential;

  // ── Option A: local JSON key file ──────────────────────────────
  const keyPath = process.env.FIREBASE_KEY_PATH
    || path.join(__dirname, 'serviceAccountKey.json');

  if (fs.existsSync(keyPath)) {
    credential = admin.credential.cert(require('./serviceAccountKey.json'));
    console.log('🔑 Firebase: using', path.basename(keyPath));

  // ── Option B: env vars (for production hosting) ─────────────────
  } else if (process.env.FIREBASE_PROJECT_ID) {
    credential = admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    });
    console.log('🔑 Firebase: using environment variables');

  } else {
    throw new Error(
      '\n❌ Firebase credentials not found!\n\n' +
      '   Local:  Save serviceAccountKey.json in config/\n' +
      '   Deploy: Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY\n'
    );
  }

  admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      || `${process.env.FIREBASE_PROJECT_ID || 'krishimitra'}.appspot.com`,
  });

  console.log('✅ Firebase Admin initialised');
}

const db   = admin.firestore();
const auth = admin.auth();

// Suppress "undefined" field warnings in Firestore
db.settings({ ignoreUndefinedProperties: true });

module.exports = { admin, db, auth };
