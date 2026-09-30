/**
 * build-organs.mjs — מחלץ איברים ושרירים מ-Z-Anatomy אל GLB.
 *
 * ─────────────────────────────────────────────────────────────────
 *  המקור והרישיון
 *
 *  Z-Anatomy — https://github.com/LluisV/Z-Anatomy-Sample
 *  **CC BY-SA 4.0**, נגזר מ-BodyParts3D (DBCLS, CC BY-SA 2.1 JP).
 *
 *  **ShareAlike.** המשמעות המעשית: קובצי ה-GLB שנוצרים כאן הם
 *  יצירה נגזרת וחייבים להישאר תחת CC BY-SA 4.0 עם ייחוס. זה חל
 *  עליהם בלבד — לא על קוד האפליקציה, שאינו נגזר מהם. הפירוט
 *  ב-content/models/CREDITS.md.
 * ─────────────────────────────────────────────────────────────────
 *  למה דרך דפדפן
 *
 *  המקור הוא FBX בינארי. אין ל-node מפרש FBX, אבל ל-three יש
 *  FBXLoader שרץ בדפדפן. הסקריפט מרים שרת סטטי, טוען את הקבצים
 *  בכרומיום, מחלץ את הרשתות לפי שם, ומחזיר ל-node מערכי מספרים
 *  שעוברים הקטנה וכתיבה ל-GLB באותו כותב שכבר קיים.
 * ─────────────────────────────────────────────────────────────────
 *  היישור לגוף שלנו
 *
 *  Z-Anatomy ו-MakeHuman הם שני אנשים שונים בשתי מערכות יחידות.
 *  קובץ "Regions of human body" מכיל את כל פני הגוף, ולכן תיבת
 *  התוחם שלו נותנת את הגובה והמרכז של דמות Z-Anatomy. כל איבר
 *  מומר דרכה ליחידות "גובה הגוף = 1, כפות הרגליים ב-0" — אותן
 *  יחידות שבהן body.glb כבר מנורמל.
 *
 *  זה מיישר בקירוב, לא בדיוק: שתי הדמויות אינן באותן פרופורציות.
 *  כוונון עדין לכל קבוצה יושב ב-js/ui/body-parts.js.
 * ─────────────────────────────────────────────────────────────────
 *
 * שימוש:
 *   npm install --no-save meshoptimizer playwright
 *   node scripts/build-organs.mjs --src <תיקיית ה-FBX>
 *
 * הורדת המקורות (פעם אחת):
 *   base=https://raw.githubusercontent.com/LluisV/Z-Anatomy-Sample/main/Assets/Models/1.0%20Models
 *   curl -L -o VisceralSystem100.fbx  "$base/VisceralSystem100.fbx"
 *   curl -L -o MuscularSystem100.fbx  "$base/MuscularSystem100.fbx"
 *   curl -L -o CardioVascular41.fbx   "$base/CardioVascular41.fbx"
 *   curl -L -o Regions.fbx            "$base/Regions%20of%20human%20body100.fbx"
 */

import http from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'content', 'models');

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const SRC = opt('--src', join(ROOT, '..', 'zanatomy'));

/* ------------------------------------------------------------------ *
 * מה מחלצים
 *
 * l/r נוספים בקוד — כל שריר מופיע פעמיים, פעם לכל צד.
 * ------------------------------------------------------------------ */

const both = (...names) => names.flatMap((n) => [n + 'l', n + 'r']);

const GROUPS = [
  {
    file: 'VisceralSystem100.fbx',
    out: 'lungs.glb',
    tris: 9000,
    /* חמש האונות האמיתיות: שתיים משמאל, שלוש מימין. הסימפונות
       לא נכללים — הם רשת דקיקה שנעלמת בהקטנה וגוזלת משולשים. */
    meshes: [
      'Superior_lobe_of_left_lung', 'Inferior_lobe_of_left_lung',
      'Superior_lobe_of_right_lung', 'Middle_lobe_of_right_lung',
      'Inferior_lobe_of_right_lung',
    ],
  },
  {
    file: 'CardioVascular41.fbx',
    out: 'heart.glb',
    tris: 7000,
    /* שרירי הלב עצמו. כלי הדם הגדולים נשארים בחוץ — הם יוצאים
       מהחזה ומגיעים עד הצוואר, ומרחיבים את האיבר לכדי משהו שלא
       נראה כמו לב. */
    meshes: [
      'Left_ventricle', 'Right_ventricle',
      'Left_atrium', 'Right_atrium',
      'Auricle_of_left_atrium', 'Auricle_of_right_atrium',
    ],
  },
  {
    file: 'VisceralSystem100.fbx',
    out: 'kidneys.glb',
    tris: 4000,
    meshes: ['Kidneyl', 'Kidneyr'],
  },
  {
    file: 'MuscularSystem100.fbx',
    out: 'muscle-pec.glb',
    tris: 7000,
    /* חזה גדול, שלושת ראשיו. יושב על הגזע ולכן מתיישר עם הגוף
       שלנו כמות שהוא. */
    meshes: both(
      'Clavicular_head_of_pectoralis_major_muscle',
      'Sternocostal_head_of_pectoralis_major_muscle',
      '(Abdominal_part_of_pectoralis_major_muscle)',
    ),
  },
  {
    file: 'MuscularSystem100.fbx',
    out: 'muscle-arm.glb',
    tris: 7000,
    /* הדלתא הקדמית (החלק הבריחי בלבד — האקרומיאלי והשדרתי אינם
       דוחפים) ושלושת ראשי התלת-ראשי.

       בקובץ נפרד מהחזה בכוונה: Z-Anatomy עומד בתנוחה אנטומית עם
       זרועות צמודות, ודמות MakeHuman שלנו בתנוחת A עם זרועות
       פרושות ב-35°. שרירי הגזע מתיישרים לבד; את שרירי הזרוע צריך
       לסובב סביב הכתף, וזה אפשרי רק אם הם רשת בפני עצמה. */
    meshes: both(
      /* הדלתא הקדמית והאמצעית. החלק השדרתי (האחורי) נשאר בחוץ:
         הוא מושך ואינו דוחף, ואינו עובד בשכיבות סמיכה. */
      'Clavicular_part_of_deltoid_muscle',
      'Acromial_part_of_deltoid_muscle',
      'Long_head_of_triceps_brachii',
      'Lateral_head_of_triceps_brachii',
      'Medial_head_of_triceps_brachii',
    ),
  },
  {
    file: 'MuscularSystem100.fbx',
    out: 'muscle-legs.glb',
    tris: 14000,
    /* סקוואטים: ארבע-ראשי (ישר הירך ושלושת הרחבים) והמסטרינג
       (דו-ראשי הירך, חצי-גידי וחצי-קרומי). */
    meshes: both(
      'Rectus_femoris_muscle',
      'Vastus_lateralis_muscle', 'Vastus_medialis_muscle', 'Vastus_intermedius_muscle',
      'Long_head_of_biceps_femoris', 'Short_head_of_biceps_femoris',
      'Semitendinosus_muscle', 'Semimembranosus_muscle',
    ),
  },

  /* ---------- שכבת הרקע ----------
     איברים ושרירים שאין להם נישה. הם קיימים כדי שהגוף ייראה כמו
     גוף ולא כמו חמישה חלקים צפים, והם מוכנים לרגע שבו נישה חדשה
     תיקח אחד מהם. לא לחיצים ולא מסומנים. */

  {
    file: 'MuscularSystem100.fbx',
    out: 'decor-core.glb',
    tris: 16000,
    /* הקוביות בבטן היו הבקשה המפורשת. איתן האלכסוני החיצוני,
       הרחב גבי, החלק היורד של הטרפז, המסור הקדמי והישבן הגדול —
       כל מה שמצייר גזע. */
    meshes: both(
      'Rectus_abdominis_muscle',
      'External_abdominal_oblique_muscle',
      'Latissimus_dorsi_muscle',
      'Descending_part_of_trapezius_muscle',
      'Serratus_anterior_muscle',
      'Gluteus_maximus_muscle',
    ),
  },
  {
    file: 'MuscularSystem100.fbx',
    out: 'decor-arm.glb',
    tris: 6000,
    /* על הזרוע, ולכן מקבל את אותו סיבוב כמו שרירי הדחיפה */
    meshes: both(
      'Long_head_of_biceps_brachii', 'Short_head_of_biceps_brachii',
      'Brachialis_muscle',
    ),
  },
  {
    file: 'MuscularSystem100.fbx',
    out: 'decor-leg.glb',
    tris: 8000,
    /* שוק — מתחת לברך, ולכן מקבל את אותה הרחקה כמו שרירי הירך */
    meshes: both(
      'Medial_head_of_gastrocnemius', 'Lateral_head_of_gastrocnemius',
      'Soleus_muscle',
    ),
  },
  {
    file: 'VisceralSystem100.fbx',
    out: 'decor-organ.glb',
    tris: 10000,
    /* איברי הבטן והצוואר. המעי הגס נשאר בחוץ — הוא 60 אלף
       משולשים בארבעה חלקים וממלא את כל הבטן. */
    meshes: [
      'Liver', 'Stomach', 'Pancreas', 'Gallbladder',
      'Urinary_bladder', 'Trachea', 'Thyroid_gland',
    ],
  },
];

/* ------------------------------------------------------------------ *
 * שרת ודפדפן
 * ------------------------------------------------------------------ */

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

function serve(port, pageHtml) {
  return http.createServer((q, r) => {
    const rel = normalize(decodeURIComponent(q.url.split('?')[0]));

    /* הדף מוגש מהשרת ולא דרך setContent: setContent יושב על
       about:blank, ושם נתיב מוחלט כמו /vendor/... אינו נפתר. */
    if (q.url.split('?')[0].endsWith('/build.html')) {
      r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      r.end(pageHtml);
      return;
    }

    for (const base of [ROOT, SRC]) {
      const p = join(base, rel);
      try {
        const st = statSync(p);
        if (st.isDirectory()) continue;
        r.writeHead(200, {
          'Content-Type': MIME[extname(p)] || 'application/octet-stream',
          'Content-Length': st.size,
        });
        createReadStream(p).pipe(r);
        return;
      } catch { /* הבא בתור */ }
    }
    r.writeHead(404).end('nf');
  }).listen(port);
}

const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import * as THREE from '/vendor/three/three.module.js';
import { FBXLoader } from '/vendor/build/FBXLoader.js';

window.__load = (url) => new Promise((res, rej) => {
  new FBXLoader().load(url, res, undefined, rej);
});

/** תיבת התוחם של כל הקובץ — משמשת לחישוב קנה המידה */
window.__bbox = async (url) => {
  const o = await window.__load(url);
  const b = new THREE.Box3().setFromObject(o);
  return { min: b.min.toArray(), max: b.max.toArray() };
};

/** מחלץ רשתות לפי שם, מאוחדות ומומרות ליחידות הגוף */
window.__extract = async (url, names, ref) => {
  const o = await window.__load(url);
  o.updateMatrixWorld(true);

  const want = new Set(names);
  const pos = [];
  const seen = [];
  o.traverse((m) => {
    if (!m.isMesh || !want.has(m.name)) return;
    seen.push(m.name);
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    g.applyMatrix4(m.matrixWorld);
    const a = g.getAttribute('position').array;
    for (let i = 0; i < a.length; i += 1) pos.push(a[i]);
    g.dispose();
  });

  /* אל יחידות "גובה הגוף = 1, כפות הרגליים ב-0, ממורכז" */
  const h = ref.max[1] - ref.min[1];
  const s = 1 / h;
  const cx = (ref.min[0] + ref.max[0]) / 2;
  const cz = (ref.min[2] + ref.max[2]) / 2;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = (pos[i] - cx) * s;
    pos[i + 1] = (pos[i + 1] - ref.min[1]) * s;
    pos[i + 2] = (pos[i + 2] - cz) * s;
  }
  return { pos, seen, missing: names.filter((n) => !seen.includes(n)) };
};
</script>`;

/* ------------------------------------------------------------------ *
 * עיבוד ב-node
 * ------------------------------------------------------------------ */

function weld(positions, tolerance = 1e-5) {
  const map = new Map();
  const out = [];
  const index = new Uint32Array(positions.length / 3);
  const q = 1 / tolerance;
  for (let i = 0; i < positions.length; i += 3) {
    const key = `${Math.round(positions[i] * q)},${Math.round(positions[i + 1] * q)},`
              + `${Math.round(positions[i + 2] * q)}`;
    let at = map.get(key);
    if (at === undefined) {
      at = out.length / 3;
      map.set(key, at);
      out.push(positions[i], positions[i + 1], positions[i + 2]);
    }
    index[i / 3] = at;
  }
  return { positions: new Float32Array(out), index };
}

function computeNormals(positions, index) {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3;
    const b = index[i + 1] * 3;
    const c = index[i + 2] * 3;
    const ux = positions[b] - positions[a];
    const uy = positions[b + 1] - positions[a + 1];
    const uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a];
    const vy = positions[c + 1] - positions[a + 1];
    const vz = positions[c + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const o of [a, b, c]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l; n[i + 1] /= l; n[i + 2] /= l;
  }
  return n;
}

/** GLB הוא JSON ואחריו גוש בינארי, בשני נתחים. אין צורך בספרייה. */
function writeGlb(positions, normals, index) {
  const maxIdx = positions.length / 3;
  const idx = maxIdx < 65536 ? new Uint16Array(index) : new Uint32Array(index);
  const pad4 = (n) => (n + 3) & ~3;

  const parts = [
    { data: Buffer.from(positions.buffer, positions.byteOffset, positions.byteLength) },
    { data: Buffer.from(normals.buffer, normals.byteOffset, normals.byteLength) },
    { data: Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength) },
  ];
  let offset = 0;
  for (const p of parts) { p.offset = offset; offset = pad4(offset + p.data.length); }
  const bin = Buffer.alloc(offset);
  for (const p of parts) p.data.copy(bin, p.offset);

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }

  const json = {
    asset: { version: '2.0', generator: 'dafdef build-organs.mjs' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: idx.BYTES_PER_ELEMENT === 2 ? 5123 : 5125,
        count: idx.length, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: parts[0].offset, byteLength: parts[0].data.length, target: 34962 },
      { buffer: 0, byteOffset: parts[1].offset, byteLength: parts[1].data.length, target: 34962 },
      { buffer: 0, byteOffset: parts[2].offset, byteLength: parts[2].data.length, target: 34963 },
    ],
    buffers: [{ byteLength: bin.length }],
  };

  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonChunk = Buffer.concat([jsonBuf, Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc(pad4(bin.length) - bin.length, 0)]);

  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonChunk.length, 0);
  jsonHead.writeUInt32LE(0x4E4F534A, 4);
  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(binChunk.length, 0);
  binHead.writeUInt32LE(0x004E4942, 4);

  return Buffer.concat([header, jsonHead, jsonChunk, binHead, binChunk]);
}

/* ------------------------------------------------------------------ */

const srv = serve(8751, PAGE);
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('שגיאת דף:', e.message));

await page.goto('http://localhost:8751/build.html');
await page.waitForFunction(() => typeof window.__extract === 'function');

console.log('מודד את דמות המקור…');
const ref = await page.evaluate((u) => window.__bbox(u), 'http://localhost:8751/Regions.fbx');
console.log(`  גובה ${(ref.max[1] - ref.min[1]).toFixed(1)} יחידות · `
          + `רוחב ${(ref.max[0] - ref.min[0]).toFixed(1)} · עומק ${(ref.max[2] - ref.min[2]).toFixed(1)}`);

await mkdir(OUT, { recursive: true });
const report = [];

for (const g of GROUPS) {
  console.log(`\n  ${g.out}`);
  const got = await page.evaluate(
    ([u, names, r]) => window.__extract(u, names, r),
    [`http://localhost:8751/${g.file}`, g.meshes, ref],
  );

  if (got.missing.length) {
    console.log(`      ⚠ לא נמצאו: ${got.missing.join(', ')}`);
  }
  if (!got.pos.length) { console.log('      ריק — מדלג'); continue; }

  const raw = new Float32Array(got.pos);
  const w = weld(raw);
  console.log(`      ${got.seen.length} רשתות · ${(w.index.length / 3).toLocaleString('he')} משולשים`);

  await MeshoptSimplifier.ready;
  let index = w.index;
  if (index.length > g.tris * 3) {
    const [simplified, error] = MeshoptSimplifier.simplify(
      index, w.positions, 3, g.tris * 3, 0.03, ['LockBorder'],
    );
    index = simplified;
    console.log(`      הוקטן ל-${(index.length / 3).toLocaleString('he')} · שגיאה ${(error * 100).toFixed(2)}%`);
  }

  /* זריקת קודקודים יתומים */
  const used = new Map();
  const newPos = [];
  const newIdx = new Uint32Array(index.length);
  for (let i = 0; i < index.length; i += 1) {
    const old = index[i];
    let at = used.get(old);
    if (at === undefined) {
      at = newPos.length / 3;
      used.set(old, at);
      newPos.push(w.positions[old * 3], w.positions[old * 3 + 1], w.positions[old * 3 + 2]);
    }
    newIdx[i] = at;
  }

  const pos = new Float32Array(newPos);
  const glb = writeGlb(pos, computeNormals(pos, newIdx), newIdx);
  await writeFile(join(OUT, g.out), glb);

  let lo = [9, 9, 9];
  let hi = [-9, -9, -9];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      lo[k] = Math.min(lo[k], pos[i + k]);
      hi[k] = Math.max(hi[k], pos[i + k]);
    }
  }
  console.log(`      ${(glb.length / 1024).toFixed(0)}KB · `
            + `x ${lo[0].toFixed(3)}…${hi[0].toFixed(3)} · `
            + `y ${lo[1].toFixed(3)}…${hi[1].toFixed(3)} · `
            + `z ${lo[2].toFixed(3)}…${hi[2].toFixed(3)}`);
  report.push({ out: g.out, lo, hi, kb: Math.round(glb.length / 1024) });
}

await browser.close();
srv.close();

console.log('\nיחידות: גובה הגוף = 1, כפות הרגליים ב-y=0.');
console.log(JSON.stringify(report, null, 1));
