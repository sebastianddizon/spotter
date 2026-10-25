/* ============================================================
   APP CORE: storage, state, helpers, icons, Claude calls
   ============================================================ */
const E = window.Engine;
const APP_NAME = 'Spotter';   // working name: change here when the new name is picked
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const today = () => E.isoDate(Date.now());
const fmt = (n, d = 0) => (n == null || isNaN(n)) ? '–' : Number(n).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
const r5 = (n) => Math.round(n / 5) * 5;
function prettyDate(iso, opts = { weekday: 'long', month: 'short', day: 'numeric' }) { return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, opts); }

/* ---------- icons (inline, stroke) ---------- */
const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  today: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  train: I('<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>'),
  food: I('<path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8a2 2 0 0 1-2 2M9 3v6M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9"/>'),
  progress: I('<path d="M3 20h18M5 16l4-5 4 3 6-8"/><circle cx="19" cy="6" r="1.4"/>'),
  coach: I('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  camera: I('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  label: I('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 10.5h8M8 14h5M8 17.5h3"/>'),
  barcode: I('<path d="M4 6v12M7 6v12M10 6v12M14 6v12M16 6v12M20 6v12M3 4h3M18 4h3M3 20h3M18 20h3"/>'),
  pen: I('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  check: I('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  swap: I('<path d="M7 7h12l-3-3M17 17H5l3 3"/>'),
  chev: I('<path d="M6 9l6 6 6-6"/>'),
  left: I('<path d="M15 6l-6 6 6 6"/>'),
  right: I('<path d="M9 6l6 6-6 6"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  spark: I('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  home: I('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>'),
  gym: I('<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>'),
  bed: I('<path d="M3 18v-8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>'),
  walk: I('<circle cx="13" cy="4" r="2"/><path d="M10 21l2-7 3 3v5M9 11l3-4 3 3 3 1M9 11l-2 4"/>'),
  bolt: I('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  scale: I('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8.5 9a5 5 0 0 1 7 0L13 12"/>'),
  logo: `<img src="data:image/png;base64,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" alt="" width="26" height="26" style="border-radius:7px;display:block">`
};

/* ============================================================
   STORE: Claude db (synced across iPhone/iPad) or local fallback
   ============================================================ */
const Store = {
  mode: 'local', db: null, uid: null, ready: false,
  queue: Promise.resolve(),
  async init() {
    if (Api.enabled) { this.mode = 'api'; this.ready = true; return; }
    try {
      const [db, user] = await Promise.all([window.claude?.use?.('db'), window.claude?.use?.('user')]);
      if (db && user) {
        const id = await user.id();
        if (id) { this.db = db; this.uid = id; this.mode = 'db'; }
      }
    } catch (e) { console.warn('db unavailable', e); }
    this.ready = true;
  },
  base() { return 'data/users/' + this.uid; },
  local(key, val) {
    try {
      if (val === undefined) { const v = localStorage.getItem('fc:' + key); return v ? JSON.parse(v) : null; }
      localStorage.setItem('fc:' + key, JSON.stringify(val));
    } catch (e) { return null; }
  },
  async loadAll() {
    if (this.mode === 'db') {
      const prof = await this.db.doc(this.base() + '/profile').get();
      const lib = await this.db.doc(this.base() + '/lib').get();
      const days = await this.db.doc(this.base() + '/profile').collection('days').orderBy('date', 'desc').limit(200).get();
      const map = {};
      days.docs.forEach(d => { const v = d.data(); if (v) map[v.date] = structuredClone(v); });
      return { profile: prof.exists ? structuredClone(prof.data()) : null, lib: lib.exists ? structuredClone(lib.data()) : null, days: map };
    }
    if (this.mode === 'api') {
      if (!Api.token) { S.needJoin = true; return { profile: null, lib: null, days: {} }; }
      try {
        const r = await Api.call('loadAll');
        const days = {}; (r.days || []).forEach(d => { if (d && d.date) days[d.date] = d; });
        // keep this device's copy in step so it opens instantly and offline next time
        this.local('profile', r.profile); this.local('lib', r.lib); this.local('days', days);
        return { profile: r.profile, lib: r.lib, days };
      } catch (e) {
        if (e.code === 'bad_token') { Api.token = ''; S.needJoin = true; return { profile: null, lib: null, days: {} }; }
        S.ui.offline = true;
      }
    }
    return { profile: this.local('profile'), lib: this.local('lib'), days: this.local('days') || {} };
  },
  write(fn) { this.queue = this.queue.then(fn).catch(e => { console.error(e); toast(e?.code === 'quota_exceeded' ? 'Storage is full. Export your data, then clear old days.' : 'Could not save. Check your connection and try again.'); }); return this.queue; },
  saveProfile(p) {
    if (this.mode === 'db') return this.write(() => this.db.doc(this.base() + '/profile').set(JSON.parse(JSON.stringify(p))));
    this.local('profile', p); if (this.mode === 'api') Api.queueSave('profile', p); return Promise.resolve();
  },
  saveLib(l) {
    if (this.mode === 'db') return this.write(() => this.db.doc(this.base() + '/lib').set(JSON.parse(JSON.stringify(l))));
    this.local('lib', l); if (this.mode === 'api') Api.queueSave('lib', l); return Promise.resolve();
  },
  saveDay(d) {
    if (this.mode === 'db') return this.write(() => this.db.doc(this.base() + '/profile').collection('days').doc(d.date).set(JSON.parse(JSON.stringify(d))));
    const all = this.local('days') || {}; all[d.date] = d; this.local('days', all); if (this.mode === 'api') Api.queueSave('day:' + d.date, d); return Promise.resolve();
  },
  async wipe() {
    if (this.mode === 'db') {
      const days = await this.db.doc(this.base() + '/profile').collection('days').get();
      for (const d of days.docs) await this.db.doc(this.base() + '/profile').collection('days').doc(d.id).delete();
      await this.db.doc(this.base() + '/lib').delete();
      await this.db.doc(this.base() + '/profile').delete();
    } else {
      if (this.mode === 'api') { try { await Api.call('wipe'); } catch (e) {} }
      try { ['profile', 'lib', 'days', 'pending'].forEach(k => localStorage.removeItem('fc:' + k)); } catch (e) {}
    }
  }
};

/* ============================================================
   STATE
   ============================================================ */
const S = {
  profile: null, lib: { barcodes: {}, recent: [], favorites: [] }, days: {},
  view: 'today', foodDate: today(), ob: null, sheet: null, chat: [], brief: null,
  rest: null, sample: null, sampleImages: false, downloads: null, ui: {}
};

/* one-time rename of older saved settings */
function migrateProfile(p) {
  if (!p) return p;
  if (p.style === 'og' + 'us') p.style = 'strength';
  if (p['og' + 'us'] && !p.strength) { p.strength = p['og' + 'us']; delete p['og' + 'us']; }
  const pm = { ['ps' + 'mf']: 'rapid', ['u' + 'd2']: 'carbcycle', ['ana' + 'bolic']: 'weekendcarb' };
  if (pm[p.protocol]) p.protocol = pm[p.protocol];
  if (p.dietStyle === 'ana' + 'bolic') p.dietStyle = 'weekendcarb';
  if (p.program && p.program['og' + 'us'] != null) { p.program.strength = p.program['og' + 'us']; delete p.program['og' + 'us']; }
  return p;
}
function syncMyEx() {
  (S.lib?.myex || []).forEach(x => { if (E.EXBYID[x.id]) return; const e = { id: x.id, loc: 'mine', name: x.name, m: x.m, type: 'compound', tier: 2, rr: [8, 12], inc: x.bw ? 1 : 5, bw: !!x.bw, cue: '' }; E.EX.push(e); E.EXBYID[x.id] = e; });
}
function day(date) {
  if (!S.days[date]) S.days[date] = { date, food: [], workouts: [], checkin: null, weight: null };
  const d = S.days[date]; d.food = d.food || []; d.workouts = d.workouts || [];
  return d;
}
function saveDay(date) { return Store.saveDay(day(date)); }
function saveProfile() { return Store.saveProfile(S.profile); }
function saveLib() { return Store.saveLib(S.lib); }

/* ---------- derived ---------- */
function targets() {
  const p = S.profile; if (!p) return null;
  return E.calcTargets(p, { tdeeOverride: p.nutrition?.tdeeOverride });
}
function program() {
  const p = S.profile; if (!p) return null;
  if (!p.program) { p.program = E.buildProgram(p); }
  return p.program;
}
function allWorkouts() {
  const out = [];
  Object.values(S.days).forEach(d => (d.workouts || []).forEach(w => out.push({ ...w, date: d.date })));
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}
function setsHistory() {
  const h = {};
  allWorkouts().filter(w => w.done).forEach(w => (w.items || []).forEach(it => (it.sets || []).filter(s => s.done && s.load != null && s.reps).forEach(s => {
    (h[it.exId] = h[it.exId] || []).push({ date: w.date, load: +s.load, reps: +s.reps, rir: s.rir == null ? 2 : +s.rir });
  })));
  return h;
}
function checkinsMap() { const m = {}; Object.values(S.days).forEach(d => { if (d.checkin) m[d.date] = { ...d.checkin, date: d.date }; }); return m; }
function weights() { return Object.values(S.days).filter(d => d.weight > 0).map(d => ({ date: d.date, lb: +d.weight })).sort((a, b) => a.date < b.date ? -1 : 1); }
function intakeByDate() { const m = {}; Object.values(S.days).forEach(d => { const t = E.dayTotals(d.food || []); if (t.kcal > 0) m[d.date] = t.kcal; }); return m; }
function nstate() { return S.profile.nutrition || (S.profile.nutrition = {}); }
function weeksInDeficit() {
  const n = nstate(); if (!n.deficitStart) return 0;
  return Math.floor(E.daysBetween(n.deficitStart, today()) / 7);
}

function plannedTrainingOn(date) {
  const d = day(date);
  if ((d.workouts || []).some(w => w.done)) return true;
  if (d.plan?.loc === 'off') return false;
  if (date === today()) return d.plan?.loc ? d.plan.loc !== 'off' : true;
  return false;
}
function targetFor(date) {
  const T = targets(); if (!T) return null;
  return E.dayTargets(S.profile, T, date, plannedTrainingOn(date), { dietBreakUntil: nstate().dietBreakUntil, refeedDow: nstate().refeedDow });
}

function todaysPlan(opts = {}) {
  const p = S.profile, prog = program(), t = today(), d = day(t);
  const plan = d.plan || {};
  return E.dailyPlan({
    profile: p, program: prog, workouts: allWorkouts(), checkin: d.checkin, checkins: checkinsMap(), today: t,
    location: plan.loc || (p.locations || ['gym'])[0], minutes: plan.min || p.sessionMin || 45, setsHistory: setsHistory(),
    choice: plan.choice, dayIndex: plan.dayIndex, wear: d.wear || null
  });
}

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2600);
}

/* ============================================================
   CLAUDE (sample capability): photo macros, label read, coach chat
   ============================================================ */
async function initSample() {
  if (Store.mode === 'api') { S.sample = Api.makeSample(); S.sampleImages = true; S.downloads = Api.downloads; return render(); }
  try {
    const s = await window.claude?.use?.('sample');
    if (s) { S.sample = s; try { const lim = await s.limits(); S.sampleImages = !!lim?.images; S.sampleLimits = lim; } catch (e) {} }
    S.downloads = await window.claude?.use?.('downloads');
  } catch (e) {}
  render();
}

async function shrinkImage(file, max = 1400) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', 0.85));
  } catch (e) { return file; }
}

function aiError(e) {
  const c = e?.code;
  if (c === 'not_granted') return 'Claude access was declined for this page. Allow it from the artifact menu to use photo logging and the coach.';
  if (c === 'rate_limited') return 'Too many requests right now. Wait a minute and try again.';
  if (c === 'invalid_json') return 'The estimate came back unreadable. Try again, or add a short description.';
  if (c === 'images_unavailable') return 'This view cannot send photos. Use Describe instead.';
  return 'Claude could not answer just now. Try again in a moment.';
}

const FOOD_JSON = `Return only JSON: {"items":[{"name":string,"grams":number,"kcal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"confidence":"high"|"medium"|"low"}],"assumptions":string,"question":string}. "question" is the single question that would most improve accuracy, or "".`;

async function aiFoodEstimate({ image, text }) {
  const prompt = `You estimate nutrition for a personal food log used to hit macro targets. Use standard USDA-style values for cooked weights.
Rules:
- List each distinct food or component separately (protein, starch, vegetables, sauce, cooking oil, drink).
- Estimate portions in grams from visual cues: a dinner plate is about 26 cm, a fork about 19 cm, a fist about 1 cup.
- Include likely hidden calories (oil, butter, dressing) as their own item when the dish is restaurant or pan-cooked.
- When the user's note gives brands, amounts, or ingredients, trust it over the photo.
- Round macros to whole grams and kcal to the nearest 5. Make kcal roughly match 4P + 4C + 9F.
${FOOD_JSON}

User note: ${text ? text : '(none)'}`;
  const opts = { modelTier: 'default' };
  if (image) opts.images = [image];
  return await S.sample.json(prompt, opts);
}

async function aiReadLabel(image, note) {
  const prompt = `Read this Nutrition Facts label (or package) exactly as printed. Do not estimate if the number is visible.
Return only JSON: {"name":string,"brand":string,"serving":string,"servingGrams":number|null,"servingsPerContainer":number|null,"perServing":{"kcal":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"sugar":number,"sodiumMg":number}}.
If a value is not visible use null. Product note from user: ${note || '(none)'}`;
  return await S.sample.json(prompt, { images: [image], modelTier: 'default' });
}

const KB_DIGEST = `Coaching rules this app follows:
Training: 10-20 hard sets per muscle per week is the productive range; start low and add 1-2 sets/week while recovery holds; indirect sets count half. Each muscle 2x/week. Most work 6-12 reps (compounds 6-10 at 1-3 RIR, isolation 10-20 at 0-1 RIR, failure only on isolation/machines). Rest 2-3 min compounds, 1-2 min isolation; antagonist supersets when short on time. Double progression; estimated max from load, reps and reps left; adjust the next set 2% per half point of effort off target. Stretch-biased exercises: overhead triceps, incline curls, RDL, seated curl, deep squats, flyes, pulldowns. Lengthened partials optional, sparingly. Deload every 4-8 weeks (shorter in a deficit): cut volume 40-60%, about 10% lighter. Readiness: short sleep or high stress -> hold loads, +1 RIR, fewer sets; very low -> light session or walk. Missed 1-2 weeks: return at 90% loads; 3+ weeks: 80%, ramp 2 weeks. Never make up missed sessions. Keep a program for a full block before changing it. Strength plan: base = 90% of estimated max, cycle PR week/7s(75%x5x7)/5s(80%x7x5)/3s(85%x10x3)/deload(60%x3x5), TM +5 upper/+10 lower per cycle; top set RPE 9 with back-off drops 10/7.5/5/5% at RPE 10/9.5/9/8.5.
Nutrition: fat loss 0.5-1.0% BW/week, slower when lean; protein 2.3-3.1 g/kg lean mass in a deficit (or ~1 g/lb target bodyweight), 1.6-2.2 g/kg otherwise; fat at least 0.3 g/lb and 15-20% of kcal; carbs fill the rest. 3-5 meals with 30-50 g protein. Weekly calorie changes come from measured maintenance (average intake minus trend-weight change x 3500), smoothed; ignore week 1 of a new phase. Judge the weekly average; do not punish a high day. Diet break 2 weeks at maintenance (carbs >= 100 g) every 6-14 weeks of dieting by leanness; refeeds for lean dieters. Creatine monohydrate 3-5 g/day; caffeine 3-6 mg/kg pre-training if it does not hurt sleep. Fasted cardio has no fat-loss advantage; steps first, then easy cardio. Optional special diets (user opt-in only): weekend carb-up, rapid fat loss with time caps, carb cycling. Train like an athlete: about 60/40 strength to conditioning with 2+ conditioning sessions a week placed after weights; pull at least as much as you push; face pulls or external rotation work every session for shoulder health; replace upright rows with high pulls (hands above elbows); grip in the palm, not the fingers, to spare the elbows; strong mind-muscle connection and controlled reps; dynamic warm-up before, static stretching away from training; a very sore muscle is not trained hard that day; fix overuse aches early by changing grip or exercise.
Never recommend drugs, stimulant stacks (ephedrine, yohimbine), dehydration or diuretics.`;

function coachContext() {
  const p = S.profile, T = targets(), t = today(), prog = program();
  const last7 = [];
  for (let i = 7; i >= 1; i--) {
    const dt = E.addDays(t, -i), d = S.days[dt]; if (!d) continue;
    const tot = E.dayTotals(d.food || []);
    const w = (d.workouts || []).filter(x => x.done).map(x => `${x.dayName} at ${x.location} (${(x.items || []).reduce((s, it) => s + (it.sets || []).filter(z => z.done).length, 0)} sets)`).join('; ');
    last7.push(`${dt}: ${tot.kcal ? Math.round(tot.kcal) + ' kcal, P' + Math.round(tot.protein) : 'no food log'}${d.weight ? ', weight ' + d.weight : ''}${d.checkin ? ', readiness ' + E.readiness(d.checkin).score : ''}${w ? ', trained ' + w : ''}`);
  }
  const plan = todaysPlan();
  const tt = targetFor(t);
  const tot = E.dayTotals(day(t).food);
  return `ATHLETE: ${p.name || 'User'}, ${p.sex}, ${p.age}y, ${Math.floor(p.heightIn / 12)}'${p.heightIn % 12}", ${p.weightLb} lb${p.bf ? ', ~' + p.bf + '% body fat' : ''}. Goal: ${p.goal}, pace ${p.pace}. Trains ${p.daysPerWeek}x/week, ${p.sessionMin} min, at ${(p.locations || []).join(' and ')} (P1 = Innodigym P1 Max digital cable platform, floor-anchored, dial in kg per cable, no bench, no high anchor). Leg emphasis: ${p.legEmphasis}. Priority: ${(p.priority || []).join(', ') || 'none'}. Notes: ${p.notes || 'none'}. Diet protocol: ${p.protocol || 'standard'}.
TARGETS TODAY: ${tt.kcal} kcal, P${tt.protein} C${tt.carbs} F${tt.fat} (${tt.label}). Eaten so far: ${Math.round(tot.kcal)} kcal, P${Math.round(tot.protein)} C${Math.round(tot.carbs)} F${Math.round(tot.fat)}. Maintenance estimate ${T.tdee}.
PROGRAM: ${prog.split}, block of ${prog.blockWeeks} weeks, week ${E.weekNumber(prog, t)}.
TODAY'S PLAN: ${plan.type === 'train' ? plan.dayName + ' at ' + plan.location + ': ' + plan.items.map(i => `${i.ex.name} ${i.sets}x${i.reps}${i.load ? ' @' + i.load + (' ' + E.unitText(i.ex.loc)) : ''}`).join('; ') : plan.type}. Adjustments: ${plan.adjustments.join(' ')}
LAST 7 DAYS: ${last7.join(' | ') || 'no data yet'}`;
}

const COACH_VOICE = `You are the user's personal strength and nutrition coach inside their app. Write plainly and directly, like a knowledgeable coach talking to a client; match depth to the user's training experience in their profile. Use plain everyday words a non-gym person understands; do not use jargon like RIR, RPE, deload, hypertrophy, TDEE, macros split or recomp unless the user uses it first, and if you must, explain it in the same sentence. Short paragraphs, no hype, no exclamation points, no emojis, no em dashes, no motivational slogans. Give one clear recommendation, then the reason in a sentence. Never name researchers, coaches, authors, books, studies or named programs as sources. If asked where the advice comes from, say it follows widely accepted training and nutrition guidelines. You may say food data comes from the USDA database. Use the user's numbers. Give P1 Max loads as kg on the dial per cable. If the user asks for something not supported or unsafe (drugs, stimulant stacks, extreme restriction), say so and give the safe alternative. Keep answers under 180 words unless asked for more.`;

async function aiCoach(messages, onText, signal) {
  const sys = `${COACH_VOICE}\n\n${KB_DIGEST}\n\n${coachContext()}`;
  const msgs = [{ role: 'user', content: sys + '\n\nAcknowledge with "Ready." only.' }, { role: 'assistant', content: 'Ready.' }, ...messages];
  return await S.sample(msgs, { onText, signal, cache: false, modelTier: 'default' });
}

async function aiBrief(onText) {
  const prompt = `${COACH_VOICE}\n\n${KB_DIGEST}\n\n${coachContext()}\n\nWrite today's coaching brief in 3 short parts with these plain labels: "Training", "Food", "One thing". Under 120 words total. Reference what happened yesterday if relevant.`;
  return await S.sample(prompt, { onText, cache: true, modelTier: 'quick' });
}

/* ---------- barcode (native detector, then ZXing from CDN) ---------- */
let zxingP = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (!zxingP) zxingP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'; s.onload = () => res(window.ZXing); s.onerror = rej; document.head.appendChild(s); });
  return zxingP;
}
/* Multi-pass decode: photos of screens and curved packages fail a single pass (moire, glare), so try several sizes and both binarizers. */
function zxReader(Z) {
  const hints = new Map(); hints.set(Z.DecodeHintType.TRY_HARDER, true);
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.CODE_128]);
  const r = new Z.MultiFormatReader(); r.setHints(hints); return r;
}
function zxCanvas(Z, reader, c) {
  for (const bin of ['h', 'g']) {
    try { const ls = new Z.HTMLCanvasElementLuminanceSource(c); return reader.decode(new Z.BinaryBitmap(bin === 'h' ? new Z.HybridBinarizer(ls) : new Z.GlobalHistogramBinarizer(ls))).getText(); } catch (e) {}
  }
  return null;
}
function drawScaled(src, sw, sh, W, rot) {
  const c = document.createElement('canvas'); const k = W / Math.max(sw, sh);
  const w = Math.round(sw * k), h = Math.round(sh * k);
  c.width = rot ? h : w; c.height = rot ? w : h; const x = c.getContext('2d');
  x.filter = 'grayscale(1) contrast(1.4) blur(0.6px)';
  if (rot) { x.translate(c.width / 2, c.height / 2); x.rotate(Math.PI / 2); x.drawImage(src, -w / 2, -h / 2, w, h); } else x.drawImage(src, 0, 0, w, h);
  return c;
}
async function decodeBarcode(file) {
  try {
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      const r = await det.detect(await createImageBitmap(file));
      if (r && r[0]) return r[0].rawValue;
    }
  } catch (e) {}
  try {
    const Z = await loadZXing(); const reader = zxReader(Z);
    const url = URL.createObjectURL(file); const img = new Image(); img.src = url; await img.decode();
    for (const W of [900, 640, 1200, 480, 1600]) for (const rot of [0, 90]) {
      const t = zxCanvas(Z, reader, drawScaled(img, img.naturalWidth, img.naturalHeight, W, rot));
      if (t) { URL.revokeObjectURL(url); return t; }
    }
    URL.revokeObjectURL(url);
  } catch (e) {}
  return null;
}
/* Live camera scan (home-screen app / browser; the Claude artifact frame has no camera). */
const LiveScan = {
  stream: null, timer: null,
  supported() { return !!navigator.mediaDevices?.getUserMedia && Store.mode !== 'db' && !window.claude; },
  async start(video, onCode, onErr) {
    try {
      const Z = await loadZXing(); const reader = zxReader(Z);
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = this.stream; video.setAttribute('playsinline', ''); await video.play();
      let det = null; try { if ('BarcodeDetector' in window) det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }); } catch (e) {}
      const tick = async () => {
        if (!this.stream) return;
        if (video.videoWidth) {
          let code = null;
          if (det) { try { const r = await det.detect(video); code = r?.[0]?.rawValue || null; } catch (e) {} }
          if (!code) {
            // crop the middle band where the barcode sits
            const vw = video.videoWidth, vh = video.videoHeight, c = document.createElement('canvas');
            const cw = Math.min(900, vw), ch = Math.round(cw * 0.5); c.width = cw; c.height = ch;
            const x = c.getContext('2d'); x.filter = 'grayscale(1) contrast(1.3)';
            const sw = vw * 0.9, sh = sw * 0.5; x.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cw, ch);
            code = zxCanvas(Z, reader, c);
          }
          if (code) { try { navigator.vibrate?.(60); } catch (e) {} this.stop(); return onCode(code); }
        }
        this.timer = setTimeout(tick, 180);
      };
      tick();
    } catch (e) { this.stop(); onErr(e?.name === 'NotAllowedError' ? 'Camera access was declined. Allow it in Settings > Safari > Camera, or photograph the barcode instead.' : 'The camera could not start. Photograph the barcode instead.'); }
  },
  stop() { clearTimeout(this.timer); if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; } }
};
