/* ============================================================
   EATING OUT (order picker), FRIDGE IDEAS, PROGRESS PHOTOS
   ============================================================ */

/* ---------- what is left today ---------- */
function leftToday() {
  const d = day(today()), tgt = targetFor(today()), tot = E.dayTotals(d.food);
  return { kcal: Math.max(0, Math.round(tgt.kcal - tot.kcal)), protein: Math.max(0, Math.round(tgt.protein - tot.protein)), carbs: Math.max(0, Math.round(tgt.carbs - tot.carbs)), fat: Math.max(0, Math.round(tgt.fat - tot.fat)), target: tgt };
}
function defaultBudget() {
  const l = leftToday(); const cap = Math.round(l.target.kcal * 0.55);
  return Math.max(300, Math.min(l.kcal || cap, cap));
}

/* ---------- restaurant menus (food/menus/<slug>.json) ---------- */
const Menus = {
  async index() { try { return await FoodDB.j('food/menus/index.json'); } catch (e) { return []; } },
  async menu(slug) { const m = await FoodDB.j(`food/menus/${slug}.json`); return m.items.map(r => ({ name: r[0], cat: r[1], serving: r[2], kcal: r[3], protein: r[4], carbs: r[5], fat: r[6], fiber: r[7] })); }
};
const RX = {
  drink: /\b(soda|coke|sprite|pepsi|dr pepper|tea|lemonade|coffee|latte|frappe|shake|smoothie|beer|wine|cocktail|margarita|juice|water|milk|drink|beverage|float|slush)\b/i,
  dessert: /\b(dessert|cookie|brownie|pie|sundae|cake|cheesecake|churro|cobbler|ice cream|pizookie|blondie|donut|cinnamon)\b/i,
  sauce: /\b(sauce|dressing|dip|ranch|salsa|syrup|condiment|seasoning|ketchup|mustard|mayo|gravy|queso dip|honey|butter|vinaigrette|aioli|glaze|rub)\b/i,
  skip: /\b(kid|kids|child|family|party|catering|platter|bucket|tray|gallon|\d{2,} ?(pc|piece|count|ct)\b|share|sharing)\b/i
};
function classify(it) {
  const t = `${it.name} ${it.cat}`;
  if (RX.skip.test(t) || it.kcal > 1800) return 'skip';
  if (RX.drink.test(t) && !/\bchicken|burger|sandwich|bowl|taco\b/i.test(it.name)) return 'drink';
  if (RX.dessert.test(t)) return 'dessert';
  if (RX.sauce.test(t) && it.kcal < 260) return 'sauce';
  if (/(burger|double-double|\bsandwich|bowl|burrito|taco|salad|steak|sirloin|ribeye|filet|chop|wrap|quesadilla|entree|combo|platter|fillet|salmon|pasta|tenders?|strips?|fingers?)\b/i.test(it.name) && it.kcal >= 150) return 'main';
  if (it.kcal >= 250 || it.protein >= 18) return 'main';
  return 'side';
}
/** Best orders for a calorie budget. Tries one main, main + side, and main + side + sauce. Returns three different picks. */
/* Chains where you build your own (bowl, burrito): protein + rice + beans + toppings. */
function buildOwn(items, budget) {
  const cat = re => items.filter(x => re.test(x.cat) && !/kid/i.test(x.cat + x.name) && !/large/i.test(x.name));
  const prot = cat(/^protein$/i), rice = cat(/rice/i), beans = cat(/bean/i);
  if (!prot.length || !rice.length) return null;
  const tops = cat(/salsa|topping|veggie/i).filter(x => x.kcal <= 240 && !/lettuce|salad mix/i.test(x.name));
  const shells = [{ name: 'Bowl', kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, none: true }, ...cat(/tortilla/i).filter(x => /burrito/i.test(x.name))];
  const out = [];
  for (const sh of shells) for (const p of prot) for (const dbl of [1, 2]) for (const r of [null, ...rice]) for (const bn of [null, ...beans]) {
    const base = [sh.none ? null : sh, ...Array(dbl).fill(p), r, bn].filter(Boolean);
    const t0 = base.reduce((m, x) => m + x.kcal, 0); if (t0 > budget) continue;
    for (let i = -1; i < tops.length; i++) for (let j = i + 1; j <= tops.length; j++) {
      const extra = [tops[i], tops[j]].filter(Boolean); const list = base.concat(extra);
      out.push({ items: list, label: `${sh.name}: ${dbl === 2 ? 'double ' : ''}${p.name.toLowerCase()}${r ? ', ' + r.name.replace(/Cilantro-Lime /, '').toLowerCase() : ''}${bn ? ', ' + bn.name.toLowerCase() : ''}${extra.length ? ', ' + extra.map(x => x.name.replace(/ \(.*\)/, '').toLowerCase()).join(', ') : ''}` });
    }
  }
  return out;
}
/* Items sold by the piece (wings, fingers) become 4, 6, 8 or 10 piece orders. */
function piecesExpand(items) {
  const out = [];
  items.forEach(it => {
    if (/^1 (piece|pc|wing|finger|tender|strip|nugget)/i.test(it.serving) && it.kcal < 260) {
      const counts = /wing/i.test(it.name) ? [4, 6, 8, 10] : [2, 3, 4, 5];
      counts.forEach(n => out.push({ ...it, name: `${n} × ${it.name}`, serving: `${n} pieces`, kcal: it.kcal * n, protein: it.protein * n, carbs: it.carbs * n, fat: it.fat * n, fiber: (it.fiber || 0) * n, pieces: n, k: 'main' }));
    } else out.push(it);
  });
  return out;
}
function pickOrders(items, budget, proteinLeft) {
  const own = buildOwn(items, budget);
  if (own) return rankCombos(own.map(c => ({ ...c, ...c.items.reduce((m, x) => ({ kcal: m.kcal + x.kcal, protein: m.protein + x.protein, carbs: m.carbs + x.carbs, fat: m.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }) })).filter(c => c.kcal <= budget && c.kcal >= Math.min(250, budget * 0.4)), budget, proteinLeft);
  items = piecesExpand(items);
  const rows = items.map(it => ({ ...it, k: it.k || classify(it) })).filter(x => x.k !== 'skip' && x.k !== 'drink' && x.k !== 'dessert' && x.kcal > 0);
  const mains = rows.filter(x => x.k === 'main' && x.kcal <= budget);
  const adds = rows.filter(x => (x.k === 'side' || x.k === 'sauce') && x.kcal <= Math.max(120, budget * 0.5));
  const topAdds = [...adds].sort((a, b) => (b.protein + 5) / (b.kcal + 40) - (a.protein + 5) / (a.kcal + 40)).slice(0, 40);
  const combos = [];
  const push = (list) => {
    const t = list.reduce((m, x) => ({ kcal: m.kcal + x.kcal, protein: m.protein + x.protein, carbs: m.carbs + x.carbs, fat: m.fat + x.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    if (t.kcal > budget || t.kcal < Math.min(250, budget * 0.4)) return;
    combos.push({ items: list, ...t });
  };
  mains.forEach(m => {
    push([m]);
    topAdds.forEach((a, i) => { if (a.name === m.name || a.k !== 'side') return; push([m, a]);
      topAdds.forEach(b => { if (b !== a && b.name !== a.name && (b.k === 'sauce' || b.kcal < 120)) push([m, a, b]); });
    });
  });
  return rankCombos(combos, budget, proteinLeft);
}
function rankCombos(combos, budget, proteinLeft) {
  if (!combos.length) return [];
  const pGoal = Math.max(25, Math.min(proteinLeft || 40, 70));
  const balance = c => Math.min(c.protein, pGoal) * 3 + Math.min(c.kcal / budget, 1) * 40 - c.fat * 0.35 - Math.max(0, c.items.length - (c.label ? 5 : 2)) * 6;
  const key = c => c.items.map(x => x.name).sort().join('|');
  const out = [], used = new Set();
  const take = (title, why, sorter, filter = () => true) => {
    const head = x => x.label ? x.label.split(',')[0] : x.items[0].name.replace(/^\d+ × /, '');
    const c = combos.filter(filter).sort(sorter).find(x => !used.has(key(x)) && !out.some(o => head(o) === head(x)));
    if (c) { used.add(key(c)); out.push({ title, why, ...c }); }
  };
  take('Most protein', 'Gets you closest to your protein for the day.', (a, b) => b.protein - a.protein || a.kcal - b.kcal);
  take('Best balance', 'Good protein and enough food to feel full, inside your budget.', (a, b) => balance(b) - balance(a));
  take('Lighter pick', 'Saves calories for later and still has solid protein.', (a, b) => a.kcal - b.kcal, c => c.protein >= Math.min(25, pGoal * 0.6));
  return out;
}

function sheetOrder() {
  const o = S.ui.order = S.ui.order || {};
  const l = leftToday();
  if (o.budget == null) o.budget = defaultBudget();
  const ai = !!S.sample && S.sampleImages;
  let body = '';
  if (!o.index) { Menus.index().then(ix => { o.index = ix; if (S.sheet?.type === 'order') render(); }); body = '<p class="small muted"><span class="spinner"></span> Loading menus</p>'; }
  else if (!o.slug && !o.photo) {
    body = `<div class="chips">${o.index.map(c => `<button class="chip" data-act="order-chain" data-v="${c.slug}">${esc(c.chain)}</button>`).join('')}</div>
      ${ai ? `<div class="divider"></div><p class="small muted">Somewhere else? Take a photo of the menu and get the best picks.</p><label class="btn block" for="or-file" style="margin-top:8px">${ICON.camera} Photo of a menu</label><input id="or-file" type="file" accept="image/*" hidden data-file2="order">` : ''}`;
  } else if (o.busy) body = `<p class="small muted"><span class="spinner"></span> ${o.photo ? 'Reading the menu' : 'Finding the best orders'}</p>`;
  else if (o.err) body = `<p class="small" style="color:var(--bad)">${esc(o.err)}</p><button class="btn sm" data-act="order-back">Back</button>`;
  else {
    const picks = o.picks || [];
    body = `<div class="row between"><b>${esc(o.chain || 'Menu')}</b><button class="btn sm ghost" data-act="order-back">Change</button></div>
      ${picks.length ? picks.map((p, k) => `<div class="card flat stack" style="padding:14px;gap:8px"><div><div class="row between" style="flex-wrap:nowrap"><div class="eyebrow">${esc(p.title)}</div><div class="num" style="font-weight:700;white-space:nowrap">${fmt(p.kcal)} kcal</div></div><div class="row between tiny muted" style="flex-wrap:nowrap;margin-top:2px"><span>${esc(p.why)}</span><span style="white-space:nowrap">P ${fmt(p.protein)} · C ${fmt(p.carbs)} · F ${fmt(p.fat)}</span></div></div>
        ${p.label ? `<div class="small" style="font-weight:600">${esc(p.label[0].toUpperCase() + p.label.slice(1))}</div>` : ''}<ul class="small" style="margin:0;padding-left:18px">${p.items.map(x => `<li>${esc(x.name)}${x.serving && !/^1 (item|ea|each|serving)$/i.test(x.serving) ? ` <span class="muted">(${esc(x.serving)})</span>` : ''}</li>`).join('')}</ul>
        <button class="btn sm primary" data-act="order-log" data-v="${k}">Log this order</button></div>`).join('')
        : `<p class="small muted">Nothing on this menu fits ${fmt(o.budget)} calories. Try a bigger budget.</p>`}
      ${o.items ? `<details class="acc"><summary>Pick items yourself ${ICON.chev.replace('<svg', '<svg width="16" height="16"')}</summary><input class="inp" id="or-q" placeholder="Search this menu" value="${esc(o.q || '')}" data-act-input="order-q" style="margin:8px 0">
        <div class="list">${o.items.filter(x => !o.q || x.name.toLowerCase().includes(o.q.toLowerCase())).slice(0, 40).map((x, k) => `<div class="row between" style="padding:8px 0;flex-wrap:nowrap"><div style="min-width:0"><div class="small" style="font-weight:500">${esc(x.name)}</div><div class="tiny muted">${fmt(x.kcal)} kcal · P ${fmt(x.protein)}</div></div><button class="btn sm" data-act="order-one" data-v="${o.items.indexOf(x)}">Log</button></div>`).join('')}</div></details>` : ''}`;
  }
  return `<div class="grab"></div><div class="stack"><div><div class="eyebrow">Eating out</div><div class="h2">What should I order?</div></div>
    <div class="row" style="flex-wrap:nowrap;gap:10px;align-items:end"><label class="f" style="flex:1">Calories to spend<input class="inp" id="or-budget" inputmode="numeric" type="number" value="${o.budget}"></label><button class="btn sm" data-act="order-budget" style="margin-bottom:4px">Update</button></div>
    <p class="tiny muted" style="margin-top:-6px">You have ${fmt(l.kcal)} calories and ${fmt(l.protein)} g protein left today.</p>
    ${body}</div>`;
}
async function orderRun() {
  const o = S.ui.order; o.busy = true; o.err = null; render();
  try {
    if (!o.items) o.items = await Menus.menu(o.slug);
    o.picks = pickOrders(o.items, +o.budget, leftToday().protein);
  } catch (e) { o.err = 'Could not load that menu. Check your connection and try again.'; }
  o.busy = false; render();
}
async function orderPhoto(file) {
  const o = S.ui.order; o.photo = true; o.busy = true; o.err = null; o.slug = null; o.items = null; render();
  try {
    const img = await shrinkImage(file, 1800); const l = leftToday();
    const r = await S.sample.json(`You help someone order at a restaurant while sticking to their nutrition targets. Read the menu in the photo. If you recognize the restaurant, use its published nutrition; otherwise estimate from typical recipes and portions, rounding kcal to the nearest 10.
They want to spend about ${o.budget} calories and have ${l.protein} g protein left today.
Pick three different orders from this menu: "Best balance" (good protein, filling, within budget), "Most protein" (within budget), "Lighter pick" (well under budget, still decent protein). Each order is one or more menu items, with simple changes if they help (sauce on the side, no cheese).
Return only JSON: {"chain": string, "picks": [{"title": string, "why": string (one plain sentence), "items": [{"name": string, "kcal": number, "protein": number, "carbs": number, "fat": number}]}]}`, { images: [img], modelTier: 'default' });
    o.chain = r.chain || 'This menu';
    o.picks = (r.picks || []).map(p => { const t = (p.items || []).reduce((m, x) => ({ kcal: m.kcal + (+x.kcal || 0), protein: m.protein + (+x.protein || 0), carbs: m.carbs + (+x.carbs || 0), fat: m.fat + (+x.fat || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }); return { title: p.title, why: p.why, items: p.items || [], ...t, est: true }; });
  } catch (e) { o.err = aiError(e); }
  o.busy = false; render();
}
function logOrder(list, chain, est) {
  const meal = defaultMeal();
  list.forEach(x => addFood({ name: `${x.name}${chain ? ' (' + chain + ')' : ''}`, kcal: x.kcal, protein: x.protein, carbs: x.carbs, fat: x.fat, fiber: x.fiber || 0, meal, source: est ? 'describe' : 'restaurant' }));
  toast(`Logged to ${meal}`);
}

/* ---------- fridge ideas ---------- */
function sheetFridge() {
  const f = S.ui.fridge = S.ui.fridge || {};
  const l = leftToday(); const ai = !!S.sample;
  let res = '';
  if (f.busy) res = '<p class="small muted"><span class="spinner"></span> Coming up with meals</p>';
  else if (f.err) res = `<p class="small" style="color:var(--bad)">${esc(f.err)}</p>`;
  else if (f.meals) res = f.meals.map((m, k) => `<div class="card flat stack" style="padding:14px;gap:8px"><div class="row between" style="align-items:flex-start"><div style="min-width:0"><div class="h2" style="font-size:18px">${esc(m.name)}</div><div class="tiny muted">${m.minutes ? m.minutes + ' min · ' : ''}${esc(m.why || '')}</div></div><div class="num" style="text-align:right;font-weight:600;white-space:nowrap">${fmt(m.kcal)} kcal<div class="tiny muted">P ${fmt(m.protein)} · C ${fmt(m.carbs)} · F ${fmt(m.fat)}</div></div></div>
      <ul class="small" style="margin:0;padding-left:18px">${(m.ingredients || []).map(x => `<li>${esc(x.amount ? x.amount + ' ' : '')}${esc(x.name)}</li>`).join('')}</ul>
      ${(m.steps || []).length ? `<details class="acc"><summary>How to make it ${ICON.chev.replace('<svg', '<svg width="16" height="16"')}</summary><ol class="small" style="padding-left:18px">${m.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></details>` : ''}
      <button class="btn sm primary" data-act="fridge-log" data-v="${k}">I made this, log it</button></div>`).join('');
  return `<div class="grab"></div><div class="stack"><div><div class="eyebrow">Fridge</div><div class="h2">What can I make?</div></div>
    ${ai ? `<label class="f">What's in your fridge and pantry?<textarea class="inp" id="fr-text" rows="3" placeholder="e.g. chicken thighs, eggs, rice, spinach, cheddar, tortillas, salsa">${esc(f.text || '')}</textarea></label>
    <div class="row" style="gap:8px;flex-wrap:nowrap"><label class="btn" for="fr-file" style="flex:1">${ICON.camera} ${f.preview ? 'Change photo' : 'Add a fridge photo'}</label><input id="fr-file" type="file" accept="image/*" hidden data-file2="fridge"><button class="btn primary" style="flex:1" data-act="fridge-go" ${f.busy ? 'disabled' : ''}>${ICON.spark} Suggest meals</button></div>
    ${f.preview ? `<img src="${f.preview}" alt="Fridge photo" style="border-radius:12px;max-height:160px;object-fit:cover;width:100%">` : ''}
    <p class="tiny muted">Meals are built to fit your ${fmt(l.kcal)} calories and ${fmt(l.protein)} g protein left today.</p>${res}`
    : '<p class="small muted">Meal ideas use Claude. Allow Claude for this page from the artifact menu to turn them on.</p>'}</div>`;
}
async function fridgeRun() {
  const f = S.ui.fridge; f.text = $('#fr-text')?.value || f.text || '';
  if (!f.text.trim() && !f.image) { f.err = 'Type what you have or add a photo first.'; return render(); }
  f.busy = true; f.err = null; render();
  const l = leftToday(); const p = S.profile;
  try {
    const opts = { modelTier: 'default' }; if (f.image) opts.images = [f.image];
    const r = await S.sample.json(`Suggest 3 simple meals someone can make right now from what they have. Use mostly the listed or pictured foods; assume salt, pepper, oil and common spices are available.
They have about ${l.kcal} calories, ${l.protein} g protein, ${l.carbs} g carbs and ${l.fat} g fat left today${p.dislikes ? `, and avoid: ${p.dislikes}` : ''}. Make at least one meal high in protein. Keep each meal at or under ${Math.max(350, Math.min(l.kcal || 600, Math.round(l.target.kcal * 0.5)))} calories unless the remaining calories are higher and it is their last meal.
Use realistic amounts and USDA-style values. Plain words, short steps.
What they have: ${f.text || '(see photo)'}
Return only JSON: {"meals":[{"name": string, "minutes": number, "why": string (one short sentence), "ingredients":[{"name": string, "amount": string}], "steps":[string], "kcal": number, "protein": number, "carbs": number, "fat": number}]}`, opts);
    f.meals = (r.meals || []).slice(0, 3);
  } catch (e) { f.err = aiError(e); }
  f.busy = false; render();
}

/* ---------- progress photos ---------- */
const Photos = {
  local: !window.SPOTTER_CONFIG?.apiUrl || !!window.claude,
  db() { return this._db || (this._db = new Promise((res, rej) => { const r = indexedDB.open('spotter-photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })); },
  async tx(mode, fn) { const d = await this.db(); return new Promise((res, rej) => { const t = d.transaction('p', mode); const st = t.objectStore('p'); const r = fn(st); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); },
  async list() {
    if (Store.mode === 'api' && !this.local) { const r = await Api.call('photoList'); return r.photos || []; }
    const all = await this.tx('readonly', st => st.getAll()); return (all || []).map(x => ({ id: x.id, date: x.date, pose: x.pose, thumb: x.thumb }));
  },
  async save(date, pose, full, thumb) {
    if (Store.mode === 'api' && !this.local) return Api.call('photoSave', { date, pose, full, thumb }, 90000);
    const id = uid(); await this.tx('readwrite', st => st.put({ id, date, pose, full, thumb })); return { ok: true, id };
  },
  async full(id) {
    const c = (this._full = this._full || {}); if (c[id]) return c[id];
    let b64;
    if (Store.mode === 'api' && !this.local) b64 = (await Api.call('photoGet', { id }, 60000)).full;
    else b64 = (await this.tx('readonly', st => st.get(id)))?.full;
    return (c[id] = 'data:image/jpeg;base64,' + b64);
  },
  async del(id) { if (Store.mode === 'api' && !this.local) return Api.call('photoDelete', { id }); return this.tx('readwrite', st => st.delete(id)); }
};
async function canvasB64(src, max, q) {
  const bmp = src instanceof HTMLVideoElement ? src : await createImageBitmap(src);
  const w = src.videoWidth || bmp.width, h = src.videoHeight || bmp.height;
  const k = Math.min(1, max / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d');
  if (src instanceof HTMLVideoElement && S.ui.cam?.facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q).split(',')[1];
}
function photosCard() {
  const P = S.ui.photos = S.ui.photos || {};
  if (!P.list && !P.loading) { P.loading = true; Photos.list().then(l => { P.list = l.sort((a, b) => a.date < b.date ? -1 : 1); P.loading = false; if (S.view === 'progress') render(); }).catch(() => { P.list = []; P.loading = false; P.err = true; if (S.view === 'progress') render(); }); }
  const list = P.list || [];
  const pose = P.pose || 'front';
  const mine = list.filter(x => x.pose === pose);
  return `<div class="card"><div class="card-h"><div><div class="eyebrow">Progress photos</div><div class="tiny muted" style="margin-top:2px">${Photos.local || Store.mode !== 'api' ? 'Saved on this device only.' : 'Private. Saved to your own Google Drive, never shared.'}</div></div><button class="btn sm primary" data-act="ph-cam">${ICON.photo} Take</button></div>
    <div class="seg" style="margin-bottom:10px">${['front', 'side', 'back'].map(k => `<button data-act="ph-pose" data-v="${k}" aria-pressed="${pose === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
    ${P.loading ? '<p class="small muted"><span class="spinner"></span></p>' : mine.length ? `<div class="ph-strip">${mine.slice().reverse().map(x => `<button class="ph-th" data-act="ph-pick" data-v="${x.id}" aria-pressed="${(P.sel || []).includes(x.id)}"><img src="data:image/jpeg;base64,${x.thumb}" alt="${esc(x.pose)} ${esc(x.date)}"><span>${esc(prettyDate(x.date, { month: 'short', day: 'numeric' }))}</span></button>`).join('')}</div>
      <p class="tiny muted" style="margin-top:8px">${mine.length > 1 ? 'Tap two photos to compare them.' : 'Take another in a week or two to compare.'}</p>${(P.sel || []).length === 2 ? `<button class="btn block" style="margin-top:8px" data-act="ph-compare">Compare</button>` : ''}`
      : `<p class="small muted">No ${pose} photos yet. Same spot, same light, same time of day works best. Spotter shows a faint outline of your last photo so you can match the pose.</p>`}
  </div>`;
}
function sheetCam() {
  const c = S.ui.cam || {};
  return `<div class="grab"></div><div class="stack"><div class="row between"><div><div class="eyebrow">Progress photo</div><div class="h2">${esc((c.pose || 'front')[0].toUpperCase() + (c.pose || 'front').slice(1))}</div></div>${c.ghost ? `<label class="tiny muted" style="display:flex;gap:6px;align-items:center">Outline<input type="range" min="0" max="70" value="${c.op ?? 35}" id="cam-op" style="width:90px"></label>` : ''}</div>
    <div class="cam-box">${c.err ? `<p class="small" style="padding:16px">${esc(c.err)}</p>` : `<video id="cam-v" playsinline autoplay muted style="${c.facing === 'user' ? 'transform:scaleX(-1)' : ''}"></video>${c.ghost ? `<img id="cam-g" class="cam-ghost" src="${c.ghost}" alt="" style="opacity:${(c.op ?? 35) / 100}">` : ''}`}</div>
    ${c.saving ? '<p class="small muted"><span class="spinner"></span> Saving</p>' : `<div class="row" style="gap:8px;flex-wrap:nowrap"><button class="btn" data-act="cam-flip" style="flex:1">Flip camera</button><button class="btn primary" data-act="cam-shot" style="flex:1" ${c.err ? 'disabled' : ''}>${ICON.photo} Take photo</button></div>
    <label class="btn block ghost" for="cam-file">Or choose from your photos</label><input id="cam-file" type="file" accept="image/*" hidden data-file2="photo">`}
    <p class="tiny muted">Tip: prop the phone at chest height, step back until your whole body fits, and line up with the outline.</p></div>`;
}
async function camStart() {
  const c = S.ui.cam; stopCam();
  try {
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: c.facing || 'user', width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false });
    c.stream = st; const v = $('#cam-v'); if (v) { v.srcObject = st; await v.play().catch(() => {}); }
  } catch (e) { c.err = 'Camera is not available here. Use "choose from your photos" instead.'; render(); }
}
function stopCam() { const c = S.ui.cam; if (c?.stream) { c.stream.getTracks().forEach(t => t.stop()); c.stream = null; } }
async function camSave(src) {
  const c = S.ui.cam; c.saving = true; render();
  try {
    const full = await canvasB64(src, 1400, 0.82), thumb = await canvasB64(src, 220, 0.6);
    await Photos.save(today(), c.pose || 'front', full, thumb);
    stopCam(); S.ui.photos = { pose: c.pose }; S.ui.cam = null; closeSheet(); toast('Photo saved');
  } catch (e) { c.saving = false; c.err = 'Could not save the photo. ' + (e?.message || ''); render(); }
}
function sheetCompare() {
  const P = S.ui.photos, [a, b] = P.cmp || [];
  return `<div class="grab"></div><div class="stack"><div class="eyebrow">Compare</div>
    ${!a || !b ? '<p class="small muted"><span class="spinner"></span> Loading</p>' : `<div class="cmp" style="--x:${P.x ?? 50}%"><img src="${a.src}" alt="Earlier"><div class="cmp-top"><img src="${b.src}" alt="Later"></div><div class="cmp-line"></div></div>
    <input type="range" min="0" max="100" value="${P.x ?? 50}" id="cmp-x" aria-label="Slide to compare" style="width:100%">
    <div class="row between tiny muted"><span>${esc(prettyDate(a.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span><span>${esc(prettyDate(b.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span></div>
    <div class="row" style="gap:8px"><button class="btn sm ghost danger" data-act="ph-del" data-v="${b.id}">Delete later photo</button></div>`}</div>`;
}
