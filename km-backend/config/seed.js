/**
 * config/seed.js
 * Seeds Firestore with demo data for development.
 * Run: node config/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { admin, db, auth } = require('./firebase');

// ── Demo users ────────────────────────────────────────────────────
const USERS = [
  {
    email: 'farmer@krishi.com', password: 'krishi123',
    profile: { first_name:'Ramesh', last_name:'Shinde', phone:'9823456789',
               district:'Nashik', land_size:5, primary_crop:'Wheat', role:'farmer' }
  },
  {
    email: 'priya@krishi.com', password: 'priya1234',
    profile: { first_name:'Priya', last_name:'Patil', phone:'9845678901',
               district:'Pune', land_size:3, primary_crop:'Tomato', role:'farmer' }
  },
  {
    email: 'admin@krishi.com', password: 'admin@123',
    profile: { first_name:'Admin', last_name:'KrishiMitra', phone:'9800000001',
               district:'Nagpur', land_size:0, primary_crop:'', role:'admin' }
  },
];

// ── Equipment listings ─────────────────────────────────────────────
const EQUIPMENT = [
  { type:'Tractor',   name:'Mahindra 475 DI',  owner:'Ramesh Shinde',  location:'Ozar Village', district:'Nashik',    rent_per_day:800,  condition:'Excellent', available:true,  contact:'9823456789' },
  { type:'Harvester', name:'John Deere W70',   owner:'Suresh Patil',   location:'Nandgaon',     district:'Nashik',    rent_per_day:1200, condition:'Good',      available:true,  contact:'9845678901' },
  { type:'Sprayer',   name:'Honda Power Sprayer',owner:'Mohan Yadav',  location:'Deola',        district:'Nashik',    rent_per_day:300,  condition:'Good',      available:false, contact:'9867890123' },
  { type:'Tractor',   name:'Sonalika DI 745',  owner:'Vijay Kale',     location:'Yeola',        district:'Nashik',    rent_per_day:700,  condition:'Excellent', available:true,  contact:'9890123456' },
  { type:'Thresher',  name:'Paddy Thresher',   owner:'Anil Jadhav',    location:'Malegaon',     district:'Jalgaon',   rent_per_day:600,  condition:'Good',      available:true,  contact:'9812345678' },
  { type:'Harvester', name:'Claas Crop Tiger', owner:'Ravi Deshmukh',  location:'Shirdi',       district:'Ahmednagar',rent_per_day:1500, condition:'Excellent', available:true,  contact:'9834567890' },
];

// ── Market data ────────────────────────────────────────────────────
const CROPS   = ['wheat','rice','soybean','cotton','tomato','onion'];
const MANDIS  = ['Nashik APMC','Pune APMC','Nagpur APMC','Aurangabad APMC'];
const BASE_PX = { wheat:221, rice:320, soybean:420, cotton:590, tomato:820, onion:280 };

async function seedUsers() {
  console.log('\n👤 Seeding users…');
  for (const u of USERS) {
    let uid;
    try {
      const rec = await auth.createUser({
        email: u.email, password: u.password,
        displayName: `${u.profile.first_name} ${u.profile.last_name}`
      });
      uid = rec.uid;
      console.log(`   ✅ Created: ${u.email}`);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        uid = (await auth.getUserByEmail(u.email)).uid;
        console.log(`   ⏭  Exists:  ${u.email}`);
      } else throw e;
    }
    await db.collection('users').doc(uid).set(
      { ...u.profile, email: u.email, uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
}

async function seedMarket() {
  console.log('\n📊 Seeding 7-day market prices…');
  const batch = db.batch();
  const today = new Date();
  for (const crop of CROPS) {
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today);
      date.setDate(today.getDate() - d);
      const ds = date.toISOString().split('T')[0];
      for (const mandi of MANDIS) {
        const price = Math.round(BASE_PX[crop] * (0.88 + Math.random() * 0.24));
        const id = `${crop}_${mandi.replace(/\s+/g,'_')}_${ds}`;
        batch.set(db.collection('market_prices').doc(id), {
          crop, mandi, price, date: ds,
          timestamp: admin.firestore.Timestamp.fromDate(date)
        });
      }
    }
  }
  await batch.commit();
  console.log(`   ✅ ${CROPS.length} crops × ${MANDIS.length} mandis × 7 days`);
}

async function seedEquipment() {
  console.log('\n🚜 Seeding equipment listings…');
  // Check if already seeded
  const existing = await db.collection('equipment').limit(1).get();
  if (!existing.empty) { console.log('   ⏭  Already seeded'); return; }
  const batch = db.batch();
  for (const eq of EQUIPMENT) {
    batch.set(db.collection('equipment').doc(), {
      ...eq, createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
  console.log(`   ✅ ${EQUIPMENT.length} listings added`);
}

(async () => {
  try {
    console.log('🌾 KrishiMitra Seed Script');
    console.log('─'.repeat(40));
    await seedUsers();
    await seedMarket();
    await seedEquipment();
    console.log('\n✅ Seeding complete!\n');
    console.log('Demo credentials:');
    console.log('  farmer@krishi.com  /  krishi123');
    console.log('  admin@krishi.com   /  admin@123\n');
    process.exit(0);
  } catch (e) {
    console.error('\n❌ Seed error:', e.message);
    process.exit(1);
  }
})();
