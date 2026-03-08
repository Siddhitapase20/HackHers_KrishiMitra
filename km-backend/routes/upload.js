/**
 * routes/upload.js
 *
 * POST /api/upload/crop-image   Upload a crop photo (up to 10 MB)
 *
 * Images are stored in /uploads/ on disk locally.
 * Swap the storage logic for Firebase Storage in production.
 */
const router     = require('express').Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const { v4: uuid } = require('uuid');
const { verifyToken } = require('../middleware/auth');

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file,  cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `crop_${Date.now()}_${uuid().slice(0,8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg','image/jpg','image/png','image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG and WebP images are allowed.'), ok);
  },
});

/* ── POST /api/upload/crop-image ─────────────────────────────────── */
router.post('/crop-image', verifyToken, upload.single('image'), (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, message: 'No image file received.' });

  // In production swap this URL for a Firebase Storage signed URL
  const fileUrl = `/uploads/${req.file.filename}`;

  res.status(201).json({
    success: true,
    message: 'Image uploaded successfully.',
    data: {
      filename: req.file.filename,
      url:      fileUrl,
      size_kb:  Math.round(req.file.size / 1024),
    },
  });
});

module.exports = router;
