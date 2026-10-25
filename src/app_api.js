/* ============================================================
   API MODE (GitHub Pages build): Google Apps Script backend
   Sync: one Google Sheet, rows keyed by each person's private sync code.
   AI: Apps Script calls the Anthropic API with a key kept in Script Properties.
   The artifact build ignores all of this (window.claude is present there).
   ============================================================ */
const Api = {
  url: (window.SPOTTER_CONFIG && window.SPOTTER_CONFIG.apiUrl) || '',
  get enabled() { return !window.claude && !!this.url; },
  get token() { try { return localStorage.getItem('fc:token') || ''; } catch (e) { return ''; } },
  set token(v) { try { v ? localStorage.setItem('fc:token', v) : localStorage.removeItem('fc:token'); } catch (e) {} },
  async call(action, payload = {}, timeoutMs = 60000) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      // text/plain keeps this a "simple" request, so no CORS preflight (Apps Script cannot answer one)
      const r = await fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: this.token, ...payload }), signal: ctl.signal, redirect: 'follow' });
      const j = await r.json();
      if (!j.ok) throw { code: j.code || 'server_error', message: j.error || 'Server error' };
      return j;
    } catch (e) {
      if (e?.name === 'AbortError') throw { code: 'timeout', message: 'The server took too long to answer.' };
      throw e?.code ? e : { code: 'network', message: 'Could not reach the server.' };
    } finally { clearTimeout(t); }
  },
  /* ---- sync queue: last write per key wins, retried when back online ---- */
  pending: {}, timer: null,
  queueSave(key, value) {
    this.pending[key] = value;
    try { localStorage.setItem('fc:pending', JSON.stringify(Object.keys(this.pending))); } catch (e) {}
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 800);
  },
  async flush() {
    const keys = Object.keys(this.pending); if (!keys.length) return;
    const batch = keys.map(k => ({ key: k, value: this.pending[k] }));
    keys.forEach(k => delete this.pending[k]);
    try { await this.call('saveMany', { items: batch }); try { localStorage.removeItem('fc:pending'); } catch (e) {} S.ui.offline = false; }
    catch (e) { batch.forEach(b => { if (!(b.key in this.pending)) this.pending[b.key] = b.value; }); S.ui.offline = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 15000); }
  },
  /* ---- same interface as the artifact `sample` capability, so the app code does not change ---- */
  async blobToB64(b) { return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(b); }); },
  makeSample() {
    const run = async (input, opts = {}, json = false) => {
      const messages = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
      let images = [];
      if (opts.images) { const list = opts.images instanceof Blob ? [opts.images] : [...opts.images]; images = await Promise.all(list.map(async b => ({ type: b.type || 'image/jpeg', data: await this.blobToB64(b) }))); }
      const r = await this.call('ai', { messages, images, tier: opts.modelTier || 'default', json }, 120000);
      if (opts.onText) opts.onText({ text: r.text, delta: r.text });
      if (json) { try { return JSON.parse(String(r.text).replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); } catch (e) { throw { code: 'invalid_json', text: r.text }; } }
      return { text: r.text, truncated: false };
    };
    const s = (input, opts) => run(input, opts, false);
    s.json = (input, opts) => run(input, opts, true);
    s.limits = async () => ({ maxPromptBytes: 200000, images: { maxCount: 4 } });
    return s;
  },
  downloads: { save: async ({ filename, data }) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } }
};

/* ---------- join / link screen (API mode, no sync code on this device yet) ---------- */
function viewJoin() {
  const j = S.ui.join || (S.ui.join = { mode: 'new' });
  return `<div class="ob stack" style="padding-top:8px">
    <div class="hero-ob"><div class="h-display">Train smarter.<br>Eat with a plan.</div><p class="muted" style="margin-top:10px">Spotter builds your training program and your calorie and macro targets, then adjusts them every day from how you slept, what you lifted and what you ate.</p></div>
    <div class="seg"><button data-act="join-mode" data-v="new" aria-pressed="${j.mode === 'new'}">I'm new</button><button data-act="join-mode" data-v="link" aria-pressed="${j.mode === 'link'}">I already use Spotter</button></div>
    <form class="card stack" data-form="join">
      ${j.mode === 'new' ? `<label class="f">First name<input class="inp" id="jn-name" autocomplete="given-name"></label><label class="f">Invite code<input class="inp" id="jn-code" autocomplete="off" autocapitalize="off"></label><p class="tiny muted">Spotter is private for now. Ask the person who shared it for the invite code.</p>`
        : `<label class="f">Your sync code<input class="inp" id="jn-token" autocomplete="off" autocapitalize="off" placeholder="from Settings on your other device"></label><p class="tiny muted">Open Spotter on the device you already use, go to Settings, and copy the sync code. Your logs, plan and theme come with it.</p>`}
      ${j.err ? `<p class="small" style="color:var(--bad)">${esc(j.err)}</p>` : ''}
      <button class="btn primary" type="submit" ${j.busy ? 'disabled' : ''}>${j.busy ? 'One moment…' : j.mode === 'new' ? 'Create my account' : 'Link this device'}</button>
    </form></div>`;
}
async function doJoin() {
  const j = S.ui.join; j.err = null;
  // read the inputs before re-rendering (render rebuilds the form)
  const name = $('#jn-name')?.value.trim() || '', code = $('#jn-code')?.value.trim() || '', tk = ($('#jn-token')?.value || '').trim();
  j.busy = true; render();
  try {
    if (j.mode === 'new') {
      if (!code) throw { message: 'Enter the invite code.' };
      const r = await Api.call('register', { invite: code, name });
      Api.token = r.token;
    } else {
      if (tk.length < 16) throw { message: 'That sync code looks incomplete. Copy the whole thing.' };
      Api.token = tk;
      await Api.call('ping');
    }
    S.needJoin = false; j.busy = false;
    const data = await Store.loadAll();
    S.profile = migrateProfile(data.profile); S.lib = { barcodes: {}, recent: [], ...(data.lib || {}) }; S.days = data.days || {};
    if (S.profile?.skin) applyTheme(S.profile.skin);
    initSample();
  } catch (e) {
    if (j.mode === 'link') Api.token = '';
    j.busy = false; j.err = e.code === 'bad_invite' ? 'That invite code is not right.' : e.code === 'bad_token' ? 'That sync code was not found.' : (e.message || 'Could not connect. Try again.');
  }
  render();
}

/* ---------- Oura (through the Apps Script backend; tokens never reach the phone) ---------- */
const Oura = {
  async status() { try { const r = await Api.call('ouraStatus'); S.ui.oura = { connected: !!r.connected, last: S.ui.oura?.last || null }; } catch (e) { S.ui.oura = { connected: false }; } return S.ui.oura.connected; },
  async connect() {
    try { const r = await Api.call('ouraStart', { returnUrl: location.href.split('#')[0] }); location.href = r.url; }
    catch (e) { toast(e.code === 'not_configured' ? 'Oura is not set up on the server yet.' : 'Could not start the Oura connection.'); }
  },
  async sync(force) {
    if (!S.ui.oura?.connected) return;
    let lastAt = 0; try { lastAt = +localStorage.getItem('fc:ouraAt') || 0; } catch (e) {}
    if (!force && Date.now() - lastAt < 2 * 3600e3 && day(today()).wear) return;
    try {
      const r = await Api.call('ouraDays', { start: E.addDays(today(), -4), end: today() });
      (r.days || []).forEach(w => { if (!w.date) return; const d = day(w.date); d.wear = { ...w, src: 'oura' }; delete d.wear.date; saveDay(w.date); });
      try { localStorage.setItem('fc:ouraAt', String(Date.now())); } catch (e) {}
      S.ui.oura.last = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (force) toast('Oura synced');
      render();
    } catch (e) { if (e.code === 'oura_reauth') { S.ui.oura.connected = false; toast('Oura needs to be reconnected in Settings.'); render(); } else if (force) toast('Oura sync failed. Try again later.'); }
  },
  async disconnect() { try { await Api.call('ouraDisconnect'); } catch (e) {} S.ui.oura = { connected: false }; render(); }
};
