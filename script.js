let user = null, actLog = [], chart = null, lang = 'hi', listening = false, sr = null;

// DATA
const CROPS = {
  Nashik:  { 'Black Cotton Soil': ['Wheat','Soybean','Cotton'], def: ['Wheat','Onion','Tomato'] },
  Pune:    { 'Alluvial Soil': ['Sugarcane','Wheat','Rice'],     def: ['Sugarcane','Soybean','Onion'] },
  Nagpur:  { def: ['Cotton','Soybean','Jowar'] },
  def:     { def: ['Wheat','Soybean','Jowar'] }
};

const CROP_INFO = {
  Wheat:     { y:'20-25 q/ac', c:'18000', p:'220/q',  pr:'26000' },
  Soybean:   { y:'8-12 q/ac',  c:'14000', p:'420/q',  pr:'22000' },
  Cotton:    { y:'15-20 q/ac', c:'22000', p:'580/q',  pr:'30000' },
  Tomato:    { y:'60-80 q/ac', c:'28000', p:'12/kg',  pr:'44000' },
  Onion:     { y:'80-100 q/ac',c:'20000', p:'10/kg',  pr:'60000' },
  Sugarcane: { y:'350 q/ac',   c:'35000', p:'34/q',   pr:'49000' },
  Jowar:     { y:'15-20 q/ac', c:'10000', p:'185/q',  pr:'18000' },
  Rice:      { y:'22-28 q/ac', c:'24000', p:'210/q',  pr:'31000' },
};

const MARKET = {
  wheat:   { p:270, t:[210,215,222,218,230,245,270], v:'SELL NOW', r:'Price above average. Sell immediately!', bg:'#2d6a4f' },
  rice:    { p:310, t:[320,315,312,310,308,311,310], v:'WAIT',     r:'Prices slightly low. Wait 2-3 days.',   bg:'#7c4d00' },
  soybean: { p:430, t:[415,418,422,425,428,432,430], v:'SELL NOW', r:'Prices above average. Good time.',      bg:'#2d6a4f' },
  cotton:  { p:570, t:[615,605,595,585,578,572,570], v:'WAIT',     r:'Prices declining. Hold for 1 week.',    bg:'#8b0000' },
  tomato:  { p:15,  t:[10,11,12,13,14,15,15],        v:'SELL NOW', r:'Peak price! Sell before spoilage.',     bg:'#1a5c2a' },
};

const DISEASE = {
  yellow: { n:'Nutrient Deficiency', s:'Low',    sc:'sev-l', d:'Yellow leaves = nitrogen or iron deficiency.',       tx:['Apply urea/DAP','Check soil pH 6.0-7.0','Ensure drainage'] },
  brown:  { n:'Leaf Blight',         s:'High',   sc:'sev-h', d:'Fungal infection causing brown spots. Spreads fast.', tx:['Spray Mancozeb 75% WP at 2.5g/L','Remove infected leaves','Avoid overhead watering','Repeat after 7 days'] },
  white:  { n:'Powdery Mildew',      s:'Medium', sc:'sev-m', d:'White powder on leaves = fungal disease.',            tx:['Apply sulfur fungicide','Remove infected parts','Improve airflow','Repeat after 10 days'] },
  def:    { n:'General Infection',   s:'Medium', sc:'sev-m', d:'Possible pest or fungal issue.',                      tx:['Contact local Krishi Seva Kendra','Apply broad-spectrum fungicide','Monitor for 5 days'] },
};

const EQUIP = [
  { id:1, type:'Tractor',   name:'Mahindra 575 DI',  owner:'Ramesh S.', loc:'Nashik',     rent:800,  cond:'Excellent' },
  { id:2, type:'Harvester', name:'Combine Harvester', owner:'Suresh P.', loc:'Pune',       rent:2500, cond:'Good'      },
  { id:3, type:'Sprayer',   name:'Power Sprayer',     owner:'Anil Y.',   loc:'Nagpur',     rent:300,  cond:'Good'      },
  { id:4, type:'Tractor',   name:'Sonalika DI 35',    owner:'Manoj K.',  loc:'Aurangabad', rent:700,  cond:'Fair'      },
  { id:5, type:'Thresher',  name:'Wheat Thresher',    owner:'Vijay S.',  loc:'Solapur',    rent:500,  cond:'Excellent' },
  { id:6, type:'Sprayer',   name:'Boom Sprayer',      owner:'Priya K.',  loc:'Kolhapur',   rent:450,  cond:'Good'      },
];

const REPLIES = {
  hi: { crop:'aapke liye gehu, soybean ya tamatar sahi hain. 🌱', sell:'katai ke 2-3 hafte baad bechen. 📊', disease:'Mancozeb spray karen. Health section dekhen. 🔬', mandi:'Gehu 270/q | Soybean 4300/q 💰', fertilizer:'DAP 50kg + Urea 25kg prati acre dalen. 💊', weather:'Agle 7 din normal barish. ⛅', def:'Hamare AI tools se jaankari payen. 🌿' },
  mr: { crop:'gahu, soybean kiva kanda lava. 🌱', sell:'2-3 aathavdyani vika. 📊', def:'KrishiMitra tools vapra. 🌿' },
  en: { crop:'Wheat, Soybean or Tomato recommended for your region. 🌱', sell:'Sell 2-3 weeks after harvest. 📊', disease:'Spray Mancozeb 75% WP for leaf spots. 🔬', mandi:'Wheat Rs.270/q | Soybean Rs.4300/q 💰', fertilizer:'DAP 50kg/acre + Urea 25kg/acre at sowing. 💊', weather:'Normal rainfall next 7 days. ⛅', def:'Use our AI tools for detailed answers. 🌿' },
};

// NAVIGATION
function go(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('show'));
  document.getElementById('page-' + page).classList.add('show');
  window.scrollTo(0, 0);
  if (page === 'market')  setTimeout(loadMarket, 80);
  if (page === 'equip')   renderEq();
  if (page === 'profile') loadProfile();
}

// TOAST
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(window._t);
  window._t = setTimeout(() => t.style.display = 'none', 3000);
}

// AUTH
function doLogin() {
  const em = document.getElementById('l-email').value.trim();
  const pw = document.getElementById('l-pass').value;
  if (!em || !pw) return toast('Fill all fields');
  user = { name: em === 'farmer@krishi.com' ? 'Ramesh Shinde' : em.split('@')[0], email: em, district:'Nashik', crop:'Wheat', land:'5 acres', phone:'9876543210' };
  setUser();
  toast('Welcome, ' + user.name + '!');
  go('home');
}

function doRegister() {
  const fn = document.getElementById('r-fn').value.trim();
  const em = document.getElementById('r-email').value.trim();
  const pw = document.getElementById('r-pass').value;
  if (!fn || !em || !pw) return toast('Fill all fields');
  if (pw.length < 6) return toast('Password too short');
  user = {
    name:     fn + ' ' + document.getElementById('r-ln').value.trim(),
    email:    em,
    district: document.getElementById('r-dist').value || '-',
    crop:     '-',
    land:     (document.getElementById('r-land').value || '-') + ' acres',
    phone:    document.getElementById('r-phone').value || '-'
  };
  setUser();
  toast('Welcome, ' + fn + '!');
  go('home');
}

function logout() {
  user = null;
  actLog = [];
  document.getElementById('nav-guest').style.display = '';
  document.getElementById('nav-user').style.display = 'none';
  toast('Logged out');
  go('home');
}

function setUser() {
  document.getElementById('nav-guest').style.display = 'none';
  document.getElementById('nav-user').style.display = '';
  document.getElementById('nav-name').textContent = 'Farmer: ' + user.name.split(' ')[0];
}

// CROP PREDICTION
function predict() {
  const dist   = document.getElementById('p-dist').value;
  const soil   = document.getElementById('p-soil').value;
  const water  = document.getElementById('p-water').value;
  const land   = document.getElementById('p-land').value;
  const season = document.getElementById('p-season').value;
  if (!dist || !soil || !water || !land || !season) return toast('Fill all fields');

  const d    = CROPS[dist] || CROPS.def;
  const list = (d[soil] || d.def).slice(0, 3);

  document.getElementById('crop-cards').innerHTML = list.map((crop, i) => {
    const info  = CROP_INFO[crop] || { y:'-', c:'-', p:'-', pr:'20000' };
    const total = 'Rs.' + Math.round(parseInt(info.pr) * parseFloat(land) / 1000) + 'K';
    return `<div class="card" style="${i === 0 ? 'border:2px solid #2d6a4f;' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <b style="font-size:1.1rem;">${crop}</b>
        <span class="tag">#${i+1}${i === 0 ? ' Best' : ''}</span>
      </div>
      <table style="margin-top:8px;font-size:0.82rem;">
        <tr><td>Yield</td>       <td><b>${info.y}</b></td></tr>
        <tr><td>Cost/Acre</td>   <td><b>Rs.${info.c}</b></td></tr>
        <tr><td>Mandi Price</td> <td><b>Rs.${info.p}</b></td></tr>
        <tr><td>Profit/Acre</td> <td><b style="color:#2d6a4f;">Rs.${info.pr}</b></td></tr>
      </table>
      <div style="background:#e8f5ec;padding:7px;border-radius:5px;margin-top:8px;display:flex;justify-content:space-between;">
        <span>Total (${land} ac)</span><b style="color:#2d6a4f;">${total}</b>
      </div>
    </div>`;
  }).join('');

  document.getElementById('pred-result').style.display = 'block';
  addLog('Crop Predicted', list[0] + ' - ' + dist + ', ' + land + ' acres');
}

// CROP HEALTH
function showPreview(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const b = document.getElementById('img-preview');
    b.innerHTML = '<img src="' + ev.target.result + '" style="width:100%;max-height:160px;object-fit:cover;border-radius:6px;" />';
    b.style.display = 'block';
  };
  r.readAsDataURL(f);
}

function diagnose() {
  const sel    = [...document.querySelectorAll('#symptom-chips .chip.on')].map(c => c.textContent.toLowerCase());
  const hasImg = document.getElementById('crop-img').files.length > 0;
  if (!sel.length && !hasImg) return toast('Select symptoms or upload image');

  let d = DISEASE.def;
  if (sel.some(s => s.includes('yellow')))                            d = DISEASE.yellow;
  else if (sel.some(s => s.includes('brown') || s.includes('spot'))) d = DISEASE.brown;
  else if (sel.some(s => s.includes('white') || s.includes('powder')))d = DISEASE.white;

  document.getElementById('diag-box').innerHTML =
    '<h2>Diagnosis Result</h2>' +
    '<p><b>' + d.n + '</b> &nbsp;<span class="' + d.sc + '">' + d.s + ' Severity</span></p>' +
    '<p style="font-size:0.88rem;color:#444;">' + d.d + '</p>' +
    '<b>Treatment Steps:</b>' +
    '<ol style="font-size:0.88rem;color:#333;line-height:1.8;">' +
      d.tx.map(s => '<li>' + s + '</li>').join('') +
    '</ol>';
  addLog('Crop Diagnosed', d.n + ' (' + d.s + ' severity)');
}

// CALCULATOR
function calcP() {
  const cost = [1,2,3,4,5,6].reduce((s, i) => s + (parseFloat(document.getElementById('c'+i).value) || 0), 0);
  const rev  = (parseFloat(document.getElementById('c7').value) || 0) * (parseFloat(document.getElementById('c8').value) || 0);
  const prof = rev - cost;

  document.getElementById('r-cost').textContent   = 'Rs.' + cost.toLocaleString('en-IN');
  document.getElementById('r-rev').textContent    = 'Rs.' + rev.toLocaleString('en-IN');
  document.getElementById('r-profit').textContent = 'Rs.' + Math.abs(prof).toLocaleString('en-IN');
  document.getElementById('r-lbl').textContent    = prof >= 0 ? 'Profit' : 'Loss';
  document.getElementById('r-profit').style.color = prof > 0 ? 'green' : prof < 0 ? 'red' : '#888';

  const adv = document.getElementById('r-adv');
  if (prof > 0)      { adv.style.cssText = 'background:#d8f3dc;color:#1b4332'; adv.textContent = 'Profitable crop!'; }
  else if (prof < 0) { adv.style.cssText = 'background:#fee2e2;color:#991b1b'; adv.textContent = 'At a loss. Reduce costs or increase yield.'; }
  else               { adv.style.cssText = ''; adv.textContent = ''; }
}

// MARKET ADVISOR
function loadMarket() {
  const d = MARKET[document.getElementById('mk-crop').value];
  if (!d) return;

  document.getElementById('mkt-verdict').textContent        = d.v;
  document.getElementById('mkt-reason').textContent         = d.r;
  document.getElementById('mkt-price').textContent          = 'Rs.' + d.p + '/q';
  document.getElementById('mkt-banner').style.background    = d.bg;

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById('price-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Today'],
      datasets: [{ data: d.t, borderColor: '#2d6a4f', backgroundColor: 'rgba(45,106,79,0.1)', borderWidth: 2, pointRadius: 4, tension: 0.3, fill: true }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  const mandis = [
    { n:'Nashik APMC',   d:'Nashik',     m:0   },
    { n:'Pune Market',   d:'Pune',       m:-5  },
    { n:'Nagpur APMC',   d:'Nagpur',     m:+8  },
    { n:'Solapur Mandi', d:'Solapur',    m:-10 },
    { n:'Kolhapur APMC', d:'Kolhapur',   m:+3  },
    { n:'Aurangabad',    d:'Aurangabad', m:-3  },
  ];
  document.getElementById('mandi-table').innerHTML = mandis.map(m =>
    '<tr>' +
      '<td>' + m.n + '</td>' +
      '<td>' + m.d + '</td>' +
      '<td>Rs.' + (d.p + m.m) + '/q</td>' +
      '<td style="color:' + (m.m >= 0 ? 'green' : 'orange') + '">' + (m.m >= 0 ? 'Best' : 'OK') + '</td>' +
    '</tr>'
  ).join('');
}

// VOICE ASSISTANT
function setLang(l, el) {
  lang = l;
  ['hi','mr','en'].forEach(x => {
    document.getElementById('lang-' + x).className = 'btn ' + (x === l ? 'btn-green' : 'btn-white');
  });
  toast('Language: ' + el.textContent.trim());
}

function toggleVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    return toast('Use Chrome or Edge for voice');
  }
  if (listening) { sr && sr.stop(); stopVoice(); return; }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  sr = new SR();
  sr.lang     = lang === 'hi' ? 'hi-IN' : lang === 'mr' ? 'mr-IN' : 'en-IN';
  sr.onstart  = () => { listening = true;  document.getElementById('orb-status').textContent = 'Listening...'; };
  sr.onresult = e  => { const t = e.results[0][0].transcript; addMsg(t, true); setTimeout(() => addMsg(getReply(t), false), 600); };
  sr.onend    = ()  => stopVoice();
  sr.onerror  = ()  => { stopVoice(); toast('Voice failed. Try again.'); };
  sr.start();
}

function stopVoice() {
  listening = false;
  document.getElementById('orb-status').textContent = 'Tap to speak';
}

function qAsk(btn) {
  addMsg(btn.textContent, true);
  setTimeout(() => addMsg(getReply(btn.textContent), false), 500);
}

function sendMsg() {
  const i = document.getElementById('chat-input');
  const t = i.value.trim();
  if (!t) return;
  i.value = '';
  addMsg(t, true);
  setTimeout(() => addMsg(getReply(t), false), 600);
}

function addMsg(txt, me) {
  const b = document.getElementById('chat-box');
  const d = document.createElement('div');
  d.className = 'msg' + (me ? ' me' : '');
  d.innerHTML = '<span>' + (me ? 'You' : 'Bot') + '</span><div class="bubble">' + txt + '</div>';
  b.appendChild(d);
  b.scrollTop = 9999;
}

function getReply(txt) {
  const r = REPLIES[lang] || REPLIES.en;
  const t = txt.toLowerCase();
  for (const k in r) {
    if (k !== 'def' && t.includes(k)) return r[k];
  }
  return r.def;
}

// EQUIPMENT SHARING
function renderEq() {
  const search = (document.getElementById('eq-search') ? document.getElementById('eq-search').value : '').toLowerCase();
  const filter = document.getElementById('eq-filter') ? document.getElementById('eq-filter').value : 'all';
  let list = EQUIP;
  if (filter !== 'all') list = list.filter(e => e.type === filter);
  if (search)           list = list.filter(e => e.name.toLowerCase().includes(search) || e.loc.toLowerCase().includes(search));

  if (!list.length) {
    document.getElementById('eq-grid').innerHTML = '<p style="color:#aaa;">No equipment found.</p>';
    return;
  }

  document.getElementById('eq-grid').innerHTML = list.map(e =>
    '<div class="eq-card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<b>' + e.name + '</b><span class="tag">' + e.type + '</span>' +
      '</div>' +
      '<small>Location: ' + e.loc + ' &nbsp; Owner: ' + e.owner + '</small><br/>' +
      '<small>Condition: ' + e.cond + '</small>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">' +
        '<b style="color:#2d6a4f;">Rs.' + e.rent + '/day</b>' +
        '<button class="btn btn-white" style="padding:5px 10px;font-size:0.78rem;" onclick="openReqModal(' + e.id + ',\'' + e.name + '\')">Request</button>' +
      '</div>' +
    '</div>'
  ).join('');
}

function listEquip() {
  const nm   = document.getElementById('em-name').value.trim();
  const loc  = document.getElementById('em-loc').value.trim();
  const rent = document.getElementById('em-rent').value;
  const ph   = document.getElementById('em-phone').value.trim();
  if (!nm || !loc || !rent || !ph) return toast('Fill all fields');

  EQUIP.unshift({
    id:   Date.now(),
    type: document.getElementById('em-type').value,
    name: document.getElementById('em-type').value + ' (' + nm + ')',
    owner: nm, loc: loc,
    rent: parseInt(rent),
    cond: document.getElementById('em-cond').value
  });
  closeModal('list-modal');
  renderEq();
  toast('Equipment listed!');
  addLog('Equipment Listed', document.getElementById('em-type').value + ' in ' + loc);
}

function openReqModal(id, name) {
  document.getElementById('req-item-name').textContent = 'Equipment: ' + name;
  window._reqId = id;
  openModal('req-modal');
}

function sendRequest() {
  const n  = document.getElementById('rq-name').value.trim();
  const dt = document.getElementById('rq-date').value;
  const dy = document.getElementById('rq-days').value;
  const ph = document.getElementById('rq-phone').value.trim();
  if (!n || !dt || !dy || !ph) return toast('Fill all fields');
  closeModal('req-modal');
  toast('Request sent! Farmer will contact you.');
  addLog('Equipment Requested', dy + ' days from ' + dt);
}

// MODALS
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-bg')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// PROFILE
function loadProfile() {
  if (!user) return;
  const preds = actLog.filter(a => a.includes('Predicted')).length;
  const diags = actLog.filter(a => a.includes('Diagnosed')).length;
  const calcs = actLog.filter(a => a.includes('Profit')).length;
  const init  = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  document.getElementById('p-avatar').textContent = init;
  document.getElementById('p-name').textContent   = user.name;
  document.getElementById('p-email').textContent  = user.email;
  document.getElementById('p-npred').textContent  = preds;
  document.getElementById('p-ndiag').textContent  = diags;
  document.getElementById('p-ncalc').textContent  = calcs;
  document.getElementById('pi-dist').textContent  = user.district || '-';
  document.getElementById('pi-crop').textContent  = user.crop     || '-';
  document.getElementById('pi-land').textContent  = user.land     || '-';
  document.getElementById('pi-phone').textContent = user.phone    || '-';

  document.getElementById('activity-log').innerHTML = actLog.length
    ? actLog.map(a => '<p style="border-bottom:1px solid #eee;padding:6px 0;margin:0;font-size:0.85rem;">' + a + '</p>').join('')
    : '<p style="color:#aaa;">No activity yet. Start using the tools!</p>';
}

function addLog(title, detail) {
  actLog.unshift(title + ' - ' + detail);
  if (actLog.length > 20) actLog.pop();
}

document.addEventListener('DOMContentLoaded', renderEq);