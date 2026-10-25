/* ============================================================
   COACH ENGINE  (pure functions, no DOM; runs in browser + node)
   Every rule carries a short `why` so the UI can show its basis.
   ============================================================ */
(function (root) {
'use strict';

const KG = 2.20462;
const DAY = 86400000;

/* ---------- small utils ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round = (v, step) => Math.round(v / step) * step;
const sum = (a) => a.reduce((s, x) => s + (+x || 0), 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);
function isoDate(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDate(d); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / DAY); }
function weekdayOf(iso) { return new Date(iso + 'T12:00:00').getDay(); }

/* ============================================================
   MUSCLES + EXERCISE LIBRARY
   loc: gym | p1 (Innodigym P1 Max: floor-anchored dual cables,
   bar / 2 handles / ankle straps / belt, no bench, no high anchor)
   tier: 1 best (stretch-biased, stable, easy to progress) .. 3
   cables: P1 only, 1 = single cable, 2 = both cables
   ============================================================ */
const MUSCLES = {
  chest: 'Chest', lats: 'Back (width)', upperback: 'Upper back', sidedelts: 'Shoulders',
  reardelts: 'Back of shoulders', frontdelts: 'Front of shoulders', biceps: 'Biceps', triceps: 'Triceps',
  quads: 'Front of thighs', hams: 'Back of thighs', glutes: 'Glutes', calves: 'Calves', abs: 'Abs'
};
const LEG_MUSCLES = ['quads', 'hams', 'glutes', 'calves'];

const EX = [
  // ---------------- GYM ----------------
  { id: 'g_incdb', loc: 'gym', name: 'Incline dumbbell press', m: 'chest', sec: ['frontdelts', 'triceps'], type: 'compound', tier: 1, stretch: true, rr: [6, 10], inc: 5, equip: 'dumbbells', cue: '30 degree bench, deep stretch at the bottom.' },
  { id: 'g_machpress', loc: 'gym', name: 'Machine chest press', m: 'chest', sec: ['triceps'], type: 'compound', tier: 1, rr: [6, 10], inc: 5, equip: 'machine', cue: 'Stable, easy to push close to failure safely.' },
  { id: 'g_bench', loc: 'gym', name: 'Barbell bench press', m: 'chest', sec: ['frontdelts', 'triceps'], type: 'compound', tier: 2, rr: [5, 8], inc: 5, equip: 'barbell', cue: 'Leave a rep in the tank without a spotter.' },
  { id: 'g_dip', loc: 'gym', name: 'Weighted dip', m: 'chest', sec: ['triceps'], type: 'compound', tier: 2, stretch: true, rr: [6, 10], inc: 5, equip: 'dip station', cue: 'Lean forward, control the stretch.' },
  { id: 'g_fly', loc: 'gym', name: 'Cable or pec-deck fly', m: 'chest', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 5, equip: 'cable', cue: 'Bias the stretched position.' },
  { id: 'g_pulldown', loc: 'gym', name: 'Lat pulldown', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, equip: 'cable', cue: 'Full stretch at the top, elbows to ribs.' },
  { id: 'g_pullup', loc: 'gym', name: 'Pull-up (add weight when 12+)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 2, rr: [6, 10], inc: 5, equip: 'bar', cue: 'Dead hang each rep.' },
  { id: 'g_1arm_row', loc: 'gym', name: 'Single-arm cable row', m: 'lats', sec: ['upperback'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, equip: 'cable', cue: 'Let the shoulder blade travel forward for the stretch.' },
  { id: 'g_csrow', loc: 'gym', name: 'Chest-supported row', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, equip: 'machine', cue: 'Chest stays on the pad.' },
  { id: 'g_cablerow', loc: 'gym', name: 'Seated cable row', m: 'upperback', sec: ['lats'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, equip: 'cable', cue: 'Pause at the squeeze, reach long.' },
  { id: 'g_pullover', loc: 'gym', name: 'Cable lat pullover', m: 'lats', type: 'iso', tier: 2, stretch: true, rr: [10, 15], inc: 5, equip: 'cable', cue: 'Arms nearly straight.' },
  { id: 'g_lat', loc: 'gym', name: 'Cable lateral raise', m: 'sidedelts', type: 'iso', tier: 1, rr: [10, 20], inc: 2.5, equip: 'cable', cue: 'Cable behind the body, lead with the elbow.' },
  { id: 'g_dblat', loc: 'gym', name: 'Dumbbell lateral raise', m: 'sidedelts', type: 'iso', tier: 2, rr: [12, 20], inc: 5, equip: 'dumbbells', cue: 'Slight lean, no swing.' },
  { id: 'g_revdeck', loc: 'gym', name: 'Reverse pec deck', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [12, 20], inc: 5, equip: 'machine', cue: 'Sweep out wide, not back.' },
  { id: 'g_facepull', loc: 'gym', name: 'Face pull', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 2, rr: [15, 20], inc: 5, equip: 'cable', prehab: true, cue: 'Pull to the forehead and rotate the thumbs back behind you.' },
  { id: 'g_extrot', loc: 'gym', name: 'Cable external rotation', m: 'reardelts', type: 'iso', tier: 3, rr: [12, 20], inc: 2.5, equip: 'cable', prehab: true, cue: 'Elbow pinned at your side, rotate out slowly.' },
  { id: 'g_ohp', loc: 'gym', name: 'Machine or seated DB shoulder press', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [6, 10], inc: 5, equip: 'machine', cue: 'Press slightly in front of the face.' },
  { id: 'g_inccurl', loc: 'gym', name: 'Incline dumbbell curl', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [8, 12], inc: 5, equip: 'dumbbells', cue: 'Arms hang behind the torso.' },
  { id: 'g_bayes', loc: 'gym', name: 'Bayesian cable curl', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 2.5, equip: 'cable', cue: 'Face away from the stack.' },
  { id: 'g_preacher', loc: 'gym', name: 'Preacher curl', m: 'biceps', type: 'iso', tier: 2, rr: [8, 12], inc: 5, equip: 'EZ bar or machine', cue: 'Control the bottom.' },
  { id: 'g_ohext', loc: 'gym', name: 'Overhead cable triceps extension', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 5, equip: 'cable', cue: 'Deep stretch behind the head.' },
  { id: 'g_pushdown', loc: 'gym', name: 'Cable triceps pushdown', m: 'triceps', type: 'iso', tier: 2, rr: [10, 15], inc: 5, equip: 'cable', cue: 'Elbows pinned.' },
  { id: 'g_skull', loc: 'gym', name: 'EZ-bar skull crusher', m: 'triceps', type: 'iso', tier: 2, stretch: true, rr: [8, 12], inc: 5, equip: 'EZ bar', cue: 'Bar travels behind the head.' },
  { id: 'g_hack', loc: 'gym', name: 'Hack squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, rr: [6, 10], inc: 10, equip: 'machine', cue: 'Full depth.' },
  { id: 'g_legpress', loc: 'gym', name: 'Leg press', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, rr: [8, 12], inc: 10, equip: 'machine', cue: 'Low and deep.' },
  { id: 'g_squat', hinge: true, loc: 'gym', name: 'Barbell back squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 2, rr: [5, 8], inc: 5, equip: 'barbell', cue: 'Stop 2 reps short without a spotter.' },
  { id: 'g_bss', loc: 'gym', name: 'Bulgarian split squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 2, stretch: true, rr: [8, 12], inc: 5, equip: 'dumbbells', cue: 'Per leg.' },
  { id: 'g_legext', loc: 'gym', name: 'Leg extension', m: 'quads', type: 'iso', tier: 1, rr: [10, 15], inc: 5, equip: 'machine', cue: 'Lean back slightly for a deeper stretch.' },
  { id: 'g_seatcurl', loc: 'gym', name: 'Seated leg curl', m: 'hams', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 5, equip: 'machine', cue: 'Lean forward for more stretch.' },
  { id: 'g_rdl', hinge: true, loc: 'gym', name: 'Romanian deadlift', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [6, 10], inc: 5, equip: 'barbell', cue: 'Hips back, flat back.' },
  { id: 'g_hipthrust', loc: 'gym', name: 'Hip thrust', m: 'glutes', sec: ['hams'], type: 'compound', tier: 2, rr: [8, 12], inc: 10, equip: 'barbell or machine', cue: 'Pause at the top.' },
  { id: 'g_calf', loc: 'gym', name: 'Standing calf raise', m: 'calves', type: 'iso', tier: 1, stretch: true, rr: [8, 15], inc: 10, equip: 'machine', cue: 'Pause 2 seconds in the stretch.' },
  { id: 'g_deadlift', hinge: true, loc: 'gym', name: 'Deadlift', m: 'hams', sec: ['glutes', 'upperback'], type: 'compound', tier: 3, rr: [3, 7], inc: 10, equip: 'barbell', mainOnly: true, cue: 'Brace, push the floor away.' },
  { id: 'g_bbohp', loc: 'gym', name: 'Barbell overhead press', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 3, rr: [3, 7], inc: 5, equip: 'barbell', mainOnly: true, cue: 'Glutes tight, bar over mid-foot.' },
  { id: 'g_cablecrunch', loc: 'gym', name: 'Cable crunch', m: 'abs', type: 'iso', tier: 1, rr: [10, 15], inc: 5, equip: 'cable', cue: 'Round the spine, hips still.' },


  // ---------------- HOTWORX FX ZONE (dumbbells, kettlebells, bands; no machines assumed) ----------------
  { id: 'h_dbfloor', loc: 'hotworx', name: 'Dumbbell floor press', m: 'chest', sec: ['triceps'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, equip: 'dumbbells', cue: 'Elbows at 45 degrees, pause on the floor.' },
  { id: 'h_pushup', loc: 'hotworx', name: 'Push-up (feet or knees)', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 2, rr: [8, 20], inc: 1, equip: 'bodyweight', cue: 'Body in one line, chest to the floor. Log reps; load stays 0.' },
  { id: 'h_dbrow', loc: 'hotworx', name: 'One-arm dumbbell row', m: 'lats', sec: ['upperback', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, equip: 'dumbbell', cue: 'Hand on your knee, pull the elbow to your hip.' },
  { id: 'h_bandrow', loc: 'hotworx', name: 'Band row', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 2, rr: [12, 20], inc: 1, equip: 'band', cue: 'Squeeze the shoulder blades together, slow return.' },
  { id: 'h_dbohp', loc: 'hotworx', name: 'Seated or standing dumbbell press', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, equip: 'dumbbells', cue: 'Ribs down, press straight up.' },
  { id: 'h_dblat', loc: 'hotworx', name: 'Dumbbell lateral raise', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], inc: 2.5, equip: 'dumbbells', cue: 'Slight lean forward, lead with the elbows.' },
  { id: 'h_facepull', loc: 'hotworx', name: 'Band face pull', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [15, 20], inc: 1, equip: 'band', prehab: true, cue: 'Pull to the forehead and rotate the thumbs back.' },
  { id: 'h_pullapart', loc: 'hotworx', name: 'Band pull-apart', m: 'reardelts', type: 'iso', tier: 2, rr: [15, 25], inc: 1, equip: 'band', prehab: true, cue: 'Straight arms, pull the band to the chest.' },
  { id: 'h_dbcurl', loc: 'hotworx', name: 'Dumbbell curl', m: 'biceps', type: 'iso', tier: 1, rr: [10, 15], inc: 5, equip: 'dumbbells', cue: 'Elbows still, full stretch at the bottom.' },
  { id: 'h_ohext', loc: 'hotworx', name: 'Overhead dumbbell triceps extension', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 5, equip: 'dumbbell', cue: 'One dumbbell in both hands, deep stretch behind the head.' },
  { id: 'h_goblet', loc: 'hotworx', name: 'Goblet squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, rr: [8, 15], inc: 5, equip: 'dumbbell or kettlebell', hinge: true, cue: 'Elbows inside the knees, sit down between the heels.' },
  { id: 'h_split', loc: 'hotworx', name: 'Dumbbell split squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, equip: 'dumbbells', cue: 'Per leg. Back knee drops straight down.' },
  { id: 'h_dbrdl', loc: 'hotworx', name: 'Dumbbell Romanian deadlift', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, equip: 'dumbbells', hinge: true, cue: 'Hips back, dumbbells close to the legs.' },
  { id: 'h_kbswing', loc: 'hotworx', name: 'Kettlebell swing', m: 'glutes', sec: ['hams'], type: 'compound', tier: 2, rr: [12, 20], inc: 5, equip: 'kettlebell', hinge: true, cue: 'Snap the hips, arms just guide the bell.' },
  { id: 'h_bridge', loc: 'hotworx', name: 'Dumbbell glute bridge', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, rr: [10, 15], inc: 5, equip: 'dumbbell', cue: 'Dumbbell on the hips, pause at the top.' },
  { id: 'h_calf', loc: 'hotworx', name: 'Single-leg calf raise', m: 'calves', type: 'iso', tier: 2, stretch: true, rr: [10, 20], inc: 5, equip: 'dumbbell', cue: 'Full stretch at the bottom, 2-second pause.' },
  { id: 'h_deadbug', loc: 'hotworx', name: 'Dead bug', m: 'abs', type: 'iso', tier: 2, rr: [8, 12], inc: 1, equip: 'bodyweight', cue: 'Low back pressed down the whole time.' },

  // ---------------- INNODIGYM P1 MAX ----------------
  { id: 'p_floorpress', loc: 'p1', name: 'Platform floor press (bar)', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, rr: [6, 10], cables: 2, inc: 1, mode: 'Standard', cue: 'Lie on the platform, elbows touch the floor at the bottom.' },
  { id: 'p_lyingfly', loc: 'p1', name: 'Lying cable fly (handles)', m: 'chest', type: 'iso', tier: 1, stretch: true, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Soft elbows, open wide.' },
  { id: 'p_lowhighfly', loc: 'p1', name: 'Standing low-to-high fly', m: 'chest', type: 'iso', tier: 2, rr: [12, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Upper chest bias.' },
  { id: 'p_1armpress', loc: 'p1', name: 'Single-arm floor press', m: 'chest', sec: ['triceps'], type: 'compound', tier: 2, rr: [8, 12], cables: 1, inc: 1, mode: 'Standard', cue: 'Brace the free side.' },
  { id: 'p_bentrow', hinge: true, loc: 'p1', name: 'Bent-over row (bar)', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 1, rr: [8, 12], cables: 2, inc: 1, mode: 'Standard', cue: 'Torso near parallel, pull to the lower ribs.' },
  { id: 'p_1armrow', hinge: true, loc: 'p1', name: 'Single-arm bent-over row (handle)', m: 'lats', sec: ['upperback'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], cables: 1, inc: 1, mode: 'Standard', cue: 'Elbow sweeps toward the hip for lats.' },
  { id: 'p_seatrow', loc: 'p1', name: 'Seated floor row (bar)', m: 'lats', sec: ['upperback', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], cables: 2, inc: 1, mode: 'Standard', cue: 'Sit on the floor facing the platform, reach long.' },
  { id: 'p_reardelt', hinge: true, loc: 'p1', name: 'Bent-over rear delt fly (handles)', m: 'reardelts', type: 'iso', tier: 1, rr: [12, 20], cables: 2, inc: 1, mode: 'Standard', cue: 'Cross the cables.' },
  { id: 'p_lat', loc: 'p1', name: 'Cross-body cable lateral raise', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], cables: 1, inc: 1, mode: 'Standard', cue: 'Cable starts behind the opposite leg.' },
  { id: 'p_highpull', loc: 'p1', name: 'Cable high pull (handles)', m: 'sidedelts', sec: ['upperback', 'reardelts'], type: 'compound', tier: 2, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Hands finish above the elbows so the shoulder stays externally rotated.' },
  { id: 'p_facepull', loc: 'p1', name: 'Lying face pull (handles)', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [15, 20], cables: 2, inc: 1, mode: 'Standard', prehab: true, cue: 'Lie with your head toward the platform, pull to the forehead and rotate the thumbs back.' },
  { id: 'p_extrot', loc: 'p1', name: 'Cable external rotation (handle)', m: 'reardelts', type: 'iso', tier: 2, rr: [12, 20], cables: 1, inc: 1, mode: 'Standard', prehab: true, cue: 'Elbow pinned at your side on a rolled towel, rotate out slowly.' },
  { id: 'p_ohp', loc: 'p1', name: 'Standing overhead press (bar)', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [6, 10], cables: 2, inc: 1, mode: 'Standard', cue: 'Squeeze glutes, press in a straight line.' },
  { id: 'p_curl', loc: 'p1', name: 'Bar curl', m: 'biceps', type: 'iso', tier: 2, rr: [8, 12], cables: 2, inc: 1, mode: 'Standard', cue: 'Elbows still.' },
  { id: 'p_behindcurl', loc: 'p1', name: 'Behind-the-body cable curl', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], cables: 1, inc: 1, mode: 'Standard', cue: 'Step forward so the arm is pulled behind you.' },
  { id: 'p_hammer', loc: 'p1', name: 'Handle hammer curl', m: 'biceps', type: 'iso', tier: 2, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Neutral grip.' },
  { id: 'p_ohext', loc: 'p1', name: 'Overhead triceps extension (facing away)', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Split stance, deep stretch behind the head.' },
  { id: 'p_kickback', loc: 'p1', name: 'Cable kickback', m: 'triceps', type: 'iso', tier: 2, rr: [12, 20], cables: 1, inc: 1, mode: 'Standard', cue: 'Upper arm parallel to the floor.' },
  { id: 'p_lyingext', loc: 'p1', name: 'Lying cable skull crusher', m: 'triceps', type: 'iso', tier: 2, stretch: true, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Bar to the forehead.' },
  { id: 'p_frontsquat', hinge: true, loc: 'p1', name: 'Front squat (bar)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, rr: [6, 10], cables: 2, inc: 1, mode: 'Standard', cue: 'Heels on a plate if you lack depth.' },
  { id: 'p_splitsquat', loc: 'p1', name: 'Split squat (handles)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], cables: 2, inc: 1, mode: 'Standard', cue: 'Per leg, front foot on the platform.' },
  { id: 'p_rdl', hinge: true, loc: 'p1', name: 'Romanian deadlift (bar)', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], cables: 2, inc: 1, mode: 'Standard', cue: 'Hips back until the hamstrings stop you.' },
  { id: 'p_legcurl', loc: 'p1', name: 'Prone leg curl (ankle straps)', m: 'hams', type: 'iso', tier: 2, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Lie face down, feet toward the platform.' },
  { id: 'p_hipthrust', loc: 'p1', name: 'Belt hip thrust', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Shoulders on the floor, drive through heels.' },
  { id: 'p_calf', loc: 'p1', name: 'Standing calf raise (bar)', m: 'calves', type: 'iso', tier: 2, stretch: true, rr: [10, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Toes on the platform edge.' },
  { id: 'p_crunch', loc: 'p1', name: 'Lying cable crunch', m: 'abs', type: 'iso', tier: 2, rr: [12, 15], cables: 2, inc: 1, mode: 'Standard', cue: 'Head toward the platform, bar at the chest.' },
  // ---------------- HOME FREE WEIGHTS (need: equipment keys the user must own; [] = bodyweight) ----------------
  // db dumbbells, kb kettlebells, bands resistance bands, bar pull-up bar, bench bench, bb barbell + rack
  { id: 'hm_dbbench', loc: 'home', need: ['db', 'bench'], name: 'Dumbbell bench press', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, stretch: true, rr: [6, 12], inc: 5, cue: 'Lower until the dumbbells are beside your chest, then press up.' },
  { id: 'hm_dbincline', loc: 'home', need: ['db', 'bench'], name: 'Incline dumbbell press', m: 'chest', sec: ['frontdelts', 'triceps'], type: 'compound', tier: 1, stretch: true, rr: [6, 12], inc: 5, cue: 'Bench at a slight incline. Deep stretch at the bottom.' },
  { id: 'hm_bbbench', loc: 'home', need: ['bb', 'bench'], name: 'Barbell bench press', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 2, rr: [5, 8], inc: 5, cue: 'Set the safety arms. Stop 2 reps early without a spotter.' },
  { id: 'hm_dbfloor', loc: 'home', need: ['db'], name: 'Dumbbell floor press', m: 'chest', sec: ['triceps'], type: 'compound', tier: 2, rr: [8, 12], inc: 5, cue: 'Lie on the floor. Pause when your elbows touch down.' },
  { id: 'hm_kbfloor', loc: 'home', need: ['kb'], name: 'Kettlebell floor press', m: 'chest', sec: ['triceps'], type: 'compound', tier: 2, rr: [8, 12], inc: 4, cue: 'One or two bells, bell resting on the back of the wrist.' },
  { id: 'hm_pushup', loc: 'home', need: [], name: 'Push-up (feet or knees)', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 2, rr: [8, 20], inc: 1, bw: true, cue: 'Body in one straight line. Chest all the way to the floor.' },
  { id: 'hm_deficitpu', loc: 'home', need: [], name: 'Deficit push-up (hands on books)', m: 'chest', sec: ['triceps'], type: 'compound', tier: 2, stretch: true, rr: [8, 20], inc: 1, bw: true, cue: 'Hands raised a few inches so your chest drops lower.' },
  { id: 'hm_dbfly', loc: 'home', need: ['db', 'bench'], name: 'Dumbbell fly', m: 'chest', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 5, cue: 'Soft elbows, open wide, feel the stretch.' },
  { id: 'hm_bandfly', loc: 'home', need: ['bands'], name: 'Band chest fly', m: 'chest', type: 'iso', tier: 2, rr: [12, 20], inc: 1, cue: 'Band anchored behind you at chest height.' },
  { id: 'hm_pullup', loc: 'home', need: ['bar'], name: 'Pull-up or chin-up', m: 'lats', sec: ['biceps', 'upperback'], type: 'compound', tier: 1, stretch: true, rr: [5, 12], inc: 1, bw: true, cue: 'Hang all the way down each rep. Use a band for help if needed.' },
  { id: 'hm_bandpulldown', loc: 'home', need: ['bands'], name: 'Band lat pulldown', m: 'lats', sec: ['biceps'], type: 'compound', tier: 2, rr: [12, 20], inc: 1, cue: 'Band anchored high on a door. Pull elbows down to your ribs.' },
  { id: 'hm_dbrow', loc: 'home', need: ['db'], name: 'One-arm dumbbell row', m: 'lats', sec: ['upperback', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, cue: 'Hand on a bench or knee. Let the weight hang low, then pull to your hip.' },
  { id: 'hm_kbrow', loc: 'home', need: ['kb'], name: 'One-arm kettlebell row', m: 'lats', sec: ['upperback', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 4, cue: 'Staggered stance, pull the bell to your hip.' },
  { id: 'hm_dbpullover', loc: 'home', need: ['db', 'bench'], name: 'Dumbbell pullover', m: 'lats', type: 'iso', tier: 2, stretch: true, rr: [10, 15], inc: 5, cue: 'Arms nearly straight, lower behind your head slowly.' },
  { id: 'hm_bandstraight', loc: 'home', need: ['bands'], name: 'Band straight-arm pulldown', m: 'lats', type: 'iso', tier: 2, rr: [12, 20], inc: 1, cue: 'Arms straight, sweep the band down to your thighs.' },
  { id: 'hm_csrow', loc: 'home', need: ['db', 'bench'], name: 'Chest-supported dumbbell row', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, cue: 'Lie face down on an incline bench. Squeeze your shoulder blades.' },
  { id: 'hm_bbrow', loc: 'home', need: ['bb'], name: 'Barbell bent-over row', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 1, hinge: true, rr: [6, 10], inc: 5, cue: 'Hinge forward, flat back, pull to your belly button.' },
  { id: 'hm_gorilla', loc: 'home', need: ['kb'], name: 'Kettlebell gorilla row', m: 'upperback', sec: ['lats'], type: 'compound', tier: 2, hinge: true, rr: [8, 12], inc: 4, cue: 'Two bells on the floor, row one at a time.' },
  { id: 'hm_bandrow', loc: 'home', need: ['bands'], name: 'Band row', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 2, rr: [12, 20], inc: 1, cue: 'Squeeze your shoulder blades together, slow on the way back.' },
  { id: 'hm_invrow', loc: 'home', need: [], name: 'Table row (under a sturdy table)', m: 'upperback', sec: ['lats', 'biceps'], type: 'compound', tier: 3, rr: [6, 15], inc: 1, bw: true, cue: 'Grip the table edge, pull your chest up to it. Make sure the table cannot tip.' },
  { id: 'hm_dblat', loc: 'home', need: ['db'], name: 'Dumbbell lateral raise', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], inc: 2.5, cue: 'Lead with your elbows, stop at shoulder height.' },
  { id: 'hm_bandlat', loc: 'home', need: ['bands'], name: 'Band lateral raise', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], inc: 1, cue: 'Stand on the band, raise out to the sides.' },
  { id: 'hm_kblat', loc: 'home', need: ['kb'], name: 'Kettlebell lateral raise (light bell)', m: 'sidedelts', type: 'iso', tier: 3, rr: [12, 20], inc: 4, cue: 'Hold by the handle, bell hanging down.' },
  { id: 'hm_juglat', loc: 'home', need: [], name: 'Lateral raise with water jugs or full bags', m: 'sidedelts', type: 'iso', tier: 3, rr: [12, 25], inc: 1, bw: true, cue: 'Any steady household weight works. Lead with your elbows.' },
  { id: 'hm_dbrear', loc: 'home', need: ['db'], name: 'Bent-over dumbbell rear fly', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, hinge: true, rr: [12, 20], inc: 2.5, cue: 'Bend forward, sweep the dumbbells out wide.' },
  { id: 'hm_bandface', loc: 'home', need: ['bands'], name: 'Band face pull', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [15, 20], inc: 1, prehab: true, cue: 'Pull to your forehead and turn your thumbs back.' },
  { id: 'hm_pullapart', loc: 'home', need: ['bands'], name: 'Band pull-apart', m: 'reardelts', type: 'iso', tier: 2, rr: [15, 25], inc: 1, prehab: true, cue: 'Straight arms, pull the band to your chest.' },
  { id: 'hm_proney', loc: 'home', need: [], name: 'Lying Y raise', m: 'reardelts', type: 'iso', tier: 3, rr: [10, 15], inc: 1, bw: true, prehab: true, cue: 'Face down, lift your arms in a Y shape, thumbs up.' },
  { id: 'hm_dbohp', loc: 'home', need: ['db'], name: 'Dumbbell shoulder press', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [6, 12], inc: 5, cue: 'Ribs down, press straight up.' },
  { id: 'hm_kbpress', loc: 'home', need: ['kb'], name: 'Kettlebell overhead press', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [6, 10], inc: 4, cue: 'One arm at a time, squeeze your glutes.' },
  { id: 'hm_bbohp', loc: 'home', need: ['bb'], name: 'Barbell overhead press', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 2, rr: [5, 8], inc: 5, cue: 'Glutes tight, bar over the middle of your foot.' },
  { id: 'hm_pike', loc: 'home', need: [], name: 'Pike push-up', m: 'frontdelts', sec: ['triceps'], type: 'compound', tier: 2, rr: [6, 15], inc: 1, bw: true, cue: 'Hips high, lower the top of your head toward the floor.' },
  { id: 'hm_inccurl', loc: 'home', need: ['db', 'bench'], name: 'Incline dumbbell curl', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [8, 12], inc: 5, cue: 'Arms hang behind your body.' },
  { id: 'hm_dbcurl', loc: 'home', need: ['db'], name: 'Dumbbell curl', m: 'biceps', type: 'iso', tier: 1, rr: [8, 15], inc: 5, cue: 'Elbows still, full stretch at the bottom.' },
  { id: 'hm_hammer', loc: 'home', need: ['db'], name: 'Hammer curl', m: 'biceps', type: 'iso', tier: 2, rr: [10, 15], inc: 5, cue: 'Thumbs up the whole time.' },
  { id: 'hm_kbcurl', loc: 'home', need: ['kb'], name: 'Kettlebell curl', m: 'biceps', type: 'iso', tier: 2, rr: [10, 15], inc: 4, cue: 'Hold the horns or handle, elbows still.' },
  { id: 'hm_bandcurl', loc: 'home', need: ['bands'], name: 'Band curl', m: 'biceps', type: 'iso', tier: 2, rr: [12, 20], inc: 1, cue: 'Stand on the band, squeeze at the top.' },
  { id: 'hm_dbohext', loc: 'home', need: ['db'], name: 'Overhead dumbbell triceps extension', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 5, cue: 'One dumbbell in both hands, deep stretch behind your head.' },
  { id: 'hm_dbskull', loc: 'home', need: ['db', 'bench'], name: 'Dumbbell skull crusher', m: 'triceps', type: 'iso', tier: 2, stretch: true, rr: [10, 15], inc: 5, cue: 'Lower beside your head, elbows pointing up.' },
  { id: 'hm_kbohext', loc: 'home', need: ['kb'], name: 'Overhead kettlebell triceps extension', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 4, cue: 'Hold the horns, lower behind your head.' },
  { id: 'hm_bandpush', loc: 'home', need: ['bands'], name: 'Band triceps pushdown', m: 'triceps', type: 'iso', tier: 2, rr: [12, 20], inc: 1, cue: 'Band anchored high, elbows pinned to your sides.' },
  { id: 'hm_cgpushup', loc: 'home', need: [], name: 'Close-grip push-up', m: 'triceps', sec: ['chest'], type: 'compound', tier: 2, rr: [8, 20], inc: 1, bw: true, cue: 'Hands under your shoulders, elbows close to your body.' },
  { id: 'hm_dbgoblet', loc: 'home', need: ['db'], name: 'Dumbbell goblet squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, rr: [8, 15], inc: 5, cue: 'Hold one dumbbell at your chest, sit down between your heels.' },
  { id: 'hm_kbgoblet', loc: 'home', need: ['kb'], name: 'Kettlebell goblet squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, rr: [8, 15], inc: 4, cue: 'Hold the horns at your chest, elbows inside your knees.' },
  { id: 'hm_bss', loc: 'home', need: ['db', 'bench'], name: 'Bulgarian split squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, cue: 'Back foot on the bench. Per leg.' },
  { id: 'hm_dbsplit', loc: 'home', need: ['db'], name: 'Dumbbell split squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 2, stretch: true, rr: [8, 12], inc: 5, cue: 'Per leg. Back knee drops straight down.' },
  { id: 'hm_bbsquat', loc: 'home', need: ['bb'], name: 'Barbell back squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 2, hinge: true, rr: [5, 8], inc: 5, cue: 'Set the safety arms. Stop 2 reps early.' },
  { id: 'hm_bwsplit', loc: 'home', need: [], name: 'Split squat (bodyweight)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 3, stretch: true, rr: [10, 20], inc: 1, bw: true, cue: 'Per leg. Slow on the way down.' },
  { id: 'hm_dbrdl', loc: 'home', need: ['db'], name: 'Dumbbell Romanian deadlift', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [8, 12], inc: 5, cue: 'Push your hips back, dumbbells slide down your thighs.' },
  { id: 'hm_kbrdl', loc: 'home', need: ['kb'], name: 'Kettlebell Romanian deadlift', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [8, 12], inc: 4, cue: 'Hips back, flat back, bells close to your legs.' },
  { id: 'hm_bbrdl', loc: 'home', need: ['bb'], name: 'Barbell Romanian deadlift', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [6, 10], inc: 5, cue: 'Hips back until you feel a stretch, flat back.' },
  { id: 'hm_bandcurl_leg', loc: 'home', need: ['bands'], name: 'Band leg curl', m: 'hams', type: 'iso', tier: 2, rr: [12, 20], inc: 1, cue: 'Lie face down, band anchored low, curl your heels in.' },
  { id: 'hm_slidecurl', loc: 'home', need: [], name: 'Towel hamstring curl', m: 'hams', type: 'iso', tier: 2, rr: [8, 15], inc: 1, bw: true, cue: 'On your back, heels on a towel on a smooth floor. Hips up, slide heels in.' },
  { id: 'hm_dbthrust', loc: 'home', need: ['db', 'bench'], name: 'Dumbbell hip thrust', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, rr: [10, 15], inc: 5, cue: 'Upper back on the bench, pause at the top.' },
  { id: 'hm_bbthrust', loc: 'home', need: ['bb', 'bench'], name: 'Barbell hip thrust', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, rr: [8, 12], inc: 10, cue: 'Pad the bar. Pause at the top.' },
  { id: 'hm_swing', loc: 'home', need: ['kb'], name: 'Kettlebell swing', m: 'glutes', sec: ['hams'], type: 'compound', tier: 2, hinge: true, rr: [12, 20], inc: 4, cue: 'Snap your hips forward, arms just guide the bell.' },
  { id: 'hm_bridge', loc: 'home', need: [], name: 'Single-leg glute bridge', m: 'glutes', sec: ['hams'], type: 'compound', tier: 2, rr: [10, 20], inc: 1, bw: true, cue: 'Per leg, pause at the top.' },
  { id: 'hm_dbcalf', loc: 'home', need: ['db'], name: 'Single-leg calf raise (holding a dumbbell)', m: 'calves', type: 'iso', tier: 1, stretch: true, rr: [10, 20], inc: 5, cue: 'On a step, full stretch at the bottom, 2-second pause.' },
  { id: 'hm_bwcalf', loc: 'home', need: [], name: 'Single-leg calf raise on a step', m: 'calves', type: 'iso', tier: 2, stretch: true, rr: [12, 25], inc: 1, bw: true, cue: 'Full stretch at the bottom, hold a wall for balance.' },
  { id: 'hm_hangknee', loc: 'home', need: ['bar'], name: 'Hanging knee raise', m: 'abs', type: 'iso', tier: 1, rr: [8, 15], inc: 1, bw: true, cue: 'Curl your hips up, no swinging.' },
  { id: 'hm_deadbug', loc: 'home', need: [], name: 'Dead bug', m: 'abs', type: 'iso', tier: 2, rr: [8, 12], inc: 1, bw: true, cue: 'Low back pressed to the floor the whole time.' },
  { id: 'hm_bandcrunch', loc: 'home', need: ['bands'], name: 'Kneeling band crunch', m: 'abs', type: 'iso', tier: 2, rr: [12, 20], inc: 1, cue: 'Band anchored high, curl your ribs to your hips.' },

  // ---------------- CALISTHENICS (home; bodyweight moves with bars, rings and parallettes) ----------------
  { id: 'hm_paralpu', loc: 'home', need: ['parallettes'], name: 'Deep push-up on parallettes', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, stretch: true, rr: [8, 20], inc: 1, bw: true, cue: 'Hands on the bars, lower your chest below your hands.' },
  { id: 'hm_ringpu', loc: 'home', need: ['rings'], name: 'Ring push-up', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, stretch: true, rr: [8, 15], inc: 1, bw: true, cue: 'Rings a few inches off the floor. Turn your hands out at the top.' },
  { id: 'hm_archer', loc: 'home', need: [], name: 'Archer push-up', m: 'chest', sec: ['triceps'], type: 'compound', tier: 2, rr: [5, 10], inc: 1, bw: true, cue: 'Wide hands, shift your weight to one side each rep. Per side.' },
  { id: 'hm_dip', loc: 'home', need: ['dip'], name: 'Dip', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, stretch: true, rr: [6, 12], inc: 1, bw: true, cue: 'Lean forward a little, go down until your shoulders are below your elbows.' },
  { id: 'hm_ringdip', loc: 'home', need: ['rings'], name: 'Ring dip', m: 'triceps', sec: ['chest'], type: 'compound', tier: 2, stretch: true, rr: [5, 10], inc: 1, bw: true, cue: 'Keep the rings close to your body. Use feet on the floor for help.' },
  { id: 'hm_ringrow', loc: 'home', need: ['rings'], name: 'Ring row', m: 'upperback', sec: ['lats', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 15], inc: 1, bw: true, cue: 'Walk your feet forward to make it harder.' },
  { id: 'hm_chin', loc: 'home', need: ['bar'], name: 'Chin-up (palms toward you)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, stretch: true, rr: [5, 12], inc: 1, bw: true, cue: 'Full hang at the bottom, chin over the bar.' },
  { id: 'hm_negpull', loc: 'home', need: ['bar'], name: 'Slow lowering pull-up', m: 'lats', sec: ['biceps', 'upperback'], type: 'compound', tier: 2, stretch: true, rr: [3, 6], inc: 1, bw: true, cue: 'Jump or step to the top, then lower for 5 seconds. Great if you cannot do a pull-up yet.' },
  { id: 'hm_hangleg', loc: 'home', need: ['bar'], name: 'Hanging leg raise', m: 'abs', type: 'iso', tier: 1, rr: [6, 15], inc: 1, bw: true, cue: 'Legs as straight as you can, no swinging.' },
  { id: 'hm_lsit', loc: 'home', need: ['parallettes'], name: 'L-sit hold (seconds)', m: 'abs', type: 'iso', tier: 2, rr: [10, 30], inc: 1, bw: true, cue: 'Count seconds as reps. Bend your knees to make it easier.' },
  { id: 'hm_parpike', loc: 'home', need: ['parallettes'], name: 'Pike push-up on parallettes', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, stretch: true, rr: [6, 12], inc: 1, bw: true, cue: 'Hips high, lower your head between the bars.' },
  { id: 'hm_hspu', loc: 'home', need: [], name: 'Wall handstand push-up', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 3, rr: [3, 8], inc: 1, bw: true, cue: 'Advanced. Kick up against a wall, lower your head to a pillow.' },
  { id: 'hm_ringface', loc: 'home', need: ['rings'], name: 'Ring face pull', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [10, 20], inc: 1, bw: true, prehab: true, cue: 'Lean back, pull the rings to your forehead, elbows high.' },
  { id: 'hm_ringcurl', loc: 'home', need: ['rings'], name: 'Ring curl', m: 'biceps', type: 'iso', tier: 2, rr: [8, 15], inc: 1, bw: true, cue: 'Lean back, curl your body up to your hands.' },
  { id: 'hm_ringext', loc: 'home', need: ['rings'], name: 'Ring triceps extension', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [8, 15], inc: 1, bw: true, cue: 'Lean forward, bend at the elbows, push back out.' },
  { id: 'hm_benchdip', loc: 'home', need: ['bench'], name: 'Bench dip', m: 'triceps', type: 'compound', tier: 3, rr: [10, 20], inc: 1, bw: true, cue: 'Hands on the bench behind you, elbows point back.' },
  { id: 'hm_pistol', loc: 'home', need: [], name: 'Assisted pistol squat', m: 'quads', sec: ['glutes'], type: 'compound', tier: 2, stretch: true, rr: [5, 10], inc: 1, bw: true, cue: 'Hold a doorframe, sit down on one leg. Per leg.' },
  { id: 'hm_nordic', loc: 'home', need: [], name: 'Nordic curl', m: 'hams', type: 'iso', tier: 1, rr: [3, 8], inc: 1, bw: true, cue: 'Feet hooked under a couch, lower your body forward slowly. Catch yourself with your hands.' },

  // ---------------- SPEEDIANCE GYM MONSTER (2 adjustable arms, bar, handles, ankle straps, belt; bench optional; 1 lb steps, up to 220 lb) ----------------
  { id: 'sd_bench', loc: 'sd', need: ['bench'], name: 'Bench press (bar, arms low)', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, rr: [6, 10], inc: 5, mode: 'Standard', cue: 'Bench between the arms, bar over your chest.' },
  { id: 'sd_incline', loc: 'sd', need: ['bench'], name: 'Incline press (handles, arms low)', m: 'chest', sec: ['frontdelts', 'triceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Eccentric', cue: 'Bench at a slight incline, deep stretch at the bottom.' },
  { id: 'sd_standpress', loc: 'sd', need: [], name: 'Standing chest press (handles, arms at chest height)', m: 'chest', sec: ['triceps'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Face away, split stance, press forward and together.' },
  { id: 'sd_fly', loc: 'sd', need: [], name: 'Cable fly (arms at shoulder height)', m: 'chest', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 2, mode: 'Eccentric', cue: 'Soft elbows, let your arms open wide.' },
  { id: 'sd_lowfly', loc: 'sd', need: [], name: 'Low-to-high fly (arms low)', m: 'chest', type: 'iso', tier: 2, rr: [12, 15], inc: 2, mode: 'Standard', cue: 'Sweep up to eye level for upper chest.' },
  { id: 'sd_pulldown', loc: 'sd', need: [], name: 'Kneeling lat pulldown (handles, arms high)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Full stretch at the top, elbows to your ribs.' },
  { id: 'sd_1armpd', loc: 'sd', need: [], name: 'Single-arm pulldown (arm high)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, stretch: true, rr: [10, 15], inc: 2, mode: 'Eccentric', cue: 'Reach long, pull your elbow to your hip.' },
  { id: 'sd_straight', loc: 'sd', need: [], name: 'Straight-arm pulldown (bar, arms high)', m: 'lats', type: 'iso', tier: 2, stretch: true, rr: [10, 15], inc: 2, mode: 'Standard', cue: 'Arms nearly straight, sweep to your thighs.' },
  { id: 'sd_seatrow', loc: 'sd', need: [], name: 'Seated row (bar, arms low)', m: 'upperback', sec: ['lats', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Sit facing the machine, reach long, pull to your belly.' },
  { id: 'sd_bentrow', loc: 'sd', need: [], name: 'Bent-over row (bar, arms low)', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 2, hinge: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Hinge forward, flat back.' },
  { id: 'sd_lat', loc: 'sd', need: [], name: 'Cross-body lateral raise (arm low)', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], inc: 1, mode: 'Standard', cue: 'Cable starts behind the opposite leg.' },
  { id: 'sd_ypull', loc: 'sd', need: [], name: 'Cable Y raise (arms low)', m: 'sidedelts', sec: ['reardelts'], type: 'iso', tier: 2, rr: [12, 20], inc: 1, mode: 'Standard', cue: 'Arms up and out in a Y.' },
  { id: 'sd_face', loc: 'sd', need: [], name: 'Face pull (handles, arms at head height)', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [15, 20], inc: 1, mode: 'Standard', prehab: true, cue: 'Pull to your forehead, thumbs turn back.' },
  { id: 'sd_revfly', loc: 'sd', need: [], name: 'Reverse fly (arms at shoulder height, crossed)', m: 'reardelts', type: 'iso', tier: 1, rr: [12, 20], inc: 1, mode: 'Standard', cue: 'Sweep out wide, not back.' },
  { id: 'sd_extrot', loc: 'sd', need: [], name: 'External rotation (handle, arm at elbow height)', m: 'reardelts', type: 'iso', tier: 2, rr: [12, 20], inc: 1, mode: 'Standard', prehab: true, cue: 'Elbow pinned at your side, rotate out slowly.' },
  { id: 'sd_ohp', loc: 'sd', need: [], name: 'Standing overhead press (bar, arms low)', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [6, 10], inc: 5, mode: 'Standard', cue: 'Squeeze your glutes, press straight up.' },
  { id: 'sd_bayes', loc: 'sd', need: [], name: 'Behind-the-body curl (handle, arm low)', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 1, mode: 'Eccentric', cue: 'Face away, arm pulled behind you.' },
  { id: 'sd_curl', loc: 'sd', need: [], name: 'Bar curl (arms low)', m: 'biceps', type: 'iso', tier: 2, rr: [8, 12], inc: 2, mode: 'Standard', cue: 'Elbows still.' },
  { id: 'sd_ohext', loc: 'sd', need: [], name: 'Overhead triceps extension (bar, arms low, facing away)', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 2, mode: 'Eccentric', cue: 'Split stance, deep stretch behind your head.' },
  { id: 'sd_pushdown', loc: 'sd', need: [], name: 'Triceps pushdown (bar, arms high)', m: 'triceps', type: 'iso', tier: 2, rr: [10, 15], inc: 2, mode: 'Standard', cue: 'Elbows pinned to your sides.' },
  { id: 'sd_squat', loc: 'sd', need: [], name: 'Front squat (bar, arms low)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, hinge: true, rr: [6, 10], inc: 5, mode: 'Chain', cue: 'Bar on the front of your shoulders, sit deep.' },
  { id: 'sd_split', loc: 'sd', need: [], name: 'Split squat (handles, arms low)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Per leg, back knee drops straight down.' },
  { id: 'sd_rdl', loc: 'sd', need: [], name: 'Romanian deadlift (bar, arms low)', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Hips back until you feel the stretch.' },
  { id: 'sd_legcurl', loc: 'sd', need: [], name: 'Standing leg curl (ankle strap, arm low)', m: 'hams', type: 'iso', tier: 2, rr: [10, 15], inc: 1, mode: 'Standard', cue: 'Face the machine, curl your heel up. Per leg.' },
  { id: 'sd_thrust', loc: 'sd', need: [], name: 'Belt hip thrust (arms low)', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, rr: [10, 15], inc: 5, mode: 'Chain', cue: 'Shoulders on the floor or bench, pause at the top.' },
  { id: 'sd_kickback', loc: 'sd', need: [], name: 'Glute kickback (ankle strap, arm low)', m: 'glutes', type: 'iso', tier: 2, rr: [12, 15], inc: 1, mode: 'Standard', cue: 'Kick back and slightly out. Per leg.' },
  { id: 'sd_calf', loc: 'sd', need: [], name: 'Standing calf raise (bar, arms low)', m: 'calves', type: 'iso', tier: 2, stretch: true, rr: [10, 15], inc: 5, mode: 'Standard', cue: 'Toes on a plate, full stretch at the bottom.' },
  { id: 'sd_crunch', loc: 'sd', need: [], name: 'Kneeling cable crunch (handles, arms high)', m: 'abs', type: 'iso', tier: 1, rr: [10, 15], inc: 2, mode: 'Standard', cue: 'Round your back, hips stay still.' },

  // ---------------- TONAL (2 adjustable arms that also swing out; smart handles, smart bar, rope; bench optional; 1 lb steps, up to 250 lb) ----------------
  { id: 'tn_bench', loc: 'tonal', need: ['bench'], name: 'Bench press (smart bar, arms low)', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, rr: [6, 10], inc: 5, mode: 'Standard', cue: 'Smart Bench in front of Tonal, bar over your chest.' },
  { id: 'tn_dbpress', loc: 'tonal', need: ['bench'], name: 'Bench chest press (handles)', m: 'chest', sec: ['triceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Eccentric', cue: 'Like dumbbells: deep stretch at the bottom.' },
  { id: 'tn_standpress', loc: 'tonal', need: [], name: 'Standing chest press (handles, arms out at chest height)', m: 'chest', sec: ['triceps'], type: 'compound', tier: 1, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Face away, split stance, press forward.' },
  { id: 'tn_fly', loc: 'tonal', need: [], name: 'Standing chest fly (arms out at shoulder height)', m: 'chest', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 2, mode: 'Eccentric', cue: 'Soft elbows, let the arms pull you open.' },
  { id: 'tn_pulldown', loc: 'tonal', need: [], name: 'Kneeling lat pulldown (arms high)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Kneel facing Tonal, elbows to your ribs.' },
  { id: 'tn_1armpd', loc: 'tonal', need: [], name: 'Single-arm lat pulldown (arm high)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, stretch: true, rr: [10, 15], inc: 2, mode: 'Eccentric', cue: 'Reach long at the top.' },
  { id: 'tn_straight', loc: 'tonal', need: [], name: 'Straight-arm pulldown (rope, arms high)', m: 'lats', type: 'iso', tier: 2, rr: [10, 15], inc: 2, mode: 'Standard', cue: 'Arms nearly straight, sweep to your thighs.' },
  { id: 'tn_row', loc: 'tonal', need: [], name: 'Seated row (smart bar, arms low)', m: 'upperback', sec: ['lats', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Sit facing Tonal, reach long, pull to your belly.' },
  { id: 'tn_bentrow', loc: 'tonal', need: [], name: 'Bent-over row (smart bar, arms low)', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 2, hinge: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Hinge forward, flat back.' },
  { id: 'tn_lat', loc: 'tonal', need: [], name: 'Single-arm lateral raise (arm low)', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], inc: 1, mode: 'Standard', cue: 'Stand side-on, cable crosses in front of you.' },
  { id: 'tn_face', loc: 'tonal', need: [], name: 'Face pull (rope, arms at head height)', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [15, 20], inc: 1, mode: 'Standard', prehab: true, cue: 'Pull to your forehead, hands apart at the end.' },
  { id: 'tn_revfly', loc: 'tonal', need: [], name: 'Reverse fly (arms out at shoulder height)', m: 'reardelts', type: 'iso', tier: 1, rr: [12, 20], inc: 1, mode: 'Standard', cue: 'Face Tonal, sweep your arms out wide.' },
  { id: 'tn_ohp', loc: 'tonal', need: [], name: 'Standing overhead press (handles, arms low)', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [6, 10], inc: 5, mode: 'Standard', cue: 'Ribs down, press straight up.' },
  { id: 'tn_bayes', loc: 'tonal', need: [], name: 'Behind-the-body curl (handle, arm low)', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 1, mode: 'Eccentric', cue: 'Face away, arm pulled behind you.' },
  { id: 'tn_curl', loc: 'tonal', need: [], name: 'Bar curl (smart bar, arms low)', m: 'biceps', type: 'iso', tier: 2, rr: [8, 12], inc: 2, mode: 'Standard', cue: 'Elbows still.' },
  { id: 'tn_ohext', loc: 'tonal', need: [], name: 'Overhead triceps extension (rope, arms low, facing away)', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 2, mode: 'Eccentric', cue: 'Deep stretch behind your head.' },
  { id: 'tn_pushdown', loc: 'tonal', need: [], name: 'Triceps pushdown (rope, arms high)', m: 'triceps', type: 'iso', tier: 2, rr: [10, 15], inc: 2, mode: 'Standard', cue: 'Elbows pinned, spread the rope at the bottom.' },
  { id: 'tn_squat', loc: 'tonal', need: [], name: 'Front squat (smart bar, arms low)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, hinge: true, rr: [6, 10], inc: 5, mode: 'Chains', cue: 'Bar on the front of your shoulders.' },
  { id: 'tn_split', loc: 'tonal', need: [], name: 'Split squat (handles, arms low)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Per leg.' },
  { id: 'tn_rdl', loc: 'tonal', need: [], name: 'Romanian deadlift (smart bar, arms low)', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [8, 12], inc: 5, mode: 'Standard', cue: 'Hips back until you feel the stretch.' },
  { id: 'tn_1legrdl', loc: 'tonal', need: [], name: 'Single-leg Romanian deadlift (handle)', m: 'hams', sec: ['glutes'], type: 'compound', tier: 2, stretch: true, hinge: true, rr: [8, 12], inc: 2, mode: 'Standard', cue: 'Per leg, hips stay square.' },
  { id: 'tn_thrust', loc: 'tonal', need: ['bench'], name: 'Hip thrust (smart bar, bench)', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, rr: [10, 15], inc: 5, mode: 'Chains', cue: 'Upper back on the bench, pause at the top.' },
  { id: 'tn_bridge', loc: 'tonal', need: [], name: 'Glute bridge (smart bar, on the floor)', m: 'glutes', sec: ['hams'], type: 'compound', tier: 2, rr: [10, 15], inc: 5, mode: 'Standard', cue: 'Bar across your hips, pause at the top.' },
  { id: 'tn_calf', loc: 'tonal', need: [], name: 'Standing calf raise (smart bar, arms low)', m: 'calves', type: 'iso', tier: 2, stretch: true, rr: [10, 15], inc: 5, mode: 'Standard', cue: 'Full stretch at the bottom.' },
  { id: 'tn_crunch', loc: 'tonal', need: [], name: 'Kneeling rope crunch (arms high)', m: 'abs', type: 'iso', tier: 1, rr: [10, 15], inc: 2, mode: 'Standard', cue: 'Round your back, hips stay still.' },

  // ---------------- AMP (wall-mounted, one adjustable arm; handles, bar, rope; Fixed / Band / Eccentric modes; up to about 100 lb) ----------------
  { id: 'am_press', loc: 'amp', need: [], name: 'Standing chest press (handles, arm at chest height)', m: 'chest', sec: ['triceps'], type: 'compound', tier: 1, rr: [8, 12], inc: 2, mode: 'Fixed', cue: 'Face away, split stance, press forward.' },
  { id: 'am_1armpress', loc: 'amp', need: [], name: 'Single-arm chest press (handle)', m: 'chest', sec: ['triceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 2, mode: 'Eccentric', cue: 'One arm at a time, brace your core.' },
  { id: 'am_fly', loc: 'amp', need: [], name: 'Single-arm cable fly (handle, arm at shoulder height)', m: 'chest', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 1, mode: 'Eccentric', cue: 'Stand side-on, sweep across your body.' },
  { id: 'am_pulldown', loc: 'amp', need: [], name: 'Kneeling lat pulldown (bar, arm high)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 2, mode: 'Fixed', cue: 'Full stretch at the top, elbows to your ribs.' },
  { id: 'am_1armpd', loc: 'amp', need: [], name: 'Single-arm pulldown (handle, arm high)', m: 'lats', sec: ['biceps'], type: 'compound', tier: 1, stretch: true, rr: [10, 15], inc: 1, mode: 'Eccentric', cue: 'Reach long, elbow to your hip.' },
  { id: 'am_straight', loc: 'amp', need: [], name: 'Straight-arm pulldown (rope, arm high)', m: 'lats', type: 'iso', tier: 2, rr: [10, 15], inc: 1, mode: 'Fixed', cue: 'Arms nearly straight.' },
  { id: 'am_row', loc: 'amp', need: [], name: 'Seated row (bar, arm low)', m: 'upperback', sec: ['lats', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 2, mode: 'Fixed', cue: 'Sit facing the wall, pull to your belly.' },
  { id: 'am_1armrow', loc: 'amp', need: [], name: 'Single-arm row (handle, arm at chest height)', m: 'upperback', sec: ['lats'], type: 'compound', tier: 1, stretch: true, rr: [10, 15], inc: 1, mode: 'Standard', cue: 'Let your shoulder reach forward, then pull.' },
  { id: 'am_lat', loc: 'amp', need: [], name: 'Cross-body lateral raise (handle, arm low)', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], inc: 1, mode: 'Fixed', cue: 'Cable starts behind the opposite leg.' },
  { id: 'am_face', loc: 'amp', need: [], name: 'Face pull (rope, arm at head height)', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [15, 20], inc: 1, mode: 'Fixed', prehab: true, cue: 'Pull to your forehead, thumbs turn back.' },
  { id: 'am_revfly', loc: 'amp', need: [], name: 'Single-arm reverse fly (handle, arm at shoulder height)', m: 'reardelts', type: 'iso', tier: 1, rr: [12, 20], inc: 1, mode: 'Fixed', cue: 'Stand side-on, sweep the arm out and back.' },
  { id: 'am_ohp', loc: 'amp', need: [], name: 'Single-arm overhead press (handle, arm low)', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [8, 12], inc: 1, mode: 'Fixed', cue: 'Stand over the cable, press straight up.' },
  { id: 'am_curl', loc: 'amp', need: [], name: 'Bar curl (arm low)', m: 'biceps', type: 'iso', tier: 1, rr: [8, 12], inc: 1, mode: 'Eccentric', cue: 'Elbows still.' },
  { id: 'am_bayes', loc: 'amp', need: [], name: 'Behind-the-body curl (handle, arm low)', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 1, mode: 'Fixed', cue: 'Face away, arm pulled behind you.' },
  { id: 'am_ohext', loc: 'amp', need: [], name: 'Overhead triceps extension (rope, arm low, facing away)', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], inc: 1, mode: 'Eccentric', cue: 'Deep stretch behind your head.' },
  { id: 'am_pushdown', loc: 'amp', need: [], name: 'Triceps pushdown (rope, arm high)', m: 'triceps', type: 'iso', tier: 2, rr: [10, 15], inc: 1, mode: 'Fixed', cue: 'Elbows pinned.' },
  { id: 'am_squat', loc: 'amp', need: [], name: 'Goblet squat (rope or handle, arm low)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, rr: [10, 15], inc: 2, mode: 'Band', cue: 'Hold at your chest, sit down between your heels.' },
  { id: 'am_split', loc: 'amp', need: [], name: 'Split squat (handle, arm low)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], inc: 2, mode: 'Fixed', cue: 'Per leg.' },
  { id: 'am_rdl', loc: 'amp', need: [], name: 'Romanian deadlift (bar, arm low)', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [10, 15], inc: 2, mode: 'Fixed', cue: 'Hips back until you feel the stretch.' },
  { id: 'am_pullthru', loc: 'amp', need: [], name: 'Cable pull-through (rope, arm low)', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, hinge: true, rr: [12, 15], inc: 2, mode: 'Fixed', cue: 'Face away, rope between your legs, snap your hips forward.' },
  { id: 'am_kickback', loc: 'amp', need: [], name: 'Glute kickback (handle around the foot, arm low)', m: 'glutes', type: 'iso', tier: 2, rr: [12, 15], inc: 1, mode: 'Fixed', cue: 'Per leg.' },
  { id: 'am_calf', loc: 'amp', need: [], name: 'Single-leg calf raise (handle, arm low)', m: 'calves', type: 'iso', tier: 2, stretch: true, rr: [10, 20], inc: 1, mode: 'Fixed', cue: 'On a step, full stretch at the bottom.' },
  { id: 'am_crunch', loc: 'amp', need: [], name: 'Kneeling rope crunch (arm high)', m: 'abs', type: 'iso', tier: 1, rr: [10, 15], inc: 1, mode: 'Fixed', cue: 'Round your back, hips stay still.' },

  // ---------------- VITRUVIAN TRAINER+ (floor platform, 2 cables, bar, handles, ankle straps, rope; kg per cable, up to 100 per cable) ----------------
  { id: 'vt_floorpress', loc: 'vit', need: [], name: 'Floor press (bar)', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, rr: [6, 10], cables: 2, inc: 1, mode: 'Old School', cue: 'Lie on the platform, pause when your elbows touch.' },
  { id: 'vt_benchpress', loc: 'vit', need: ['bench'], name: 'Bench press (bar, bench over the platform)', m: 'chest', sec: ['triceps', 'frontdelts'], type: 'compound', tier: 1, stretch: true, rr: [6, 10], cables: 2, inc: 1, mode: 'Old School', cue: 'Bench over the platform, full range.' },
  { id: 'vt_fly', loc: 'vit', need: [], name: 'Lying cable fly (handles)', m: 'chest', type: 'iso', tier: 1, stretch: true, rr: [10, 15], cables: 2, inc: 0.5, mode: 'Eccentric Only', cue: 'Soft elbows, open wide.' },
  { id: 'vt_1armpress', loc: 'vit', need: [], name: 'Single-arm floor press (handle)', m: 'chest', sec: ['triceps'], type: 'compound', tier: 2, rr: [8, 12], cables: 1, inc: 0.5, mode: 'Old School', cue: 'Brace your free side.' },
  { id: 'vt_bentrow', loc: 'vit', need: [], name: 'Bent-over row (bar)', m: 'upperback', sec: ['lats', 'reardelts'], type: 'compound', tier: 1, hinge: true, rr: [8, 12], cables: 2, inc: 1, mode: 'Old School', cue: 'Torso near flat, pull to your belly button.' },
  { id: 'vt_1armrow', loc: 'vit', need: [], name: 'Single-arm row (handle)', m: 'lats', sec: ['upperback'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [8, 12], cables: 1, inc: 0.5, mode: 'Time Under Tension', cue: 'Let the shoulder reach down, pull to your hip.' },
  { id: 'vt_seatrow', loc: 'vit', need: [], name: 'Seated floor row (bar)', m: 'lats', sec: ['upperback', 'biceps'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], cables: 2, inc: 1, mode: 'Old School', cue: 'Sit on the floor, feet against the platform.' },
  { id: 'vt_rear', loc: 'vit', need: [], name: 'Bent-over rear fly (handles, cables crossed)', m: 'reardelts', type: 'iso', tier: 1, hinge: true, rr: [12, 20], cables: 2, inc: 0.5, mode: 'Old School', cue: 'Sweep out wide.' },
  { id: 'vt_face', loc: 'vit', need: [], name: 'Lying face pull (rope)', m: 'reardelts', sec: ['upperback'], type: 'iso', tier: 1, rr: [15, 20], cables: 2, inc: 0.5, mode: 'Old School', prehab: true, cue: 'Lie with your head toward the platform, pull to your forehead.' },
  { id: 'vt_lat', loc: 'vit', need: [], name: 'Cross-body lateral raise (handle)', m: 'sidedelts', type: 'iso', tier: 1, rr: [12, 20], cables: 1, inc: 0.5, mode: 'Old School', cue: 'Cable starts behind the opposite leg.' },
  { id: 'vt_highpull', loc: 'vit', need: [], name: 'High pull (handles)', m: 'sidedelts', sec: ['upperback', 'reardelts'], type: 'compound', tier: 2, rr: [10, 15], cables: 2, inc: 0.5, mode: 'Old School', cue: 'Hands finish above your elbows.' },
  { id: 'vt_ohp', loc: 'vit', need: [], name: 'Standing overhead press (bar)', m: 'frontdelts', sec: ['triceps', 'sidedelts'], type: 'compound', tier: 1, rr: [6, 10], cables: 2, inc: 1, mode: 'Old School', cue: 'Squeeze your glutes, press straight up.' },
  { id: 'vt_curl', loc: 'vit', need: [], name: 'Bar curl', m: 'biceps', type: 'iso', tier: 1, rr: [8, 12], cables: 2, inc: 0.5, mode: 'Eccentric Only', cue: 'Elbows still.' },
  { id: 'vt_bayes', loc: 'vit', need: [], name: 'Behind-the-body curl (handle)', m: 'biceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], cables: 1, inc: 0.5, mode: 'Old School', cue: 'Step forward so the arm is pulled behind you.' },
  { id: 'vt_ohext', loc: 'vit', need: [], name: 'Overhead triceps extension (rope, facing away)', m: 'triceps', type: 'iso', tier: 1, stretch: true, rr: [10, 15], cables: 2, inc: 0.5, mode: 'Eccentric Only', cue: 'Deep stretch behind your head.' },
  { id: 'vt_kickback', loc: 'vit', need: [], name: 'Cable kickback (handle)', m: 'triceps', type: 'iso', tier: 2, rr: [12, 20], cables: 1, inc: 0.5, mode: 'Old School', cue: 'Upper arm parallel to the floor.' },
  { id: 'vt_squat', loc: 'vit', need: [], name: 'Front squat (bar)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, hinge: true, rr: [6, 10], cables: 2, inc: 1, mode: 'Old School', cue: 'Bar on the front of your shoulders, sit deep.' },
  { id: 'vt_split', loc: 'vit', need: [], name: 'Split squat (handles)', m: 'quads', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, rr: [8, 12], cables: 2, inc: 0.5, mode: 'Old School', cue: 'Front foot on the platform. Per leg.' },
  { id: 'vt_rdl', loc: 'vit', need: [], name: 'Romanian deadlift (bar)', m: 'hams', sec: ['glutes'], type: 'compound', tier: 1, stretch: true, hinge: true, rr: [8, 12], cables: 2, inc: 1, mode: 'Old School', cue: 'Hips back until you feel the stretch.' },
  { id: 'vt_legcurl', loc: 'vit', need: [], name: 'Lying leg curl (ankle straps)', m: 'hams', type: 'iso', tier: 2, rr: [10, 15], cables: 2, inc: 0.5, mode: 'Old School', cue: 'Face down, feet toward the platform.' },
  { id: 'vt_thrust', loc: 'vit', need: [], name: 'Hip thrust (bar across the hips)', m: 'glutes', sec: ['hams'], type: 'compound', tier: 1, rr: [10, 15], cables: 2, inc: 1, mode: 'Old School', cue: 'Shoulders on the floor, pause at the top.' },
  { id: 'vt_calf', loc: 'vit', need: [], name: 'Standing calf raise (bar)', m: 'calves', type: 'iso', tier: 2, stretch: true, rr: [10, 15], cables: 2, inc: 1, mode: 'Old School', cue: 'Toes on the platform edge.' },
  { id: 'vt_crunch', loc: 'vit', need: [], name: 'Lying cable crunch (rope)', m: 'abs', type: 'iso', tier: 2, rr: [12, 15], cables: 2, inc: 0.5, mode: 'Old School', cue: 'Head toward the platform, rope at your chest.' }
];
const EXBYID = Object.fromEntries(EX.map(e => [e.id, e]));

/* Places to lift. unit/inc/max describe how each place shows weight. perCable: the number is set per cable. */
const PLACES = {
  gym: { name: 'Gym', full: 'Commercial gym', unit: 'lb', inc: 5 },
  home: { name: 'Home', full: 'Home (free weights)', unit: 'lb', inc: 5 },
  hotworx: { name: 'HOTWORX', full: 'HOTWORX FX Zone', unit: 'lb', inc: 5 },
  hotel: { name: 'Hotel', full: 'Traveling', unit: 'lb', inc: 5 },
  p1: { name: 'P1 Max', full: 'Innodigym P1 Max', unit: 'kg', inc: 1, max: 75, perCable: true, machine: true, modes: 'Standard' },
  sd: { name: 'Speediance', full: 'Speediance Gym Monster', unit: 'lb', inc: 1, max: 220, machine: true, modes: 'Standard, Eccentric, Chain, Constant' },
  tonal: { name: 'Tonal', full: 'Tonal', unit: 'lb', inc: 1, max: 250, machine: true, modes: 'Standard, Eccentric, Chains, Burnout, Spotter' },
  amp: { name: 'amp', full: 'amp', unit: 'lb', inc: 1, max: 100, machine: true, modes: 'Fixed, Band, Eccentric' },
  vit: { name: 'Vitruvian', full: 'Vitruvian Trainer+', unit: 'kg', inc: 0.5, max: 100, perCable: true, machine: true, modes: 'Old School, Time Under Tension, Pump, Eccentric Only, Echo' }
};
const HOME_EQUIP = [
  { k: 'db', t: 'Dumbbells' }, { k: 'kb', t: 'Kettlebells' }, { k: 'bands', t: 'Resistance bands' }, { k: 'bar', t: 'Pull-up bar' },
  { k: 'bench', t: 'Bench' }, { k: 'bb', t: 'Barbell and rack' }, { k: 'rings', t: 'Gymnastic rings' }, { k: 'parallettes', t: 'Parallettes or handstand bars' }, { k: 'dip', t: 'Dip bars' }
];
function placeOf(loc) { return PLACES[loc] || PLACES.gym; }
/* Hotel workouts use the home library with whatever the hotel has. */
function libOf(loc) { return loc === 'hotel' ? 'home' : loc; }
function equipFor(profile, loc) { return loc === 'hotel' ? (profile.travelEquip || ['db', 'bench']) : (profile.homeEquip || []); }
/* Plates per side for a barbell. Greedy with standard lb plates. */
function platesFor(total, bar = 45, plates = [45, 35, 25, 10, 5, 2.5]) {
  let side = (total - bar) / 2; const out = [];
  if (side < 0) return { ok: false, side: 0, plates: [], leftover: 0 };
  for (const p of plates) { while (side >= p - 1e-9) { out.push(p); side -= p; } }
  return { ok: side < 0.01, plates: out, leftover: Math.round(side * 100) / 100 };
}
function isBarbell(ex) { return !!ex && (ex.equip === 'barbell' || (ex.need || []).includes('bb') || /barbell|deadlift|back squat/i.test(ex.name || '')) && !PLACES[ex.loc]?.machine; }
/* Best set so far: estimated max for weighted sets, most reps for bodyweight. */
function bestOf(rows) {
  if (!rows || !rows.length) return null;
  const w = rows.filter(r => +r.load > 0);
  if (w.length) { const b = w.reduce((m, r) => { const e = e1rm(+r.load, +r.reps, 0); return e > m.e ? { e, r } : m; }, { e: 0, r: null }); return { kind: 'load', value: b.e, row: b.r }; }
  const b = rows.reduce((m, r) => +r.reps > (m?.reps || 0) ? r : m, null); return { kind: 'reps', value: +b.reps, row: b };
}
function unitOf(loc) { return placeOf(loc).unit; }
function unitText(loc) { const p = placeOf(loc); return loc === 'p1' ? 'kg on the dial' : p.perCable ? 'kg per cable' : p.machine ? 'lb on the screen' : 'lb'; }

/* Specialized training: logged sessions the plan works around. kpm = calories per minute at 180 lb. legs: hard on the legs. boost: body parts that get a little extra lifting work. */
const SPORTS = [
  { k: 'hotworx', name: 'HOTWORX', min: 30, kpm: 6, legs: false, boost: [] },
  { k: 'boxing', name: 'Boxing', min: 60, kpm: 9, legs: false, boost: ['upperback', 'reardelts'] },
  { k: 'mma', name: 'MMA or kickboxing', min: 60, kpm: 10, legs: true, boost: ['upperback', 'hams'] },
  { k: 'bjj', name: 'Jiu-jitsu or wrestling', min: 60, kpm: 9, legs: false, boost: ['upperback', 'lats'] },
  { k: 'football', name: 'Football', min: 90, kpm: 8, legs: true, boost: ['glutes', 'hams'] },
  { k: 'basketball', name: 'Basketball', min: 60, kpm: 8, legs: true, boost: ['calves', 'quads'] },
  { k: 'soccer', name: 'Soccer', min: 60, kpm: 8, legs: true, boost: ['hams', 'calves'] },
  { k: 'running', name: 'Running', min: 30, kpm: 11, legs: true, boost: ['hams', 'calves'] },
  { k: 'cycling', name: 'Cycling or spin', min: 45, kpm: 8, legs: true, boost: ['hams', 'glutes'] },
  { k: 'crossfit', name: 'CrossFit or boot camp', min: 60, kpm: 10, legs: true, boost: [] },
  { k: 'racquet', name: 'Tennis or pickleball', min: 60, kpm: 7, legs: true, boost: ['reardelts', 'upperback'] },
  { k: 'swim', name: 'Swimming', min: 45, kpm: 8, legs: false, boost: ['reardelts', 'lats'] },
  { k: 'yoga', name: 'Yoga or Pilates', min: 60, kpm: 3.5, legs: false, boost: [], easy: true }
];
const SPORTBYK = Object.fromEntries(SPORTS.map(s => [s.k, s]));

/* HOTWORX infrared sauna sessions (logged, not programmed). HIIT ones count toward weekly conditioning. */
const HOTWORX = [
  { k: 'cycle', name: 'Hot Cycle', min: 15, kind: 'hiit' }, { k: 'blast', name: 'Hot Blast', min: 15, kind: 'hiit' }, { k: 'thunder', name: 'Hot Thunder (rower)', min: 15, kind: 'hiit' },
  { k: 'iso', name: 'Hot Iso', min: 30, kind: 'iso' }, { k: 'buns', name: 'Hot Buns', min: 30, kind: 'iso' }, { k: 'core', name: 'Hot Core', min: 30, kind: 'iso' },
  { k: 'warrior', name: 'Hot Warrior', min: 30, kind: 'iso' }, { k: 'bands', name: 'Hot Bands', min: 30, kind: 'iso' }, { k: 'pilates', name: 'Hot Pilates', min: 30, kind: 'iso' },
  { k: 'yoga', name: 'Hot Yoga', min: 30, kind: 'iso' }, { k: 'barre', name: 'Hot Barre None', min: 30, kind: 'iso' }, { k: 'stretch', name: 'Hot Stretch', min: 30, kind: 'recovery' }
];

/* ============================================================
   NUTRITION TARGETS
   ============================================================ */
function bmrStandard(sex, kg, cm, age) {
  return 10 * kg + 6.25 * cm - 5 * age + (sex === 'female' ? -161 : 5);
}
function bmrLean(lbmKg) { return 370 + 21.6 * lbmKg; }

/* Activity factor without exercise, then exercise added separately. */
const JOB_FACTOR = { desk: 1.25, mixed: 1.4, onfeet: 1.55, physical: 1.7 };

function leanCategory(sex, bf) {
  // leanness categories, used for rate of loss and protein
  if (bf == null) return 'unknown';
  if (sex === 'female') return bf < 24 ? 'lean' : bf < 30 ? 'moderate' : 'higher';
  return bf < 15 ? 'lean' : bf < 25 ? 'moderate' : 'higher';
}

/** Weekly loss rate as %BW per week (0.5 to 1.0; leaner = slower). */
function lossRatePct(profile) {
  const cat = leanCategory(profile.sex, profile.bf);
  const pref = profile.pace || 'moderate';          // slow | moderate | aggressive
  // Capped at 1.0% for everyone (faster costs muscle and strength).
  const table = { lean: [0.4, 0.5, 0.7], moderate: [0.5, 0.75, 1.0], higher: [0.75, 0.9, 1.0], unknown: [0.5, 0.7, 0.9] };
  const idx = { slow: 0, moderate: 1, aggressive: 2 }[pref] ?? 1;
  return table[cat][idx];
}

function estimateTDEE(profile) {
  const kg = profile.weightLb / KG;
  const cm = profile.heightIn * 2.54;
  let bmr, method;
  if (profile.bf != null && profile.bf > 3) {
    bmr = bmrLean(kg * (1 - profile.bf / 100)); method = 'lean mass (uses body fat)';
  } else {
    bmr = bmrStandard(profile.sex, kg, cm, profile.age || 35); method = 'height, weight and age';
  }
  const job = JOB_FACTOR[profile.job] || 1.3;
  const steps = profile.steps || 6000;
  const stepKcal = Math.max(0, steps - 3000) * 0.04 * (profile.weightLb / 180);
  const sessions = profile.daysPerWeek || 3;
  const sessKcal = sessions * (profile.sessionMin || 45) * 4 / 7;     // ~4 kcal/min of lifting, averaged daily
  const sportKcal = (profile.sports || []).reduce((s, x) => { const sp = SPORTBYK[x.k]; return sp ? s + (x.n || 1) * sp.min * sp.kpm * 0.85 * (profile.weightLb / 180) : s; }, 0) / 7;   // net of resting burn
  const tdee = bmr * job + stepKcal + sessKcal + sportKcal;
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), method };
}

/**
 * Daily targets. `tdeeOverride` comes from the adaptive estimate once logging data exists.
 */
function calcTargets(profile, opts = {}) {
  const why = [];
  const est = estimateTDEE(profile);
  const tdee = opts.tdeeOverride || est.tdee;
  why.push(opts.tdeeOverride ? `You burn about ${tdee} calories a day, measured from what you ate and how your weight moved.` : `You burn about ${tdee} calories a day, estimated from your size, job, steps, workouts${(profile.sports || []).length ? ' and sports' : ''}.`);

  const lb = profile.weightLb, kg = lb / KG;
  const bf = profile.bf;
  const lbmKg = bf != null ? kg * (1 - bf / 100) : null;
  const goal = profile.goal || 'fatloss';
  let kcal = tdee, ratePct = 0;

  if (goal === 'fatloss') {
    ratePct = lossRatePct(profile);
    const lbPerWk = lb * ratePct / 100;
    const deficit = Math.min(lbPerWk * 3500 / 7, tdee * 0.3);   // cap deficit at 30% of TDEE
    kcal = tdee - deficit;
    why.push(`Lose about ${lbPerWk.toFixed(1)} lb a week. Slower than that keeps your muscle; faster usually costs muscle and energy.`);
  } else if (goal === 'gain') {
    const y = profile.trainingYears || 0;
    ratePct = y < 1 ? 2 : y < 2 ? 1.5 : y < 4 ? 1 : 0.5;          // %BW per month by training age
    if (profile.returning) ratePct = Math.max(ratePct, 1);
    kcal = tdee + lb * ratePct / 100 * 3000 / 30;
    why.push(`Gain about ${(profile.weightLb * ratePct / 100).toFixed(1)} lb a month. Gaining slowly means most of it is muscle, not fat.`);
  } else if (goal === 'recomp') {
    kcal = tdee - 150;
    why.push('Eat a little under what you burn and lots of protein, so you lose some fat and build some muscle at the same time.');
  } else {
    why.push('Eat about what you burn so your weight stays steady while you get stronger.');
  }

  // floor so the plan never undercuts reasonable minimums
  const floor = profile.sex === 'female' ? 1200 : 1500;
  if (kcal < floor) { kcal = floor; why.push(`Calories stay at ${floor} or more, the lowest that is safe to eat every day.`); }
  kcal = Math.round(kcal / 10) * 10;

  // Protein: deficit 2.3-3.1 g/kg LBM ; otherwise 1.6-2.2 g/kg
  let protein;
  const cat = leanCategory(profile.sex, bf);
  if (goal === 'fatloss' || goal === 'recomp') {
    if (lbmKg && cat !== 'higher') { const f = cat === 'lean' ? 2.8 : 2.5; protein = lbmKg * f; why.push(`Protein ${Math.round(protein)} g a day. High protein while losing weight is the main thing that protects your muscle.`); }
    else { const tw = profile.goalWeightLb || lb * 0.9; protein = tw * 1.0; why.push(`Protein ${Math.round(protein)} g a day, about 1 g per pound of your goal weight. It keeps you full and protects your muscle.`); }
  } else {
    protein = kg * 2.0; why.push(`Protein ${Math.round(protein)} g a day. That is enough to build muscle; more than this adds little.`);
  }
  protein = Math.round(protein / 5) * 5;

  // Fat: 25% of kcal, floor 0.3 g/lb (about 0.66 g/kg) for hormones; diet style shifts it
  const style = profile.dietStyle || 'balanced';
  let fatPct = { balanced: 0.25, highcarb: 0.20, lowcarb: 0.40, weekendcarb: 0.60 }[style] ?? 0.25;
  let fat = kcal * fatPct / 9;
  const fatFloor = Math.max(lb * 0.3, kcal * 0.15 / 9);         // 0.3 g/lb, 15% floor
  if (fat < fatFloor) fat = fatFloor;
  fat = Math.round(fat / 5) * 5;
  let carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  if (style === 'weekendcarb') { carbs = Math.min(carbs, 30); fat = Math.round((kcal - protein * 4 - carbs * 4) / 9 / 5) * 5; why.push('Weekend carb-up: very low carbs on weekdays, more carbs on the weekend. This is an optional special diet.'); }
  carbs = Math.round(carbs / 5) * 5;
  why.push(`Fat ${fat} g, enough for healthy hormones. Carbs make up the rest (${carbs} g) and give you energy for workouts.`);

  const base = { kcal, protein, fat, carbs, fiber: Math.round(kcal / 1000 * 14) };

  // Training vs rest day split (carb shift; weekly average unchanged)
  let trainDay = { ...base }, restDay = { ...base };
  if (profile.carbCycle && style !== 'weekendcarb') {
    const d = profile.daysPerWeek || 3;
    const shift = Math.round(base.carbs * 0.25 / 5) * 5;              // +25% carbs on training days
    const restCut = Math.round(shift * d / Math.max(1, 7 - d) / 5) * 5;
    trainDay = { ...base, carbs: base.carbs + shift, kcal: base.kcal + shift * 4 };
    restDay = { ...base, carbs: Math.max(30, base.carbs - restCut), kcal: base.kcal - restCut * 4 };
    why.push(`More carbs on workout days (+${shift} g) and fewer on rest days (-${restCut} g). Your weekly total stays the same.`);
  }
  return { tdee, ratePct, base, trainDay, restDay, why, method: est.method };
}

/* ============================================================
   TREND WEIGHT + ADAPTIVE MAINTENANCE  
   ============================================================ */
function trendSeries(weights) {
  // weights: [{date, lb}] -> EWMA, alpha 0.1 (Hacker's Diet), gaps carried
  const s = [...weights].filter(w => w.lb > 0).sort((a, b) => a.date < b.date ? -1 : 1);
  let t = null; const out = [];
  for (const w of s) { t = t == null ? w.lb : t + 0.1 * (w.lb - t); out.push({ date: w.date, lb: w.lb, trend: +t.toFixed(2) }); }
  return out;
}

/**
 * Estimate real maintenance from logged intake and trend change.
 * Needs 14+ days with 10+ logged days.
 */
function adaptiveTDEE(intakeByDate, weights, today, priorTDEE) {
  const start = addDays(today, -21);
  const tr = trendSeries(weights).filter(x => x.date >= start && x.date <= today);
  const days = Object.keys(intakeByDate).filter(d => d >= start && d < today && intakeByDate[d] > 600);
  if (tr.length < 2 || days.length < 10) return { ok: false, logged: days.length, need: 10, reason: `Need 10 logged food days and 2+ weigh-ins in the last 3 weeks (have ${days.length} days, ${tr.length} weigh-ins).` };
  const span = Math.max(7, daysBetween(tr[0].date, tr[tr.length - 1].date));
  const dLbPerDay = (tr[tr.length - 1].trend - tr[0].trend) / span;
  const intake = avg(days.map(d => intakeByDate[d]));
  const measured = intake - dLbPerDay * 3500;
  // blend with prior so a single noisy period cannot swing the number
  const conf = clamp(days.length / 21, 0.3, 0.8);
  const tdee = priorTDEE ? priorTDEE * (1 - conf) + measured * conf : measured;
  return { ok: true, tdee: Math.round(tdee), measured: Math.round(measured), intake: Math.round(intake), lbPerWeek: +(dLbPerDay * 7).toFixed(2), logged: days.length, conf };
}

/** Leanness categories: weeks of straight dieting before a 2-week break. */
function dietBreakLimitWeeks(profile) {
  const cat = leanCategory(profile.sex, profile.bf);
  return { lean: 6, moderate: 10, higher: 14, unknown: 10 }[cat];
}

/**
 * Weekly check-in: decides whether calories move, and why.
 * state: {phaseStart, weeksInDeficit, lastReview}
 * Returns {newTDEE, change, notes, dietBreak, refeed}
 */
function weeklyReview(profile, targets, intakeByDate, weights, today, state = {}) {
  const out = { change: 0, notes: [], newTDEE: null, dietBreak: false, refeed: false };
  const tr = trendSeries(weights);
  const lb = tr.length ? tr[tr.length - 1].trend : profile.weightLb;
  const phaseDays = state.phaseStart ? daysBetween(state.phaseStart, today) : 99;
  if (phaseDays < 8) { out.notes.push('This is your first week. Early scale changes are mostly water, so your calories stay put for now.'); return out; }

  const ad = adaptiveTDEE(intakeByDate, weights, today, targets.tdee);
  if (ad.ok) {
    out.newTDEE = ad.tdee;
    out.notes.push(`Over ${ad.logged} logged days you ate about ${ad.intake} calories a day and your weight moved ${ad.lbPerWeek > 0 ? '+' : ''}${ad.lbPerWeek} lb a week. That means you burn about ${ad.tdee} a day.`);
    const goalLbWk = profile.goal === 'fatloss' ? -(lb * targets.ratePct / 100) : profile.goal === 'gain' ? lb * targets.ratePct / 100 / 4.3 : 0;
    const off = ad.lbPerWeek - goalLbWk;
    if (Math.abs(off) < lb * 0.0015) out.notes.push(`You are right on pace (${ad.lbPerWeek} lb a week).`);
    else out.notes.push(`You moved ${ad.lbPerWeek} lb a week; the goal is ${goalLbWk.toFixed(1)}. Your new calories are based on what your body actually did.`);
  } else {
    // Fallback: rate-based nudge (100 to 200 kcal when 2-week trend is off by > 0.25%BW/wk)
    const recent = tr.filter(x => x.date >= addDays(today, -14));
    if (recent.length >= 4 && profile.goal === 'fatloss') {
      const span = Math.max(7, daysBetween(recent[0].date, recent[recent.length - 1].date));
      const rate = (recent[recent.length - 1].trend - recent[0].trend) / span * 7;
      const target = -(lb * targets.ratePct / 100);
      if (rate - target > lb * 0.0025) { out.change = -150; out.notes.push(`Your weight is dropping slower than planned (${Math.abs(rate).toFixed(1)} lb a week, goal ${Math.abs(target).toFixed(1)}). Eat 150 fewer calories a day.`); }
      else if (target - rate > lb * 0.0025) { out.change = 150; out.notes.push(`You are losing faster than planned (${Math.abs(rate).toFixed(1)} lb a week). Eat 150 more calories a day so you keep your muscle and energy.`); }
      else out.notes.push('You are right on pace. No change.');
    } else out.notes.push(ad.reason + ' Targets hold until then.');
  }

  if (profile.goal === 'fatloss') {
    const wk = state.weeksInDeficit || 0;
    const limit = dietBreakLimitWeeks(profile);
    if (wk >= limit) { out.dietBreak = true; out.notes.push(`You have been dieting for ${wk} weeks. Take a 2-week break: eat enough to keep your weight steady. Breaks make the rest of the diet easier. The scale may go up 1 to 3 lb from water; that is not fat.`); }
    const cat = leanCategory(profile.sex, profile.bf);
    if (cat === 'lean') { out.refeed = true; out.notes.push('Once a week, have a higher-carb day: eat enough to stay the same weight, mostly from extra carbs.'); }
  }
  return out;
}

/* ============================================================
   DIET PROTOCOLS
   standard (default) | weekendcarb (opt-in) | rapid (opt-in, capped) | carbcycle (opt-in, eligibility)
   ============================================================ */
const PROTOCOLS = {
  standard: { name: 'Normal eating (recommended)', src: 'Recommended', blurb: 'Eat foods you like, staying within your calories and protein. Works for almost everyone.' },
  weekendcarb: { name: 'Weekend carb-up', src: 'Low-carb', optIn: true, blurb: 'Very low carbs Monday to Friday, then lots of carbs on the weekend.',
    conflicts: ['You still lose fat by eating fewer calories than you burn. Eating more fat does not burn fat.', 'Protein stays at your daily target on carb-up days too.', 'Weekend calories are capped at 25% above weekdays, not unlimited.', 'Very low carbs can make workouts feel harder. Expect a rough first week (tired, foggy).', 'Check with your doctor first, ideally with recent bloodwork.'] },
  rapid: { name: 'Rapid fat loss (crash diet)', src: 'Fast fat loss', optIn: true, blurb: 'Only lean protein and vegetables for a short time, then a 2-week break. Fast, but hard.',
    conflicts: ['Muscle and strength loss risk is higher than a moderate deficit. Training volume drops by up to two thirds.', 'Needs electrolytes (sodium 3 to 5 g, potassium, magnesium 500 mg, calcium), a multivitamin and fish oil every day.', 'Not for anyone with a medical condition without a doctor. Lightheadedness is common.', 'Most of the early scale drop is water.'] },
  carbcycle: { name: 'Carb cycling', src: 'Carb cycling', optIn: true, blurb: 'A weekly cycle of low-carb and high-carb days, for lean people who already lift regularly.',
    conflicts: ['Only for men at 15% body fat or less (women 22% or less) who have lifted 3 to 6+ months.', 'Requires 4 lifting sessions a week on a fixed schedule.', 'Run 6 to 8 cycles, then 2 weeks at maintenance.'] }
};

function rapidCaps(profile) {
  const cat = leanCategory(profile.sex, profile.bf);
  // cat1 11-12 days, cat2 2-6 weeks, cat3 6-12 weeks
  return { lean: { days: 12, free: 0, refeed: '2-3 day carb refeed at the end' }, moderate: { days: 42, free: 1, refeed: 'one 5-hour refeed a week' }, higher: { days: 84, free: 2, refeed: 'none' }, unknown: { days: 28, free: 1, refeed: 'one 5-hour refeed a week' } }[cat];
}

function carbcycleEligible(profile) {
  const bfOk = profile.bf != null && (profile.sex === 'female' ? profile.bf <= 22 : profile.bf <= 15);
  const trainOk = (profile.trainingYears || 0) >= 0.5 && (profile.daysPerWeek || 0) >= 4;
  return { ok: bfOk && trainOk, bfOk, trainOk };
}

/**
 * Targets for a specific date. T = calcTargets() result (base, trainDay, restDay, tdee).
 * state: {dietBreakUntil, protocolStart, refeedDow}
 */
function dayTargets(profile, T, date, isTraining, state = {}) {
  const lb = profile.weightLb, kg = lb / KG;
  const lbm = profile.bf != null ? lb * (1 - profile.bf / 100) : lb * 0.8;
  const dow = weekdayOf(date);
  const proto = profile.protocol || 'standard';
  const P = T.base.protein;
  const mk = (kcal, protein, carbs, label, note) => {
    const fat = Math.max(Math.round(lb * 0.25), Math.round((kcal - protein * 4 - carbs * 4) / 9));
    return { kcal: Math.round(protein * 4 + carbs * 4 + fat * 9), protein: Math.round(protein), carbs: Math.round(carbs), fat, label, note };
  };

  if (state.dietBreakUntil && date <= state.dietBreakUntil) {
    const fat = Math.round(T.tdee * 0.25 / 9);
    return { kcal: T.tdee, protein: P, carbs: Math.max(100, Math.round((T.tdee - P * 4 - fat * 9) / 4)), fat, label: 'Break week', note: `Eat to keep your weight steady through ${state.dietBreakUntil}. Keep working out.` };
  }

  if (proto === 'rapid') {
    const cat = leanCategory(profile.sex, profile.bf);
    const gPerLbLbm = { lean: 1.5, moderate: 1.25, higher: 1.0, unknown: 1.25 }[cat];   // weight training column
    const protein = Math.round(lbm * gPerLbLbm / 5) * 5;
    const carbs = 30, fat = 10;    // vegetables + fish oil only
    return { kcal: protein * 4 + carbs * 4 + fat * 9, protein, carbs, fat, label: 'Rapid fat loss', note: `Lean protein and non-starchy vegetables. Fish oil 6 g. Electrolytes and multivitamin daily. Cap: ${rapidCaps(profile).days} days.` };
  }

  if (proto === 'carbcycle') {
    const maint = T.tdee;
    const lbmKg = lbm / KG;
    const low = Math.max(1200, maint * 0.5);
    const pLow = lbm * 1.25;
    if (dow === 1 || dow === 2 || dow === 3) return mk(low, pLow, low * 0.2 / 4, 'Low day', dow === 3 ? 'Off day. Optional 45 to 60 min easy cardio.' : 'Depletion workout today.');
    if (dow === 4) return mk(low * 0.75 + lbmKg * 4 * 4, lbm, lbmKg * 4, 'Load starts tonight', 'Tension workout this evening, then the carb load begins: 25 to 30 g carbs and 15 g whey before training.');
    if (dow === 5) return mk(maint * 1.9, lbm, lbmKg * 10, 'Carb load', 'Mostly starch, low fat, lots of water. 12 to 16 g/kg lean mass across the load.');
    if (dow === 6) return mk(maint * 0.9, lbm, lbmKg * 4.5, 'Power day', 'Power workout. Complex carbs, fat 40 to 50 g.');
    return mk(maint * 0.85, lbm, lbmKg * 2.5, 'Taper', 'Carbs early in the day, vegetables at night.');
  }

  if (proto === 'weekendcarb') {
    const wk = T.base;
    const isCarbUp = dow === 6 || (dow === 0 && (profile.carbUpHours || 36) > 24);
    const cap = profile.adCarbCap || 30;
    if (!isCarbUp) return { ...mk(wk.kcal, Math.max(P, wk.kcal * 0.32 / 4), cap, 'Low-carb day'), note: `Carbs at or under ${cap} g, fat 55 to 60%. Weekday carbs are best at your evening meal.` };
    const kcal = Math.round(wk.kcal * 1.25);
    const fat = Math.round(kcal * 0.3 / 9);
    return { kcal, protein: P, fat, carbs: Math.round((kcal - P * 4 - fat * 9) / 4), label: 'Carb-up', note: 'Carb-up window. End it early if you feel puffy or smooth. Protein floor still applies. Capped at 25% over weekday calories.' };
  }

  // standard + optional refeed / carb cycle
  const cat = leanCategory(profile.sex, profile.bf);
  if (profile.goal === 'fatloss' && cat === 'lean' && state.refeedDow != null && dow === +state.refeedDow) {
    const fat = Math.round(lb * 0.25);
    return { kcal: T.tdee, protein: P, fat, carbs: Math.round((T.tdee - P * 4 - fat * 9) / 4), label: 'Higher-carb day', note: 'Today you eat more carbs, enough to stay the same weight. Best on a workout day.' };
  }
  const t = isTraining ? T.trainDay : T.restDay;
  return { ...t, label: profile.carbCycle ? (isTraining ? 'Training day' : 'Rest day') : 'Daily target', note: '' };
}

/* In-session RPE adjustment : 2% per 0.5 RPE off target; a missed rep counts as a full point. */
function nextSetLoad(ex, load, targetRIR, actualRIR, reps, repTarget) {
  if (load == null || actualRIR == null) return null;
  let diff = (targetRIR - actualRIR);           // positive = harder than planned
  if (reps < repTarget) diff += (repTarget - reps);
  if (Math.abs(diff) < 0.5) return { load, note: 'Right on target. Same weight next set.' };
  const pct = clamp(-diff * 0.04, -0.12, 0.08);
  const inc = ex.inc || placeOf(ex.loc).inc;
  const next = Math.max(inc, round(load * (1 + pct), inc));
  return { load: next, note: diff > 0 ? `That was harder than planned. Go a little lighter next set.` : `That was easier than planned. Go a little heavier next set.` };
}

/* ============================================================
   STRENGTH PLAN  (gym strength days; requires 4 days/week)
   ============================================================ */
const STRPLAN = {
  lifts: { squat: { name: 'Back squat', inc: 10, lower: true, exId: 'g_squat' }, bench: { name: 'Bench press', inc: 5, exId: 'g_bench' }, deadlift: { name: 'Deadlift', inc: 10, lower: true, exId: 'g_deadlift' }, ohp: { name: 'Overhead press', inc: 5, exId: 'g_bbohp' } },
  order: ['squat', 'bench', 'deadlift', 'ohp'],
  weeks: [ { t: 'pr', label: 'Test week' }, { t: '7s', pct: 0.75, sets: 5, reps: 7 }, { t: '5s', pct: 0.80, sets: 7, reps: 5 }, { t: '3s', pct: 0.85, sets: 10, reps: 3 }, { t: 'deload', pct: 0.60, sets: 3, reps: 5 } ],
  intro: { '7s': 4, '5s': 6, '3s': 8 },
  backoff: [ { rpe: 10, drop: 0.10, msg: 'That was too heavy. Next time stop when you have 1 good rep left.' }, { rpe: 9.5, drop: 0.075, msg: 'A little too close. Leave 1 rep in the tank next time.' }, { rpe: 9, drop: 0.05, msg: 'Right where it should be.' }, { rpe: 8.5, drop: 0.05, msg: 'Good, a safe effort.' } ]
};
/** Rounding: nearest 5 lb, ties round down. */
function strRound(x, step = 5) { const q = x / step; const f = Math.floor(q); return (q - f > 0.5 ? f + 1 : f) * step; }
function strBase(e1) { return strRound(e1 * 0.9); }
function strSession(lift, tm, cycleWeekIdx, cycleNum) {
  const w = STRPLAN.weeks[cycleWeekIdx % 5];
  if (w.t === 'pr') return { lift, type: 'pr', label: w.label, top: { reps: '3-5', rpe: 9 }, note: 'Warm up, then do one heavy set of 3 to 5 reps, stopping when you have 1 good rep left. Then do a few lighter sets. Never force a rep.' };
  const sets = cycleNum === 1 && STRPLAN.intro[w.t] ? STRPLAN.intro[w.t] : w.sets;
  return { lift, type: w.t, label: `${w.t === 'deload' ? 'Easy week' : 'Volume week'}: ${sets} sets of ${w.reps} at ${strRound(tm * w.pct)} lb`, sets, reps: w.reps, load: strRound(tm * w.pct) };
}
function strBackoff(topLoad, topReps, rpe) {
  if (rpe <= 8) return { load: null, note: 'That felt easy. Add a little weight and do the heavy set again, or do your lighter sets at this same weight.' };
  const row = STRPLAN.backoff.find(r => rpe >= r.rpe) || STRPLAN.backoff[3];
  let drop = row.drop, reps = topReps;
  if (topReps === 2) { drop = 0.125; reps = 4; }
  if (topReps === 1) { drop = 0.15; reps = 3; }
  return { load: strRound(topLoad * (1 - drop)), reps, note: `${row.msg} Lighter sets: ${reps} reps, 2 to 5 sets. Stop once a set leaves you with only 1 rep left.` };
}
function strNextTop(lastReps, lastRpe, lastLoad) {
  if (lastRpe >= 10) return { load: lastLoad, reps: lastReps, note: 'Last time your heavy set was all you had. Use the same weight and stop 1 rep short this time.' };
  if (lastReps <= 3) return { load: lastLoad, reps: 4, note: 'Same load, aim for 4.' };
  if (lastReps === 4) return { load: lastLoad, reps: 5, note: 'Same load, aim for 5.' };
  return { load: lastLoad + 5, reps: '3-5', note: 'Add 5 lb. Do as many reps as you can while keeping 1 in the tank.' };
}

/* ============================================================
   PROGRAM BUILDER
   ============================================================ */
/**
 * Weekly sets per muscle. 10+ sets/week beats fewer.
 * Returning or time-limited lifters start mid-range and add over the block.
 */
function weeklySetTargets(profile) {
  const why = [];
  const yrs = profile.trainingYears || 0;
  const returning = !!profile.returning;
  let base = yrs < 1 ? 8 : yrs < 3 ? 10 : 12;
  if (returning) base -= 2;
  if (profile.goal === 'fatloss') base -= 1;
  const days = profile.daysPerWeek || 3;
  const mins = profile.sessionMin || 45;
  const budget = Math.floor(days * (mins - 6) / (mins < 50 ? 2.2 : 2.6));     // min per working set incl. rest; short sessions use supersets
  const t = {};
  const legPref = profile.legEmphasis || 'normal';      // low | normal | high
  let legMul = { low: 0.6, normal: 1, high: 1.3 }[legPref];
  const legSport = (profile.sports || []).filter(x => SPORTBYK[x.k]?.legs).reduce((s, x) => s + (x.n || 1), 0);
  if (legSport >= 2) { legMul *= 0.8; why.push('Your sports already work your legs hard, so there is a little less leg lifting.'); }
  // Direct sets. Indirect work counts half , so synergists get less direct volume.
  Object.assign(t, { chest: base, lats: base, upperback: Math.round(base * 0.6), sidedelts: base, reardelts: Math.round(base * 0.35),
    frontdelts: Math.round(base * 0.35), biceps: Math.round(base * 0.6), triceps: Math.round(base * 0.6),
    quads: Math.round(base * legMul), hams: Math.round(base * legMul), glutes: legPref === 'low' ? 0 : Math.round(base * 0.35 * legMul),
    calves: profile.calves === false ? 0 : (legPref === 'low' ? 2 : 4), abs: 2 });
  if (legPref === 'low') why.push('Fewer leg exercises, because you said your legs grow easily. That time goes to your upper body.');
  for (const p of profile.priority || []) { if (t[p] != null) t[p] += 3; }
  const sb = [...new Set((profile.sports || []).flatMap(x => SPORTBYK[x.k]?.boost || []))].filter(m => !(profile.priority || []).includes(m) && t[m] != null && t[m] > 0);
  sb.forEach(m => { t[m] += 1; });
  if (sb.length) why.push(`A little extra work that helps your sport: ${sb.map(m => MUSCLES[m]).join(', ')}.`);
  if ((profile.priority || []).length) why.push(`Extra work for the areas you picked: ${(profile.priority || []).map(p => MUSCLES[p]).join(', ')}.`);
  // pulling volume at least matches pushing, to offset the internal-rotation bias of daily life
  const push = t.chest + t.frontdelts, pull = t.lats + t.upperback + t.reardelts;
  if (pull < push) { t.upperback += push - pull; why.push(`As much pulling (back) as pushing (chest) work, which keeps your shoulders healthy and your posture good.`); }
  let total = sum(Object.values(t));
  if (total > budget) {
    const pri = new Set(profile.priority || []);
    // tight on time: drop direct work that heavy compounds already cover (indirect sets count half)
    for (const m of ['frontdelts', 'abs', 'calves']) if (!pri.has(m) && total > budget) { total -= t[m]; t[m] = 0; }
    if (!t.frontdelts) why.push('No separate ab or calf exercises for now. Your main exercises already work them.');
    const fixed = sum(Object.entries(t).filter(([m]) => pri.has(m)).map(([, v]) => v));
    const flex = sum(Object.entries(t).filter(([m]) => !pri.has(m)).map(([, v]) => v));
    const scale = clamp((budget - fixed) / flex, 0.6, 1);
    for (const m of Object.keys(t)) if (!pri.has(m) && t[m]) t[m] = Math.max(2, Math.round(t[m] * scale));
    why.push(`Built to fit ${days} workouts of ${mins} minutes a week.${mins < 60 ? ' Longer workouts would let you train every area more.' : ''}`);
  }
  why.unshift(`You start with a moderate amount of work, then it slowly increases as your body adapts.`);
  return { sets: t, why, total: sum(Object.values(t)) };
}

/** Split templates: each day is an ordered list of muscle slots. */
function splitFor(days) {
  const FB_A = ['chest', 'lats', 'quads', 'sidedelts', 'triceps', 'hams', 'biceps', 'abs'];
  const FB_B = ['upperback', 'frontdelts', 'hams', 'chest', 'biceps', 'sidedelts', 'quads', 'reardelts', 'triceps', 'calves'];
  const FB_C = ['lats', 'chest', 'glutes', 'sidedelts', 'biceps', 'triceps', 'reardelts', 'quads', 'abs'];
  const UP_A = ['chest', 'lats', 'frontdelts', 'upperback', 'sidedelts', 'biceps', 'triceps'];
  const UP_B = ['upperback', 'chest', 'lats', 'sidedelts', 'triceps', 'biceps', 'reardelts'];
  const LO_A = ['quads', 'hams', 'glutes', 'calves', 'abs'];
  const LO_B = ['hams', 'quads', 'glutes', 'calves', 'abs'];
  const PUSH = ['chest', 'frontdelts', 'chest', 'sidedelts', 'triceps'];
  const PULL = ['lats', 'upperback', 'reardelts', 'biceps', 'lats'];
  const LEGS = ['quads', 'hams', 'glutes', 'calves', 'abs'];
  switch (clamp(days, 1, 6)) {
    case 1: return { name: 'Full body', days: [{ name: 'Full body', slots: FB_A }] };
    case 2: return { name: 'Full body A/B', why: 'Two full-body workouts a week, so every area gets trained twice.', days: [{ name: 'Full body A', slots: FB_A }, { name: 'Full body B', slots: FB_B }] };
    case 3: return { name: 'Full body A/B/C', why: 'Three full-body workouts that rotate, so every area gets trained 2 to 3 times a week, even if you miss a day.', days: [{ name: 'Full body A', slots: FB_A }, { name: 'Full body B', slots: FB_B }, { name: 'Full body C', slots: FB_C }] };
    case 4: return { name: 'Upper / Lower', why: 'Two upper-body days and two lower-body days a week.', days: [{ name: 'Upper A', slots: UP_A }, { name: 'Lower A', slots: LO_A }, { name: 'Upper B', slots: UP_B }, { name: 'Lower B', slots: LO_B }] };
    case 5: return { name: 'Upper / Lower + Push / Pull', why: 'Upper and lower body days plus one extra upper-body day.', days: [{ name: 'Upper A', slots: UP_A }, { name: 'Lower A', slots: LO_A }, { name: 'Push', slots: PUSH }, { name: 'Pull', slots: PULL }, { name: 'Lower B', slots: LO_B }] };
    default: return { name: 'Push / Pull / Legs x2', why: 'Push, pull and leg days, each twice a week.', days: [{ name: 'Push A', slots: PUSH }, { name: 'Pull A', slots: PULL }, { name: 'Legs A', slots: LEGS }, { name: 'Push B', slots: PUSH }, { name: 'Pull B', slots: PULL }, { name: 'Legs B', slots: LEGS }] };
  }
}

function buildProgram(profile) {
  const strength = profile.style === 'strength' && (profile.daysPerWeek || 0) >= 4;
  const split = strength ? { name: 'Get stronger, 4 days', why: 'Each day starts with one big lift, then a few muscle-building exercises. Each body part gets worked about twice a week.', days: [
      { name: 'Squat day', main: 'squat', slots: ['hams', 'quads', 'calves', 'abs'] },
      { name: 'Bench day', main: 'bench', slots: ['lats', 'chest', 'upperback', 'sidedelts', 'triceps', 'biceps', 'reardelts'] },
      { name: 'Deadlift day', main: 'deadlift', slots: ['quads', 'hams', 'abs'] },
      { name: 'OHP day', main: 'ohp', slots: ['upperback', 'chest', 'lats', 'sidedelts', 'biceps', 'triceps', 'reardelts'] } ] }
    : splitFor(profile.daysPerWeek || 3);
  const vol = weeklySetTargets(profile);
  // count occurrences of each muscle across the split
  const occ = {};
  split.days.forEach(d => d.slots.forEach(m => occ[m] = (occ[m] || 0) + 1));
  // distribute weekly sets: at least 2 sets per exercise; when a muscle needs fewer
  // exposures than the template offers, place them on the lightest days so sessions stay even
  const dayLoad = split.days.map(() => 0);
  const pick = {};   // muscle -> Set(day indices)
  const order = Object.keys(occ).sort((x, y) => (vol.sets[y] || 0) - (vol.sets[x] || 0));
  for (const m of order) {
    const weekly = vol.sets[m] || 0; if (!weekly) continue;
    const cand = split.days.map((d, i) => d.slots.includes(m) ? i : -1).filter(i => i >= 0);
    const n = Math.max(1, Math.min(cand.length, Math.floor(weekly / 2)));
    const chosen = cand.sort((x, y) => dayLoad[x] - dayLoad[y] || x - y).slice(0, n);
    pick[m] = { days: new Set(chosen), n, weekly, k: 0 };
    chosen.forEach(i => dayLoad[i] += weekly / n);
  }
  const days = split.days.map((d, di) => {
    const seen = {};
    const slots = [];
    d.slots.forEach((m, si) => {
      const pm = pick[m]; if (!pm || !pm.days.has(di) || seen[m]) return;
      seen[m] = 1; pm.k++;
      const share = Math.floor(pm.weekly / pm.n) + ((pm.k <= pm.weekly % pm.n) ? 1 : 0);
      slots.push({ key: `d${di}s${si}`, muscle: m, sets: clamp(share, 2, 5), variant: di });
    });
    return { name: d.name, main: d.main, slots };
  });
  const blockWeeks = strength ? 4 : profile.goal === 'fatloss' ? 5 : 6;   // deficit: shorter blocks
  return { split: split.name, splitWhy: split.why, days, volume: vol, created: isoDate(Date.now()), blockWeeks, strength };
}

/** Pick the exercise for a slot at a location. Overrides win, then tier, then variant rotation. */
function exerciseFor(slot, loc, profile, usedToday) {
  const ov = (profile.swaps || {})[slot.key + '@' + loc];
  if (ov && EXBYID[ov]) return EXBYID[ov];
  const avoid = new Set(profile.avoid || []);
  const have = new Set(profile.homeEquip || []);
  const ok = e => e.loc === loc && !e.mainOnly && !avoid.has(e.id) && !usedToday.has(e.id) && (e.need || []).every(k => have.has(k));
  let pool = EX.filter(e => ok(e) && e.m === slot.muscle);
  if (!pool.length) pool = EX.filter(e => ok(e) && (e.sec || []).includes(slot.muscle));
  if (!pool.length) return null;
  pool.sort((a, b) => a.tier - b.tier || (b.stretch ? 1 : 0) - (a.stretch ? 1 : 0));
  // first slot of a muscle in a day prefers compound
  const compounds = pool.filter(e => e.type === 'compound');
  const isos = pool.filter(e => e.type === 'iso');
  const ordered = slot.variant % 2 === 0 ? [...compounds, ...isos] : [...isos, ...compounds];
  const top = ordered.filter(e => e.tier <= (ordered[0]?.tier ?? 1) + 1);
  return top[slot.variant % Math.max(1, Math.min(2, top.length))] || ordered[0];
}

/* ============================================================
   LOADS + PROGRESSION
   ============================================================ */
/** Estimated max with reps in reserve: e1RM = load x (1 + (reps + RIR) / 30). */
function e1rm(load, reps, rir = 0) { return load * (1 + (reps + (rir || 0)) / 30); }
function loadFor(e1, reps, rir) { return e1 / (1 + (reps + rir) / 30); }

/**
 * Suggest a load for the next exercise exposure.
 * history: array of past logged sets for this exercise [{date, load, reps, rir}]
 * Units: gym = lb total; p1 = kg dial per cable.
 */
function suggestLoad(ex, history, repTarget, rirTarget, mod = {}) {
  if (ex.bw && (!history || !history.length || !history.some(s => +s.load > 0))) return { load: null, basis: `Bodyweight. When you hit ${ex.rr[1]} reps on every set, make it harder: go slower, go deeper, or add weight.` };
  if (!history || !history.length) return { load: null, basis: 'First time: pick a weight you could lift about ' + (repTarget + rirTarget + 2) + ' times, and log what you do. Next time Spotter picks the weight for you.' };
  const byDate = {};
  history.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s); });
  const dates = Object.keys(byDate).sort();
  const last = byDate[dates[dates.length - 1]];
  const best = Math.max(...last.map(s => e1rm(+s.load, +s.reps, s.rir ?? 2)));
  const inc = ex.inc || placeOf(ex.loc).inc;
  // double progression check: all sets at top of range at or under target RIR -> bump
  const top = ex.rr ? ex.rr[1] : repTarget;
  const hitTop = last.every(s => +s.reps >= top && (s.rir ?? 2) <= rirTarget + 0.5);
  let target = loadFor(best, repTarget, rirTarget);
  if (mod.hold) target = Math.min(target, Math.max(...last.map(s => +s.load)));
  if (mod.reduce) target *= (1 - mod.reduce);
  let load = Math.max(inc, round(target, inc));
  const lastTop = Math.max(...last.map(s => +s.load));
  let basis;
  if (hitTop && !mod.hold && !mod.reduce) { load = Math.max(load, lastTop + inc); basis = `You did all your reps last time, so go up ${inc} ${unitText(ex.loc)}.`; }
  else basis = `Based on your last workout. Aim for ${repTarget} reps, stopping when you could still do about ${rirTarget} more.`;
  if (mod.hold) basis += ' Same weight as last time because you are run down today.';
  if (mod.reduce) basis += ` A bit lighter today on purpose.`;
  return { load, basis, e1: +best.toFixed(1) };
}

function p1Display(dialKg, cables) {
  const totalKg = dialKg * (cables || 2);
  return { dial: dialKg, totalKg, totalLb: Math.round(totalKg * KG) };
}

/* ============================================================
   READINESS + DAILY PLAN
   ============================================================ */
function readiness(c, w) {
  // w: wearable summary for last night {readiness, sleepHrs, hrv, rhr, tempDev, src}
  if (!c && !(w && w.readiness != null)) return { score: null, band: 'unknown', notes: ['No check-in yet today, so this is your normal plan.'] };
  if (!c) {
    const notes = [`From your ${w.src === 'oura' ? 'Oura ring' : 'watch'}: score ${w.readiness}${w.sleepHrs ? `, ${w.sleepHrs} hours of sleep` : ''}.`];
    if (w.sleepHrs && w.sleepHrs < 6) notes.push(`Only ${w.sleepHrs} hours of sleep. Keep the same weights as last time today; don't push for more.`);
    if (w.tempDev != null && w.tempDev >= 0.5) notes.push(`Your body temperature is up a little. You may be getting sick or run down, so today is lighter.`);
    let score = w.readiness; if (w.tempDev != null && w.tempDev >= 0.5) score = Math.min(score, 55);
    return { score, band: score >= 70 ? 'green' : score >= 50 ? 'yellow' : 'red', notes, src: w.src };
  }
  const notes = [];
  const sleep = clamp((+c.sleepHrs || 7) / 8, 0, 1.1) * 30;
  const sleepQ = ((+c.sleepQ || 3) / 5) * 15;
  const energy = ((+c.energy || 3) / 5) * 20;
  const stress = ((6 - (+c.stress || 3)) / 5) * 15;
  const sore = ((6 - (+c.soreness || 2)) / 5) * 20;
  const score = Math.round(clamp(sleep + sleepQ + energy + stress + sore, 0, 100));
  if ((+c.sleepHrs || 7) < 6) notes.push(`Only ${c.sleepHrs} hours of sleep. Keep the same weights as last time today; don't push for more.`);
  if ((+c.soreness || 0) >= 4) notes.push('You are sore, so sore areas get a little less work today.');
  if ((+c.stress || 0) >= 4) notes.push('Stressful day: work hard but stop a couple of reps before it gets really tough.');
  let final = score;
  if (w && w.readiness != null) {
    // ring data is objective, the check-in is how you feel: weight them 60/40
    final = Math.round(w.readiness * 0.6 + score * 0.4);
    notes.unshift(`Today's score mixes your ${w.src === 'oura' ? 'Oura ring' : 'watch'} (${w.readiness}) with how you said you feel (${score}).`);
    if (w.tempDev != null && w.tempDev >= 0.5) { final = Math.min(final, 55); notes.push(`Your body temperature is up a little, so today is lighter.`); }
  }
  const band = final >= 70 ? 'green' : final >= 50 ? 'yellow' : 'red';
  return { score: final, band, notes };
}

function lastSessionInfo(workouts, today) {
  const done = workouts.filter(w => w.date < today && w.done && w.kind !== 'conditioning' && w.kind !== 'sport' && !w.hx).sort((a, b) => a.date < b.date ? 1 : -1);
  return done[0] || null;
}

function nextDayIndex(program, workouts, today) {
  const last = lastSessionInfo(workouts.filter(w => !w.free), today);
  if (!last || last.dayIndex == null) return 0;
  return (last.dayIndex + 1) % program.days.length;
}

function weekNumber(program, today) {
  return Math.floor(daysBetween(program.created, today) / 7) + 1;
}

function deloadCheck(program, workouts, checkins, today, hist) {
  const wk = weekNumber(program, today);
  const block = program.blockWeeks || 6;
  if (wk % (block + 1) === 0) return { deload: true, why: `Easy week. You have trained hard for ${block} weeks, so this week is half the work and lighter weights. It lets your body catch up so you come back stronger.` };
  const recent = Object.values(checkins).filter(c => c.date >= addDays(today, -7) && c.date < today);
  const bands = recent.map(c => readiness(c).band);
  const red = bands.filter(b => b === 'red').length, low = bands.filter(b => b !== 'green').length;
  if (red >= 3 || low >= 5) return { deload: true, why: `You have felt run down most of this week, so today is an easy workout to let your body recover.` };
  // performance trigger: e1RM down on 2+ exercises across the last 2 exposures
  if (hist) {
    let drops = 0;
    for (const id of Object.keys(hist)) {
      const byDate = {}; hist[id].forEach(s => (byDate[s.date] = byDate[s.date] || []).push(e1rm(+s.load, +s.reps, s.rir ?? 2)));
      const ds = Object.keys(byDate).sort().slice(-3);
      if (ds.length === 3) { const v = ds.map(d => Math.max(...byDate[d])); if (v[2] < v[0] * 0.97 && v[1] < v[0] * 0.99) drops++; }
    }
    if (drops >= 2) return { deload: true, why: `Your strength dipped the last two workouts, a sign you need rest. Today is an easy workout.` };
  }
  return { deload: false };
}

/**
 * Today's plan. ctx: {profile, program, workouts, checkin, checkins, today, location, minutes, setsHistory}
 */
function dailyPlan(ctx) {
  const { profile, program, workouts = [], checkin, checkins = {}, today, setsHistory = {} } = ctx;
  const loc = ctx.location || (profile.locations || ['gym'])[0];
  const minutes = ctx.minutes || profile.sessionMin || 45;
  const adj = [];
  const r = readiness(checkin, ctx.wear);
  adj.push(...r.notes);

  const last = lastSessionInfo(workouts, today);
  const gap = last ? daysBetween(last.date, today) : null;
  const di = ctx.dayIndex != null ? ctx.dayIndex : nextDayIndex(program, workouts, today);
  const day = program.days[di];
  const dl = deloadCheck(program, workouts, checkins, today, setsHistory);

  const condWeek = workouts.filter(w => w.done && (w.kind === 'conditioning' || w.hx === 'hiit' || (w.kind === 'sport' && w.level !== 'easy' && !SPORTBYK[w.sport]?.easy)) && w.date >= addDays(today, -6)).length;
  const condNote = condWeek < 2 ? `Cardio: ${condWeek} of 2 this week. ${(profile.locations || []).includes('hotworx') ? 'A 15-minute HOTWORX session like Hot Cycle, Hot Blast or Hot Thunder counts' : '15 to 20 minutes of walking intervals counts (1 minute fast, 1 minute easy)'}.${(profile.sports || []).some(x => x.k !== 'hotworx' && !SPORTBYK[x.k]?.easy) ? ' Your sport sessions count too.' : ''} A rest day is a good time for it.` : 'Cardio is done for this week (2 sessions).';
  if (ctx.location === 'off') return { type: 'rest', day: null, readiness: r, condWeek, adjustments: ['Rest day. Go for a walk and get your protein in.', condNote] };
  if (r.band === 'red' && ctx.choice === 'walk') {
    return { type: 'recovery', dayIndex: di, readiness: r, condWeek, adjustments: [...adj, `Easy day: walk 25 to 40 minutes, then stretch. ${day.name} moves to your next workout.`] };
  }

  let setMul = 1, rirAdd = 0, mod = {};
  const wk = weekNumber(program, today);
  const inBlock = ((wk - 1) % ((program.blockWeeks || 6) + 1)) + 1;
  if (dl.deload) { setMul = 0.5; rirAdd = 2; mod.reduce = 0.1; adj.push(dl.why); }
  else if (r.band === 'red') { setMul = 0.5; rirAdd = 2; mod.reduce = 0.1; adj.push(`Your body needs an easy day (${r.score}/100). Half the usual work and lighter weights. Prefer a walk? Switch it below.`); }
  else if (r.band === 'yellow') { setMul = 0.75; rirAdd = 1; mod.hold = true; adj.push(`You are a bit run down (${r.score}/100). A little less work today, and keep the same weights as last time.`); }
  else if (inBlock > 1) { setMul = 1 + Math.min(inBlock - 1, 3) * 0.08; adj.push(`Week ${inBlock}: a little more work than week 1. It builds up gradually on purpose.`); }
  if (gap != null && gap >= 21) { setMul = Math.min(setMul, 0.6); mod.reduce = Math.max(mod.reduce || 0, 0.2); mod.hold = false; adj.push(`Welcome back after ${gap} days off. Lighter weights and less work for 2 weeks so you are not wrecked by soreness.`); }
  else if (gap != null && gap >= 8) { setMul = Math.min(setMul, 0.75); mod.reduce = Math.max(mod.reduce || 0, 0.1); mod.hold = false; adj.push(`It has been ${gap} days. A little lighter today. No need to make up missed workouts.`); }
  else if (gap === 1) adj.push(`You worked out yesterday, so today is ${day.name}, which works different areas.`);
  const recentSport = workouts.filter(w => w.done && w.kind === 'sport' && w.level === 'hard' && (w.date === today || w.date === addDays(today, -1))).pop();
  if (recentSport && !dl.deload && r.band !== 'red') {
    const sp = SPORTBYK[recentSport.sport];
    setMul *= 0.85; if (sp?.legs) mod.legLight = true;
    adj.push(`You had a hard ${(sp?.name || recentSport.dayName).toLowerCase()} session ${recentSport.date === today ? 'today' : 'yesterday'}. A little less lifting so you recover${sp?.legs ? ', with legs kept lightest' : ''}.`);
  }

  const soreSet = new Set(checkin?.soreAreas || []);
  const used = new Set();
  const items = [];
  if (day.main && program.strength) {
    const L = STRPLAN.lifts[day.main];
    const og = profile.strength || {};
    const tm0 = (og.tm || {})[day.main];
    const start = og.start || program.created;
    const dd = Math.max(0, daysBetween(start, today));
    const cycleNum = Math.floor(dd / 35) + 1, wIdx = Math.floor(dd / 7) % 5;
    const bbOk = loc === 'gym' || (loc === 'home' && (profile.homeEquip || []).includes('bb'));
    if (bbOk && tm0) {
      const tm = tm0 + (cycleNum - 1) * L.inc;
      const ex = EXBYID[L.exId];
      used.add(ex.id);
      const s = strSession(day.main, tm, wIdx, cycleNum);
      if (s.type === 'pr') {
        const lastTop = (og.lastTop || {})[day.main];
        const nt = lastTop ? strNextTop(lastTop.reps, lastTop.rpe, lastTop.load) : null;
        items.push({ slotKey: 'main', muscle: ex.m, ex: { ...ex, name: L.name }, main: true, strength: s, sets: 1, reps: '3-5', repTarget: 4, rir: 1, load: nt ? nt.load : strRound(tm * 0.85), basis: (nt ? nt.note + ' ' : '') + s.note, rest: 240 });
      } else {
        items.push({ slotKey: 'main', muscle: ex.m, ex: { ...ex, name: L.name }, main: true, strength: s, sets: s.sets, reps: String(s.reps), repTarget: s.reps, rir: s.type === 'deload' ? 4 : 2, load: s.load, basis: `Round ${cycleNum}, week ${wIdx + 1}. ${s.label}. These should feel steady, never a struggle.`, rest: 180 });
      }
      adj.push(`Main lift: ${L.name}, ${s.label}.${profile.goal === 'fatloss' ? ' While losing weight, the extra exercises are kept lighter and your lift numbers may reset.' : ''}`);
      if (profile.goal === 'fatloss') setMul *= 0.8;
    } else if (bbOk && !tm0) {
      adj.push(`Add a recent set for ${L.name} in Settings so the app can pick your weights. Today you get the other exercises only.`);
    } else {
      adj.push(`${L.name} needs the gym, so it is skipped at home today.`);
    }
  }
  day.slots.forEach(slot => {
    const ex = exerciseFor(slot, libOf(loc), loc === 'hotel' ? { ...profile, homeEquip: equipFor(profile, loc) } : profile, used);
    if (!ex) { adj.push(`No ${MUSCLES[slot.muscle]} exercise here, so it is skipped today.`); return; }
    used.add(ex.id);
    let sets = Math.max(1, Math.round(slot.sets * setMul));
    if (soreSet.has(slot.muscle)) { sets = Math.max(1, sets - 1); }
    if (mod.legLight && LEG_MUSCLES.includes(slot.muscle)) { sets = Math.max(1, sets - 1); }
    const isComp = ex.type === 'compound';
    const repT = isComp ? Math.round((ex.rr[0] + ex.rr[1]) / 2) : ex.rr[0] + 2;
    const rir = clamp((isComp ? 2 : 1) + rirAdd, 0, 4);
    const sug = suggestLoad(ex, setsHistory[ex.id], repT, rir, mod);
    items.push({ slotKey: slot.key, muscle: slot.muscle, ex, sets, reps: `${ex.rr[0]}-${ex.rr[1]}`, repTarget: repT, rir, load: sug.load, basis: sug.basis, rest: isComp ? 150 : 90 });
  });
  // shoulder-health finisher: 2 light sets of face pulls or external rotation every session
  if (profile.prehab !== false && !items.some(i => i.ex.prehab)) {
    const haveE = new Set(equipFor(profile, loc));
    const ph = EX.find(e => e.loc === libOf(loc) && e.prehab && !used.has(e.id) && !(profile.avoid || []).includes(e.id) && (e.need || []).every(k => haveE.has(k)));
    if (ph) { used.add(ph.id); items.push({ slotKey: 'prehab', muscle: ph.m, ex: ph, prehab: true, sets: 2, reps: `${ph.rr[0]}-${ph.rr[1]}`, repTarget: ph.rr[0] + 3, rir: 2, load: suggestLoad(ph, setsHistory[ph.id], ph.rr[0] + 3, 2, {}).load, basis: 'Finish with this light exercise to keep your shoulders healthy.', rest: 45 }); }
  }
  if (soreSet.size) adj.push(`Sore today: ${[...soreSet].map(m => MUSCLES[m] || m).join(', ')}. A little less work for those.`);

  if (minutes < 50) {
    // antagonist / non-competing supersets, 60 s between exercises. Never on the main lift.
    const PUSH = new Set(['chest', 'frontdelts', 'triceps', 'sidedelts']), PULL = new Set(['lats', 'upperback', 'reardelts', 'biceps']);
    const grp = m => PUSH.has(m) ? 'push' : PULL.has(m) ? 'pull' : 'legs';
    let tag = 0;
    for (let i = 0; i < items.length - 1; i++) {
      const a = items[i], b = items[i + 1];
      if (a.main || b.main || a.pair) continue;
      if (grp(a.muscle) !== grp(b.muscle) && !(a.ex.hinge && b.ex.hinge)) { a.pair = b.pair = String.fromCharCode(65 + tag++); i++; }
    }
    if (tag) adj.push(`To save time, exercises with the same letter are done back to back: do the first, rest 1 minute, do the second, rest 1 minute, repeat.`);
  }
  // fit to time: ~ (rest + 40s) per set + 6 min warm-up
  const est = () => 6 + sum(items.map(i => i.sets * ((i.pair ? i.rest / 2 : i.rest) + 40) / 60));
  let guard = 0;
  const DROP_ORDER = ['abs', 'calves', 'glutes', 'frontdelts', 'reardelts'];
  while (est() > minutes && guard++ < 60) {
    const pri0 = new Set(profile.priority || []);
    const dropIdx = items.findIndex(i => !i.main && DROP_ORDER.includes(i.muscle) && !pri0.has(i.muscle));
    if (dropIdx >= 0 && items.filter(i => !i.main && i.sets > 2).length === 0) { adj.push(`Skipped ${items[dropIdx].ex.name} to fit ${minutes} minutes.`); items.splice(dropIdx, 1); continue; }
    // trim the last, lowest-priority item first; never below 2 sets unless needed
    const pri = new Set(profile.priority || []);
    const cand = [...items].reverse().find(i => !i.main && i.sets > 2 && !pri.has(i.muscle)) || [...items].reverse().find(i => !i.main && i.sets > 2);
    if (cand) cand.sets--; else if (items.length > 1 && !items[items.length - 1].main) items.pop(); else break;
  }
  if (est() > minutes && items.length > 3) { items.splice(items.length - 1, 1); }
  // supersets on P1: pair non-competing muscles to save rest
  adj.push('Warm up for 5 minutes first: arm circles, leg swings and a few bodyweight squats. Then do 1 or 2 light practice sets of your first exercise.');
  if (loc === 'hotworx') adj.push(`At HOTWORX: do these weights in the FX Zone first, then a 15-minute sauna session like Hot Cycle or Hot Blast if you have time. Drink water before and after.`);
  const minutesEst = Math.round(est());
  if (condWeek < 2) adj.push(condNote + ' On a lifting day it goes at the end, never before the weights.');
  return { type: 'train', condWeek, dayIndex: di, dayName: day.name, location: loc, readiness: r, deload: dl.deload, items, minutesEst, adjustments: adj, week: weekNumber(program, today) };
}

/* ============================================================
   NUTRITION: day status + yesterday carryover
   ============================================================ */
function dayTotals(entries) {
  return entries.reduce((t, e) => ({ kcal: t.kcal + (+e.kcal || 0), protein: t.protein + (+e.protein || 0), carbs: t.carbs + (+e.carbs || 0), fat: t.fat + (+e.fat || 0), fiber: t.fiber + (+e.fiber || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}

function nutritionNotes(target, yTotals, plan) {
  const n = [];
  if (yTotals && yTotals.kcal > 0) {
    const over = yTotals.kcal - target.kcal;
    if (over > target.kcal * 0.15) n.push(`You ate ${Math.round(over)} calories over yesterday. That's fine. Stick to today's normal target; don't try to make up for it.`);
    else if (over < -target.kcal * 0.2) n.push(`You ate ${Math.round(-over)} calories under yesterday. No need to make it up. Focus on protein today.`);
    if (yTotals.protein < target.protein * 0.8) n.push(`Protein was low yesterday (${Math.round(yTotals.protein)} g of ${target.protein} g). Aim for 30 to 50 g at each meal today.`);
  }
  if (plan && plan.type === 'train') n.push('Workout day: eat some carbs and protein in the meals before and after you train.');
  if (plan && plan.type === 'recovery') n.push('Easy day: same protein as usual.');
  return n;
}

const api = { KG, MUSCLES, LEG_MUSCLES, EX, EXBYID, isoDate, addDays, daysBetween, weekdayOf, clamp, round, sum, avg,
  estimateTDEE, calcTargets, leanCategory, lossRatePct, trendSeries, adaptiveTDEE, weeklyReview,
  PLACES, HOME_EQUIP, SPORTS, SPORTBYK, placeOf, unitOf, unitText, libOf, equipFor, platesFor, isBarbell, bestOf,
  weeklySetTargets, splitFor, buildProgram, exerciseFor, e1rm, loadFor, suggestLoad, p1Display,
  readiness, nextDayIndex, deloadCheck, dailyPlan, dayTotals, nutritionNotes, weekNumber,
  HOTWORX, PROTOCOLS, rapidCaps, carbcycleEligible, dayTargets, dietBreakLimitWeeks, nextSetLoad, STRPLAN, strRound, strBase, strSession, strBackoff, strNextTop };
if (typeof module !== 'undefined') module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
