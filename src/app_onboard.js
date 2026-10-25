/* ============================================================
   ONBOARDING QUESTIONNAIRE
   Neutral defaults; every answer editable.
   ============================================================ */
const OB_DEFAULT = {
  name: '', sex: 'male', age: '', heightFt: 5, heightInR: 9, weightLb: '', goalWeightLb: '', bf: '', bfUnknown: false,
  goal: 'fatloss', pace: 'moderate',
  trainingYears: 1, returning: false, daysPerWeek: 3, sessionMin: 45, locations: ['gym'], style: 'hypertrophy',
  legEmphasis: 'normal', priority: [], calves: true, avoid: [], injuries: '',
  job: 'mixed', steps: 6000, sleepHrs: 7, stress: 3, notes: '',
  meals: 3, proteinHabit: 'ok', tracking: 'some', dietStyle: 'balanced', carbCycle: false, dislikes: '', alcohol: 0, supps: [], homeEquip: [], sportKeys: [], sportN: {},
  p1inc: 1, p1max: 75, prehab: true
};

const OB_STEPS = [
  { key: 'you', title: 'About you', sub: 'Used for calories, protein and how fast to diet.' },
  { key: 'goal', title: 'Your goal', sub: 'This decides how much you eat.' },
  { key: 'train', title: 'Training', sub: 'This builds your workout plan.' },
  { key: 'prefs', title: 'Preferences', sub: 'What to focus on and what to skip.' },
  { key: 'life', title: 'Lifestyle', sub: 'These change how much you burn and how fast you recover.' },
  { key: 'food', title: 'Eating habits', sub: 'So your plan fits how you like to eat.' },
  { key: 'review', title: 'Your plan', sub: 'Here is your plan, and why.' }
];

function obStart(edit) {
  const p = S.profile;
  if (edit && p) {
    S.ob = { step: 0, edit: true, a: { ...OB_DEFAULT, ...p, supps: (p.supps || []).map(x => ({ ...x })), homeEquip: (p.homeEquip || []).slice(), locations: (p.locations || []).filter(x => x !== 'hotworx'), sportKeys: [...new Set([...(p.locations || []).includes('hotworx') ? ['hotworx'] : [], ...(p.sports || []).map(x => x.k)])], sportN: Object.fromEntries((p.sports || []).map(x => [x.k, x.n])), heightFt: Math.floor(p.heightIn / 12), heightInR: p.heightIn % 12, bf: p.bf ?? '', bfUnknown: p.bf == null } };
  } else S.ob = { step: 0, a: { ...OB_DEFAULT, supps: [], homeEquip: [], sportKeys: [], sportN: {}, locations: ['gym'] } };
}

function obProfile(a) {
  const num = (v, d = null) => (v === '' || v == null || isNaN(+v)) ? d : +v;
  return {
    name: a.name.trim(), sex: a.sex, age: num(a.age, 35), heightIn: num(a.heightFt, 5) * 12 + num(a.heightInR, 9), weightLb: num(a.weightLb, 180),
    goalWeightLb: num(a.goalWeightLb), bf: a.bfUnknown ? null : num(a.bf), goal: a.goal, pace: a.pace,
    trainingYears: num(a.trainingYears, 1), returning: !!a.returning, daysPerWeek: num(a.daysPerWeek, 3), sessionMin: num(a.sessionMin, 45),
    locations: (() => { const l = a.locations.filter(x => x !== 'hotworx'); if ((a.sportKeys || []).includes('hotworx')) l.push('hotworx'); return l.length ? l : ['home']; })(),
    homeEquip: (a.homeEquip || []).slice(), sports: (a.sportKeys || []).map(k => ({ k, n: +((a.sportN || {})[k] || 1) })), style: a.style, legEmphasis: a.legEmphasis, priority: a.priority.slice(0, 3),
    calves: a.calves, avoid: a.avoid, injuries: a.injuries, job: a.job, steps: num(a.steps, 6000), sleepHrs: num(a.sleepHrs, 7), stress: num(a.stress, 3),
    notes: a.notes, meals: num(a.meals, 3), proteinHabit: a.proteinHabit, tracking: a.tracking, dietStyle: a.dietStyle, carbCycle: !!a.carbCycle,
    dislikes: a.dislikes, alcohol: num(a.alcohol, 0), supps: (a.supps || []).filter(x => x.name && x.name.trim()).map(x => ({ id: x.id, name: x.name.trim(), serving: (x.serving || '').trim(), kcal: num(x.kcal, 0), protein: num(x.protein, 0), carbs: num(x.carbs, 0), fat: num(x.fat, 0) })), prehab: a.prehab !== false, p1inc: num(a.p1inc, 1), p1max: num(a.p1max, 75)
  };
}

function obValid(step, a) {
  if (step === 0) return a.age > 12 && a.weightLb > 70 && a.heightFt > 3;
  if (step === 2) return a.locations.length > 0 || (a.sportKeys || []).length > 0;
  return true;
}

function q(label, help, inner) { return `<div class="ob-q"><div class="lbl">${label}</div>${help ? `<div class="help">${help}</div>` : ''}${inner}</div>`; }
function optBtns(field, opts, cur, cols) {
  return `<div class="opt ${cols ? 'cols' : ''}">${opts.map(o => `<button type="button" data-act="ob-set" data-f="${field}" data-v="${esc(o.v)}" aria-pressed="${String(cur) === String(o.v)}"><b>${esc(o.t)}</b>${o.s ? `<span>${esc(o.s)}</span>` : ''}</button>`).join('')}</div>`;
}
function chipsMulti(field, opts, cur, max) {
  return `<div class="chips">${opts.map(o => `<button type="button" class="chip" data-act="ob-toggle" data-f="${field}" data-v="${o.v}" data-max="${max || 99}" aria-pressed="${cur.includes(o.v)}">${esc(o.t)}</button>`).join('')}</div>`;
}
function inp(field, val, type = 'number', attrs = '') { return `<input class="inp" id="ob-${field}" data-ob="${field}" type="${type}" value="${esc(val)}" ${type === 'number' ? 'inputmode="decimal"' : ''} ${attrs}>`; }

const SUPP_PRESETS = [
  { name: 'Protein powder', serving: '1 scoop', kcal: 120, protein: 24, carbs: 3, fat: 2 },
  { name: 'Creatine', serving: '5 g', kcal: 0, protein: 0, carbs: 0, fat: 0 },
  { name: 'Multivitamin', serving: '1 pill', kcal: 0, protein: 0, carbs: 0, fat: 0 },
  { name: 'Fish oil', serving: '2 softgels', kcal: 20, protein: 0, carbs: 0, fat: 2 },
  { name: 'Vitamin D', serving: '1 pill', kcal: 0, protein: 0, carbs: 0, fat: 0 },
  { name: 'Pre-workout', serving: '1 scoop', kcal: 5, protein: 0, carbs: 1, fat: 0 },
  { name: 'Collagen', serving: '1 scoop', kcal: 40, protein: 10, carbs: 0, fat: 0 },
  { name: 'Mass gainer', serving: '1 serving', kcal: 650, protein: 50, carbs: 110, fat: 4 },
  { name: 'Electrolytes', serving: '1 packet', kcal: 10, protein: 0, carbs: 2, fat: 0 }
];
function suppEditor(list) {
  const have = new Set(list.map(x => x.name));
  return q('Supplements you take', 'Vitamins, pills, protein powders and shakes. Anything with calories gets counted when you mark it taken. Check the label and fix the numbers if yours are different.',
    `<div class="chips">${SUPP_PRESETS.filter(p => !have.has(p.name)).map((p, k) => `<button type="button" class="chip" data-act="sup-add" data-v="${esc(p.name)}">+ ${esc(p.name)}</button>`).join('')}<button type="button" class="chip" data-act="sup-add" data-v="">+ Something else</button></div>
    ${list.length ? `<div class="stack" style="gap:10px;margin-top:12px">${list.map((x, i) => `<div class="card flat" style="padding:12px">
      <input class="inp" data-sup="${i}-name" placeholder="Name, e.g. whey protein" value="${esc(x.name)}" aria-label="Supplement name">
      <div class="row between" style="flex-wrap:nowrap;gap:8px;margin-top:8px"><input class="inp" data-sup="${i}-serving" placeholder="Amount, e.g. 1 scoop" value="${esc(x.serving || '')}" aria-label="Amount per serving"><button type="button" class="btn sm ghost" data-act="sup-del" data-v="${i}" aria-label="Remove ${esc(x.name || 'supplement')}">Remove</button></div>
      <div class="fields" style="grid-template-columns:repeat(4,1fr);margin-top:8px">${[['kcal', 'Calories'], ['protein', 'Protein g'], ['carbs', 'Carbs g'], ['fat', 'Fat g']].map(([k, l]) => `<label class="f">${l}<input class="inp" style="padding-left:8px;padding-right:4px" data-sup="${i}-${k}" inputmode="decimal" type="number" value="${esc(x[k] ?? 0)}"></label>`).join('')}</div>
    </div>`).join('')}</div><p class="tiny muted" style="margin-top:6px">Pills and vitamins can stay at 0.</p>` : ''}`);
}

function renderOnboarding() {
  const { step, a } = S.ob; const st = OB_STEPS[step];
  let body = '';
  if (st.key === 'you') body = `
    ${step === 0 && !S.ob.edit ? `<div class="hero-ob"><div class="h-display">Train smarter.<br>Eat with a plan.</div><p class="muted" style="margin-top:10px">Spotter builds your training program and your calorie and macro targets, then adjusts them every day from how you slept, what you lifted and what you ate. Two minutes of questions and you are set.</p></div>` : ''}
    <div class="fields">
      <label class="f">First name${inp('name', a.name, 'text', 'autocomplete="given-name"')}</label>
      <label class="f">Age${inp('age', a.age)}</label>
    </div>
    ${q('Sex', 'Men and women burn calories a little differently.', optBtns('sex', [{ v: 'male', t: 'Male' }, { v: 'female', t: 'Female' }], a.sex, true))}
    <div class="fields">
      <label class="f">Height (ft)${inp('heightFt', a.heightFt)}</label>
      <label class="f">Height (in)${inp('heightInR', a.heightInR)}</label>
      <label class="f">Weight (lb)${inp('weightLb', a.weightLb)}</label>
    </div>
    <div class="fields">
      <label class="f">Body fat % (estimate)${inp('bf', a.bf, 'number', a.bfUnknown ? 'disabled' : '')}</label>
      <label class="f">Goal weight (lb, optional)${inp('goalWeightLb', a.goalWeightLb)}</label>
    </div>
    <div class="chips"><button type="button" class="chip" data-act="ob-flag" data-f="bfUnknown" aria-pressed="${a.bfUnknown}">Not sure of body fat</button></div>
    <p class="tiny muted">Not sure of your body fat? Tap "Not sure". A rough guess from the mirror is fine too.</p>`;
  if (st.key === 'goal') body = `
    ${q('Main goal', '', optBtns('goal', [
      { v: 'fatloss', t: 'Lose weight', s: 'Lose fat and keep your muscle.' },
      { v: 'recomp', t: 'Tone up', s: 'Lose a little fat and build a little muscle. Your weight stays about the same.' },
      { v: 'gain', t: 'Build muscle', s: 'Get bigger and stronger. Your weight goes up slowly.' },
      { v: 'maintain', t: 'Stay where I am', s: 'Keep my weight and get stronger.' }], a.goal))}
    ${a.goal === 'fatloss' ? q('How fast?', 'Faster is harder to stick with and can cost muscle.', optBtns('pace', [{ v: 'slow', t: 'Slow and steady', s: 'Easiest' }, { v: 'moderate', t: 'Normal', s: 'Recommended' }, { v: 'aggressive', t: 'Faster', s: 'Harder' }], a.pace, true)) : ''}`;
  if (st.key === 'train') body = `
    <div class="fields">
      <label class="f">Years lifting weights (0 if new)${inp('trainingYears', a.trainingYears)}</label>
    </div>
    <div class="chips"><button type="button" class="chip" data-act="ob-flag" data-f="returning" aria-pressed="${a.returning}">I'm getting back into it after a break</button></div>
    ${q('Workouts per week you can count on', 'Pick what you can do even on a busy week. Extra workouts are a bonus.', `<div class="seg">${[2, 3, 4, 5, 6].map(n => `<button type="button" data-act="ob-set" data-f="daysPerWeek" data-v="${n}" aria-pressed="${+a.daysPerWeek === n}">${n}</button>`).join('')}</div>`)}
    ${q('How long can each workout be?', '', `<div class="seg">${[30, 45, 60, 75].map(n => `<button type="button" data-act="ob-set" data-f="sessionMin" data-v="${n}" aria-pressed="${+a.sessionMin === n}">${n} min</button>`).join('')}</div>`)}
    ${q('Where do you lift?', 'Pick everything you have. Each day you choose where you are and the exercises change to match.', '')}
    <div class="eyebrow" style="margin-top:-6px">Gym</div>
    ${chipsMulti('locations', [{ v: 'gym', t: 'Commercial gym' }], a.locations)}
    <div class="eyebrow" style="margin-top:6px">Home gym</div>
    ${chipsMulti('locations', [{ v: 'home', t: 'Free weights, calisthenics or bodyweight' }], a.locations)}
    ${a.locations.includes('home') ? `<div class="help" style="margin-top:2px">What do you have at home? For calisthenics, pick a pull-up bar, rings, parallettes or dip bars. Leave all off for bodyweight only.</div>${chipsMulti('homeEquip', E.HOME_EQUIP.map(x => ({ v: x.k, t: x.t })), a.homeEquip || [])}` : ''}
    <div class="help" style="margin-top:4px">Smart home gyms</div>
    ${chipsMulti('locations', ['p1', 'sd', 'tonal', 'amp', 'vit'].map(k => ({ v: k, t: E.PLACES[k].full })), a.locations)}
    ${a.locations.includes('p1') ? `<div class="fields"><label class="f">P1 dial step (kg)${inp('p1inc', a.p1inc)}</label><label class="f">P1 max per cable (kg)${inp('p1max', a.p1max)}</label></div>` : ''}
    ${a.locations.some(l => ['sd', 'tonal', 'vit'].includes(l)) && !(a.homeEquip || []).includes('bench') ? `<div class="chips"><button type="button" class="chip" data-act="ob-equip" data-v="bench" aria-pressed="false">I have the bench for my smart gym</button></div>` : ''}
    <div class="eyebrow" style="margin-top:6px">Specialized training</div>
    <div class="help" style="margin-top:2px">Classes and sports you do. Your lifting plan works around them.</div>
    ${chipsMulti('sportKeys', E.SPORTS.map(x => ({ v: x.k, t: x.name })), a.sportKeys || [])}
    ${(a.sportKeys || []).length ? `<div class="stack" style="gap:8px;margin-top:4px">${a.sportKeys.map(k => `<div class="row between" style="flex-wrap:nowrap;gap:10px"><span class="small" style="min-width:0">${esc(E.SPORTBYK[k].name)}, times a week</span><div class="seg" style="flex:none">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="ob-sportn" data-k="${k}" data-v="${n}" aria-pressed="${+((a.sportN || {})[k] || 1) === n}">${n}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
    ${q('What kind of plan?', '', optBtns('style', [
      { v: 'hypertrophy', t: 'Look better and build muscle', s: 'Recommended for most people.' },
      { v: 'strength', t: 'Get stronger', s: 'Focus on the big lifts: squat, bench press, deadlift and overhead press. Needs 4 days a week at a gym.' }], a.style))}
    ${a.style === 'strength' && +a.daysPerWeek < 4 ? '<p class="tiny" style="color:var(--warn)">This plan needs 4 days a week. With fewer days you get the build muscle plan instead.</p>' : ''}`;
  if (st.key === 'prefs') body = `
    ${q('How much leg work?', '', optBtns('legEmphasis', [{ v: 'low', t: 'Less legs', s: 'More time on upper body' }, { v: 'normal', t: 'Normal' }, { v: 'high', t: 'More legs', s: 'Glutes and thighs' }], a.legEmphasis, true))}
    ${q('Areas you want to improve most (up to 3)', 'These get extra work.', chipsMulti('priority', Object.entries(E.MUSCLES).filter(([k]) => k !== 'abs').map(([v, t]) => ({ v, t })), a.priority, 3))}
    <div class="chips"><button type="button" class="chip" data-act="ob-flag" data-f="calves" aria-pressed="${a.calves}">Include calf exercises</button><button type="button" class="chip" data-act="ob-flag" data-f="prehab" aria-pressed="${a.prehab}">Add a quick shoulder-health exercise to each workout</button></div>
    <label class="f">Injuries, or exercises you want to avoid${`<textarea class="inp" data-ob="injuries" id="ob-injuries" placeholder="e.g. left shoulder gets cranky on overhead pressing">${esc(a.injuries)}</textarea>`}</label>`;
  if (st.key === 'life') body = `
    ${q('What is your work day like?', '', optBtns('job', [{ v: 'desk', t: 'Mostly desk' }, { v: 'mixed', t: 'Mixed', s: 'Some walking, some desk' }, { v: 'onfeet', t: 'On my feet' }, { v: 'physical', t: 'Physical labor' }], a.job, true))}
    <div class="fields">
      <label class="f">Steps per day (your phone shows this)${inp('steps', a.steps)}</label>
      <label class="f">Hours of sleep most nights${inp('sleepHrs', a.sleepHrs)}</label>
    </div>
    ${q('How stressed are you usually?', '1 is calm, 5 is stretched thin.', `<div class="scale">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="ob-set" data-f="stress" data-v="${n}" aria-pressed="${+a.stress === n}">${n}</button>`).join('')}</div>`)}
    <label class="f">Anything about your schedule the coach should know<textarea class="inp" data-ob="notes" id="ob-notes">${esc(a.notes)}</textarea></label>`;
  if (st.key === 'food') body = `
    <div class="fields">
      <label class="f">Meals per day${inp('meals', a.meals)}</label>
      <label class="f">Drinks per week${inp('alcohol', a.alcohol)}</label>
    </div>
    ${q('How much protein do you eat now?', 'Meat, fish, eggs, Greek yogurt, protein shakes.', optBtns('proteinHabit', [{ v: 'low', t: 'Usually low' }, { v: 'ok', t: 'Decent' }, { v: 'high', t: 'Always high' }], a.proteinHabit, true))}
    ${q('How do you like to eat?', 'Same calories either way. This only changes carbs versus fats.', optBtns('dietStyle', [
      { v: 'balanced', t: 'A normal mix', s: 'Recommended' }, { v: 'highcarb', t: 'More carbs', s: 'Bread, rice, pasta, fruit' }, { v: 'lowcarb', t: 'Fewer carbs', s: 'More meat, eggs, cheese, nuts' }], a.dietStyle))}
    <div class="chips"><button type="button" class="chip" data-act="ob-flag" data-f="carbCycle" aria-pressed="${a.carbCycle}">Eat more carbs on workout days</button></div>
    <label class="f">Foods you avoid or dislike<input class="inp" data-ob="dislikes" id="ob-dislikes" value="${esc(a.dislikes)}"></label>
    ${suppEditor(a.supps || [])}
    <p class="tiny muted">Special diets (like low-carb or rapid fat loss) are under Coach > Special diets. They stay off unless you turn them on.</p>`;
  if (st.key === 'review') {
    const p = obProfile(a); const T = E.calcTargets(p); const prog = E.buildProgram(p);
    body = `
      <div class="tiles">
        <div class="tile"><div class="k">Calories</div><div class="v mk">${fmt(T.base.kcal)}</div></div>
        <div class="tile"><div class="k">Protein</div><div class="v mp">${T.base.protein} g</div></div>
        <div class="tile"><div class="k">Carbs</div><div class="v mc">${T.base.carbs} g</div></div>
        <div class="tile"><div class="k">Fat</div><div class="v mf">${T.base.fat} g</div></div>
      </div>
      <ul class="why">${T.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>
      <div class="divider"></div>
      <div class="h2">${esc(prog.split)}</div>
      <p class="small muted">${esc(prog.splitWhy || '')}</p>
      <div class="list">${prog.days.map(d => `<div style="padding:9px 0"><b>${esc(d.name)}</b><div class="small muted">${d.main ? esc(E.STRPLAN.lifts[d.main].name) + ', ' : ''}${d.slots.map(s => `${E.MUSCLES[s.muscle]}`).join(' · ')}</div></div>`).join('')}</div>
      <ul class="why">${prog.volume.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>`;
  }
  const pct = Math.round((step + 1) / OB_STEPS.length * 100);
  return `<div class="ob stack" style="padding-top:8px">
    <div class="progress" aria-hidden="true"><i style="width:${pct}%"></i></div>
    <div><div class="eyebrow">Step ${step + 1} of ${OB_STEPS.length}</div><h1 class="h-display h1" style="margin-top:4px">${st.title}</h1><p class="muted small" style="margin-top:4px">${st.sub}</p></div>
    <form class="card stack" data-form="ob" novalidate>${body}</form>
    <div class="row between">
      ${step > 0 ? '<button class="btn" data-act="ob-back">Back</button>' : (S.ob.edit ? '<button class="btn" data-act="ob-cancel">Cancel</button>' : '<span></span>')}
      <button class="btn primary" data-act="ob-next" ${obValid(step, a) ? '' : 'disabled'}>${step === OB_STEPS.length - 1 ? (S.ob.edit ? 'Save and rebuild plan' : 'Start coaching') : 'Continue'}</button>
    </div></div>`;
}

async function obFinish() {
  const a = S.ob.a; const prev = S.profile;
  const p = obProfile(a);
  p.program = E.buildProgram(p);
  p.nutrition = { ...(prev?.nutrition || {}) };
  if (!prev || prev.goal !== p.goal) { p.nutrition.phaseStart = today(); p.nutrition.deficitStart = p.goal === 'fatloss' ? today() : null; }
  p.protocol = prev?.protocol || 'standard';
  p.swaps = prev?.swaps || {}; p.strength = prev?.strength || null;
  p.created = prev?.created || today();
  S.profile = p; S.ob = null; S.view = 'today';
  await saveProfile();
  toast(prev ? 'Plan rebuilt' : 'Plan ready');
  render();
}
