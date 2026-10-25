/* ============================================================
   VIEWS
   ============================================================ */
const LOC_LABEL = new Proxy({ off: 'Rest' }, { get: (o, k) => o[k] || (E.PLACES[k] ? E.PLACES[k].name : k === 'sport' ? 'Sport' : String(k || '')) });
const haveEquip = e => { const h = new Set(S.profile?.homeEquip || []); return (e.need || []).every(k => h.has(k)); };

function plateBars(t, tot) {
  const rows = [
    { k: 'kcal', lab: 'Calories', col: 'var(--k)', unit: '' },
    { k: 'protein', lab: 'Protein', col: 'var(--p)', unit: 'g' },
    { k: 'carbs', lab: 'Carbs', col: 'var(--c)', unit: 'g' },
    { k: 'fat', lab: 'Fat', col: 'var(--f)', unit: 'g' }
  ];
  return `<div class="plates">${rows.map(r => {
    const v = tot[r.k] || 0, goal = t[r.k] || 1, pct = Math.min(100, v / goal * 100);
    return `<div class="plate" style="--col:${r.col}"><div class="lab"><span class="disc"></span>${r.lab}</div><div class="bar" role="img" aria-label="${r.lab} ${Math.round(v)} of ${goal}"><i class="${v > goal * 1.05 ? 'over' : ''}" style="width:${pct}%"></i></div><div class="val num">${fmt(v)}<span> / ${fmt(goal)}${r.unit}</span></div></div>`;
  }).join('')}</div>`;
}

function gauge(score, band) {
  const col = band === 'green' ? 'var(--good)' : band === 'yellow' ? 'var(--warn)' : band === 'red' ? 'var(--bad)' : 'var(--ink3)';
  const v = score == null ? 0 : score / 100;
  const a = Math.PI * (1 - v), x = 59 + 50 * Math.cos(a), y = 60 - 50 * Math.sin(a);
  return `<div class="gauge" role="img" aria-label="Readiness ${score ?? 'not checked in'}"><svg viewBox="0 0 118 66"><path d="M9 60a50 50 0 0 1 100 0" stroke="var(--surface2)" stroke-width="10" fill="none" stroke-linecap="round"/>${score != null ? `<path d="M9 60A50 50 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}" stroke="${col}" stroke-width="10" fill="none" stroke-linecap="round"/>` : ''}</svg><div class="g-num" style="color:${col}">${score ?? '–'}</div></div>`;
}

function loadLabel(ex, load) {
  if (load == null) return '';
  if (ex.loc === 'p1') { const d = E.p1Display(load, ex.cables); return `<div class="dial"><b>${fmt(load, load % 1 ? 1 : 0)} kg</b><span>dial ${ex.cables === 1 ? '(1 cable)' : 'per cable'} · about ${d.totalLb} lb total</span></div>`; }
  const pl = E.placeOf(ex.loc);
  if (ex.loc === 'vit') return `<div class="dial"><b>${fmt(load, load % 1 ? 1 : 0)} kg</b><span>${ex.cables === 1 ? '1 cable' : 'per cable'} · about ${Math.round(load * (ex.cables || 2) * 2.2046)} lb total</span></div>`;
  if (pl.machine) return `<div class="dial"><b>${fmt(load)} lb</b><span>on the ${esc(pl.name)} screen</span></div>`;
  return `<div class="dial"><b>${fmt(load)} lb</b><span>${ex.equip || ''}</span></div>`;
}

/* ---------------- TODAY ---------------- */
function viewToday() {
  const t = today(), d = day(t), p = S.profile;
  const plan = todaysPlan();
  const tgt = targetFor(t), tot = E.dayTotals(d.food);
  const yTot = S.days[E.addDays(t, -1)] ? E.dayTotals(S.days[E.addDays(t, -1)].food) : null;
  const nNotes = E.nutritionNotes(tgt, yTot && yTot.kcal ? yTot : null, plan);
  if (tgt.note) nNotes.unshift(tgt.note);
  const prog = program();
  const wk = E.weekNumber(prog, t);
  const phase = p.goal === 'fatloss' ? `Losing weight · week ${weeksInDeficit() + 1}` : p.goal === 'gain' ? 'Building muscle' : p.goal === 'recomp' ? 'Toning up' : 'Maintaining';
  const started = (d.workouts || []).find(w => !w.done), done = (d.workouts || []).filter(w => w.done && w.kind !== 'conditioning' && w.kind !== 'sport' && !w.hx);
  const loc = d.plan?.loc || (p.locations || ['gym'])[0];
  const min = d.plan?.min || p.sessionMin;
  const remaining = Math.round(tgt.kcal - tot.kcal);

  const wearStrip = d.wear ? `<div class="row small" style="gap:6px;margin-top:8px"><span class="pill blue">Oura</span><span class="muted">Readiness ${d.wear.readiness ?? '–'} · Sleep ${d.wear.sleepHrs ?? '–'} h${d.wear.hrv ? ` · HRV ${d.wear.hrv}` : ''}${d.wear.rhr ? ` · RHR ${d.wear.rhr}` : ''}</span></div>` : '';
  const checkin = (d.checkin || d.wear?.readiness != null) ? (() => {
    const r = E.readiness(d.checkin, d.wear);
    const bandTxt = { green: 'Ready to push', yellow: 'Train, hold back a little', red: 'Low: go light or walk' }[r.band];
    return `<div class="card"><div class="card-h"><div><div class="eyebrow">Today's energy</div><div class="h2" style="margin-top:2px">${bandTxt}</div></div>${gauge(r.score, r.band)}</div>
      ${d.checkin ? `<div class="row small muted"><span>Sleep ${d.checkin.sleepHrs} h</span><span>·</span><span>Energy ${d.checkin.energy}/5</span><span>·</span><span>Stress ${d.checkin.stress}/5</span><span>·</span><span>Soreness ${d.checkin.soreness}/5</span>${d.weight ? `<span>·</span><span>${d.weight} lb</span>` : ''}</div>` : '<p class="small muted">Set from your ring. Add how you feel (energy, stress, soreness) for a sharper read.</p>'}
      ${wearStrip}
      <div class="row" style="margin-top:10px"><button class="btn sm ${d.checkin ? 'ghost' : ''}" data-act="checkin-open">${d.checkin ? 'Edit check-in' : 'Add how you feel'}</button></div></div>`;
  })() : `<div class="card"><div class="card-h"><div><div class="eyebrow">Morning check-in</div><div class="h2" style="margin-top:2px">How did you wake up?</div></div>${gauge(null)}</div>
      <p class="small muted">Thirty seconds. Sleep, energy, stress and soreness decide whether today pushes, holds, or goes light.</p>
      <button class="btn primary block" style="margin-top:12px" data-act="checkin-open">${ICON.today} Check in</button></div>`;

  let session;
  if (done.length && !started) {
    const w = done[done.length - 1];
    const sets = (w.items || []).reduce((s, it) => s + it.sets.filter(x => x.done).length, 0);
    session = `<div class="card"><div class="card-h"><div><div class="eyebrow">Session done</div><div class="h2" style="margin-top:2px">${esc(w.dayName)}</div></div><span class="pill good">${ICON.check.replace('<svg', '<svg width="14" height="14"')} ${sets} set${sets === 1 ? '' : 's'}</span></div>
      <p class="small muted">Logged at ${LOC_LABEL[w.location]}. The next session picks up from here.</p>
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="go" data-v="train">View log</button></div></div>`;
  } else {
    const locSeg = `<div class="chips" role="group" aria-label="Where are you training">${(p.locations || ['gym']).concat('off').map(l => `<button class="chip" data-act="plan-loc" data-v="${l}" aria-pressed="${loc === l}">${l === 'gym' || l === 'hotworx' ? ICON.gym.replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px"') : E.PLACES[l] ? ICON.home.replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px"') : ICON.bed.replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px"')} ${LOC_LABEL[l]}</button>`).join('')}</div>`;
    const minSeg = `<div class="chips">${[30, 45, 60, 75].map(m => `<button class="chip" data-act="plan-min" data-v="${m}" aria-pressed="${+min === m}">${m} min</button>`).join('')}</div>`;
    let inner = '';
    if (plan.type === 'train') {
      inner = `<div class="list" style="margin-top:6px">${plan.items.map((it, i) => `<div class="row between" style="padding:8px 0;flex-wrap:nowrap"><div style="min-width:0"><div style="font-weight:500">${it.pair ? `<span class="pill blue" style="margin-right:6px">${it.pair}</span>` : ''}${esc(it.ex.name)}</div><div class="tiny muted">${E.MUSCLES[it.muscle]}</div></div><div class="num" style="text-align:right;white-space:nowrap;font-family:var(--display);font-weight:600;font-size:16px">${it.sets} × ${it.reps}<div class="tiny muted" style="font-family:var(--body);font-weight:400">${it.load != null ? (it.ex.loc === 'p1' ? 'dial ' + it.load + ' kg' : it.load + ' ' + E.unitOf(it.ex.loc)) : it.ex.bw ? 'bodyweight' : 'pick a weight'}</div></div></div>`).join('')}</div>
        <div class="row" style="margin-top:12px">${started ? `<button class="btn primary block" data-act="go" data-v="train">${ICON.train} Continue session</button>` : `<button class="btn primary block" data-act="start-session">${ICON.train} Start ${esc(plan.dayName)}</button>`}</div>
        ${plan.readiness.band === 'red' ? `<button class="btn block ghost" style="margin-top:8px" data-act="plan-choice" data-v="walk">${ICON.walk} Swap for a recovery walk</button>` : ''}`;
    } else if (plan.type === 'recovery') {
      inner = `<p style="margin-top:8px">25 to 40 minutes of easy walking on the treadmill, then 10 minutes of mobility. ${esc(prog.days[plan.dayIndex].name)} moves to your next session.</p><button class="btn block" style="margin-top:10px" data-act="plan-choice" data-v="">Train light instead</button>`;
    } else {
      inner = `<p style="margin-top:8px" class="muted">Rest day. Steps and protein still count. Your next session is ${esc(prog.days[E.nextDayIndex(prog, allWorkouts(), t)].name)}.</p>${plan.condWeek < 2 ? `<button class="btn block" style="margin-top:10px" data-act="log-cond">${ICON.walk} Log 20 min conditioning</button>` : ''}`;
    }
    const hxBtn = (p.locations || []).includes('hotworx') ? `<button class="btn block ghost" style="margin-top:8px" data-act="hx-open">${ICON.bolt} Log a HOTWORX sauna session</button>` : '';
    const spBtn = (p.sports || []).some(x => x.k !== 'hotworx') ? `<button class="btn block ghost" style="margin-top:8px" data-act="sp-open">${ICON.bolt} Log ${esc((p.sports || []).filter(x => x.k !== 'hotworx').length === 1 ? 'a ' + E.SPORTBYK[(p.sports || []).find(x => x.k !== 'hotworx').k].name.toLowerCase() + ' session' : 'a sport or class')}</button>` : '';
    inner += hxBtn + spBtn;
    session = `<div class="card"><div class="card-h"><div><div class="eyebrow">Today's workout · week ${((wk - 1) % (prog.blockWeeks + 1)) + 1}${plan.deload ? ' · easy week' : ''}</div><div class="h2" style="margin-top:2px">${plan.type === 'train' ? esc(plan.dayName) : plan.type === 'recovery' ? 'Recovery walk' : 'Rest'}</div></div>${plan.type === 'train' ? `<span class="pill">${plan.minutesEst} min</span>` : ''}</div>
      <div class="stack" style="gap:8px">${locSeg}${plan.type !== 'rest' ? minSeg : ''}</div>${inner}</div>`;
  }

  const food = `<div class="card"><div class="card-h"><div class="eyebrow">${esc(tgt.label)}</div><button class="btn sm" data-act="go" data-v="food">${ICON.plus} Log food</button></div>
    <div class="row" style="gap:18px;flex-wrap:nowrap;margin-bottom:14px">${kcalRing(tot.kcal, tgt.kcal)}<div style="min-width:0"><div class="big num">${fmt(Math.abs(remaining))}</div><div class="small muted">${remaining >= 0 ? 'calories left today' : 'calories over today'}</div><div class="row small" style="gap:12px;margin-top:8px"><span class="mp"><b>${fmt(Math.max(0, tgt.protein - tot.protein))}g</b> protein to go</span></div></div></div>
    ${plateBars(tgt, tot)}
    <form data-form="log" class="row" style="flex-wrap:nowrap;gap:8px;margin-top:12px"><input class="inp" id="log-in-today" placeholder="What did you eat?" autocomplete="off"><button class="btn primary" type="submit">Log</button></form>
    ${nNotes.length ? `<div class="divider"></div><ul class="notes">${nNotes.map(n => `<li>${ICON.info}<span>${esc(n)}</span></li>`).join('')}</ul>` : ''}</div>`;

  const adj = plan.adjustments || [];
  const coachNotes = `<div class="card"><div class="card-h"><div class="eyebrow">Why today's plan looks like this</div>${S.sample ? `<button class="btn sm" data-act="brief">${ICON.spark} Ask coach about today</button>` : ''}</div>
    ${S.brief ? `<div class="msg ai" style="max-width:100%;margin-bottom:12px" aria-live="polite">${esc(S.brief.text || '')}${S.brief.loading && !S.brief.text ? '<span class="spinner"></span>' : ''}</div>` : ''}
    ${adj.length ? `<ul class="notes">${adj.map(n => `<li>${ICON.info}<span>${esc(n)}</span></li>`).join('')}</ul>` : '<p class="small muted">Normal day: the plan runs as written.</p>'}</div>`;

  const review = weeklyReviewDue() ? `<div class="card" style="border-color:var(--c)"><div class="row between"><div><div class="eyebrow">Weekly review</div><div class="h2" style="margin-top:2px">Check-in on your numbers</div><p class="small muted">Spotter looks at your week and adjusts your calories.</p></div><button class="btn primary sm" data-act="go" data-v="progress">Review</button></div></div>` : '';

  return `<div class="stack">
    <div class="row between" style="padding-top:6px"><div><div class="eyebrow">${esc(prettyDate(t))}</div><h1 class="h-display h1" style="margin-top:4px">${greeting()}${p.name ? ', ' + esc(p.name) : ''}</h1></div><span class="pill blue">${esc(phase)}</span></div>
    ${review}
    <div class="grid2"><div class="stack">${checkin}${session}</div><div class="stack">${food}${coachNotes}</div></div>
  </div>`;
}
function kcalRing(v, goal) {
  const R = 56, C = 2 * Math.PI * R, pct = Math.min(1, v / Math.max(1, goal)), over = v > goal * 1.05;
  return `<div class="ring" role="img" aria-label="${Math.round(pct * 100)}% of calories"><svg viewBox="0 0 132 132"><circle cx="66" cy="66" r="${R}" fill="none" stroke="var(--surface2)" stroke-width="12"/><circle cx="66" cy="66" r="${R}" fill="none" stroke="${over ? 'var(--bad)' : 'var(--k)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct)).toFixed(1)}"/></svg><div class="rc"><b class="num">${Math.round(pct * 100)}%</b><span>eaten</span></div></div>`;
}
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'; }
function weeklyReviewDue() { const last = nstate().lastReview || S.profile.created || today(); return E.daysBetween(last, today()) >= 7; }

/* ---------------- CHECK-IN SHEET ---------------- */
function sheetCheckin() {
  const d = day(today()); const c = d.checkin || { sleepHrs: d.wear?.sleepHrs || S.profile.sleepHrs || 7, sleepQ: 3, energy: 3, stress: S.profile.stress || 3, soreness: 2, soreAreas: [] };
  S.ui.ci = S.ui.ci || { ...c, weight: d.weight || '' , steps: c.steps || '' };
  const ci = S.ui.ci;
  const sc = (f, lo, hi) => `<div class="scale">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="ci-set" data-f="${f}" data-v="${n}" aria-pressed="${+ci[f] === n}">${n}</button>`).join('')}</div><div class="row between tiny muted" style="margin-top:3px"><span>${lo}</span><span>${hi}</span></div>`;
  return `<div class="grab"></div><div class="stack">
    <div class="h2">Morning check-in</div>
    <label class="f">Sleep last night (hours)<div class="stepper"><button type="button" data-act="ci-step" data-f="sleepHrs" data-v="-0.5" aria-label="Less sleep">−</button><input id="ci-sleep" data-ci="sleepHrs" inputmode="decimal" value="${ci.sleepHrs}"><button type="button" data-act="ci-step" data-f="sleepHrs" data-v="0.5" aria-label="More sleep">+</button></div></label>
    <div class="f">Sleep quality${sc('sleepQ', 'Rough', 'Great')}</div>
    <div class="f">Energy${sc('energy', 'Flat', 'Wired')}</div>
    <div class="f">Stress${sc('stress', 'Calm', 'Stretched thin')}</div>
    <div class="f">Overall soreness${sc('soreness', 'None', 'Very sore')}</div>
    <div class="f">Anything sore?<div class="chips">${Object.entries(E.MUSCLES).filter(([k]) => !['frontdelts', 'abs'].includes(k)).map(([k, v]) => `<button type="button" class="chip" data-act="ci-sore" data-v="${k}" aria-pressed="${(ci.soreAreas || []).includes(k)}">${v}</button>`).join('')}</div></div>
    <div class="fields"><label class="f">Bodyweight (lb)<input class="inp" id="ci-weight" data-ci="weight" inputmode="decimal" value="${esc(ci.weight)}" placeholder="optional"></label><label class="f">Steps yesterday<input class="inp" id="ci-steps" data-ci="steps" inputmode="numeric" value="${esc(ci.steps)}" placeholder="optional"></label></div>
    <p class="tiny muted">Weigh in the morning after the bathroom. The trend line smooths daily water swings, so single readings never move your targets.</p>
    <button class="btn primary block" data-act="ci-save">Save check-in</button></div>`;
}

/* ---------------- TRAIN ---------------- */
function viewTrain() {
  const t = today(), d = day(t);
  const active = (d.workouts || []).find(w => !w.done);
  const hist = allWorkouts().filter(w => w.done).reverse().slice(0, 12);
  let body;
  if (active) body = sessionCard(active);
  else {
    const plan = todaysPlan();
    body = `<div class="card"><div class="eyebrow">Nothing in progress</div><div class="h2" style="margin-top:2px">${plan.type === 'train' ? 'Next up: ' + esc(plan.dayName) : 'Rest or recovery today'}</div>
      <p class="small muted" style="margin-top:4px">${plan.type === 'train' ? `${plan.items.length} exercises, about ${plan.minutesEst} minutes at ${LOC_LABEL[plan.location]}.` : 'You can still start a session if plans changed.'}</p>
      <div class="row" style="margin-top:12px"><button class="btn primary" data-act="start-session">${ICON.train} Start session</button><button class="btn" data-act="go" data-v="today">Change location or time</button></div>
      <div class="divider"></div><p class="small muted">Did your own thing? Log the exercises you actually did. It still counts toward your progress.</p><button class="btn block" style="margin-top:8px" data-act="free-start">${ICON.plus} Log my own workout</button></div>`;
  }
  const histHtml = hist.length ? `<div class="card"><div class="card-h"><div class="eyebrow">Recent sessions</div></div><div class="list">${hist.map(w => {
    const sets = (w.items || []).reduce((s, it) => s + it.sets.filter(x => x.done).length, 0);
    return `<details class="acc"><summary><span>${esc(w.dayName)} <span class="muted small" style="font-weight:400">· ${esc(prettyDate(w.date, { weekday: 'short', month: 'short', day: 'numeric' }))} · ${LOC_LABEL[w.location]}</span></span><span class="row" style="gap:6px;flex-wrap:nowrap"><span class="pill">${sets} sets</span>${ICON.chev.replace('<svg', '<svg width="16" height="16"')}</span></summary><div class="small">${(w.items || []).map(it => `<div style="padding:4px 0"><b style="font-weight:600">${esc(it.name)}</b><div class="muted mono">${it.sets.filter(s => s.done).map(s => `${s.load ?? '–'}${it.loc === 'p1' ? 'kg' : ''}×${s.reps}${s.rir != null ? '@' + s.rir : ''}`).join('  ') || 'no sets logged'}</div></div>`).join('')}</div></details>`;
  }).join('')}</div></div>` : '';
  return `<div class="stack"><div style="padding-top:6px"><div class="eyebrow">${esc(prettyDate(t))}</div><h1 class="h-display h1" style="margin-top:4px">Train</h1></div>${body}${histHtml}</div>`;
}

function sessionCard(w) {
  const done = w.items.reduce((s, it) => s + it.sets.filter(x => x.done).length, 0);
  const total = w.items.reduce((s, it) => s + it.sets.length, 0);
  return `<div class="card">
    <div class="card-h"><div><div class="eyebrow">${LOC_LABEL[w.location]} · ${done} of ${total} sets</div><div class="h2" style="margin-top:2px">${esc(w.dayName)}</div></div><button class="btn sm primary" data-act="finish-session">Finish</button></div>
    <div class="progress"><i style="width:${total ? done / total * 100 : 0}%"></i></div>
    ${w.notes?.length ? `<ul class="notes" style="margin-top:12px">${w.notes.map(n => `<li>${ICON.info}<span class="small">${esc(n)}</span></li>`).join('')}</ul>` : ''}
    <div class="list" style="margin-top:6px">${w.items.map((it, i) => exerciseBlock(w, it, i)).join('')}</div>
    <div class="row" style="margin-top:6px"><button class="btn sm" data-act="add-exercise">${ICON.plus} Add exercise</button><button class="btn sm ghost danger" data-act="discard-session" data-armed="${S.ui.discardArm ? 1 : 0}">${S.ui.discardArm ? 'Tap again to discard' : 'Discard session'}</button></div>
  </div>`;
}

function exerciseBlock(w, it, i) {
  const ex = E.EXBYID[it.exId] || { loc: it.loc, inc: E.placeOf(it.loc).inc, cables: 2 };
  const unit = E.unitOf(it.loc);
  const tag = it.main ? 'M' : it.pair ? it.pair : String(i + 1);
  const rpeMode = !!it.strength;
  return `<div class="ex" id="ex-${i}">
    <div class="ex-h"><div class="ex-tag ${it.main ? 'main' : it.pair ? 'pair' : ''}">${tag}</div>
      <div style="flex:1;min-width:0"><div class="ex-name">${esc(it.name)}</div>
        <div class="ex-meta">${E.MUSCLES[it.muscle] || ''} · ${it.sets.length} × ${esc(it.reps)} · ${it.rir ? 'stop ' + it.rir + ' rep' + (it.rir > 1 ? 's' : '') + ' early' : 'go until you can\'t do another'}${E.placeOf(it.loc).machine && ex.mode ? ` · <span class="pill" style="padding:1px 7px">${ex.mode} mode</span>` : ''}</div>
        ${loadLabel({ ...ex, loc: it.loc }, it.target)}
        ${it.cue ? `<div class="tiny muted" style="margin-top:5px">${esc(it.cue)}</div>` : ''}
        ${it.basis ? `<div class="basis">${esc(it.basis)}</div>` : ''}
      </div>
      ${it.main ? '' : `<button class="iconbtn" data-act="swap-open" data-i="${i}" aria-label="Swap exercise">${ICON.swap}</button>`}
    </div>
    <div class="sets">
      <div class="set set-h"><span>Set</span><span>${it.loc === 'p1' ? 'Dial kg' : ex.bw ? '+' + unit : unit}</span><span>Reps</span><span>Reps left</span><span></span></div>
      ${it.sets.map((s, j) => `<div class="set ${s.done ? 'done' : ''}">
        <span class="n">${j + 1}</span>
        <input id="s-${i}-${j}-l" data-set="load" data-i="${i}" data-j="${j}" inputmode="decimal" value="${s.load ?? ''}" placeholder="${it.target ?? '–'}" aria-label="Load set ${j + 1}">
        <input id="s-${i}-${j}-r" data-set="reps" data-i="${i}" data-j="${j}" inputmode="numeric" value="${s.reps ?? ''}" placeholder="${esc(String(it.repTarget ?? ''))}" aria-label="Reps set ${j + 1}">
        <select id="s-${i}-${j}-x" data-set="rir" data-i="${i}" data-j="${j}" aria-label="Reps you could still do set ${j + 1}">${(rpeMode ? [0, 0.5, 1, 1.5, 2, 3] : [0, 1, 2, 3, 4]).map(v => `<option value="${v}" ${(s.rir ?? it.rir) == v ? 'selected' : ''}>${String(v).replace('.5', '½').replace(/^0½$/, '½')}</option>`).join('')}</select>
        <button class="ok" data-act="set-done" data-i="${i}" data-j="${j}" aria-label="${s.done ? 'Undo set' : 'Mark set done'}">${ICON.check}</button>
      </div>${s.hint ? `<div class="hint">${esc(s.hint)}</div>` : ''}`).join('')}
    </div>
    <div class="row" style="margin-top:6px;gap:6px"><button class="btn sm ghost" data-act="set-add" data-i="${i}">${ICON.plus} Set</button>${it.sets.length > 1 ? `<button class="btn sm ghost" data-act="set-remove" data-i="${i}">Remove set</button>` : ''}</div>
  </div>`;
}

function sheetSwap(i) {
  const w = day(today()).workouts.find(x => !x.done); const it = w.items[i];
  const fits = e => !e.mainOnly && haveEquip(e) && (e.m === it.muscle || (e.sec || []).includes(it.muscle)) && e.id !== it.exId;
  const srt = (a, b) => (a.m === it.muscle ? 0 : 1) - (b.m === it.muscle ? 0 : 1) || a.tier - b.tier;
  const mine = new Set([w.location, ...(S.profile.locations || [])]);
  const alts = E.EX.filter(e => e.loc === w.location && fits(e)).sort(srt);
  const other = E.EX.filter(e => e.loc !== w.location && (mine.has(e.loc) || e.loc === 'mine') && fits(e)).sort(srt);
  return `<div class="grab"></div><div class="stack"><div><div class="eyebrow">Swap</div><div class="h2">${esc(it.name)}</div><p class="small muted">Pick a replacement for ${E.MUSCLES[it.muscle]}. "Keep" makes it the default for this slot from now on.</p></div>
    <div class="list">${alts.map(e => `<div class="row between" style="padding:10px 0;flex-wrap:nowrap"><div style="min-width:0"><div style="font-weight:500">${esc(e.name)} ${e.tier === 1 ? '<span class="pill good">Best pick</span>' : ''}</div><div class="tiny muted">${esc(e.cue)}</div></div><div class="row" style="flex-wrap:nowrap;gap:6px"><button class="btn sm" data-act="swap-do" data-i="${i}" data-v="${e.id}">Today</button><button class="btn sm primary" data-act="swap-do" data-i="${i}" data-v="${e.id}" data-keep="1">Keep</button></div></div>`).join('') || '<p class="muted">No alternatives at this location.</p>'}</div>
    ${other.length ? `<details class="acc"><summary>With other equipment you have ${ICON.chev.replace('<svg', '<svg width="16" height="16"')}</summary><div class="list">${other.map(e => `<div class="row between" style="padding:10px 0;flex-wrap:nowrap"><div style="min-width:0"><div style="font-weight:500">${esc(e.name)}</div><div class="tiny muted">${esc(e.loc === 'mine' ? 'Your exercise' : E.placeOf(e.loc).full)}</div></div><div class="row" style="flex-wrap:nowrap;gap:6px"><button class="btn sm" data-act="swap-do" data-i="${i}" data-v="${e.id}">Today</button><button class="btn sm primary" data-act="swap-do" data-i="${i}" data-v="${e.id}" data-keep="1">Keep</button></div></div>`).join('')}</div></details>` : ''}
    ${myExForm('swap', i, it.muscle)}
    <button class="btn ghost danger" data-act="avoid-ex" data-i="${i}">Never program ${esc(it.name)}</button></div>`;
}

function myExForm(mode, i, muscle) {
  return `<form class="card flat stack" data-form="myex" data-mode="${mode}" data-i="${i ?? ''}" style="padding:12px"><b class="small">Something else</b>
    <input class="inp" id="mx-name" placeholder="Type the exercise, e.g. kettlebell goblet squat" autocomplete="off">
    <div class="row" style="flex-wrap:nowrap;gap:8px"><select class="inp" id="mx-m" aria-label="Body part">${Object.entries(E.MUSCLES).map(([k, l]) => `<option value="${k}" ${k === muscle ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <label class="chip" style="white-space:nowrap"><input type="checkbox" id="mx-bw" style="margin-right:6px">Bodyweight</label></div>
    <button class="btn sm primary" type="submit">${mode === 'swap' ? 'Use this instead' : 'Add it'}</button></form>`;
}
function sheetAddExercise() {
  const w = day(today()).workouts.find(x => !x.done);
  const mine = new Set([w.location, ...(S.profile.locations || []), 'mine']);
  const list = E.EX.filter(e => (w.free ? mine.has(e.loc) : (e.loc === w.location || e.loc === 'mine')) && !e.mainOnly && haveEquip(e));
  return `<div class="grab"></div><div class="stack"><div class="h2">Add exercise</div><div class="list">${Object.keys(E.MUSCLES).map(m => {
    const xs = list.filter(e => e.m === m); if (!xs.length) return '';
    return `<details class="acc"><summary>${E.MUSCLES[m]} ${ICON.chev.replace('<svg', '<svg width="16" height="16"')}</summary><div>${xs.map(e => `<button class="btn sm" style="margin:3px" data-act="add-ex-do" data-v="${e.id}">${esc(e.name)}</button>`).join('')}</div></details>`;
  }).join('')}</div>${myExForm('add', null, 'chest')}</div>`;
}

/* ---------------- FOOD ---------------- */
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
function defaultMeal() { const h = new Date().getHours(); return h < 10 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks'; }

function viewFood() {
  const date = S.foodDate, d = day(date), tgt = targetFor(date), tot = E.dayTotals(d.food);
  const isToday = date === today();
  const ai = !!S.sample;
  const add = (act, icon, lab, dis) => `<button class="add" data-act="${act}" ${dis ? 'disabled title="Needs Claude access"' : ''} style="${dis ? 'opacity:.45' : ''}">${icon}${lab}</button>`;
  const recent = (S.lib.recent || []).slice(0, 10);
  return `<div class="stack">
    <div class="row between" style="padding-top:6px;flex-wrap:nowrap"><button class="iconbtn" data-act="food-day" data-v="-1" aria-label="Previous day">${ICON.left}</button>
      <div style="text-align:center"><div class="eyebrow">${isToday ? 'Today' : esc(prettyDate(date, { weekday: 'long' }))}</div><div class="h-display" style="font-size:24px;margin-top:2px">${esc(prettyDate(date, { month: 'long', day: 'numeric' }))}</div></div>
      <button class="iconbtn" data-act="food-day" data-v="1" aria-label="Next day" ${isToday ? 'disabled style="opacity:.35"' : ''}>${ICON.right}</button></div>
    <div class="grid2">
      <div class="stack">
        <div class="card"><div class="card-h"><div><div class="eyebrow">${esc(tgt.label)}</div><div class="big num" style="margin-top:4px">${fmt(tot.kcal)}<small>of ${fmt(tgt.kcal)} kcal</small></div></div></div>${plateBars(tgt, tot)}
        ${tgt.note ? `<p class="tiny muted" style="margin-top:10px">${esc(tgt.note)}</p>` : ''}</div>
        ${logBox()}
        ${(S.profile.supps || []).length ? `<div class="card"><div class="card-h"><div class="eyebrow">Supplements</div><div class="tiny muted">${(d.supps || []).filter(id => S.profile.supps.some(x => x.id === id)).length} of ${S.profile.supps.length} taken</div></div><div class="chips">${S.profile.supps.map(x => `<button class="chip" data-act="sup-take" data-v="${x.id}" aria-pressed="${(d.supps || []).includes(x.id)}">${esc(x.name)}${x.kcal ? ` <span style="opacity:.7">${fmt(x.kcal)} kcal</span>` : ''}</button>`).join('')}</div><p class="tiny muted" style="margin-top:8px">Tap what you took. Anything with calories is added to your day. Change your list in Settings under Profile and plan.</p></div>` : ''}
        <div class="card"><div class="eyebrow" style="margin-bottom:10px">Other ways to add</div>
          <div class="adds" style="grid-template-columns:repeat(3,1fr)">${add('food-search', ICON.food, 'Search')}${add('food-barcode', ICON.barcode, 'Barcode')}${add('food-recipes', ICON.label.replace('M8 7h8', 'M8 7h8'), 'Recipes')}${add('food-photo', ICON.camera, 'Photo', !ai || !S.sampleImages)}${add('food-label', ICON.label, 'Label', !ai || !S.sampleImages)}${add('food-quick', ICON.plus, 'Quick')}</div>
          ${!ai ? '<p class="tiny muted" style="margin-top:8px">Photo, label and describe use Claude. Allow Claude for this page from the artifact menu to turn them on.</p>' : ''}
          ${recent.length ? `<div class="eyebrow" style="margin:14px 0 8px">Recent</div><div class="chips">${recent.map((r, k) => `<button class="chip" data-act="food-recent" data-v="${k}">${esc(r.name)} <span class="muted">${fmt(r.kcal)}</span></button>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="card">${MEALS.map(m => {
        const items = d.food.filter(f => (f.meal || 'Snacks') === m);
        const mt = E.dayTotals(items);
        return `<div><div class="meal-h"><div class="h2" style="font-size:17px">${m}</div><div class="row" style="gap:8px"><div class="small muted num">${items.length ? fmt(mt.kcal) + ' kcal · P' + fmt(mt.protein) : ''}</div>${items.length ? `<button class="btn sm ghost" style="min-height:26px;padding:2px 8px" data-act="meal-save" data-v="${m}">Save meal</button>` : ''}</div></div>
          ${S.ui.mealSave === m ? `<form class="row" data-form="mealsave" data-v="${m}" style="flex-wrap:nowrap;margin-bottom:8px"><input class="inp" id="ms-name" placeholder="Name it, e.g. my breakfast" value="${esc(S.ui.mealName || '')}"><button class="btn sm primary" type="submit">Save</button></form>` : ''}
          ${items.length ? `<div class="list">${items.map(f => `<div class="entry"><div style="min-width:0;cursor:pointer" data-act="food-edit" data-v="${f.id}" role="button" tabindex="0" aria-label="Edit ${esc(f.name)}"><div class="nm">${esc(f.name)}${f.source === 'photo' || f.source === 'describe' ? ' <span class="pill" style="padding:1px 6px;font-size:11px">estimate</span>' : ''}</div><div class="mac"><span class="mp"><b>P</b> ${fmt(f.protein)}</span><span class="mc"><b>C</b> ${fmt(f.carbs)}</span><span class="mf"><b>F</b> ${fmt(f.fat)}</span>${f.qty && f.qty !== 1 ? `<span>× ${f.qty}</span>` : ''}</div></div><div class="row" style="flex-wrap:nowrap;gap:4px"><div class="kc num">${fmt(f.kcal)}</div><button class="iconbtn" style="width:32px;height:32px" data-act="food-del" data-v="${f.id}" aria-label="Delete ${esc(f.name)}" data-armed="${S.ui.delArm === f.id ? 1 : 0}">${S.ui.delArm === f.id ? ICON.check : ICON.trash}</button></div></div>`).join('')}</div>` : '<div class="tiny muted" style="padding:2px 0 10px">Nothing yet.</div>'}</div>`;
      }).join('')}</div>
    </div></div>`;
}

function mealSeg(cur) { return `<div class="seg" role="group" aria-label="Meal">${MEALS.map(m => `<button type="button" data-act="fs-meal" data-v="${m}" aria-pressed="${cur === m}">${m}</button>`).join('')}</div>`; }

function sheetFood() {
  const f = S.sheet.food;
  if (f.stage === 'capture') {
    const kind = f.kind;
    const title = { photo: 'Photo of your meal', label: 'Nutrition label', barcode: 'Scan a barcode', describe: 'Describe what you ate', quick: 'Quick add' }[kind];
    let inner = '';
    if (kind === 'photo') inner = `<p class="small muted">Take or choose a photo. A short note (brand, amount, how it was cooked) makes the estimate much better.</p>
      <label class="btn block primary" for="fs-file">${ICON.camera} ${f.image ? 'Change photo' : 'Take or choose photo'}</label><input id="fs-file" type="file" accept="image/*" hidden data-file="photo">
      ${f.preview ? `<img src="${f.preview}" alt="Meal photo" style="border-radius:12px;max-height:220px;object-fit:cover;width:100%">` : ''}
      <label class="f">Description (optional)<textarea class="inp" id="fs-note" data-fs="note" placeholder="e.g. Chipotle bowl, double chicken, white rice, fajita veggies, mild salsa, no cheese">${esc(f.note || '')}</textarea></label>
      <button class="btn block primary" data-act="fs-estimate" ${f.image ? '' : 'disabled'}>${ICON.spark} Estimate macros</button>`;
    if (kind === 'label') inner = `<p class="small muted">Photograph the Nutrition Facts panel straight on. ${f.barcode ? `This will be saved to barcode ${esc(f.barcode)} so the next scan is instant.` : ''}</p>
      <label class="btn block primary" for="fs-file">${ICON.label} ${f.image ? 'Change photo' : 'Photograph label'}</label><input id="fs-file" type="file" accept="image/*" hidden data-file="label">
      ${f.preview ? `<img src="${f.preview}" alt="Label photo" style="border-radius:12px;max-height:220px;object-fit:contain;width:100%">` : ''}
      <label class="f">Product name (optional)<input class="inp" id="fs-note" data-fs="note" value="${esc(f.note || '')}"></label>
      <button class="btn block primary" data-act="fs-readlabel" ${f.image ? '' : 'disabled'}>${ICON.spark} Read label</button>`;
    if (kind === 'barcode') inner = `${f.live ? `<div style="position:relative;border-radius:14px;overflow:hidden;background:#000;aspect-ratio:4/3"><video id="scan-video" muted playsinline style="width:100%;height:100%;object-fit:cover"></video><div style="position:absolute;left:5%;right:5%;top:28%;bottom:28%;border:2px solid rgba(255,255,255,.85);border-radius:10px;box-shadow:0 0 0 999px rgba(0,0,0,.35)"></div></div><p class="small muted">Hold the barcode inside the box. It reads on its own.</p><button class="btn block" data-act="scan-stop">Stop camera</button>`
        : `${LiveScan.supported() ? `<button class="btn block primary" data-act="scan-live">${ICON.barcode} Scan with camera</button>` : ''}<p class="small muted">Over 400,000 US products are built in. Products not in the database ask for one label photo, then they are saved.</p>`}
      <label class="btn block ${LiveScan.supported() ? '' : 'primary'}" for="fs-file">${ICON.camera} Photograph barcode</label><input id="fs-file" type="file" accept="image/*" hidden data-file="barcode">
      <label class="f">Or type the number<input class="inp" id="fs-code" data-fs="code" inputmode="numeric" value="${esc(f.code || '')}"></label>
      <button class="btn block" data-act="fs-code">Look up</button>
`;
    if (kind === 'describe') inner = `<label class="f">What did you eat?<textarea class="inp" id="fs-note" data-fs="note" placeholder="e.g. 3 scrambled eggs in butter, 2 slices sourdough, black coffee">${esc(f.note || '')}</textarea></label>
      <button class="btn block primary" data-act="fs-estimate">${ICON.spark} Estimate macros</button>`;
    if (kind === 'quick') inner = `<label class="f">Name<input class="inp" id="fs-q-name" data-q="name" value="${esc(f.q?.name || '')}" placeholder="e.g. Protein shake"></label>
      <div class="fields"><label class="f">Protein g<input class="inp" id="fs-q-p" data-q="protein" inputmode="decimal" value="${esc(f.q?.protein ?? '')}"></label><label class="f">Carbs g<input class="inp" id="fs-q-c" data-q="carbs" inputmode="decimal" value="${esc(f.q?.carbs ?? '')}"></label><label class="f">Fat g<input class="inp" id="fs-q-f" data-q="fat" inputmode="decimal" value="${esc(f.q?.fat ?? '')}"></label><label class="f">kcal (blank = calculated)<input class="inp" id="fs-q-k" data-q="kcal" inputmode="decimal" value="${esc(f.q?.kcal ?? '')}"></label></div>
      ${mealSeg(f.meal)}<button class="btn block primary" data-act="fs-quick-save">Add</button>`;
    return `<div class="grab"></div><div class="stack"><div class="h2">${title}</div>${inner}${f.busy ? '<div class="row muted small"><span class="spinner"></span> Working on it…</div>' : ''}${f.err ? `<p class="small" style="color:var(--bad)">${esc(f.err)}</p>` : ''}</div>`;
  }
  if (f.stage === 'review') {
    const items = f.items;
    const tot = items.reduce((t, x) => ({ kcal: t.kcal + (+x.kcal || 0) * f.mult, protein: t.protein + (+x.protein || 0) * f.mult, carbs: t.carbs + (+x.carbs || 0) * f.mult, fat: t.fat + (+x.fat || 0) * f.mult }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    return `<div class="grab"></div><div class="stack">
      <div class="row between"><div class="h2">Check the estimate</div><span class="pill ${f.conf === 'high' ? 'good' : f.conf === 'low' ? 'warn' : ''}">${f.kind === 'label' || f.kind === 'barcode' ? 'From label' : 'Confidence ' + (f.conf || 'medium')}</span></div>
      ${f.assumptions ? `<p class="small muted">${esc(f.assumptions)}</p>` : ''}
      ${f.question ? `<p class="small" style="color:var(--c)">${ICON.info.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} ${esc(f.question)} Add it to the note and re-estimate for a tighter number.</p>` : ''}
      <div class="list">${items.map((x, k) => `<div style="padding:10px 0" class="stack"><div class="row between" style="flex-wrap:nowrap;gap:8px"><input class="inp" style="font-weight:600" id="fr-${k}-name" data-fr="name" data-k="${k}" value="${esc(x.name)}" aria-label="Food name"><button class="iconbtn" data-act="fr-del" data-k="${k}" aria-label="Remove item">${ICON.trash}</button></div>
        <div class="fields" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${['kcal', 'protein', 'carbs', 'fat'].map(m => `<label class="f tiny">${m === 'kcal' ? 'kcal' : m[0].toUpperCase() + ' g'}<input class="inp" id="fr-${k}-${m}" data-fr="${m}" data-k="${k}" inputmode="decimal" value="${Math.round(+x[m] || 0)}"></label>`).join('')}</div>${x.grams ? `<div class="tiny muted">About ${Math.round(x.grams)} g</div>` : ''}</div>`).join('')}</div>
      ${f.kind === 'label' || f.kind === 'barcode' ? `<label class="f">Servings eaten<div class="stepper"><button type="button" data-act="fs-mult" data-v="-0.5">−</button><input id="fs-mult" data-fs="mult" inputmode="decimal" value="${f.mult}"><button type="button" data-act="fs-mult" data-v="0.5">+</button></div></label>${f.serving ? `<div class="tiny muted">1 serving = ${esc(f.serving)}</div>` : ''}` : `<label class="f">Portion<div class="chips">${[0.5, 0.75, 1, 1.25, 1.5, 2].map(m => `<button type="button" class="chip" data-act="fs-mult-set" data-v="${m}" aria-pressed="${+f.mult === m}">${m}×</button>`).join('')}</div></label>`}
      <div class="tiles"><div class="tile"><div class="k">kcal</div><div class="v mk">${fmt(tot.kcal)}</div></div><div class="tile"><div class="k">Protein</div><div class="v mp">${fmt(tot.protein)}</div></div><div class="tile"><div class="k">Carbs</div><div class="v mc">${fmt(tot.carbs)}</div></div><div class="tile"><div class="k">Fat</div><div class="v mf">${fmt(tot.fat)}</div></div></div>
      ${mealSeg(f.meal)}
      <div class="row"><button class="btn" data-act="fs-back">Back</button><button class="btn primary" style="flex:1" data-act="fs-save">Add to ${esc(f.meal)}</button></div>
    </div>`;
  }
}

/* ---------------- PROGRESS ---------------- */
function weightChart(ws) {
  const tr = E.trendSeries(ws).slice(-60);
  if (tr.length < 2) return `<div class="empty">${ICON.scale}<div>Weigh in on a few mornings and the trend line appears here.</div></div>`;
  const W = 640, H = 200, pl = 36, pr = 10, pt = 12, pb = 22;
  const lo = Math.floor(Math.min(...tr.map(x => Math.min(x.lb, x.trend))) - 1), hi = Math.ceil(Math.max(...tr.map(x => Math.max(x.lb, x.trend))) + 1);
  const t0 = new Date(tr[0].date).getTime(), t1 = new Date(tr[tr.length - 1].date).getTime() || t0 + 1;
  const X = d => pl + (new Date(d).getTime() - t0) / Math.max(1, t1 - t0) * (W - pl - pr), Y = v => pt + (hi - v) / (hi - lo) * (H - pt - pb);
  const ticks = []; const step = Math.max(1, Math.round((hi - lo) / 4)); for (let v = lo; v <= hi; v += step) ticks.push(v);
  const line = tr.map((x, i) => `${i ? 'L' : 'M'}${X(x.date).toFixed(1)} ${Y(x.trend).toFixed(1)}`).join('');
  const area = line + `L${X(tr[tr.length - 1].date).toFixed(1)} ${H - pb}L${X(tr[0].date).toFixed(1)} ${H - pb}Z`;
  const last = tr[tr.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend, latest ${last.trend} lb">
    ${ticks.map(v => `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 6}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
    <path d="${area}" fill="var(--k)" opacity=".10"/>
    ${tr.map(x => `<circle cx="${X(x.date).toFixed(1)}" cy="${Y(x.lb).toFixed(1)}" r="2.6" fill="var(--ink3)" opacity=".7"/>`).join('')}
    <path d="${line}" fill="none" stroke="var(--k)" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="${X(last.date)}" cy="${Y(last.trend)}" r="5" fill="var(--k)" stroke="var(--surface)" stroke-width="2"/>
    <text x="${pl}" y="${H - 6}">${esc(prettyDate(tr[0].date, { month: 'short', day: 'numeric' }))}</text><text x="${W - pr}" y="${H - 6}" text-anchor="end">${esc(prettyDate(last.date, { month: 'short', day: 'numeric' }))}</text>
  </svg>`;
}

function weeklyVolume() {
  const since = E.addDays(today(), -6), vol = {};
  allWorkouts().filter(w => w.done && w.date >= since).forEach(w => (w.items || []).forEach(it => {
    const n = it.sets.filter(s => s.done).length; const ex = E.EXBYID[it.exId];
    vol[it.muscle] = (vol[it.muscle] || 0) + n;
    (ex?.sec || []).forEach(m => vol[m] = (vol[m] || 0) + n * 0.5);
  }));
  return vol;
}

function viewProgress() {
  const ws = weights(), tr = E.trendSeries(ws), T = targets(), p = S.profile;
  const lastT = tr.length ? tr[tr.length - 1].trend : null;
  const wkAgo = tr.filter(x => x.date <= E.addDays(today(), -7)).pop();
  const rate = lastT && wkAgo ? lastT - wkAgo.trend : null;
  const intake = intakeByDate();
  const days7 = Array.from({ length: 7 }, (_, i) => E.addDays(today(), -i - 1));
  const logged = days7.filter(d => intake[d]).length;
  const avgK = logged ? Math.round(E.avg(days7.filter(d => intake[d]).map(d => intake[d]))) : null;
  const prot7 = days7.map(d => S.days[d] ? E.dayTotals(S.days[d].food).protein : 0).filter(x => x > 0);
  const vol = weeklyVolume(); const tgtVol = program().volume.sets;
  const rv = S.ui.review;
  const hist = setsHistory();
  const top = Object.entries(hist).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const rateGoal = p.goal === 'fatloss' ? -(p.weightLb * T.ratePct / 100) : null;
  return `<div class="stack"><div style="padding-top:6px"><div class="eyebrow">Last 60 days</div><h1 class="h-display h1" style="margin-top:4px">Progress</h1></div>
    <div class="tiles">
      <div class="tile"><div class="k">Average weight</div><div class="v num">${lastT ? fmt(lastT, 1) : '–'}<span class="small muted"> lb</span></div></div>
      <div class="tile"><div class="k">7-day change</div><div class="v num" style="color:${rate == null ? 'var(--ink)' : (p.goal === 'fatloss' ? (rate < 0 ? 'var(--good)' : 'var(--warn)') : 'var(--ink)')}">${rate == null ? '–' : (rate > 0 ? '+' : '') + fmt(rate, 2)}</div><div class="tiny muted">${rateGoal ? 'target ' + fmt(rateGoal, 1) + '/wk' : ''}</div></div>
      <div class="tile"><div class="k">Avg intake (7d)</div><div class="v num">${avgK ? fmt(avgK) : '–'}</div><div class="tiny muted">${logged}/7 days logged</div></div>
      <div class="tile"><div class="k">Avg protein</div><div class="v num mp">${prot7.length ? fmt(E.avg(prot7)) : '–'}<span class="small muted"> g</span></div><div class="tiny muted">target ${T.base.protein} g</div></div>
    </div>
    <div class="grid2"><div class="stack">
      <div class="card"><div class="card-h"><div class="eyebrow">Weight · dots are weigh-ins, the line is your average</div><button class="btn sm" data-act="checkin-open">${ICON.scale} Log</button></div>${weightChart(ws)}</div>
      <div class="card"><div class="card-h"><div><div class="eyebrow">Weekly check-up</div><div class="h2" style="margin-top:2px">Adjust your calories</div></div>${rv ? '' : `<button class="btn sm primary" data-act="review-run">Check my week</button>`}</div>
        <p class="small muted">You eat ${fmt(T.base.kcal)} calories a day and burn about ${fmt(T.tdee)}${p.nutrition?.tdeeOverride ? ' (measured from your logs)' : ' (estimated)'}. Last review: ${nstate().lastReview ? esc(prettyDate(nstate().lastReview, { month: 'short', day: 'numeric' })) : 'never'}.</p>
        ${rv ? `<ul class="notes" style="margin-top:10px">${rv.notes.map(n => `<li>${ICON.info}<span class="small">${esc(n)}</span></li>`).join('')}</ul>
          <div class="tiles" style="margin-top:12px"><div class="tile"><div class="k">Now</div><div class="v num">${fmt(T.base.kcal)}</div></div><div class="tile"><div class="k">Proposed</div><div class="v num mk">${fmt(rv.newKcal)}</div><div class="tiny muted">${rv.newKcal - T.base.kcal >= 0 ? '+' : ''}${rv.newKcal - T.base.kcal} kcal</div></div></div>
          <div class="row" style="margin-top:12px"><button class="btn" data-act="review-dismiss">Keep current</button><button class="btn primary" data-act="review-apply">Use new calories${rv.dietBreak ? ' and start break' : ''}</button></div>` : ''}
      </div>
    </div><div class="stack">
      <div class="card"><div class="card-h"><div class="eyebrow">Work done this week, by body part</div></div>
        <div class="plates">${Object.keys(E.MUSCLES).filter(m => tgtVol[m] > 0).map(m => { const v = vol[m] || 0, g = tgtVol[m] || 1; return `<div class="plate" style="--col:${v >= g * 0.9 ? 'var(--good)' : v >= g * 0.5 ? 'var(--warn)' : 'var(--ink3)'}"><div class="lab" style="font-weight:500">${E.MUSCLES[m]}</div><div class="bar"><i style="width:${Math.min(100, v / g * 100)}%"></i></div><div class="val num">${fmt(v, v % 1 ? 1 : 0)}<span> / ${g}</span></div></div>`; }).join('')}</div>
        <p class="tiny muted" style="margin-top:10px">Bars fill as you train each area. Exercises that work an area indirectly count half.</p></div>
      <div class="card"><div class="card-h"><div class="eyebrow">Strength over time</div></div>
        ${top.length ? `<div class="list">${top.map(([id, rows]) => { const ex = E.EXBYID[id]; const byD = {}; rows.forEach(r => byD[r.date] = Math.max(byD[r.date] || 0, E.e1rm(r.load, r.reps, r.rir))); const ds = Object.keys(byD).sort(); const vals = ds.map(d => byD[d]); const first = vals[0], lastv = vals[vals.length - 1]; const ch = first ? (lastv / first - 1) * 100 : 0;
          return `<div class="row between" style="padding:9px 0;flex-wrap:nowrap"><div style="min-width:0"><div style="font-weight:500">${esc(ex?.name || id)}</div><div class="tiny muted">${ds.length} session${ds.length === 1 ? '' : 's'}</div></div>${spark(vals)}<div style="text-align:right;min-width:74px"><div class="num" style="font-family:var(--display);font-weight:700;font-size:18px">${fmt(lastv, 1)} ${ex?.loc === 'p1' ? 'kg' : 'lb'}</div><div class="tiny" style="color:${ch >= 0 ? 'var(--good)' : 'var(--bad)'}">${ch >= 0 ? '+' : ''}${fmt(ch, 1)}%</div></div></div>`; }).join('')}</div>` : `<div class="empty">${ICON.train}<div>Log a couple of sessions to see strength trends.</div></div>`}</div>
    </div></div></div>`;
}
function spark(vals) {
  if (vals.length < 2) return '<span></span>';
  const W = 80, H = 26, lo = Math.min(...vals), hi = Math.max(...vals) || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * W).toFixed(1)},${(H - 3 - (v - lo) / Math.max(0.001, hi - lo) * (H - 6)).toFixed(1)}`).join(' ');
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" style="flex:none"><polyline points="${pts}" fill="none" stroke="var(--c)" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

/* ---------------- COACH ---------------- */
const PRINCIPLES = [
  { g: 'Working out', t: 'Work hard, but not to exhaustion', b: 'Most sets should end when you could only do 1 to 3 more reps. That builds muscle without wrecking you for days.' },
  { g: 'Working out', t: 'Train each area twice a week', b: 'Twice a week builds more muscle than once. Spotter rotates your workouts so this happens on its own.' },
  { g: 'Working out', t: 'Add weight a little at a time', b: 'When you can do all your reps, Spotter adds a small amount of weight next time. Small steps add up.' },
  { g: 'Working out', t: 'More work builds more muscle, up to a point', b: 'Spotter starts you with a moderate amount and adds a little each week, then gives you an easy week to recover.' },
  { g: 'Working out', t: 'Bad day? Do less, not nothing', b: 'Poor sleep or a stressful day means lighter work. A really bad day becomes a walk. Missed workouts never need making up.' },
  { g: 'Working out', t: 'Stick with the plan long enough to work', b: 'Muscles grow from doing a little more over time, not from changing exercises every week.' },
  { g: 'Working out', t: 'Pull as much as you push', b: 'Back and shoulder exercises balance out sitting, driving and phones, and keep your shoulders healthy.' },
  { g: 'Eating', t: 'Lose weight slowly', b: 'About 0.5 to 1% of your body weight a week. Faster usually means losing muscle and feeling drained.' },
  { g: 'Eating', t: 'Protein first', b: 'Protein keeps you full and protects your muscle. Try to get 30 to 50 g at each meal.' },
  { g: 'Eating', t: 'Look at the week, not one day', b: 'One big meal does not ruin anything. Do not starve yourself the next day; just get back to normal.' },
  { g: 'Eating', t: 'Breaks are part of the plan', b: 'After a couple of months of dieting, a 2-week break at normal eating makes the rest easier. The scale may go up from water; that is not fat.' },
  { g: 'Recovery', t: 'Sleep matters as much as the gym', b: 'Under 6 hours makes workouts feel harder and slows your progress.' },
  { g: 'Recovery', t: 'Walk more before you eat less', b: 'Extra steps burn calories without making you hungrier. Working out on an empty stomach does not burn more fat.' },
  { g: 'Supplements', t: 'Only a few are worth it', b: 'Creatine (3 to 5 g a day) is the one with the most proof. Coffee before a workout can help. Protein powder is just food.' }
];
const MY_TIPS = ['There is no Golden Rule. The best plan depends on your goal, your training, and how you eat.', 'Training, nutrition, and a goal all have to line up. Without one of them, you will never get there.', 'Most diets work, and they work for the same reasons. Find the theme and you get the same results.', 'Every gram of carbs holds water. Cut carbs and the first drop on the scale is mostly water.', 'When protein and calories are the same, keto and higher-carb diets yield almost identical results.', 'Six meals a day will not speed up your metabolism. Three regular meals work just as well for fat loss.', 'Read the label, not the brand. Check whether whey isolate or concentrate is the first ingredient.', 'Compare the dose on the label to the dose in the study. Many products use as little as a quarter of it.', 'Creatine helps your body remake ATP so you can perform better. It supports your training; it does not do the work for it.', 'A push-up is resistance training. The only difference from a bench press is the costume it is wearing.', 'Fasted or fed, the fat you burn comes down to how much you eat versus how much you expend. Just do the cardio.', 'You don\'t need to confuse your body. Muscle grows because of increased stimulus, not new stimulus.', 'Stick with a program long enough to know whether you are progressing. Switching every other week stops progress.'];

function viewCoach() {
  const tab = S.ui.coachTab || 'ask';
  const segs = `<div class="seg" role="tablist">${[['ask', 'Ask'], ['library', 'How it works'], ['protocols', 'Special diets']].map(([k, l]) => `<button role="tab" data-act="coach-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'ask') {
    const sugg = ['Why is my calorie target what it is?', 'I only have 25 minutes today. What should I do?', 'Is my protein high enough?', 'What should I eat for dinner to hit my numbers?', 'My lower back is tight. Adjust today?'];
    body = S.sample ? `<div class="card"><div class="chat" id="chat" aria-live="polite">${S.chat.length ? S.chat.map(m => `<div class="msg ${m.role === 'user' ? 'me' : 'ai'}">${esc(m.content)}${m.loading && !m.content ? '<span class="spinner"></span>' : ''}</div>`).join('') : `<p class="small muted">Ask anything about today's plan, your numbers, or the research. The coach sees your profile, targets, today's plan and the last 7 days.</p><div class="chips" style="margin-top:10px">${sugg.map(s => `<button class="chip" data-act="chat-sugg" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}</div>
      <form class="row" data-form="chat" style="margin-top:12px;flex-wrap:nowrap"><input class="inp" id="chat-in" placeholder="Ask your coach" autocomplete="off"><button class="btn primary" type="submit" ${S.ui.chatBusy ? 'disabled' : ''}>Send</button></form>
      ${S.chat.length ? '<button class="btn sm ghost" style="margin-top:8px" data-act="chat-clear">Clear conversation</button>' : ''}</div>`
      : `<div class="card empty">${ICON.coach}<div>The coach needs Claude access for this page. Allow it from the artifact menu, then reload.</div></div>`;
  } else if (tab === 'library') {
    const groups = [...new Set(PRINCIPLES.map(x => x.g))];
    body = `<div class="grid2"><div class="stack">${groups.map(g => `<div class="card"><div class="eyebrow" style="margin-bottom:10px">${g}</div><div class="stack" style="gap:14px">${PRINCIPLES.filter(x => x.g === g).map(x => `<div><div style="font-weight:600">${esc(x.t)}</div><p class="small muted" style="margin-top:2px">${esc(x.b)}</p></div>`).join('')}</div></div>`).join('')}</div>
      <div class="stack"><div class="card"><div class="eyebrow" style="margin-bottom:10px">Good to know</div><div class="stack" style="gap:12px">${MY_TIPS.map(t => `<div class="tipcard small">${esc(t)}</div>`).join('')}</div></div></div></div>`;
  } else {
    const cur = S.profile.protocol || 'standard';
    body = `<div class="stack">${Object.entries(E.PROTOCOLS).map(([k, pr]) => {
      const elig = k === 'carbcycle' ? E.carbcycleEligible(S.profile) : null;
      const caps = k === 'rapid' ? E.rapidCaps(S.profile) : null;
      return `<div class="card" style="${cur === k ? 'border-color:var(--steel);box-shadow:inset 0 0 0 1px var(--steel)' : ''}"><div class="card-h"><div><div class="eyebrow">${esc(pr.src)}</div><div class="h2" style="margin-top:2px">${esc(pr.name)}</div></div>${cur === k ? '<span class="pill good">Active</span>' : pr.optIn ? '<span class="pill warn">Optional</span>' : ''}</div>
        <p class="small">${esc(pr.blurb)}</p>
        ${caps ? `<p class="small muted" style="margin-top:6px">Your cap at your body-fat category: ${caps.days} days, then a 2-week break. Free meals: ${caps.free}/week. Refeeds: ${esc(caps.refeed)}.</p>` : ''}
        ${elig && !elig.ok ? `<p class="small" style="color:var(--warn);margin-top:6px">Not a fit right now: ${!elig.bfOk ? 'needs body fat at 15% or less (22% for women)' : ''}${!elig.bfOk && !elig.trainOk ? ' and ' : ''}${!elig.trainOk ? '4 lifting days a week' : ''}.</p>` : ''}
        ${pr.conflicts ? `<details class="acc" style="margin-top:8px"><summary class="small">What it trades off ${ICON.chev.replace('<svg', '<svg width="16" height="16"')}</summary><div><ul class="why">${pr.conflicts.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div></details>` : ''}
        ${cur !== k ? `<button class="btn sm ${pr.optIn ? '' : 'primary'}" style="margin-top:10px" data-act="protocol" data-v="${k}" data-armed="${S.ui.protoArm === k ? 1 : 0}" ${elig && !elig.ok ? 'disabled' : ''}>${S.ui.protoArm === k ? 'Tap again to switch' : 'Use this'}</button>` : ''}
      </div>`;
    }).join('')}
    </div>`;
  }
  return `<div class="stack"><div style="padding-top:6px"><div class="eyebrow">Your coach</div><h1 class="h-display h1" style="margin-top:4px">Coach</h1></div>${segs}${body}</div>`;
}

/* ---------------- SETTINGS ---------------- */
function sheetSettings() {
  const p = S.profile, og = p.strength || {};
  return `<div class="grab"></div><div class="stack">
    <div class="h2">Settings</div>
    <div class="card flat"><div class="row between"><div><b>Profile and plan</b><div class="small muted">Redo the questionnaire. Your logs stay.</div></div><button class="btn sm" data-act="ob-edit">Edit</button></div></div>
    ${p.style === 'strength' ? `<div class="card flat stack"><b>Your starting lifts</b><div class="small muted">Enter the weight and reps of a recent hard set for each lift. The app uses it to set your weights for each week.</div>
      ${['squat', 'bench', 'deadlift', 'ohp'].map(l => `<div class="fields" style="grid-template-columns:1fr 1fr 1fr;align-items:end"><label class="f">${E.STRPLAN.lifts[l].name} lb<input class="inp" id="og-${l}-w" data-og="${l}-w" inputmode="decimal" value="${esc(og.sets?.[l]?.w ?? '')}"></label><label class="f">Reps<input class="inp" id="og-${l}-r" data-og="${l}-r" inputmode="numeric" value="${esc(og.sets?.[l]?.r ?? '')}"></label><div class="small" style="padding-bottom:10px">Base <b>${og.tm?.[l] ?? '–'}</b></div></div>`).join('')}
      <button class="btn sm primary" data-act="og-save">Save maxes and start cycle</button></div>` : ''}
    <div class="card flat stack"><b>Wearables</b>
      ${Store.mode === 'api' ? (S.ui.oura?.connected ? `<div class="row between"><div><div style="font-weight:600">Oura ring</div><div class="small muted">Connected. Sleep, readiness, HRV and steps fill in your morning check-in.${S.ui.oura.last ? ' Last sync ' + esc(S.ui.oura.last) + '.' : ''}</div></div><span class="pill good">On</span></div><div class="row"><button class="btn sm" data-act="oura-sync">Sync now</button><button class="btn sm ghost danger" data-act="oura-off">Disconnect</button></div>`
        : `<div class="row between"><div style="min-width:0"><div style="font-weight:600">Oura ring</div><div class="small muted">Your ring's readiness and sleep set the day's plan automatically. Needs an active Oura Membership.</div></div><button class="btn sm primary" data-act="oura-connect">Connect</button></div>`)
        : '<p class="small muted">Wearables connect in the home-screen version of Spotter.</p>'}
      <p class="tiny muted">Ring data is used for readiness and plan adjustments only. It is never sent to the AI coach.</p></div>
    <div class="card flat stack"><b>Look</b><div class="skins">${SKINS.map(s => { const sk = s.k === 'auto' ? resolvedSkin('auto') : s.k; return `<button class="skinp" data-skin="${sk}" data-act="theme" data-v="${s.k}" aria-pressed="${(S.ui.theme || 'auto') === s.k}"><div class="sp-in"><div class="sp-card"><div class="sp-num">2,140</div><div class="sp-dots"><i style="border-color:var(--k)"></i><i style="border-color:var(--p)"></i><i style="border-color:var(--c)"></i><i style="border-color:var(--f)"></i></div><span class="sp-btn">Start</span></div></div><div class="sp-name"><span>${s.name}</span><span style="color:var(--ink3);font-weight:500">${s.note}</span></div></button>`; }).join('')}</div><p class="tiny muted">Your pick follows you to every device.</p></div>
    <div class="card flat stack"><b>Data</b><div class="small muted">${Store.mode === 'db' ? 'Synced to your Claude account, so iPhone and iPad see the same logs.' : Store.mode === 'api' ? 'Synced to your private Spotter account. To use it on another phone or iPad, open Spotter there, choose "I already use Spotter" and paste this sync code. Keep it private: it is the key to your logs.' : 'Saved in this browser only.'}</div>
      ${Store.mode === 'api' ? `<div class="row" style="flex-wrap:nowrap;gap:8px"><input class="inp mono" id="sync-code" readonly value="${esc(Api.token)}"><button class="btn sm" data-act="copy-token">Copy</button></div>` : ''}
      <div class="row">${S.downloads ? '<button class="btn sm" data-act="export">Export JSON</button>' : ''}${Store.mode === 'api' ? '<button class="btn sm ghost" data-act="signout">Sign out on this device</button>' : ''}<button class="btn sm ghost danger" data-act="wipe" data-armed="${S.ui.wipeArm ? 1 : 0}">${S.ui.wipeArm ? 'Tap again to erase everything' : 'Erase all data'}</button></div></div>
    <p class="tiny muted">Food data from USDA FoodData Central. Estimates from photos are estimates.</p>
  </div>`;
}

/* ---------------- EDIT A LOGGED FOOD ---------------- */
function sheetEditFood() {
  const e = S.sheet.edit;
  const q = +e.qty || 1, r = q / (e.baseQty || 1);
  const m = k => Math.round((+e.base[k] || 0) * r);
  const t = today();
  return `<div class="grab"></div><div class="stack">
    <div class="h2">Edit entry</div>
    <label class="f">Name<input class="inp" id="ef-name" value="${esc(e.name)}"></label>
    <div class="f">Meal${`<div class="seg" role="group" aria-label="Meal">${MEALS.map(x => `<button type="button" data-act="ef-meal" data-v="${x}" aria-pressed="${e.meal === x}">${x}</button>`).join('')}</div>`}</div>
    <div class="f">Day<div class="chips">${[[E.addDays(t, -1), 'Yesterday'], [t, 'Today']].map(([dt, l]) => `<button type="button" class="chip" data-act="ef-date" data-v="${dt}" aria-pressed="${e.date === dt}">${l}</button>`).join('')}<input class="inp" type="date" id="ef-date" style="width:auto;min-width:0;padding:6px 10px;font-size:14px" value="${e.date}" max="${t}"></div></div>
    <label class="f">Amount (scales the macros)<div class="stepper" style="max-width:200px"><button type="button" data-act="ef-qty" data-v="-0.25" aria-label="Less">−</button><input id="ef-qty" inputmode="decimal" value="${+q.toFixed(2)}"><button type="button" data-act="ef-qty" data-v="0.25" aria-label="More">+</button></div></label>
    <div class="fields" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:6px">${['kcal', 'protein', 'carbs', 'fat'].map(k => `<label class="f tiny">${k === 'kcal' ? 'kcal' : k[0].toUpperCase() + ' g'}<input class="inp" id="ef-${k}" inputmode="decimal" value="${m(k)}"></label>`).join('')}</div>
    <p class="tiny muted">Change the amount to scale everything, or type exact numbers.</p>
    <div class="row"><button class="btn ghost danger" data-act="ef-del" data-armed="${S.ui.efArm ? 1 : 0}">${S.ui.efArm ? 'Tap again to delete' : 'Delete'}</button><button class="btn" data-act="ef-dup">Log again today</button><button class="btn primary" style="flex:1" data-act="ef-save">Save</button></div>
  </div>`;
}

function sheetSport() {
  const p = S.profile; const mine = (p.sports || []).filter(x => x.k !== 'hotworx').map(x => E.SPORTBYK[x.k]).filter(Boolean);
  const f = S.ui.sp = S.ui.sp || {}; if (!f.k) f.k = (mine[0] || E.SPORTS[1]).k;
  const sp = E.SPORTBYK[f.k]; if (!f.min) f.min = sp.min; if (!f.level) f.level = 'medium';
  const logged = (day(today()).workouts || []).filter(w => w.kind === 'sport');
  const list = mine.length ? mine : E.SPORTS.filter(x => x.k !== 'hotworx');
  return `<div class="grab"></div><div class="stack"><div class="h2">Log a session</div>
    <div class="chips">${list.map(x => `<button class="chip" data-act="sp-set" data-f="k" data-v="${x.k}" aria-pressed="${f.k === x.k}">${esc(x.name)}</button>`).join('')}</div>
    ${q('How long?', '', `<div class="seg">${[30, 45, 60, 90, 120].map(m => `<button type="button" data-act="sp-set" data-f="min" data-v="${m}" aria-pressed="${+f.min === m}">${m} min</button>`).join('')}</div>`)}
    ${q('How hard was it?', 'Hard sessions make the next lifting day a little lighter.', `<div class="seg">${[['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']].map(([k, l]) => `<button type="button" data-act="sp-set" data-f="level" data-v="${k}" aria-pressed="${f.level === k}">${l}</button>`).join('')}</div>`)}
    <button class="btn block primary" data-act="sp-log">Log ${esc(sp.name.toLowerCase())}</button>
    ${logged.length ? `<p class="small">Logged today: ${logged.map(w => esc(w.dayName) + ' ' + w.minutes + ' min').join(', ')}</p>` : ''}
    <p class="tiny muted">Medium and hard sessions count toward your 2 cardio sessions a week.</p></div>`;
}

function sheetHotworx() {
  const today_ = day(today()); const logged = (today_.workouts || []).filter(w => w.hx);
  return `<div class="grab"></div><div class="stack"><div class="h2">Log a HOTWORX session</div>
    <p class="small muted">15-minute HIIT sessions count toward your 2 conditioning sessions a week. 30-minute isometric sessions count as recovery-style work and do not change your lifting plan.</p>
    ${['hiit', 'iso', 'recovery'].map(k => `<div><div class="eyebrow" style="margin:6px 0">${{ hiit: 'HIIT, 15 min', iso: 'Isometric, 30 min', recovery: 'Recovery' }[k]}</div><div class="chips">${E.HOTWORX.filter(x => x.kind === k).map(x => `<button class="chip" data-act="hx-log" data-v="${x.k}">${esc(x.name)}</button>`).join('')}</div></div>`).join('')}
    ${logged.length ? `<p class="small">Logged today: ${logged.map(w => esc(w.dayName)).join(', ')}</p>` : ''}
    <p class="tiny muted">Infrared heat adds sweat loss, not fat loss. Drink 16 to 24 oz of water per session and skip it on days you feel run down.</p></div>`;
}
