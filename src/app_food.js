/* ============================================================
   FOOD DATABASE + NATURAL-LANGUAGE LOGGING + RECIPES
   USDA FoodData Central (Branded, April 2026) shipped as data files next to the page:
     food/bmeta.json, food/bi/<shard>.json (items), food/bt/<bucket>.json (search), food/bu/<nn>.json (barcodes)
   Optional generic set (Foundation / SR Legacy / FNDDS): food/gmeta.json, food/gi, food/gt
   Item row: [name, brand, upc, servingQty, servingUnit(g|ml), householdText, kcal, protein, carbs, fat, fiber, category]  (per serving)
   ============================================================ */
const FoodDB = {
  cache: new Map(), meta: {},
  async j(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    const p = fetch(path).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    this.cache.set(path, p);
    try { return await p; } catch (e) { this.cache.delete(path); throw e; }
  },
  async metaFor(db) { if (!(db in this.meta)) { try { this.meta[db] = await this.j(`food/${db}meta.json`); } catch (e) { this.meta[db] = null; } } return this.meta[db]; },
  toks(s) {
    const STOP = new Set('and with the of in for a an or to on by from no not oz fl lb g ml pack ct count size per each'.split(' '));
    const out = new Set();
    (String(s).toLowerCase().replace(/'/g, '').match(/[a-z0-9]+/g) || []).forEach(w => {
      if (w.length < 2 || STOP.has(w) || (/^\d+$/.test(w) && w.length > 3)) return;
      if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
      out.add(w);
    });
    return [...out];
  },
  crc(str) { let c, crc = 0 ^ (-1); for (let i = 0; i < str.length; i++) { c = (crc ^ str.charCodeAt(i)) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ (-1)) >>> 0; },
  row(db, id, r) { return { db, id, name: r[0], brand: r[1], upc: r[2], sq: r[3], su: r[4], hh: r[5], kcal: r[6], protein: r[7], carbs: r[8], fat: r[9], fiber: r[10], cat: r[11], ports: r[12] || null }; },
  async item(db, id) { const m = await this.metaFor(db); const sh = await this.j(`food/${db}i/${Math.floor(id / m.shard)}.json`); return this.row(db, id, sh[id % m.shard]); },
  /** Search one database. Returns up to `limit` rows ranked by matched tokens, brand hits, then shorter names. */
  async searchDb(db, query, brand, limit = 8) {
    const m = await this.metaFor(db); if (!m) return [];
    const qt = this.toks(query), bt = this.toks(brand || '');
    const all = [...new Set([...qt, ...bt])]; if (!all.length) return [];
    const lists = await Promise.all(all.map(async t => {
      const b = await this.j(`food/${db}t/${this.crc(t) % m.tb}.json`); const d = b[t]; if (!d) return [t, []];
      const ids = []; let acc = 0; d.forEach((x, i) => { acc = i ? acc + x : x; ids.push(acc); }); return [t, ids];
    }));
    const score = new Map();
    lists.forEach(([t, ids]) => { const w = bt.includes(t) ? 2 : 1; ids.forEach(id => score.set(id, (score.get(id) || 0) + w)); });
    const need = qt.length + bt.length * 2;
    let cands = [...score.entries()].filter(([, s]) => s >= Math.max(1, need - (need > 3 ? 2 : 1))).sort((a, b) => b[1] - a[1]).slice(0, 120);
    if (!cands.length) return [];
    // fetch at most 4 shards, the ones holding the best candidates
    const byShard = new Map(); cands.forEach(([id, s]) => { const k = Math.floor(id / m.shard); byShard.set(k, (byShard.get(k) || 0) + s); });
    const shards = [...byShard.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
    const loaded = {}; await Promise.all(shards.map(async k => loaded[k] = await this.j(`food/${db}i/${k}.json`)));
    const rows = cands.filter(([id]) => loaded[Math.floor(id / m.shard)]).map(([id, s]) => ({ ...this.row(db, id, loaded[Math.floor(id / m.shard)][id % m.shard]), score: s }));
    const qset = new Set(qt);
    const ODD = this.oddT || (this.oddT = this.toks('breaded battered coated fried glutinous ingredient microwaved canned frozen dehydrated dried baby infant imitation tender nugget patty restaurant fast reduced substitute mix powder dry unprepared butter margarine sauce gravy oil')); 
    rows.forEach(r => { const nt = this.toks(r.name); r.score += nt.filter(t => qset.has(t)).length * 0.3 - Math.max(0, nt.length - qt.length) * 0.06 - nt.filter(t => ODD.includes(t) && !qset.has(t)).length * 0.5 + (/skin not eaten|meat only/i.test(r.name) ? 0.2 : 0); });
    return rows.sort((a, b) => b.score - a.score).slice(0, limit);
  },
  async search(query, brand, limit = 8, restaurant = false) {
    const hasG = !!(await this.metaFor('g')), hasR = !!(await this.metaFor('r'));
    if (restaurant && hasR) { const r = await this.searchDb('r', query, brand, limit); if (r.length) return r.map(x => ({ ...x, score: x.score + 1 })); }
    const [g, b, r] = await Promise.all([hasG && !brand ? this.searchDb('g', query, '', limit) : [], this.searchDb('b', query, brand, limit), hasR ? this.searchDb('r', query, brand, limit) : []]);
    if (brand && r.length && r[0].score >= 2) return [...r.map(x => ({ ...x, score: x.score + 1 })), ...b].sort((x, y) => y.score - x.score).slice(0, Math.max(limit, 8));
    // generic rows get a small edge so plain foods (eggs, rice) beat a random brand; brand words in the query still win
    return [...g.map(x => ({ ...x, score: x.score + 0.4 })), ...r.map(x => ({ ...x, score: x.score + 0.2 })), ...b].sort((x, y) => y.score - x.score).slice(0, Math.max(limit, 8));
  },
  async byUpc(code) {
    const c = String(code).replace(/\D/g, '').replace(/^0+/, ''); if (c.length < 6) return null;
    try { const b = await this.j(`food/bu/${+c.slice(-2)}.json`); const id = b[c]; return id == null ? null : await this.item('b', id); } catch (e) { return null; }
  }
};

/* ---------- unit math ---------- */
const UNIT_G = { g: 1, gram: 1, grams: 1, kg: 1000, oz: 28.35, ounce: 28.35, lb: 453.6, pound: 453.6, ml: 1, floz: 29.57, l: 1000, cup: 240, tbsp: 15, tsp: 5 };
const COUNT_UNITS = ['serving', 'servings', 'bottle', 'can', 'bar', 'scoop', 'piece', 'packet', 'pouch', 'container', 'cup_container', 'bag', 'each', 'whole', 'large', 'medium', 'small', 'slice', 'stick', 'egg', 'item'];
/** How many label servings a parsed amount equals for a database row. */
const PORT_WORDS = { cup: /\bcups?\b/, tbsp: /\b(tbsp|tablespoons?)\b/, tsp: /\b(tsp|teaspoons?)\b/, slice: /\bslices?\b/, large: /\blarge\b/, medium: /\bmedium\b/, small: /\bsmall\b/, piece: /\b(pieces?|each|whole|item)\b/ };
function portionGrams(row, unit) {
  if (!row.ports) return null;
  const re = PORT_WORDS[unit] || (COUNT_UNITS.includes(unit) ? new RegExp('\\b' + unit + 's?\\b') : null);
  const hits = re ? row.ports.filter(([l]) => re.test(l.toLowerCase())) : [];
  let p = hits.find(([l]) => /medium|regular/.test(l.toLowerCase())) || hits[0] || null;
  if (!p && ['piece', 'each', 'whole', 'item', 'serving'].includes(unit)) p = row.ports.find(([l]) => !/cup|tbsp|tablespoon|tsp|teaspoon|oz|ounce|gram/.test(l.toLowerCase()));
  if (!p) return null;
  const n = parseFloat(p[0]) || 1;
  return p[1] / n;
}
function servingsFor(row, it) {
  const u = String(it.unit || '').toLowerCase().replace(/\.$/, '');
  const sq = +row.sq || 0;
  if (row.ports && sq) {
    if (['g', 'gram', 'grams', 'kg', 'oz', 'ounce', 'lb', 'pound', 'ml', 'floz', 'l'].includes(u)) return +((it.qty || 1) * UNIT_G[u] / sq).toFixed(2);
    const pg = portionGrams(row, u);
    // trust the USDA portion unless it disagrees wildly with Claude's own gram estimate
    if (pg && !(it.grams && (pg * (it.qty || 1) > it.grams * 2.5 || pg * (it.qty || 1) < it.grams / 2.5))) return +((it.qty || 1) * pg / sq).toFixed(2);
    if (it.grams) return +(it.grams / sq).toFixed(2);
  }
  if (UNIT_G[u] && sq) {
    if (['cup', 'tbsp', 'tsp'].includes(u)) {   // volume: use the label's household text when it names the same unit
      const hh = String(row.hh || '').toLowerCase(); const m = hh.match(/([\d.\/]+)\s*(cup|tbsp|tablespoon|tsp|teaspoon)/);
      if (m) { const q = m[1].includes('/') ? m[1].split('/').reduce((a, b) => a / b) : +m[1]; const hu = m[2].startsWith('cup') ? 'cup' : m[2].startsWith('tb') || m[2].startsWith('tablespoon') ? 'tbsp' : 'tsp'; if (hu === u && q > 0) return +(it.qty / q).toFixed(2); }
      if (it.grams && sq) return +(it.grams / sq).toFixed(2);
    }
    return +((it.qty || 1) * UNIT_G[u] / sq).toFixed(2);
  }
  if (COUNT_UNITS.includes(u) || !u) return +(it.qty || 1).toFixed(2);
  if (it.grams && sq) return +(it.grams / sq).toFixed(2);
  return +(it.qty || 1).toFixed(2);
}
/* Restaurant rows are one menu item each. A count like "10 chips" or "1.5 scoops" is converted with
   the gram estimate (or, failing that, Claude's calorie estimate) instead of being read as 10 orders. */
function restServings(row, it) {
  const u = String(it.unit || '').toLowerCase(), q = +it.qty || 1;
  const hh = String(row.hh || '').toLowerCase();
  const sameUnit = (u === 'serving' || u === 'scoop' || u === '' || hh.includes(u.replace(/s$/, ''))) ;
  let s = null;
  if (sameUnit && q <= 4) s = q;
  else if (it.grams && +row.sq > 0 && row.su === 'g') s = it.grams / +row.sq;
  else if (it.est?.kcal && row.kcal > 0) s = +it.est.kcal / row.kcal;
  else s = q;
  return Math.max(0.05, +(Math.round(s * 20) / 20).toFixed(2));
}
function scaleRow(row, servings) { return { kcal: row.kcal * servings, protein: row.protein * servings, carbs: row.carbs * servings, fat: row.fat * servings, fiber: (row.fiber || 0) * servings }; }
function titleCase(s) { return String(s || '').toLowerCase().replace(/\b([a-z])/g, c => c.toUpperCase()).replace(/\s+/g, ' ').trim(); }
function rowLabel(r) { const n = [...new Set(titleCase(r.name).replace(/,\s*$/, '').split(/,\s*/))].join(', '); return r.brand && !n.toLowerCase().includes(r.brand.toLowerCase()) ? `${titleCase(r.brand)} ${n}` : n; }
function servingText(r) { return r.hh ? `${r.hh}${r.sq ? ` (${Math.round(r.sq)} ${r.su})` : ''}` : r.sq ? `${Math.round(r.sq)} ${r.su}` : '1 serving'; }

/* ---------- local matching against saved foods, meals and recipes (no Claude) ---------- */
function parseAmountPrefix(s) {
  const m = s.trim().match(/^(\d+(?:\.\d+)?|\d+\/\d+|half|a|an|one|two|three)\s*(g|grams?|oz|servings?|bowls?|plates?|portions?|cups?|x)?\s*(?:of\s+)?(.*)$/i);
  if (!m) return { qty: 1, unit: '', name: s.trim() };
  const w = { half: 0.5, a: 1, an: 1, one: 1, two: 2, three: 3 };
  const q = w[m[1].toLowerCase()] ?? (m[1].includes('/') ? m[1].split('/').reduce((a, b) => a / b) : +m[1]);
  return { qty: q, unit: (m[2] || '').toLowerCase(), name: m[3].trim() };
}
function localMatch(text) {
  const parts = text.split(/\s*(?:,|\+|\band\b|\n)\s*/i).filter(Boolean);
  const lib = S.lib; const out = [];
  for (const p of parts) {
    const a = parseAmountPrefix(p); const nm = a.name.toLowerCase().replace(/^(my|the)\s+/, '');
    const rec = (lib.recipes || []).find(r => r.name.toLowerCase() === nm || nm === r.name.toLowerCase() + 's');
    if (rec) {
      const servings = (a.unit === 'g' || a.unit === 'gram' || a.unit === 'grams') && rec.totalGrams ? a.qty / rec.totalGrams * rec.servings : a.unit === 'oz' && rec.totalGrams ? a.qty * 28.35 / rec.totalGrams * rec.servings : a.qty;
      out.push({ text: p, kind: 'recipe', name: rec.name, servings: +servings.toFixed(2), per: rec.perServing, unitLabel: rec.servingName || 'serving' }); continue;
    }
    const meal = (lib.meals || []).find(r => r.name.toLowerCase() === nm);
    if (meal) { out.push({ text: p, kind: 'meal', name: meal.name, servings: a.qty, per: meal.total, unitLabel: 'meal' }); continue; }
    const fav = (lib.recent || []).find(r => r.name.toLowerCase() === nm);
    if (fav && a.unit === '') { out.push({ text: p, kind: 'saved', name: fav.name, servings: a.qty, per: fav, unitLabel: 'serving' }); continue; }
    return null;   // anything unmatched sends the whole line to Claude
  }
  return out.length ? out : null;
}

/* ---------- Claude parse: splits the line, the page does the lookups and the math ---------- */
async function aiParseFood(text) {
  const prompt = `Split this food log into separate foods for a US nutrition database lookup.
For each food return:
- "text": the phrase it came from
- "query": 2 to 5 plain search words a USDA database would use (e.g. "chicken breast cooked", "white rice cooked", "egg whole scrambled")
- "brand": the brand or chain if named, else ""
- "qty": the number eaten, "unit": one of g, oz, lb, ml, floz, cup, tbsp, tsp, serving, bottle, can, bar, scoop, piece, slice, large, medium, small
- "grams": your best estimate of the total grams (or ml) eaten
- "est": your own estimate for the whole amount {"kcal","protein","carbs","fat","fiber"} as whole numbers, used only if the database has no match
- Count exactly what the user said. "10 chips" is ten individual chips (about 35 g), not ten bags; "6 fries" is six fries; "3 wings" is three wings. Only count orders when they say bag, order, side, box or a size.
- Build-your-own chains (Chipotle, Qdoba, Cava, Subway): list each component separately (rice, each protein, beans, each salsa, cheese, queso) with the chain as brand; a "scoop" is one standard serving, so "1.5 scoops rice" is qty 1.5, unit "scoop". Mild salsa is fresh tomato salsa, medium is tomatillo-green chili, hot is tomatillo-red chili.
- "restaurant": true for restaurant or fast-food items; then "brand" is the chain (e.g. "Chick-fil-A") and "query" is the menu item's name as the chain lists it, with size (e.g. "spicy chicken sandwich", "waffle potato fries medium")
- Split restaurant meals into the separately listed menu items (sandwich, fries, drink, sauce)
Count cooking fat (butter, oil) as its own item when the user mentions it.
Keep it compact: no extra fields, no explanations. Return only JSON: {"items":[...]}

Food log: ${text}`;
  try { return await S.sample.json(prompt, { modelTier: 'quick' }); }
  catch (e) {
    if (e?.code !== 'invalid_json') throw e;
    // long meals can run past the reply limit: ask again for a leaner answer on the stronger model
    return await S.sample.json(prompt.replace('- "text": the phrase it came from\n', '') + '\nUse short query strings and leave out "text".', { modelTier: 'default' });
  }
}

/** Resolve parsed items against the database. Branded items need the brand; generic items prefer the generic set. */
async function resolveItems(parsed) {
  const hasG = !!(await FoodDB.metaFor('g'));
  return await Promise.all((parsed.items || []).map(async it => {
    const res = { text: it.text, query: it.query, brand: it.brand || '', qty: +it.qty || 1, unit: it.unit || '', grams: +it.grams || null, est: it.est || null, restaurant: !!it.restaurant, cands: [], pick: -1 };
    try { res.cands = await FoodDB.search(it.query, it.brand, 8, !!it.restaurant); } catch (e) { res.cands = []; }
    if (it.restaurant) {
      // chain items: use the chain's published numbers when the chain matches, else Claude's estimate
      const bt = FoodDB.toks(it.brand || '');
      const okc = c => c.db === 'r' && bt.length && bt.every(t => FoodDB.toks(c.brand).includes(t));
      const kidsAsked = /\bkid/i.test(it.query + ' ' + (it.text || ''));
      let k = res.cands.findIndex(c => okc(c) && (kidsAsked || !/\bkid/i.test(c.name)));
      if (k < 0) k = res.cands.findIndex(okc);
      res.pick = k;
    } else {
      const ok = res.cands.findIndex(c => (it.brand ? true : c.db === 'g'));
      res.pick = it.brand ? (res.cands.length ? 0 : -1) : (hasG && ok >= 0 ? ok : -1);
    }
    res.servings = res.pick >= 0 ? (res.restaurant && res.cands[res.pick].db === 'r' ? restServings(res.cands[res.pick], res) : servingsFor(res.cands[res.pick], res)) : 1;
    return res;
  }));
}
function itemMacros(it) {
  if (it.kind) return scaleRow(it.per, it.servings);
  if (it.pick >= 0) return scaleRow(it.cands[it.pick], it.servings);
  const e = it.est || {}; const m = it.estMult ?? 1;
  return { kcal: (+e.kcal || 0) * m, protein: (+e.protein || 0) * m, carbs: (+e.carbs || 0) * m, fat: (+e.fat || 0) * m, fiber: (+e.fiber || 0) * m };
}
function itemName(it) { return it.kind ? it.name : it.pick >= 0 ? rowLabel(it.cands[it.pick]) : titleCase(it.text); }

/* ---------- flows ---------- */
async function startLog(text) {
  text = (text || '').trim(); if (!text) return;
  const local = localMatch(text);
  S.sheet = { type: 'food', food: { kind: 'log', stage: 'resolve', text, meal: S.foodDate === today() ? defaultMeal() : 'Snacks', items: local || [], busy: !local, local: !!local } };
  render();
  if (local) return;
  if (!S.sample) { S.sheet.food.busy = false; S.sheet.food.err = 'Typed logging needs Claude for anything not already saved. Allow Claude for this page from the artifact menu.'; return render(); }
  try {
    const parsed = await aiParseFood(text);
    S.sheet.food.items = await resolveItems(parsed);
    if (!S.sheet.food.items.length) throw { code: 'invalid_json' };
  } catch (e) { S.sheet.food.err = e?.message && !e.code ? 'The food database did not load. Check your connection and try again.' : aiError(e); }
  S.sheet.food.busy = false; render();
}

function saveLogged() {
  const f = S.sheet.food;
  f.items.forEach(it => {
    const m = itemMacros(it);
    const amount = it.kind ? `${fmt(it.servings, it.servings % 1 ? 2 : 0)} ${it.unitLabel}` : it.pick >= 0 ? `${fmt(it.servings, it.servings % 1 ? 2 : 0)} × ${servingText(it.cands[it.pick])}` : '';
    addFood({ name: itemName(it) + (amount ? ` (${amount})` : ''), ...m, meal: f.meal, source: it.kind ? it.kind : it.pick >= 0 ? 'usda' : 'describe' });
    if (it.pick >= 0) rememberFood(it.cands[it.pick]);
  });
  if (f.recipe) saveRecipeFrom(f);
  S.sheet = null; toast(f.recipe ? 'Recipe saved' : 'Logged'); render();
}

function rememberFood(row) {
  S.lib.myfoods = (S.lib.myfoods || []).filter(x => !(x.name === row.name && x.brand === row.brand));
  S.lib.myfoods.unshift({ ...row }); S.lib.myfoods = S.lib.myfoods.slice(0, 200); saveLib();
}

/* ---------- recipes ---------- */
async function startRecipe(name, text, servings, totalGrams, servingName) {
  if (!name || !text) return;
  S.sheet = { type: 'food', food: { kind: 'log', stage: 'resolve', recipe: { name, servings: +servings || 1, totalGrams: +totalGrams || null, servingName: servingName || 'serving' }, text, items: [], busy: true } };
  render();
  if (!S.sample) { S.sheet.food.busy = false; S.sheet.food.err = 'Building a recipe needs Claude. Allow Claude for this page from the artifact menu.'; return render(); }
  try { S.sheet.food.items = await resolveItems(await aiParseFood(text)); } catch (e) { S.sheet.food.err = aiError(e); }
  S.sheet.food.busy = false; render();
}
function recipeTotals(items) { return items.reduce((t, it) => { const m = itemMacros(it); Object.keys(t).forEach(k => t[k] += m[k] || 0); return t; }, { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }); }
function saveRecipeFrom(f) {
  const tot = recipeTotals(f.items), n = f.recipe.servings || 1;
  const per = Object.fromEntries(Object.entries(tot).map(([k, v]) => [k, Math.round(v / n * 10) / 10]));
  const rec = { id: uid(), name: f.recipe.name.trim(), servings: n, totalGrams: f.recipe.totalGrams, servingName: f.recipe.servingName, perServing: per, total: tot, ingredients: f.items.map(it => ({ name: itemName(it), servings: it.servings })), text: f.text, created: today() };
  S.lib.recipes = (S.lib.recipes || []).filter(r => r.name.toLowerCase() !== rec.name.toLowerCase()).concat(rec);
  saveLib();
}
function saveMealFromDay(meal) {
  const items = day(S.foodDate).food.filter(x => (x.meal || 'Snacks') === meal); if (!items.length) return;
  const name = (S.ui.mealName || '').trim() || `My ${meal.toLowerCase()}`;
  const total = E.dayTotals(items);
  S.lib.meals = (S.lib.meals || []).filter(m => m.name.toLowerCase() !== name.toLowerCase()).concat({ id: uid(), name, total, items: items.map(i => i.name) });
  saveLib(); toast(`Saved "${name}". Type it next time to log it in one step.`);
}

/* ---------- views ---------- */
function logBox() {
  return `<form class="card" data-form="log"><div class="eyebrow" style="margin-bottom:8px">What did you eat?</div>
    <div class="row" style="flex-wrap:nowrap;gap:8px"><textarea class="inp" id="log-in" rows="2" style="min-height:52px" placeholder="3 eggs scrambled in 1 tsp butter, 2 slices sourdough, Fairlife chocolate shake"></textarea><button class="btn primary" type="submit" aria-label="Log it">Log</button></div>
    <p class="tiny muted" style="margin-top:8px">Type or tap the keyboard mic. Saved recipes and meals ("1.5 bowls chili", "my breakfast") log instantly without Claude.</p></form>`;
}

function sheetLog() {
  const f = S.sheet.food;
  const isRec = !!f.recipe;
  if (f.busy) return `<div class="grab"></div><div class="stack"><div class="h2">${isRec ? 'Building ' + esc(f.recipe.name) : 'Looking it up'}</div><p class="small muted">"${esc(f.text)}"</p><div class="row muted small"><span class="spinner"></span> Splitting it into foods and checking the USDA database…</div></div>`;
  if (f.err) return `<div class="grab"></div><div class="stack"><div class="h2">Could not log that</div><p class="small" style="color:var(--bad)">${esc(f.err)}</p><button class="btn" data-act="sheet-close">Close</button></div>`;
  const tot = recipeTotals(f.items);
  const n = isRec ? (f.recipe.servings || 1) : 1;
  return `<div class="grab"></div><div class="stack">
    <div class="row between"><div class="h2">${isRec ? esc(f.recipe.name) : 'Check and log'}</div>${f.local ? '<span class="pill good">From your saved foods</span>' : '<span class="pill">USDA + estimates</span>'}</div>
    <div class="list">${f.items.map((it, k) => {
      const m = itemMacros(it);
      const src = it.kind ? `<span class="pill good">Saved ${it.kind}</span>` : it.pick >= 0 ? `<span class="pill blue">${{ g: 'USDA', b: 'USDA label', r: 'Chain menu' }[it.cands[it.pick].db]}</span>` : `<span class="pill warn">Estimate</span>`;
      const amountCtl = it.kind || it.pick >= 0
        ? `<div class="row" style="gap:6px;flex-wrap:nowrap"><div class="stepper" style="max-width:150px"><button type="button" data-act="lg-step" data-k="${k}" data-v="-0.25" aria-label="Less">−</button><input id="lg-s-${k}" data-lg="servings" data-k="${k}" inputmode="decimal" value="${+it.servings.toFixed(2)}"><button type="button" data-act="lg-step" data-k="${k}" data-v="0.25" aria-label="More">+</button></div><span class="tiny muted" style="min-width:0">× ${esc(it.kind ? it.unitLabel : servingText(it.cands[it.pick]))}</span></div>`
        : `<div class="tiny muted">${it.grams ? 'About ' + Math.round(it.grams) + ' g, ' : ''}${it.restaurant ? 'restaurant item, ' : ''}Claude's estimate</div>`;
      return `<div style="padding:11px 0" class="stack">
        <div class="row between" style="flex-wrap:nowrap;gap:8px;align-items:flex-start"><div style="min-width:0"><div style="font-weight:600">${esc(itemName(it))}</div><div class="tiny muted">"${esc(it.text)}"</div></div><div style="text-align:right;flex:none"><div class="num" style="font-family:var(--display);font-weight:700;font-size:18px">${fmt(m.kcal)}</div><div class="tiny"><span class="mp">P${fmt(m.protein)}</span> <span class="mc">C${fmt(m.carbs)}</span> <span class="mf">F${fmt(m.fat)}</span></div></div></div>
        <div class="row between" style="gap:8px">${amountCtl}<div class="row" style="gap:6px">${src}${!it.kind && it.cands?.length ? `<button class="btn sm ghost" data-act="lg-alt" data-k="${k}">${S.ui.altOpen === k ? 'Hide' : 'Change'}</button>` : ''}<button class="iconbtn" style="width:32px;height:32px" data-act="lg-del" data-k="${k}" aria-label="Remove">${ICON.trash}</button></div></div>
        ${S.ui.altOpen === k ? `<div class="list" style="border:1px solid var(--line);border-radius:10px;padding:0 10px">${it.est ? `<button class="row between" style="width:100%;border:0;background:none;padding:9px 0;text-align:left;flex-wrap:nowrap" data-act="lg-pick" data-k="${k}" data-v="-1"><span><b style="font-weight:500">Claude's estimate</b><div class="tiny muted">${it.grams ? Math.round(it.grams) + ' g' : ''}</div></span><span class="num small">${fmt(it.est.kcal)} kcal</span></button>` : ''}${it.cands.map((c, ci) => `<button class="row between" style="width:100%;border:0;background:none;padding:9px 0;text-align:left;flex-wrap:nowrap;gap:8px" data-act="lg-pick" data-k="${k}" data-v="${ci}" aria-pressed="${it.pick === ci}"><span style="min-width:0"><b style="font-weight:500">${esc(rowLabel(c))}</b><div class="tiny muted">${esc(servingText(c))} · P${fmt(c.protein)} C${fmt(c.carbs)} F${fmt(c.fat)}</div></span><span class="num small" style="flex:none">${fmt(c.kcal)} kcal</span></button>`).join('')}</div>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="tiles"><div class="tile"><div class="k">${isRec ? 'Per ' + esc(f.recipe.servingName) : 'Total'} kcal</div><div class="v mk">${fmt(tot.kcal / n)}</div></div><div class="tile"><div class="k">Protein</div><div class="v mp">${fmt(tot.protein / n)}</div></div><div class="tile"><div class="k">Carbs</div><div class="v mc">${fmt(tot.carbs / n)}</div></div><div class="tile"><div class="k">Fat</div><div class="v mf">${fmt(tot.fat / n)}</div></div></div>
    ${isRec ? `<p class="small muted">Whole batch: ${fmt(tot.kcal)} kcal over ${n} ${esc(f.recipe.servingName)}${n === 1 ? '' : 's'}${f.recipe.totalGrams ? `, ${fmt(f.recipe.totalGrams)} g cooked (${fmt(tot.kcal / f.recipe.totalGrams * 100)} kcal per 100 g)` : ''}. Saving does not log it; type "1 ${esc(f.recipe.servingName)} ${esc(f.recipe.name)}" when you eat it.</p>` : mealSeg(f.meal)}
    <div class="row"><button class="btn" data-act="sheet-close">Cancel</button><button class="btn primary" style="flex:1" data-act="lg-save" ${f.items.length ? '' : 'disabled'}>${isRec ? 'Save recipe' : 'Log to ' + esc(f.meal)}</button></div>
  </div>`;
}

function sheetRecipes() {
  const rs = S.lib.recipes || [], ms = S.lib.meals || [];
  return `<div class="grab"></div><div class="stack">
    <div class="h2">Recipes and saved meals</div>
    <form class="card flat stack" data-form="recipe">
      <b>New recipe</b>
      <label class="f">Name<input class="inp" id="rc-name" placeholder="Chili"></label>
      <label class="f">Everything that went in<textarea class="inp" id="rc-text" placeholder="2 lb 93/7 ground beef, 2 cans black beans drained, 1 can diced tomatoes, 1 yellow onion, 2 tbsp olive oil, chili seasoning packet"></textarea></label>
      <div class="fields"><label class="f">Makes (servings)<input class="inp" id="rc-serv" inputmode="decimal" value="6"></label><label class="f">Serving called<input class="inp" id="rc-sname" value="bowl"></label><label class="f">Cooked weight g (optional)<input class="inp" id="rc-grams" inputmode="decimal" placeholder="lets you log by grams"></label></div>
      <button class="btn primary" type="submit">Build recipe</button>
    </form>
    ${rs.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Your recipes</div><div class="list">${rs.map(r => `<div class="row between" style="padding:9px 0;flex-wrap:nowrap"><div style="min-width:0"><b style="font-weight:600">${esc(r.name)}</b><div class="tiny muted">Per ${esc(r.servingName)}: ${fmt(r.perServing.kcal)} kcal · P${fmt(r.perServing.protein)} C${fmt(r.perServing.carbs)} F${fmt(r.perServing.fat)} · makes ${r.servings}</div></div><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-act="rc-log" data-v="${r.id}">Log 1</button><button class="iconbtn" style="width:32px;height:32px" data-act="rc-del" data-v="${r.id}" aria-label="Delete recipe" data-armed="${S.ui.rcArm === r.id ? 1 : 0}">${S.ui.rcArm === r.id ? ICON.check : ICON.trash}</button></div></div>`).join('')}</div></div>` : ''}
    ${ms.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Saved meals</div><div class="list">${ms.map(r => `<div class="row between" style="padding:9px 0;flex-wrap:nowrap"><div style="min-width:0"><b style="font-weight:600">${esc(r.name)}</b><div class="tiny muted">${fmt(r.total.kcal)} kcal · ${esc(r.items.join(', ')).slice(0, 120)}</div></div><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-act="ml-log" data-v="${r.id}">Log</button><button class="iconbtn" style="width:32px;height:32px" data-act="ml-del" data-v="${r.id}" aria-label="Delete meal" data-armed="${S.ui.mlArm === r.id ? 1 : 0}">${S.ui.mlArm === r.id ? ICON.check : ICON.trash}</button></div></div>`).join('')}</div></div>` : ''}
  </div>`;
}

function sheetSearch() {
  const s = S.sheet.search;
  return `<div class="grab"></div><div class="stack">
    <div class="h2">Search foods</div>
    <form class="row" data-form="search" style="flex-wrap:nowrap"><input class="inp" id="sr-q" value="${esc(s.q || '')}" placeholder="e.g. quest bar cookies and cream" autocomplete="off"><button class="btn primary" type="submit">Search</button></form>
    ${s.busy ? '<div class="row muted small"><span class="spinner"></span> Searching…</div>' : ''}
    ${s.err ? `<p class="small" style="color:var(--bad)">${esc(s.err)}</p>` : ''}
    ${!s.q && (S.lib.myfoods || []).length ? `<div class="eyebrow">Your foods</div>` : ''}
    <div class="list">${(s.q ? s.rows || [] : (S.lib.myfoods || []).slice(0, 25)).map((c, i) => `<button class="row between" style="width:100%;border:0;background:none;padding:10px 0;text-align:left;flex-wrap:nowrap;gap:10px" data-act="sr-pick" data-v="${i}"><span style="min-width:0"><b style="font-weight:500">${esc(rowLabel(c))}</b><div class="tiny muted">${esc(servingText(c))} · P${fmt(c.protein)} C${fmt(c.carbs)} F${fmt(c.fat)}</div></span><span class="num small" style="flex:none">${fmt(c.kcal)} kcal</span></button>`).join('')}</div>
    ${s.q && !s.busy && !(s.rows || []).length ? '<p class="small muted">No matches. Try fewer words, or type it into "What did you eat?" and Claude will estimate it.</p>' : ''}
  </div>`;
}

function pickToLog(row) {
  S.sheet = { type: 'food', food: { kind: 'log', stage: 'resolve', text: rowLabel(row), meal: S.foodDate === today() ? defaultMeal() : 'Snacks', items: [{ text: rowLabel(row), cands: [row], pick: 0, servings: 1, unit: 'serving', qty: 1 }] } };
  render();
}
