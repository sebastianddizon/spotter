/**
 * Spotter backend (Google Apps Script web app)
 *
 * Setup (one time):
 * 1. Create a Google Sheet named "Spotter Data". Extensions > Apps Script. Replace everything with this file. Save.
 * 2. Project Settings (gear) > Script Properties > add:
 *      ANTHROPIC_API_KEY  = your key from console.anthropic.com
 *      INVITE_CODE        = one or more codes, separated by commas (people need one to create an account)
 *    Optional: MODEL_QUICK (default claude-haiku-5-5), MODEL_MAIN (default claude-sonnet-5-5)
 * 3. Run the function "setup" once (top bar dropdown, then Run) and approve the permissions.
 * 4. Deploy > New deployment > type Web app. Execute as: Me. Who has access: Anyone. Deploy. Copy the /exec URL.
 *    Later updates: Deploy > Manage deployments > pencil > Version: New version > Deploy (keeps the same URL).
 *
 * Oura (optional): register an app at https://developer.ouraring.com (or cloud.ouraring.com/oauth/applications).
 *    Redirect URI = this web app's /exec URL, exactly. Then add Script Properties:
 *      OURA_CLIENT_ID, OURA_CLIENT_SECRET, and APP_URL = https://sebastianddizon.github.io/spotter/
 *    After pasting a new version of this file: Deploy > Manage deployments > pencil > Version: New version > Deploy.
 *
 * Data: sheet "data" holds one row per (token, key). Large values are split across columns (50,000-char cell limit).
 * Sheet "users" holds token, name, created date. Tokens are random 32-character codes.
 */

const CHUNK = 45000;
const MAX_CHUNKS = 20;

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let d = ss.getSheetByName('data');
  if (!d) { d = ss.insertSheet('data'); d.getRange(1, 1, 1, 4).setValues([['token', 'key', 'updated', 'json...']]); d.setFrozenRows(1); }
  let u = ss.getSheetByName('users');
  if (!u) { u = ss.insertSheet('users'); u.getRange(1, 1, 1, 4).setValues([['token', 'name', 'created', 'invite']]); u.setFrozenRows(1); }
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('INVITE_CODE')) props.setProperty('INVITE_CODE', 'spotter-' + Math.floor(1000 + Math.random() * 9000));
  Logger.log('Ready. Invite code: ' + props.getProperty('INVITE_CODE') + '. API key set: ' + !!props.getProperty('ANTHROPIC_API_KEY'));
}

function doGet(e) {
  if (e && e.parameter && (e.parameter.code || e.parameter.error) && e.parameter.state) return ouraCallback_(e.parameter);
  return out_({ ok: true, app: 'spotter' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, code: 'bad_request', error: 'Body was not JSON.' }); }
  try {
    const a = req.action;
    if (a === 'register') return out_(register_(req));
    if (!validToken_(req.token)) return out_({ ok: false, code: 'bad_token', error: 'Unknown sync code.' });
    if (a === 'ping') return out_({ ok: true });
    if (a === 'loadAll') return out_(loadAll_(req.token));
    if (a === 'saveMany') return out_(saveMany_(req.token, req.items || []));
    if (a === 'ai') return out_(ai_(req));
    if (a === 'wipe') return out_(wipe_(req.token));
    if (a === 'ouraStart') return out_(ouraStart_(req));
    if (a === 'ouraStatus') return out_({ ok: true, connected: !!ouraGet_(req.token) });
    if (a === 'ouraDisconnect') return out_(ouraDisconnect_(req.token));
    if (a === 'ouraDays') return out_(ouraDays_(req));
    if (a === 'photoSave') return out_(photoSave_(req));
    if (a === 'photoList') return out_(photoList_(req.token));
    if (a === 'photoGet') return out_(photoGet_(req));
    if (a === 'photoDelete') return out_(photoDelete_(req));
    return out_({ ok: false, code: 'bad_action', error: 'Unknown action.' });
  } catch (err) {
    return out_({ ok: false, code: 'server_error', error: String(err && err.message || err) });
  }
}

function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- users ---------- */
function register_(req) {
  // INVITE_CODE can hold several codes separated by commas, e.g. "family-4821, friends-2026".
  // Removing a code stops new sign-ups with it; people who already joined keep working.
  const codes = String(PropertiesService.getScriptProperties().getProperty('INVITE_CODE') || '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  const used = String(req.invite || '').trim().toLowerCase();
  if (!codes.length || codes.indexOf(used) < 0) return { ok: false, code: 'bad_invite', error: 'Wrong invite code.' };
  const token = Utilities.getUuid().replace(/-/g, '');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { sheet_('users').appendRow([token, String(req.name || '').slice(0, 60), new Date(), used]); } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('tokens');
  return { ok: true, token: token };
}
function validToken_(t) {
  if (!t || String(t).length < 16) return false;
  const cache = CacheService.getScriptCache();
  let list = cache.get('tokens');
  if (!list) {
    const sh = sheet_('users'); const n = sh.getLastRow();
    list = n > 1 ? sh.getRange(2, 1, n - 1, 1).getValues().map(r => r[0]).join(',') : '';
    cache.put('tokens', list, 600);
  }
  return list.split(',').indexOf(String(t)) >= 0;
}

/* ---------- data ---------- */
function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function rows_(token) {
  const sh = sheet_('data'); const n = sh.getLastRow(); if (n < 2) return [];
  const w = Math.max(4, sh.getLastColumn());
  const vals = sh.getRange(2, 1, n - 1, w).getDisplayValues();
  const outRows = [];
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === token) outRows.push({ row: i + 2, key: vals[i][1], json: vals[i].slice(3).filter(c => c !== '').map(c => c.charAt(0) === '~' ? c.slice(1) : c).join('') });
  return outRows;
}
function loadAll_(token) {
  const r = rows_(token); const res = { ok: true, profile: null, lib: null, days: [] };
  r.forEach(x => {
    let v = null; try { v = JSON.parse(x.json); } catch (e) { return; }
    if (x.key === 'profile') res.profile = v;
    else if (x.key === 'lib') res.lib = v;
    else if (x.key.indexOf('day:') === 0) res.days.push(v);
  });
  res.days.sort((a, b) => a.date < b.date ? 1 : -1);
  res.days = res.days.slice(0, 400);
  return res;
}
function saveMany_(token, items) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const sh = sheet_('data');
    const existing = {}; rows_(token).forEach(x => existing[x.key] = x.row);
    items.forEach(it => {
      const key = String(it.key || ''); if (!/^(profile|lib|day:\d{4}-\d{2}-\d{2})$/.test(key)) return;
      const json = JSON.stringify(it.value);
      // each chunk starts with '~' so Sheets never reads a chunk as a number, date or formula
      const parts = []; for (let i = 0; i < json.length; i += CHUNK) parts.push('~' + json.slice(i, i + CHUNK));
      if (parts.length > MAX_CHUNKS) throw new Error('Value too large for ' + key);
      const row = [token, key, new Date()].concat(parts);
      const r = existing[key];
      if (r) {
        const w = Math.max(sh.getLastColumn(), row.length);
        const full = row.concat(new Array(w - row.length).fill(''));
        sh.getRange(r, 1, 1, w).setValues([full]);
      } else { sh.appendRow(row); existing[key] = sh.getLastRow(); }
    });
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  return { ok: true };
}
function wipe_(token) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try { const sh = sheet_('data'); rows_(token).map(x => x.row).sort((a, b) => b - a).forEach(r => sh.deleteRow(r)); } finally { lock.releaseLock(); }
  try { photoRows_(token).sort((a, b) => b.row - a.row).forEach(r => photoDelete_({ token: token, id: r.id })); } catch (e) {}
  return { ok: true };
}

/* ---------- AI proxy (Anthropic Messages API) ---------- */
function ai_(req) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('ANTHROPIC_API_KEY');
  if (!key) return { ok: false, code: 'not_granted', error: 'No AI key set in Script Properties.' };
  // simple per-user daily cap so a runaway loop cannot run up the bill
  const cache = CacheService.getScriptCache(); const ck = 'ai:' + req.token + ':' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd');
  const used = Number(cache.get(ck) || 0); if (used >= Number(props.getProperty('DAILY_AI_CAP') || 150)) return { ok: false, code: 'rate_limited', error: 'Daily AI limit reached.' };
  cache.put(ck, String(used + 1), 86400);

  const model = req.tier === 'quick' ? (props.getProperty('MODEL_QUICK') || 'claude-haiku-5-5') : (props.getProperty('MODEL_MAIN') || 'claude-sonnet-5-5');
  const msgs = (req.messages || []).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '') }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return { ok: false, code: 'invalid_request', error: 'Last message must be from the user.' };
  if (req.images && req.images.length) {
    const last = msgs[msgs.length - 1];
    last.content = req.images.slice(0, 4).map(im => ({ type: 'image', source: { type: 'base64', media_type: im.type || 'image/jpeg', data: im.data } })).concat([{ type: 'text', text: last.content }]);
  }
  const body = { model: model, max_tokens: req.json ? 4000 : 900, messages: msgs };
  if (req.json) body.system = 'Reply with a single JSON value only. No prose, no code fences.';
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, payload: JSON.stringify(body)
  });
  const code = res.getResponseCode(); const j = JSON.parse(res.getContentText() || '{}');
  if (code === 429) return { ok: false, code: 'rate_limited', error: 'AI is busy. Try again in a minute.' };
  if (code >= 400) return { ok: false, code: 'upstream_error', error: (j.error && j.error.message) || ('AI error ' + code) };
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return { ok: true, text: text, model: model };
}

/* ---------- Oura OAuth + daily summaries ---------- */
const OURA_AUTH = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN = 'https://api.ouraring.com/oauth/token';
const OURA_API = 'https://api.ouraring.com/v2/usercollection/';
function execUrl_() { return ScriptApp.getService().getUrl(); }
function ouraSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(); let sh = ss.getSheetByName('oura');
  if (!sh) { sh = ss.insertSheet('oura'); sh.getRange(1, 1, 1, 5).setValues([['token', 'access', 'refresh', 'expires_at', 'connected']]); sh.setFrozenRows(1); sh.hideSheet(); }
  return sh;
}
function ouraGet_(token) {
  const sh = ouraSheet_(); const n = sh.getLastRow(); if (n < 2) return null;
  const v = sh.getRange(2, 1, n - 1, 5).getDisplayValues();
  const un = x => x.charAt(0) === '~' ? x.slice(1) : x;
  for (let i = 0; i < v.length; i++) if (v[i][0] === token && v[i][1]) return { row: i + 2, access: un(v[i][1]), refresh: un(v[i][2]), exp: Number(v[i][3]) };
  return null;
}
function ouraPut_(token, access, refresh, exp) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = ouraSheet_(); const cur = ouraGet_(token);
    // '~' prefix keeps Sheets from reading a token as a number or formula
    const row = [token, '~' + access, '~' + refresh, String(exp), new Date()];
    if (cur) sh.getRange(cur.row, 1, 1, 5).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
}
function ouraStart_(req) {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('OURA_CLIENT_ID'); if (!id || !p.getProperty('OURA_CLIENT_SECRET')) return { ok: false, code: 'not_configured', error: 'Oura is not configured.' };
  const nonce = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('oura:' + nonce, JSON.stringify({ token: req.token, back: String(req.returnUrl || p.getProperty('APP_URL') || '') }), 900);
  const url = OURA_AUTH + '?response_type=code&client_id=' + encodeURIComponent(id) + '&redirect_uri=' + encodeURIComponent(execUrl_()) + '&scope=' + encodeURIComponent('daily heartrate personal') + '&state=' + nonce;
  return { ok: true, url: url };
}
function ouraCallback_(prm) {
  const p = PropertiesService.getScriptProperties();
  const raw = CacheService.getScriptCache().get('oura:' + prm.state);
  const info = raw ? JSON.parse(raw) : null;
  const back = (info && info.back) || p.getProperty('APP_URL') || '';
  let ok = false, msg = '';
  if (!info) msg = 'This link expired. Go back to Spotter and tap Connect again.';
  else if (prm.error) msg = 'Oura access was not granted.';
  else {
    const res = UrlFetchApp.fetch(OURA_TOKEN, { method: 'post', muteHttpExceptions: true, payload: { grant_type: 'authorization_code', code: prm.code, redirect_uri: execUrl_(), client_id: p.getProperty('OURA_CLIENT_ID'), client_secret: p.getProperty('OURA_CLIENT_SECRET') } });
    const j = JSON.parse(res.getContentText() || '{}');
    if (res.getResponseCode() === 200 && j.access_token) { ouraPut_(info.token, j.access_token, j.refresh_token, Date.now() + (Number(j.expires_in) || 86400) * 1000); ok = true; CacheService.getScriptCache().remove('oura:' + prm.state); }
    else msg = 'Oura sign-in failed (' + res.getResponseCode() + '). Try again.';
  }
  const html = '<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:-apple-system,sans-serif;background:#0E1523;color:#F1E6D4;display:grid;place-items:center;min-height:90vh;text-align:center;padding:24px">'
    + '<div><h2 style="margin:0 0 8px">' + (ok ? 'Oura connected' : 'Not connected') + '</h2><p style="opacity:.8">' + (ok ? 'Your ring will fill in your morning check-in.' : msg) + '</p>'
    + (back ? '<p><a href="' + back + '" target="_top" style="display:inline-block;margin-top:12px;background:#D8C3A0;color:#0E1523;padding:12px 22px;border-radius:999px;font-weight:700;text-decoration:none">Back to Spotter</a></p>' : '') + '</div></body>';
  return HtmlService.createHtmlOutput(html).setTitle('Spotter').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function ouraAccess_(token) {
  const cur = ouraGet_(token); if (!cur) return null;
  if (cur.exp - Date.now() > 3600e3) return cur.access;
  const p = PropertiesService.getScriptProperties();
  const res = UrlFetchApp.fetch(OURA_TOKEN, { method: 'post', muteHttpExceptions: true, payload: { grant_type: 'refresh_token', refresh_token: cur.refresh, client_id: p.getProperty('OURA_CLIENT_ID'), client_secret: p.getProperty('OURA_CLIENT_SECRET') } });
  const j = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() !== 200 || !j.access_token) return 'REAUTH';
  // refresh tokens are single-use: always store the new one
  ouraPut_(token, j.access_token, j.refresh_token || cur.refresh, Date.now() + (Number(j.expires_in) || 86400) * 1000);
  return j.access_token;
}
function ouraGetJson_(access, path, start, end) {
  const url = OURA_API + path + '?start_date=' + start + '&end_date=' + end;
  const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + access }, muteHttpExceptions: true });
  if (res.getResponseCode() === 401) throw new Error('REAUTH');
  if (res.getResponseCode() !== 200) return [];
  return (JSON.parse(res.getContentText() || '{}').data) || [];
}
function ouraDays_(req) {
  const access = ouraAccess_(req.token);
  if (!access) return { ok: false, code: 'oura_not_connected', error: 'Oura is not connected.' };
  if (access === 'REAUTH') return { ok: false, code: 'oura_reauth', error: 'Oura needs to be reconnected.' };
  const start = String(req.start).slice(0, 10), end = String(req.end).slice(0, 10);
  // end_date is exclusive on some endpoints: ask for one extra day
  const endPlus = Utilities.formatDate(new Date(new Date(end + 'T12:00:00Z').getTime() + 86400000), 'UTC', 'yyyy-MM-dd');
  let rd, sl, ac;
  try { rd = ouraGetJson_(access, 'daily_readiness', start, endPlus); sl = ouraGetJson_(access, 'sleep', start, endPlus); ac = ouraGetJson_(access, 'daily_activity', start, endPlus); }
  catch (err) { if (String(err.message) === 'REAUTH') return { ok: false, code: 'oura_reauth', error: 'Oura needs to be reconnected.' }; throw err; }
  const days = {};
  const g = d => days[d] || (days[d] = { date: d });
  rd.forEach(x => { const o = g(x.day); o.readiness = x.score; if (x.temperature_deviation != null) o.tempDev = Math.round(x.temperature_deviation * 10) / 10; });
  // main sleep period per day (longest), not naps
  sl.forEach(x => {
    if (!x.day) return; const o = g(x.day); const dur = Number(x.total_sleep_duration) || 0;
    if (dur <= (o._dur || 0)) return; o._dur = dur;
    o.sleepHrs = Math.round(dur / 360) / 10; if (x.average_hrv) o.hrv = Math.round(x.average_hrv); if (x.lowest_heart_rate) o.rhr = Math.round(x.lowest_heart_rate);
    if (x.efficiency) o.sleepEff = x.efficiency;
  });
  ac.forEach(x => { const o = g(x.day); if (x.steps != null) o.steps = x.steps; if (x.active_calories != null) o.activeKcal = x.active_calories; });
  const outDays = Object.keys(days).sort().map(k => { const o = days[k]; delete o._dur; return o; }).filter(o => o.date >= start && o.date <= end);
  return { ok: true, days: outDays };
}
function ouraDisconnect_(token) {
  const cur = ouraGet_(token); if (cur) ouraSheet_().getRange(cur.row, 1, 1, 5).clearContent();
  return { ok: true };
}


/* ---------- progress photos (private: saved to the owner's Google Drive, never shared) ---------- */
function photoFolder_(token) {
  const props = PropertiesService.getScriptProperties();
  let rootId = props.getProperty('PHOTO_FOLDER_ID'); let root = null;
  if (rootId) { try { root = DriveApp.getFolderById(rootId); } catch (e) { root = null; } }
  if (!root) { root = DriveApp.createFolder('Spotter progress photos'); props.setProperty('PHOTO_FOLDER_ID', root.getId()); }
  const name = token.slice(0, 10);
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
function photoSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('photos');
  if (!sh) { sh = ss.insertSheet('photos'); sh.getRange(1, 1, 1, 6).setValues([['token', 'id', 'date', 'pose', 'fileId', 'thumb']]); sh.setFrozenRows(1); sh.hideSheet(); }
  return sh;
}
function photoSave_(req) {
  const full = String(req.full || ''), thumb = String(req.thumb || '');
  if (!full || full.length > 4500000) return { ok: false, error: 'Photo too large.' };
  if (thumb.length > 45000) return { ok: false, error: 'Thumbnail too large.' };
  const date = String(req.date || '').slice(0, 10), pose = String(req.pose || 'front').slice(0, 12);
  const blob = Utilities.newBlob(Utilities.base64Decode(full), 'image/jpeg', date + '_' + pose + '.jpg');
  const file = photoFolder_(req.token).createFile(blob);
  const id = Utilities.getUuid().slice(0, 12);
  photoSheet_().appendRow([req.token, id, date, pose, file.getId(), thumb]);
  return { ok: true, id: id };
}
function photoRows_(token) {
  const sh = photoSheet_(); const n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 6).getDisplayValues().map((r, i) => ({ row: i + 2, token: r[0], id: r[1], date: r[2], pose: r[3], fileId: r[4], thumb: r[5] })).filter(r => r.token === token);
}
function photoList_(token) { return { ok: true, photos: photoRows_(token).map(r => ({ id: r.id, date: r.date, pose: r.pose, thumb: r.thumb })) }; }
function photoGet_(req) {
  const r = photoRows_(req.token).filter(x => x.id === req.id)[0]; if (!r) return { ok: false, error: 'Not found.' };
  return { ok: true, full: Utilities.base64Encode(DriveApp.getFileById(r.fileId).getBlob().getBytes()) };
}
function photoDelete_(req) {
  const r = photoRows_(req.token).filter(x => x.id === req.id)[0]; if (!r) return { ok: true };
  try { DriveApp.getFileById(r.fileId).setTrashed(true); } catch (e) {}
  photoSheet_().deleteRow(r.row);
  return { ok: true };
}
