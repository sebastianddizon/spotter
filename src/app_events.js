/* ============================================================
   RENDER + EVENTS
   ============================================================ */
const TABS = [['today', 'Today'], ['train', 'Train'], ['food', 'Food'], ['progress', 'Progress'], ['coach', 'Coach']];

function render() {
  const root = $('#root');
  if (!Store.ready) { root.innerHTML = `<div class="empty" style="padding-top:30vh"><span class="spinner"></span></div>`; return; }
  const keepScroll = window.scrollY;
  const active = document.activeElement; const activeId = active?.id; const selStart = active?.selectionStart;
  let mainHtml;
  if (S.needJoin) mainHtml = viewJoin();
  else if (!S.profile || S.ob) { if (!S.ob) obStart(false); mainHtml = renderOnboarding(); }
  else mainHtml = { today: viewToday, train: viewTrain, food: viewFood, progress: viewProgress, coach: viewCoach }[S.view]();
  const showTabs = S.profile && !S.ob && !S.needJoin;
  root.innerHTML = `<div class="app">
    ${showTabs ? `<nav class="tabs" aria-label="Sections">${TABS.map(([k, l]) => `<button data-act="go" data-v="${k}" aria-current="${S.view === k ? 'page' : 'false'}">${ICON[k]}<span>${l}</span></button>`).join('')}</nav>` : ''}
    <div class="col" style="flex:1;min-width:0;display:flex;flex-direction:column">
      <header class="top"><div class="brand">${ICON.logo}${esc(APP_NAME)}</div><div class="spacer"></div>${Store.mode === 'local' && S.profile ? '<span class="pill" title="Saved in this browser only">Local</span>' : ''}${Store.mode === 'api' && S.ui.offline ? '<span class="pill warn" title="Changes are saved on this device and will sync when you are back online">Offline</span>' : ''}${showTabs ? `<button class="iconbtn" data-act="settings" aria-label="Settings">${ICON.gear}</button>` : ''}</header>
      <main>${mainHtml}</main>
    </div></div>
    ${S.sheet ? `<div class="scrim" data-act="sheet-close-bg"><div class="sheet" role="dialog" aria-modal="true">${renderSheet()}</div></div>` : ''}
    ${S.rest ? restPill() : ''}`;
  window.scrollTo(0, keepScroll);
  if (activeId) { const el = document.getElementById(activeId); if (el) { el.focus({ preventScroll: true }); try { if (selStart != null) el.setSelectionRange(selStart, selStart); } catch (e) {} } }
  const chat = $('#chat'); if (chat && S.ui.chatScroll) { chat.lastElementChild?.scrollIntoView({ block: 'end' }); S.ui.chatScroll = false; }
}
function renderSheet() {
  const s = S.sheet;
  if (s.type === 'checkin') return sheetCheckin();
  if (s.type === 'swap') return sheetSwap(s.i);
  if (s.type === 'addex') return sheetAddExercise();
  if (s.type === 'food') return s.food.kind === 'log' ? sheetLog() : sheetFood();
  if (s.type === 'recipes') return sheetRecipes();
  if (s.type === 'search') return sheetSearch();
  if (s.type === 'settings') return sheetSettings();
  if (s.type === 'editfood') return sheetEditFood();
  if (s.type === 'hotworx') return sheetHotworx();
  if (s.type === 'sport') return sheetSport();
  return '';
}
function openSheet(s) { S.sheet = s; render(); }
function startScan() { const v = $('#scan-video'); if (!v) return; LiveScan.start(v, code => { S.sheet.food.live = false; lookupBarcode(code); }, msg => { S.sheet.food.live = false; S.sheet.food.err = msg; render(); }); }
function closeSheet() { LiveScan.stop(); S.sheet = null; S.ui.ci = null; render(); }

/* ---------- rest timer ---------- */
let restInt;
function startRest(sec) {
  clearInterval(restInt);
  S.rest = { end: Date.now() + sec * 1000 };
  restInt = setInterval(() => { const el = $('#rest-n'); if (!S.rest) return clearInterval(restInt); const left = Math.max(0, Math.round((S.rest.end - Date.now()) / 1000)); if (el) el.textContent = mmss(left); if (left <= 0) { clearInterval(restInt); S.rest = null; try { navigator.vibrate?.(200); } catch (e) {} render(); } }, 500);
}
function mmss(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function restPill() { const left = Math.max(0, Math.round((S.rest.end - Date.now()) / 1000)); return `<div class="rest" role="timer" aria-live="off"><span>Rest</span><b id="rest-n">${mmss(left)}</b><button data-act="rest-add">+30 s</button><button data-act="rest-skip">Skip</button></div>`; }

/* ---------- session ---------- */
function startSession() {
  const t = today(), d = day(t);
  if ((d.workouts || []).some(w => !w.done)) { S.view = 'train'; return render(); }
  const plan = todaysPlan();
  const loc = plan.location || (S.profile.locations || ['gym'])[0];
  const pl = plan.type === 'train' ? plan : E.dailyPlan({ profile: S.profile, program: program(), workouts: allWorkouts(), checkin: d.checkin, checkins: checkinsMap(), today: t, location: loc === 'off' ? (S.profile.locations || ['gym'])[0] : loc, minutes: d.plan?.min || S.profile.sessionMin, setsHistory: setsHistory() });
  const w = {
    id: uid(), dayIndex: pl.dayIndex, dayName: pl.dayName, location: pl.location, startedAt: Date.now(), done: false, notes: pl.adjustments.slice(0, 4),
    items: pl.items.map(it => ({
      exId: it.ex.id, name: it.ex.name, muscle: it.muscle, loc: it.ex.loc, slotKey: it.slotKey, pair: it.pair || null, main: !!it.main, strength: it.strength || null,
      reps: it.reps, repTarget: it.repTarget, rir: it.rir, target: it.load, basis: it.basis, cue: it.ex.cue, rest: it.rest,
      sets: Array.from({ length: it.sets }, () => ({ load: it.load ?? null, reps: null, rir: null, done: false }))
    }))
  };
  d.workouts.push(w); saveDay(t); S.view = 'train'; render();
}
function activeWorkout() { return day(today()).workouts.find(w => !w.done); }

function setDone(i, j) {
  const w = activeWorkout(); const it = w.items[i]; const s = it.sets[j];
  readSetInputs(i, j);
  if (s.done) { s.done = false; s.hint = null; saveDay(today()); return render(); }
  if (s.reps == null || s.reps === '') s.reps = typeof it.repTarget === 'number' ? it.repTarget : parseInt(it.reps) || 8;
  if (s.load == null || s.load === '') s.load = it.target ?? null;
  if (s.rir == null) s.rir = it.rir;
  s.done = true;
  const ex = E.EXBYID[it.exId] || { loc: it.loc, inc: E.placeOf(it.loc).inc };
  const next = it.sets[j + 1];
  if (it.strength && it.strength.type === 'pr' && j === 0) {
    const rpe = 10 - (+s.rir);
    const bo = E.strBackoff(+s.load, +s.reps, rpe);
    s.hint = bo.note;
    if (bo.load) { while (it.sets.length < 4) it.sets.push({ load: bo.load, reps: null, rir: null, done: false }); it.sets.slice(1).forEach(x => { if (!x.done) x.load = bo.load; }); it.repTarget = bo.reps; }
    const og = S.profile.strength = S.profile.strength || {}; og.lastTop = og.lastTop || {}; og.lastTop[w.items[i].strength.lift] = { load: +s.load, reps: +s.reps, rpe }; saveProfile();
  } else if (next && !next.done && s.load != null && !it.strength) {
    const adj = E.nextSetLoad(ex, +s.load, it.rir, +s.rir, +s.reps, typeof it.repTarget === 'number' ? it.repTarget : parseInt(it.reps));
    if (adj) { next.load = adj.load; s.hint = adj.load !== +s.load ? adj.note : null; }
  }
  saveDay(today());
  const pairNext = it.pair ? w.items.find((x, k) => k !== i && x.pair === it.pair) : null;
  startRest(pairNext ? 60 : (it.rest || 120));
  render();
}
function readSetInputs(i, j) {
  const w = activeWorkout(); const s = w.items[i].sets[j];
  const l = $(`#s-${i}-${j}-l`), r = $(`#s-${i}-${j}-r`), x = $(`#s-${i}-${j}-x`);
  if (l && l.value !== '') s.load = +l.value; if (r && r.value !== '') s.reps = +r.value; if (x) s.rir = +x.value;
}
function finishSession() {
  const w = activeWorkout(); if (!w) return;
  w.items.forEach((it, i) => it.sets.forEach((s, j) => { if (!s.done) readSetInputs(i, j); }));
  w.done = true; w.finishedAt = Date.now();
  const sets = w.items.reduce((s, it) => s + it.sets.filter(x => x.done).length, 0);
  saveDay(today()); S.rest = null; clearInterval(restInt);
  toast(`Logged ${sets} sets. Next session is set from this one.`);
  S.view = 'today'; render();
}

/* ---------- food ---------- */
function openFood(kind, extra = {}) { S.sheet = { type: 'food', food: { kind, stage: 'capture', meal: S.foodDate === today() ? defaultMeal() : 'Snacks', mult: 1, ...extra } }; render(); }
function pushRecent(entry) {
  const r = (S.lib.recent || []).filter(x => x.name !== entry.name);
  r.unshift({ name: entry.name, kcal: entry.kcal, protein: entry.protein, carbs: entry.carbs, fat: entry.fat, fiber: entry.fiber || 0 });
  S.lib.recent = r.slice(0, 20); saveLib();
}
function addFood(entry) {
  const d = day(S.foodDate);
  const e = { id: uid(), ts: Date.now(), meal: entry.meal || defaultMeal(), name: entry.name || 'Food', kcal: Math.round(+entry.kcal || 0), protein: Math.round(+entry.protein || 0), carbs: Math.round(+entry.carbs || 0), fat: Math.round(+entry.fat || 0), fiber: Math.round(+entry.fiber || 0), source: entry.source || 'manual', qty: entry.qty || 1, note: entry.note || '' };
  if (entry.suppId) e.suppId = entry.suppId;
  d.food.push(e); saveDay(S.foodDate); if (!entry.noRecent) pushRecent(e);
}
async function handleFile(kind, file) {
  const f = S.sheet.food; f.err = null;
  if (kind === 'barcode') {
    f.busy = true; render();
    const code = await decodeBarcode(file);
    f.busy = false;
    if (!code) { f.err = 'Could not read a barcode in that photo. Get closer, fill the frame, or type the number.'; return render(); }
    return lookupBarcode(code);
  }
  f.image = await shrinkImage(file);
  if (f.preview) URL.revokeObjectURL(f.preview);
  f.preview = URL.createObjectURL(f.image);
  render();
}
async function lookupBarcode(code) {
  code = String(code).replace(/\D/g, '').replace(/^0+/, '');
  const known = S.lib.barcodes?.[code];
  if (known) { S.sheet.food = { ...S.sheet.food, kind: 'barcode', stage: 'review', items: [{ ...known.perServing, name: known.name }], serving: known.serving, mult: 1, base: known.perServing, code, busy: false }; return render(); }
  S.sheet.food.busy = true; render();
  const row = await FoodDB.byUpc(code);
  if (row) { pickToLog(row); return; }
  S.sheet.food.busy = false;
  S.sheet.food = { ...S.sheet.food, kind: 'label', stage: 'capture', barcode: code, image: null, preview: null, err: null };
  toast('New product. Photograph its label once.');
  render();
}
async function runEstimate() {
  const f = S.sheet.food; f.busy = true; f.err = null; render();
  try {
    const res = await aiFoodEstimate({ image: f.kind === 'photo' ? f.image : null, text: f.note });
    const items = (res.items || []).map(x => ({ name: x.name, grams: x.grams, kcal: +x.kcal || 0, protein: +x.protein || 0, carbs: +x.carbs || 0, fat: +x.fat || 0, fiber: +x.fiber || 0 }));
    if (!items.length) throw { code: 'invalid_json' };
    const confs = (res.items || []).map(x => x.confidence);
    Object.assign(f, { stage: 'review', items, assumptions: res.assumptions, question: res.question, conf: confs.includes('low') ? 'low' : confs.every(c => c === 'high') ? 'high' : 'medium', busy: false });
  } catch (e) { f.busy = false; f.err = aiError(e); }
  render();
}
async function runLabel() {
  const f = S.sheet.food; f.busy = true; f.err = null; render();
  try {
    const r = await aiReadLabel(f.image, f.note);
    const ps = r.perServing || {};
    const per = { kcal: +ps.kcal || 0, protein: +ps.protein || 0, carbs: +ps.carbs || 0, fat: +ps.fat || 0, fiber: +ps.fiber || 0 };
    const name = [r.brand, r.name].filter(Boolean).join(' ') || f.note || 'Packaged food';
    if (f.barcode) { S.lib.barcodes = S.lib.barcodes || {}; S.lib.barcodes[f.barcode] = { name, serving: r.serving, perServing: per }; saveLib(); }
    Object.assign(f, { stage: 'review', items: [{ ...per, name }], serving: r.serving, base: per, mult: 1, busy: false, kind: 'label' });
  } catch (e) { f.busy = false; f.err = aiError(e); }
  render();
}
function saveReview() {
  const f = S.sheet.food;
  readReviewInputs();
  const m = +f.mult || 1;
  if (f.kind === 'label' || f.kind === 'barcode') {
    const x = f.items[0];
    addFood({ name: x.name, kcal: x.kcal * m, protein: x.protein * m, carbs: x.carbs * m, fat: x.fat * m, fiber: (x.fiber || 0) * m, meal: f.meal, source: 'label', qty: m });
  } else {
    if (f.items.length > 1) addFood({ name: f.items.map(x => x.name).join(', '), kcal: E.sum(f.items.map(x => x.kcal)) * m, protein: E.sum(f.items.map(x => x.protein)) * m, carbs: E.sum(f.items.map(x => x.carbs)) * m, fat: E.sum(f.items.map(x => x.fat)) * m, fiber: E.sum(f.items.map(x => x.fiber || 0)) * m, meal: f.meal, source: f.kind, note: f.note });
    else { const x = f.items[0]; addFood({ ...x, kcal: x.kcal * m, protein: x.protein * m, carbs: x.carbs * m, fat: x.fat * m, meal: f.meal, source: f.kind, note: f.note }); }
  }
  if (f.preview) URL.revokeObjectURL(f.preview);
  S.sheet = null; toast('Added'); render();
}
function readReviewInputs() {
  const f = S.sheet?.food; if (!f?.items) return;
  document.querySelectorAll('[data-fr]').forEach(el => { const k = +el.dataset.k, fld = el.dataset.fr; if (!f.items[k]) return; f.items[k][fld] = fld === 'name' ? el.value : +el.value || 0; });
  const mm = $('#fs-mult'); if (mm) f.mult = Math.max(0.25, +mm.value || 1);
}

/* ---------- weekly review ---------- */
function runReview() {
  const p = S.profile, T = targets(), n = nstate();
  const rv = E.weeklyReview(p, T, intakeByDate(), weights(), today(), { phaseStart: n.phaseStart, weeksInDeficit: weeksInDeficit() });
  let newKcal = T.base.kcal;
  if (rv.newTDEE) newKcal = E.calcTargets(p, { tdeeOverride: rv.newTDEE }).base.kcal;
  else if (rv.change) newKcal = T.base.kcal + rv.change;
  newKcal = Math.round(E.clamp(newKcal, T.base.kcal - 250, T.base.kcal + 250) / 10) * 10;   // smooth: max 250 kcal per week
  if (Math.abs(newKcal - T.base.kcal) === 250) rv.notes.push('Change capped at 250 kcal this week so one noisy stretch cannot swing the plan.');
  rv.newKcal = newKcal; S.ui.review = rv; render();
}
function applyReview() {
  const rv = S.ui.review, p = S.profile, T = targets(), n = nstate();
  const delta = rv.newKcal - T.base.kcal;
  n.tdeeOverride = (n.tdeeOverride || T.tdee) + delta;
  if (rv.dietBreak) { n.dietBreakUntil = E.addDays(today(), 13); n.deficitStart = E.addDays(today(), 14); }
  n.lastReview = today();
  n.history = (n.history || []).concat({ date: today(), from: T.base.kcal, to: rv.newKcal, notes: rv.notes }).slice(-30);
  if (rv.newTDEE || rv.change) { /* keep */ }
  S.ui.review = null; saveProfile(); toast(rv.dietBreak ? 'Diet break starts today' : `Target now ${fmt(rv.newKcal)} kcal`); render();
}

/* ---------- export ---------- */
async function exportData() {
  try { await S.downloads.save({ filename: `spotter-${today()}.json`, data: JSON.stringify({ profile: S.profile, lib: S.lib, days: S.days }, null, 2) }); }
  catch (e) { if (e?.code !== 'declined' && e?.code !== 'cancelled') toast('Export did not complete.'); }
}

/* ---------- theme ---------- */
const SKINS = [
  { k: 'auto', name: 'Auto', note: 'Light by day, dark at night' },
  { k: 'studio', name: 'Studio', note: 'Clean and premium' }, { k: 'iron', name: 'Iron', note: 'Hardcore gym' },
  { k: 'blush', name: 'Blush', note: 'Soft and pretty' }, { k: 'gilt', name: 'Gilt', note: 'Black and gold' }
];
const SKIN_OLD = { chalk: 'studio', steel: 'studio', logbook: 'studio', rubber: 'iron', turf: 'iron' };
const mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function resolvedSkin(t) {
  if (t && t !== 'auto') return t;
  const host = document.documentElement.getAttribute('data-theme');
  const dark = host ? host === 'dark' : !!mqDark?.matches;
  return dark ? 'studio-dark' : 'studio';
}
function applyTheme(t) {
  S.ui.theme = t || 'auto'; try { localStorage.setItem('fc:skin', S.ui.theme); } catch (e) {}
  document.documentElement.setAttribute('data-skin', resolvedSkin(S.ui.theme));
}
mqDark?.addEventListener?.('change', () => applyTheme(S.ui.theme));
new MutationObserver(() => { const want = resolvedSkin(S.ui.theme); if (document.documentElement.getAttribute('data-skin') !== want) document.documentElement.setAttribute('data-skin', want); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- chat ---------- */
async function sendChat(text) {
  if (!text.trim() || S.ui.chatBusy) return;
  S.chat.push({ role: 'user', content: text.trim() });
  const msg = { role: 'assistant', content: '', loading: true }; S.chat.push(msg);
  S.ui.chatBusy = true; S.ui.chatScroll = true; render();
  try {
    const hist = S.chat.filter(m => !m.loading).slice(-10).map(m => ({ role: m.role, content: m.content }));
    await aiCoach(hist, ({ text }) => { msg.content = text; const el = $('#chat'); if (el?.lastElementChild) el.lastElementChild.textContent = text; });
  } catch (e) { msg.content = aiError(e); }
  msg.loading = false; S.ui.chatBusy = false; S.ui.chatScroll = true; render();
}

/* ============================================================
   EVENT DELEGATION
   ============================================================ */
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === 'sheet-close-bg') { if (ev.target === el) closeSheet(); return; }
  ev.preventDefault?.();
  const a = S.ob?.a;
  switch (act) {
    case 'go': S.view = v; S.sheet = null; window.scrollTo(0, 0); render(); break;
    case 'settings': openSheet({ type: 'settings' }); break;
    // onboarding
    case 'ob-set': captureOb(); a[el.dataset.f] = isNaN(+v) || v === '' ? v : (['sex', 'goal', 'pace', 'style', 'legEmphasis', 'job', 'proteinHabit', 'dietStyle'].includes(el.dataset.f) ? v : +v); render(); break;
    case 'ob-toggle': { captureOb(); const f = el.dataset.f, arr = a[f]; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else if (arr.length < +el.dataset.max) arr.push(v); else { arr.shift(); arr.push(v); } render(); break; }
    case 'ob-flag': captureOb(); a[el.dataset.f] = !a[el.dataset.f]; render(); break;
    case 'ob-next': captureOb(); if (!obValid(S.ob.step, a)) return; if (S.ob.step < OB_STEPS.length - 1) { S.ob.step++; window.scrollTo(0, 0); render(); } else obFinish(); break;
    case 'ob-back': captureOb(); S.ob.step--; render(); break;
    case 'ob-sportn': captureOb(); a.sportN = a.sportN || {}; a.sportN[el.dataset.k] = +v; render(); break;
    case 'ob-equip': captureOb(); a.homeEquip = a.homeEquip || []; if (!a.homeEquip.includes(v)) a.homeEquip.push(v); render(); break;
    case 'sup-add': { captureOb(); const pr = SUPP_PRESETS.find(x => x.name === v); a.supps = a.supps || []; a.supps.push({ id: uid(), ...(pr || { name: '', serving: '', kcal: 0, protein: 0, carbs: 0, fat: 0 }) }); render(); break; }
    case 'sup-del': captureOb(); a.supps.splice(+v, 1); render(); break;
    case 'sup-take': {
      const sp = (S.profile.supps || []).find(x => x.id === v); if (!sp) break;
      const d = day(S.foodDate); d.supps = d.supps || [];
      const on = d.supps.includes(v);
      if (on) { d.supps = d.supps.filter(x => x !== v); d.food = d.food.filter(f => f.suppId !== v); }
      else { d.supps.push(v); if (sp.kcal || sp.protein || sp.carbs || sp.fat) { addFood({ name: sp.name + (sp.serving ? ` (${sp.serving})` : ''), kcal: sp.kcal, protein: sp.protein, carbs: sp.carbs, fat: sp.fat, source: 'supplement', suppId: v, noRecent: true }); } }
      saveDay(S.foodDate); render(); break;
    }
    case 'ob-cancel': S.ob = null; render(); break;
    case 'ob-edit': S.sheet = null; obStart(true); render(); break;
    // check-in
    case 'checkin-open': S.ui.ci = null; openSheet({ type: 'checkin' }); break;
    case 'ci-set': captureCi(); S.ui.ci[el.dataset.f] = +v; render(); break;
    case 'ci-step': captureCi(); S.ui.ci[el.dataset.f] = Math.max(0, Math.min(14, (+S.ui.ci[el.dataset.f] || 0) + +v)); render(); break;
    case 'ci-sore': { captureCi(); const arr = S.ui.ci.soreAreas = S.ui.ci.soreAreas || []; const i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); render(); break; }
    case 'ci-save': { captureCi(); const c = S.ui.ci, d = day(today()); d.checkin = { sleepHrs: +c.sleepHrs, sleepQ: +c.sleepQ, energy: +c.energy, stress: +c.stress, soreness: +c.soreness, soreAreas: c.soreAreas || [], steps: c.steps ? +c.steps : null }; if (c.weight) d.weight = +c.weight; saveDay(today()); S.brief = null; closeSheet(); toast('Check-in saved'); break; }
    // plan
    case 'plan-loc': { const d = day(today()); d.plan = { ...(d.plan || {}), loc: v }; saveDay(today()); S.brief = null; render(); break; }
    case 'plan-min': { const d = day(today()); d.plan = { ...(d.plan || {}), min: +v }; saveDay(today()); render(); break; }
    case 'plan-choice': { const d = day(today()); d.plan = { ...(d.plan || {}), choice: v || null }; saveDay(today()); render(); break; }
    case 'start-session': startSession(); break;
    case 'hx-open': openSheet({ type: 'hotworx' }); break;
    case 'sp-open': S.ui.sp = {}; openSheet({ type: 'sport' }); break;
    case 'sp-set': { const f = S.ui.sp; f[el.dataset.f] = el.dataset.f === 'k' || el.dataset.f === 'level' ? v : +v; if (el.dataset.f === 'k') f.min = E.SPORTBYK[v].min; render(); break; }
    case 'sp-log': { const f = S.ui.sp, sp = E.SPORTBYK[f.k]; const d = day(today()); d.workouts.push({ id: uid(), kind: 'sport', sport: f.k, level: f.level, dayName: sp.name, location: 'sport', minutes: f.min, done: true, startedAt: Date.now(), finishedAt: Date.now(), items: [] }); saveDay(today()); toast(`${sp.name} logged`); closeSheet(); break; }
    case 'hx-log': { const x = E.HOTWORX.find(h => h.k === v); const d = day(today()); d.workouts.push({ id: uid(), hx: x.kind, kind: x.kind === 'hiit' ? 'conditioning' : 'hotworx', dayName: x.name, location: 'hotworx', minutes: x.min, done: true, startedAt: Date.now(), finishedAt: Date.now(), items: [] }); saveDay(today()); toast(`${x.name} logged`); closeSheet(); break; }
    case 'oura-connect': Oura.connect(); break;
    case 'oura-sync': Oura.sync(true); break;
    case 'oura-off': Oura.disconnect(); break;
    case 'food-edit': { const f = day(S.foodDate).food.find(x => x.id === v); if (!f) break; const q = +f.qty || 1; S.ui.efArm = false; openSheet({ type: 'editfood', edit: { id: f.id, origDate: S.foodDate, date: S.foodDate, name: f.name, meal: f.meal || 'Snacks', qty: q, baseQty: q, base: { kcal: +f.kcal || 0, protein: +f.protein || 0, carbs: +f.carbs || 0, fat: +f.fat || 0, fiber: +f.fiber || 0 } } }); break; }
    case 'ef-meal': readEf(); S.sheet.edit.meal = v; render(); break;
    case 'ef-date': readEf(); S.sheet.edit.date = v; render(); break;
    case 'ef-qty': { readEf(); const e = S.sheet.edit; e.qty = Math.max(0.25, +(e.qty + +v).toFixed(2)); render(); break; }
    case 'ef-save': { readEf(); const e = S.sheet.edit, r = e.qty / (e.baseQty || 1);
      const src = day(e.origDate); const old = src.food.find(x => x.id === e.id) || {};
      src.food = src.food.filter(x => x.id !== e.id);
      const upd = { ...old, name: e.name || old.name, meal: e.meal, qty: e.qty, kcal: Math.round(e.base.kcal * r), protein: Math.round(e.base.protein * r), carbs: Math.round(e.base.carbs * r), fat: Math.round(e.base.fat * r), fiber: Math.round((e.base.fiber || 0) * r) };
      day(e.date).food.push(upd); saveDay(e.origDate); if (e.date !== e.origDate) saveDay(e.date);
      S.sheet = null; toast(e.date !== e.origDate ? 'Moved' : 'Saved'); render(); break; }
    case 'ef-dup': { readEf(); const e = S.sheet.edit, r = e.qty / (e.baseQty || 1); const t = today();
      day(t).food.push({ id: uid(), ts: Date.now(), name: e.name, meal: t === S.foodDate ? e.meal : defaultMeal(), qty: e.qty, kcal: Math.round(e.base.kcal * r), protein: Math.round(e.base.protein * r), carbs: Math.round(e.base.carbs * r), fat: Math.round(e.base.fat * r), fiber: Math.round((e.base.fiber || 0) * r), source: 'manual' });
      saveDay(t); S.sheet = null; toast('Logged again today'); render(); break; }
    case 'ef-del': if (!S.ui.efArm) { S.ui.efArm = true; render(); setTimeout(() => { S.ui.efArm = false; if (S.sheet?.type === 'editfood') render(); }, 6000); } else { const e = S.sheet.edit; const d = day(e.origDate); const gone = d.food.find(x => x.id === e.id); if (gone?.suppId && d.supps) d.supps = d.supps.filter(x => x !== gone.suppId); d.food = d.food.filter(x => x.id !== e.id); saveDay(e.origDate); S.sheet = null; S.ui.efArm = false; toast('Deleted'); render(); } break;
    case 'join-mode': S.ui.join = { mode: v }; render(); break;
    case 'copy-token': try { await navigator.clipboard.writeText(Api.token); toast('Sync code copied'); } catch (e) { const i = $('#sync-code'); i?.select(); toast('Select and copy the code'); } break;
    case 'signout': Api.token = ''; try { ['profile', 'lib', 'days', 'pending'].forEach(k => localStorage.removeItem('fc:' + k)); } catch (e) {} S.profile = null; S.days = {}; S.sheet = null; S.needJoin = true; render(); break;
    case 'log-cond': { const d = day(today()); d.workouts.push({ id: uid(), kind: 'conditioning', dayName: 'Conditioning', location: 'p1', done: true, startedAt: Date.now(), finishedAt: Date.now(), items: [] }); saveDay(today()); toast('Conditioning logged'); render(); break; }
    case 'brief': S.brief = { text: '', loading: true }; render(); try { await aiBrief(({ text }) => { S.brief.text = text; const m = document.querySelector('.msg.ai'); if (m) m.textContent = text; }); } catch (e) { S.brief.text = aiError(e); } S.brief.loading = false; render(); break;
    // session
    case 'set-done': setDone(+el.dataset.i, +el.dataset.j); break;
    case 'set-add': { const it = activeWorkout().items[+el.dataset.i]; const last = it.sets[it.sets.length - 1]; it.sets.push({ load: last?.load ?? it.target, reps: null, rir: null, done: false }); saveDay(today()); render(); break; }
    case 'set-remove': { const it = activeWorkout().items[+el.dataset.i]; const k = it.sets.map(s => s.done).lastIndexOf(false); it.sets.splice(k >= 0 ? k : it.sets.length - 1, 1); saveDay(today()); render(); break; }
    case 'finish-session': finishSession(); break;
    case 'discard-session': if (!S.ui.discardArm) { S.ui.discardArm = true; render(); setTimeout(() => { S.ui.discardArm = false; render(); }, 6000); } else { const d = day(today()); d.workouts = d.workouts.filter(w => w.done); S.ui.discardArm = false; saveDay(today()); S.rest = null; render(); } break;
    case 'swap-open': openSheet({ type: 'swap', i: +el.dataset.i }); break;
    case 'swap-do': {
      const w = activeWorkout(), it = w.items[+el.dataset.i], ex = E.EXBYID[v];
      const sug = E.suggestLoad(ex, setsHistory()[ex.id], typeof it.repTarget === 'number' ? it.repTarget : ex.rr[0] + 2, it.rir, {});
      Object.assign(it, { exId: ex.id, name: ex.name, cue: ex.cue, reps: `${ex.rr[0]}-${ex.rr[1]}`, target: sug.load, basis: sug.basis });
      it.sets.forEach(s => { if (!s.done) s.load = sug.load; });
      if (el.dataset.keep && it.slotKey) { S.profile.swaps = S.profile.swaps || {}; S.profile.swaps[it.slotKey + '@' + it.loc] = ex.id; saveProfile(); }
      saveDay(today()); closeSheet(); break;
    }
    case 'avoid-ex': { const it = activeWorkout().items[+el.dataset.i]; S.profile.avoid = [...new Set([...(S.profile.avoid || []), it.exId])]; saveProfile(); toast(`${it.name} removed from future plans`); closeSheet(); break; }
    case 'add-exercise': openSheet({ type: 'addex' }); break;
    case 'add-ex-do': { const ex = E.EXBYID[v], w = activeWorkout(); const sug = E.suggestLoad(ex, setsHistory()[ex.id], ex.rr[0] + 2, ex.type === 'compound' ? 2 : 1, {}); w.items.push({ exId: ex.id, name: ex.name, muscle: ex.m, loc: ex.loc, reps: `${ex.rr[0]}-${ex.rr[1]}`, repTarget: ex.rr[0] + 2, rir: ex.type === 'compound' ? 2 : 1, target: sug.load, basis: sug.basis, cue: ex.cue, rest: ex.type === 'compound' ? 150 : 90, sets: [0, 1, 2].map(() => ({ load: sug.load, reps: null, rir: null, done: false })) }); saveDay(today()); closeSheet(); break; }
    case 'rest-add': if (S.rest) S.rest.end += 30000; break;
    case 'rest-skip': S.rest = null; clearInterval(restInt); render(); break;
    // food
    case 'food-day': { const nd = E.addDays(S.foodDate, +v); if (nd <= today()) { S.foodDate = nd; render(); } break; }
    case 'food-photo': if (!el.disabled) openFood('photo'); break;
    case 'food-label': if (!el.disabled) openFood('label'); break;
    case 'food-barcode': openFood('barcode', { live: LiveScan.supported() }); if (LiveScan.supported()) setTimeout(startScan, 50); break;
    case 'scan-live': S.sheet.food.live = true; render(); setTimeout(startScan, 50); break;
    case 'scan-stop': LiveScan.stop(); S.sheet.food.live = false; render(); break;
    case 'food-describe': if (!el.disabled) openFood('describe'); break;
    case 'food-quick': openFood('quick', { q: {} }); break;
    case 'food-search': openSheet({ type: 'search', search: {} }); break;
    case 'food-recipes': openSheet({ type: 'recipes' }); break;
    case 'sheet-close': closeSheet(); break;
    case 'sr-pick': { const s = S.sheet.search; const row = (s.q ? s.rows : S.lib.myfoods)[+v]; pickToLog(row); break; }
    case 'lg-step': { readLg(); const it = S.sheet.food.items[+el.dataset.k]; it.servings = Math.max(0.25, +(it.servings + +v).toFixed(2)); render(); break; }
    case 'lg-del': readLg(); S.sheet.food.items.splice(+el.dataset.k, 1); S.ui.altOpen = null; render(); break;
    case 'lg-alt': readLg(); S.ui.altOpen = S.ui.altOpen === +el.dataset.k ? null : +el.dataset.k; render(); break;
    case 'lg-pick': { readLg(); const it = S.sheet.food.items[+el.dataset.k]; it.pick = +v; it.servings = it.pick >= 0 ? servingsFor(it.cands[it.pick], it) : 1; S.ui.altOpen = null; render(); break; }
    case 'lg-save': readLg(); saveLogged(); break;
    case 'rc-log': { const r = S.lib.recipes.find(x => x.id === v); S.sheet = { type: 'food', food: { kind: 'log', stage: 'resolve', text: '1 ' + r.servingName + ' ' + r.name, local: true, meal: S.foodDate === today() ? defaultMeal() : 'Snacks', items: [{ text: r.name, kind: 'recipe', name: r.name, servings: 1, per: r.perServing, unitLabel: r.servingName }] } }; render(); break; }
    case 'rc-del': if (S.ui.rcArm !== v) { S.ui.rcArm = v; render(); } else { S.lib.recipes = S.lib.recipes.filter(x => x.id !== v); S.ui.rcArm = null; saveLib(); render(); } break;
    case 'ml-log': { const r = S.lib.meals.find(x => x.id === v); S.sheet = { type: 'food', food: { kind: 'log', stage: 'resolve', text: r.name, local: true, meal: S.foodDate === today() ? defaultMeal() : 'Snacks', items: [{ text: r.name, kind: 'meal', name: r.name, servings: 1, per: r.total, unitLabel: 'meal' }] } }; render(); break; }
    case 'ml-del': if (S.ui.mlArm !== v) { S.ui.mlArm = v; render(); } else { S.lib.meals = S.lib.meals.filter(x => x.id !== v); S.ui.mlArm = null; saveLib(); render(); } break;
    case 'meal-save': S.ui.mealSave = S.ui.mealSave === v ? null : v; S.ui.mealName = ''; render(); break;
    case 'food-recent': { const r = S.lib.recent[+v]; openFood('quick', { q: { ...r } }); break; }
    case 'food-del': { if (S.ui.delArm !== v) { S.ui.delArm = v; render(); setTimeout(() => { if (S.ui.delArm === v) { S.ui.delArm = null; render(); } }, 6000); } else { const d = day(S.foodDate); d.food = d.food.filter(f => f.id !== v); S.ui.delArm = null; saveDay(S.foodDate); render(); } break; }
    case 'fs-meal': readReviewInputs(); captureFs(); S.sheet.food.meal = v; render(); break;
    case 'fs-estimate': captureFs(); runEstimate(); break;
    case 'fs-readlabel': captureFs(); runLabel(); break;
    case 'fs-code': captureFs(); { const c = (S.sheet.food.code || '').replace(/\D/g, ''); if (c.length >= 6) lookupBarcode(c); else { S.sheet.food.err = 'Enter the full barcode number.'; render(); } } break;
    case 'fs-mult': readReviewInputs(); S.sheet.food.mult = Math.max(0.5, (+S.sheet.food.mult || 1) + +v); render(); break;
    case 'fs-mult-set': readReviewInputs(); S.sheet.food.mult = +v; render(); break;
    case 'fr-del': readReviewInputs(); S.sheet.food.items.splice(+el.dataset.k, 1); if (!S.sheet.food.items.length) S.sheet.food.stage = 'capture'; render(); break;
    case 'fs-back': S.sheet.food.stage = 'capture'; render(); break;
    case 'fs-save': saveReview(); break;
    case 'fs-quick-save': { captureFs(); const q = S.sheet.food.q || {}; const P = +q.protein || 0, C = +q.carbs || 0, F = +q.fat || 0; const K = q.kcal ? +q.kcal : P * 4 + C * 4 + F * 9; if (!K) { S.sheet.food.err = 'Enter calories or at least one macro.'; return render(); } addFood({ name: q.name || 'Quick add', kcal: K, protein: P, carbs: C, fat: F, meal: S.sheet.food.meal, source: 'manual' }); S.sheet = null; toast('Added'); render(); break; }
    // progress
    case 'review-run': runReview(); break;
    case 'review-apply': applyReview(); break;
    case 'review-dismiss': nstate().lastReview = today(); saveProfile(); S.ui.review = null; render(); break;
    // coach
    case 'coach-tab': S.ui.coachTab = v; render(); break;
    case 'chat-sugg': sendChat(v); break;
    case 'chat-clear': S.chat = []; render(); break;
    case 'protocol': if (S.ui.protoArm !== v) { S.ui.protoArm = v; render(); setTimeout(() => { if (S.ui.protoArm === v) { S.ui.protoArm = null; render(); } }, 6000); } else { S.profile.protocol = v; S.profile.nutrition.protocolStart = today(); S.profile.nutrition.phaseStart = today(); S.ui.protoArm = null; saveProfile(); toast(`${E.PROTOCOLS[v].name} is active`); render(); } break;
    // settings
    case 'theme': applyTheme(v); if (S.profile) { S.profile.skin = v; saveProfile(); } render(); break;
    case 'export': exportData(); break;
    case 'wipe': if (!S.ui.wipeArm) { S.ui.wipeArm = true; render(); setTimeout(() => { S.ui.wipeArm = false; if (S.sheet) render(); }, 6000); } else { await Store.wipe(); S.profile = null; S.days = {}; S.lib = { barcodes: {}, recent: [] }; S.sheet = null; S.ui.wipeArm = false; S.ob = null; render(); } break;
    case 'og-save': {
      const og = S.profile.strength = S.profile.strength || {}; og.sets = og.sets || {}; og.tm = og.tm || {};
      ['squat', 'bench', 'deadlift', 'ohp'].forEach(l => { const w = +($(`#og-${l}-w`)?.value || 0), r = +($(`#og-${l}-r`)?.value || 0); if (w && r) { og.sets[l] = { w, r }; const e1 = Math.round(w / (1.0278 - 0.0278 * r)); og.tm[l] = E.strBase(e1); } });
      og.start = today(); saveProfile(); toast('Saved. Your strength plan starts today.'); render(); break;
    }
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.file) { const file = el.files?.[0]; if (file) handleFile(el.dataset.file, file); }
  if (el.id === 'ef-date' || el.id === 'ef-qty') { readEf(); render(); }
  if (el.dataset.lg) { readLg(); render(); }
  if (el.dataset.set) { const [i, j] = [+el.dataset.i, +el.dataset.j]; readSetInputs(i, j); saveDay(today()); }
});
document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.dataset.ob && S.ob) { S.ob.a[el.dataset.ob] = el.value; const btn = document.querySelector('[data-act="ob-next"]'); if (btn) btn.disabled = !obValid(S.ob.step, { ...S.ob.a, [el.dataset.ob]: el.value }); }
});
document.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const fm = ev.target.dataset.form;
  if (fm === 'join') { doJoin(); return; }
  if (fm === 'chat') { const i = $('#chat-in'); const t = i.value; i.value = ''; sendChat(t); }
  if (fm === 'log') { const i = ev.target.querySelector('textarea,input'); const t = i.value; i.value = ''; startLog(t); }
  if (fm === 'recipe') { startRecipe($('#rc-name').value, $('#rc-text').value, $('#rc-serv').value, $('#rc-grams').value, $('#rc-sname').value || 'serving'); }
  if (fm === 'mealsave') { S.ui.mealName = $('#ms-name').value; saveMealFromDay(ev.target.dataset.v); S.ui.mealSave = null; render(); }
  if (fm === 'search') { const q = $('#sr-q').value.trim(); const s = S.sheet.search; s.q = q; s.busy = true; s.err = null; render(); FoodDB.search(q, '', 25).then(r => { s.rows = r; }).catch(() => { s.err = 'The food database did not load. Check your connection.'; }).finally(() => { s.busy = false; render(); }); }
});
window.addEventListener('scroll', () => { const t = $('.top'); if (t) t.classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });

function readLg() { document.querySelectorAll('[data-lg]').forEach(el => { const it = S.sheet?.food?.items?.[+el.dataset.k]; if (it && el.value !== '') it.servings = Math.max(0.05, +el.value || it.servings); }); }
function readEf() {
  const e = S.sheet?.edit; if (!e) return;
  const nm = $('#ef-name'); if (nm) e.name = nm.value;
  const dt = $('#ef-date'); if (dt && dt.value && dt.value <= today() && dt.value !== e.date && !S.ui.efDateClicked) e.date = dt.value;
  const qi = $('#ef-qty'); const newQ = qi ? Math.max(0.05, +qi.value || e.qty) : e.qty;
  // typed macros win: fold them back into the base so later amount changes scale from them
  const r = e.qty / (e.baseQty || 1);
  ['kcal', 'protein', 'carbs', 'fat'].forEach(k => { const el = $('#ef-' + k); if (el && el.value !== '' && Math.round(e.base[k] * r) !== +el.value) e.base[k] = +el.value / (r || 1); });
  e.qty = newQ;
}
function captureOb() { document.querySelectorAll('[data-ob]').forEach(el => { S.ob.a[el.dataset.ob] = el.value; }); document.querySelectorAll('[data-sup]').forEach(el => { const [i, k] = el.dataset.sup.split('-'); const x = S.ob.a.supps?.[+i]; if (x) x[k] = el.value; }); }
function captureCi() { document.querySelectorAll('[data-ci]').forEach(el => { S.ui.ci[el.dataset.ci] = el.value; }); }
function captureFs() {
  const f = S.sheet?.food; if (!f) return;
  document.querySelectorAll('[data-fs]').forEach(el => { f[el.dataset.fs] = el.value; });
  document.querySelectorAll('[data-q]').forEach(el => { f.q = f.q || {}; f.q[el.dataset.q] = el.value; });
}

/* ============================================================
   BOOT
   ============================================================ */
(async function boot() {
  let sk = null; try { sk = localStorage.getItem('fc:skin'); } catch (e) {} applyTheme(SKIN_OLD[sk] || sk || 'auto');
  render();
  await Store.init();
  try {
    const data = await Store.loadAll();
    S.profile = migrateProfile(data.profile); S.lib = { barcodes: {}, recent: [], ...(data.lib || {}) }; S.days = data.days || {};
    if (S.profile?.skin && S.profile.skin !== S.ui.theme) applyTheme(S.profile.skin);
    if (Store.mode === 'api' && S.profile) Oura.status().then(c => { if (c) Oura.sync(false); render(); });
  } catch (e) { console.error(e); toast('Could not load your data. Showing a fresh start.'); }
  render();
  initSample();
})();
