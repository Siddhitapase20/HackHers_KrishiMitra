/**
 * routes/crops.js
 *
 * POST /api/crops/predict    Crop profit predictions
 * GET  /api/crops/history    User's prediction history
 * POST /api/crops/diagnose   Disease diagnosis from symptoms
 * GET  /api/crops/diagnose/history  User's diagnosis history
 */
const router              = require('express').Router();
const { admin, db }       = require('../config/firebase');
const { optionalToken, verifyToken } = require('../middleware/auth');

/* ── Crop database (soil × water → top 3 crops) ────────────────── */
const CROP_DB = {
  'Black Cotton Soil': {
    'Canal Irrigation': [
      { name:'Cotton',    icon:'🌿', cost:22000, yield_per_acre:1200, price_per_kg:62,  season:'Kharif' },
      { name:'Soybean',   icon:'🌱', cost:12000, yield_per_acre:1800, price_per_kg:38,  season:'Kharif' },
      { name:'Wheat',     icon:'🌾', cost:14000, yield_per_acre:2200, price_per_kg:27,  season:'Rabi'   },
    ],
    'Well/Borewell': [
      { name:'Cotton',    icon:'🌿', cost:20000, yield_per_acre:1100, price_per_kg:62,  season:'Kharif' },
      { name:'Turmeric',  icon:'🟡', cost:35000, yield_per_acre:2500, price_per_kg:80,  season:'Kharif' },
      { name:'Soybean',   icon:'🌱', cost:11000, yield_per_acre:1600, price_per_kg:38,  season:'Kharif' },
    ],
    'Rain-fed Only': [
      { name:'Soybean',   icon:'🌱', cost:9000,  yield_per_acre:1200, price_per_kg:38,  season:'Kharif' },
      { name:'Jowar',     icon:'🌾', cost:6000,  yield_per_acre:1500, price_per_kg:22,  season:'Kharif' },
      { name:'Bajra',     icon:'🌾', cost:5500,  yield_per_acre:1400, price_per_kg:21,  season:'Kharif' },
    ],
    'River Nearby': [
      { name:'Sugarcane', icon:'🎋', cost:45000, yield_per_acre:35000,price_per_kg:3.5, season:'Annual' },
      { name:'Cotton',    icon:'🌿', cost:22000, yield_per_acre:1300, price_per_kg:62,  season:'Kharif' },
      { name:'Banana',    icon:'🍌', cost:30000, yield_per_acre:15000,price_per_kg:15,  season:'Annual' },
    ],
  },
  'Alluvial Soil': {
    'Canal Irrigation': [
      { name:'Wheat',     icon:'🌾', cost:14000, yield_per_acre:2800, price_per_kg:27,  season:'Rabi'   },
      { name:'Rice',      icon:'🌾', cost:18000, yield_per_acre:2200, price_per_kg:20,  season:'Kharif' },
      { name:'Mustard',   icon:'🟡', cost:8000,  yield_per_acre:1200, price_per_kg:55,  season:'Rabi'   },
    ],
    'Well/Borewell': [
      { name:'Potato',    icon:'🥔', cost:35000, yield_per_acre:12000,price_per_kg:12,  season:'Rabi'   },
      { name:'Wheat',     icon:'🌾', cost:14000, yield_per_acre:2600, price_per_kg:27,  season:'Rabi'   },
      { name:'Onion',     icon:'🧅', cost:20000, yield_per_acre:8000, price_per_kg:18,  season:'Rabi'   },
    ],
    'Rain-fed Only': [
      { name:'Maize',     icon:'🌽', cost:8000,  yield_per_acre:2000, price_per_kg:18,  season:'Kharif' },
      { name:'Wheat',     icon:'🌾', cost:12000, yield_per_acre:1800, price_per_kg:27,  season:'Rabi'   },
      { name:'Chickpea',  icon:'🌱', cost:7000,  yield_per_acre:900,  price_per_kg:55,  season:'Rabi'   },
    ],
    'River Nearby': [
      { name:'Rice',      icon:'🌾', cost:18000, yield_per_acre:2600, price_per_kg:20,  season:'Kharif' },
      { name:'Sugarcane', icon:'🎋', cost:45000, yield_per_acre:35000,price_per_kg:3.5, season:'Annual' },
      { name:'Wheat',     icon:'🌾', cost:15000, yield_per_acre:3000, price_per_kg:27,  season:'Rabi'   },
    ],
  },
  'Red Laterite Soil': {
    'Well/Borewell': [
      { name:'Groundnut', icon:'🥜', cost:15000, yield_per_acre:1400, price_per_kg:55,  season:'Kharif' },
      { name:'Chilli',    icon:'🌶️', cost:20000, yield_per_acre:2000, price_per_kg:65,  season:'Kharif' },
      { name:'Sunflower', icon:'🌻', cost:9000,  yield_per_acre:1200, price_per_kg:48,  season:'Rabi'   },
    ],
    'Canal Irrigation': [
      { name:'Tomato',    icon:'🍅', cost:25000, yield_per_acre:15000,price_per_kg:12,  season:'Rabi'   },
      { name:'Groundnut', icon:'🥜', cost:16000, yield_per_acre:1500, price_per_kg:55,  season:'Kharif' },
      { name:'Maize',     icon:'🌽', cost:8000,  yield_per_acre:2200, price_per_kg:18,  season:'Kharif' },
    ],
    'Rain-fed Only': [
      { name:'Groundnut', icon:'🥜', cost:12000, yield_per_acre:1000, price_per_kg:55,  season:'Kharif' },
      { name:'Jowar',     icon:'🌾', cost:6000,  yield_per_acre:1300, price_per_kg:22,  season:'Kharif' },
      { name:'Sesame',    icon:'🌱', cost:8000,  yield_per_acre:600,  price_per_kg:130, season:'Kharif' },
    ],
    'River Nearby': [
      { name:'Banana',    icon:'🍌', cost:30000, yield_per_acre:14000,price_per_kg:15,  season:'Annual' },
      { name:'Tomato',    icon:'🍅', cost:25000, yield_per_acre:18000,price_per_kg:12,  season:'Rabi'   },
      { name:'Groundnut', icon:'🥜', cost:16000, yield_per_acre:1600, price_per_kg:55,  season:'Kharif' },
    ],
  },
  'Sandy Loam': {
    'Well/Borewell': [
      { name:'Watermelon',icon:'🍉', cost:20000, yield_per_acre:14000,price_per_kg:8,   season:'Zaid'   },
      { name:'Groundnut', icon:'🥜', cost:14000, yield_per_acre:1200, price_per_kg:55,  season:'Kharif' },
      { name:'Mung Bean', icon:'🌱', cost:6000,  yield_per_acre:900,  price_per_kg:70,  season:'Kharif' },
    ],
    'Canal Irrigation': [
      { name:'Groundnut', icon:'🥜', cost:14000, yield_per_acre:1300, price_per_kg:55,  season:'Kharif' },
      { name:'Watermelon',icon:'🍉', cost:18000, yield_per_acre:12000,price_per_kg:8,   season:'Zaid'   },
      { name:'Bajra',     icon:'🌾', cost:5500,  yield_per_acre:1800, price_per_kg:21,  season:'Kharif' },
    ],
    'Rain-fed Only': [
      { name:'Bajra',     icon:'🌾', cost:5000,  yield_per_acre:1300, price_per_kg:21,  season:'Kharif' },
      { name:'Sesame',    icon:'🌱', cost:7000,  yield_per_acre:500,  price_per_kg:130, season:'Kharif' },
      { name:'Groundnut', icon:'🥜', cost:12000, yield_per_acre:1000, price_per_kg:55,  season:'Kharif' },
    ],
    'River Nearby': [
      { name:'Watermelon',icon:'🍉', cost:20000, yield_per_acre:15000,price_per_kg:8,   season:'Zaid'   },
      { name:'Sugarcane', icon:'🎋', cost:42000, yield_per_acre:32000,price_per_kg:3.5, season:'Annual' },
      { name:'Groundnut', icon:'🥜', cost:16000, yield_per_acre:1500, price_per_kg:55,  season:'Kharif' },
    ],
  },
};

const DEFAULT_CROPS = [
  { name:'Wheat',   icon:'🌾', cost:14000, yield_per_acre:2200, price_per_kg:27, season:'Rabi'   },
  { name:'Soybean', icon:'🌱', cost:11000, yield_per_acre:1600, price_per_kg:38, season:'Kharif' },
  { name:'Maize',   icon:'🌽', cost:8000,  yield_per_acre:2000, price_per_kg:18, season:'Kharif' },
];

/* ── Disease database ───────────────────────────────────────────── */
const DISEASE_DB = {
  'Yellow leaves':  { name:'Leaf Blight (Helminthosporium)', severity:'medium', cause:'Fungal infection from water splash and high humidity.', treatments:['Apply Mancozeb 75% WP @ 2.5g/litre water','Spray Carbendazim 50% WP @ 1g/litre','Ensure proper field drainage','Remove and destroy infected plant debris'] },
  'Brown spots':    { name:'Alternaria Leaf Spot',           severity:'medium', cause:'Fungal disease in warm and humid conditions.',          treatments:['Spray Iprodione 50% WP @ 2g/litre','Apply Tebuconazole 250 EC @ 1ml/litre','Treat seeds with Thiram 75 WS before planting'] },
  'White powder':   { name:'Powdery Mildew (Erysiphe sp.)',  severity:'low',    cause:'Fungal disease in warm dry conditions.',                treatments:['Spray wettable Sulphur 80% WP @ 2.5g/litre','Apply Hexaconazole 5% SC @ 2ml/litre','Increase plant spacing for airflow'] },
  'Wilting':        { name:'Fusarium Wilt (F. oxysporum)',   severity:'high',   cause:'Soil-borne fungus blocking water transport in roots.',  treatments:['Drench Carbendazim 50 WP @ 1g/litre at root zone','Remove and burn wilted plants immediately','Solarize soil before next planting'] },
  'Black spots':    { name:'Alternaria Blight',              severity:'medium', cause:'Fungal disease spread through infected seeds.',         treatments:['Spray Iprodione 50% WP @ 2g/litre','Destroy infected plant material','Treat seeds with Thiram 75 WS'] },
  'Curling leaves': { name:'Leaf Curl Virus (Begomovirus)',  severity:'high',   cause:'Viral disease transmitted by whiteflies.',             treatments:['Control whiteflies with Imidacloprid @ 0.5ml/litre','Use yellow sticky traps @ 10 per acre','Remove and destroy infected plants immediately'] },
  'Root rot':       { name:'Pythium Root Rot',               severity:'high',   cause:'Water mould thriving in waterlogged soil.',            treatments:['Seed treatment with Metalaxyl 35% WS @ 6g/kg seed','Improve field drainage immediately','Drench Ridomil Gold @ 1g/litre around root zone'] },
  'Stunted growth': { name:'Nitrogen Deficiency',            severity:'low',    cause:'Insufficient nitrogen or micronutrient uptake.',       treatments:['Apply Urea @ 20 kg/acre as top dressing','Spray 2% DAP solution as foliar spray','Correct soil pH to 6.0–7.0 with lime'] },
};

/* ── POST /api/crops/predict ────────────────────────────────────── */
router.post('/predict', optionalToken, async (req, res, next) => {
  try {
    const { district, soil_type, water_source, land_size = 1 } = req.body;
    if (!district || !soil_type || !water_source)
      return res.status(400).json({ success: false, message: 'district, soil_type and water_source are required.' });

    // Pick crop list
    let baseCrops = DEFAULT_CROPS;
    if (CROP_DB[soil_type]?.[water_source])
      baseCrops = CROP_DB[soil_type][water_source];
    else if (CROP_DB[soil_type])
      baseCrops = Object.values(CROP_DB[soil_type])[0];

    const land = parseFloat(land_size) || 1;

    const predictions = baseCrops.slice(0, 3)
      .map((c, i) => {
        const cost    = Math.round(c.cost * land);
        const yld     = Math.round(c.yield_per_acre * land);
        const revenue = Math.round(yld * c.price_per_kg);
        const profit  = revenue - cost;
        return {
          rank: i + 1, name: c.name, icon: c.icon, season: c.season,
          cost, yield_kg: yld, price_per_kg: c.price_per_kg,
          revenue, profit,
          roi: cost > 0 ? Math.round((profit / cost) * 100) : 0,
        };
      })
      .sort((a, b) => b.profit - a.profit)
      .map((c, i) => ({ ...c, rank: i + 1 }));

    // Save prediction if authenticated
    if (req.user) {
      await db.collection('crop_predictions').add({
        uid: req.user.uid, district, soil_type, water_source, land_size: land,
        top_crop: predictions[0].name, predictions,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ success: true, data: { district, soil_type, water_source, land_size: land, predictions } });
  } catch (e) { next(e); }
});

/* ── GET /api/crops/history ─────────────────────────────────────── */
router.get('/history', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('crop_predictions')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    res.json({ success: true, data: { history: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (e) { next(e); }
});

/* ── POST /api/crops/diagnose ───────────────────────────────────── */
router.post('/diagnose', optionalToken, async (req, res, next) => {
  try {
    const { symptoms = [], crop_type = '' } = req.body;

    // Match first symptom to disease DB
    let diagnosis = null;
    for (const sym of symptoms) {
      const entry = Object.entries(DISEASE_DB).find(([key]) =>
        sym.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(sym.toLowerCase())
      );
      if (entry) { diagnosis = { symptom: entry[0], ...entry[1] }; break; }
    }

    if (!diagnosis) {
      diagnosis = {
        symptom: 'Unknown',
        name: 'Nutrient Deficiency',
        severity: 'low',
        cause: 'Insufficient nitrogen or micronutrient uptake.',
        treatments: ['Apply Urea @ 20 kg/acre as top dressing', 'Spray 2% DAP foliar', 'Add organic compost to improve soil health'],
      };
    }

    if (req.user) {
      await db.collection('disease_diagnoses').add({
        uid: req.user.uid, crop_type, symptoms, diagnosis,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    res.json({ success: true, data: { crop_type, symptoms, diagnosis } });
  } catch (e) { next(e); }
});

/* ── GET /api/crops/diagnose/history ───────────────────────────── */
router.get('/diagnose/history', verifyToken, async (req, res, next) => {
  try {
    const snap = await db.collection('disease_diagnoses')
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    res.json({ success: true, data: { history: snap.docs.map(d => ({ id: d.id, ...d.data() })) } });
  } catch (e) { next(e); }
});

module.exports = router;
