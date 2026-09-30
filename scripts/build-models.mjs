/**
 * build-models.mjs — הופך את מודלי המקור ל-GLB שהאפליקציה טוענת.
 *
 * ─────────────────────────────────────────────────────────────────
 *  המקורות והרישיונות
 *
 *  גוף — MakeHuman base mesh (hm08)
 *    https://github.com/makehumancommunity/makehuman
 *    makehuman/data/3dobjs/base.obj
 *    **CC0** — שוחרר במפורש בספטמבר 2020, כתוב בראש הקובץ עצמו.
 *    מנקין ניטרלי, חלק, בלי בגדים, 18,486 מרובעים.
 *
 *  מוח — "Brain AS.stl" מאת AgnieszkaStarostecka
 *    https://commons.wikimedia.org/wiki/File:Brain_AS.stl
 *    **CC BY 4.0** — שימוש מסחרי מותר, בתנאי ייחוס.
 *    סריקה אנטומית אמיתית: שתי המיספרות, גירי וסולסי, מוח קטן
 *    וגזע מוח. 3.05 מיליון משולשים במקור.
 *
 *  לא נמצא מוח ב-CC0 שאפשר להוריד בפועל: המודל של NIH 3D
 *  (3DPX-021161) הוא CC BY וה-S3 שלו מחזיר 403 בלי חתימה,
 *  ו-Smithsonian דורש מפתח API. הייחוס יושב ב-content/models/
 *  CREDITS.md ובעמוד הקרדיטים.
 * ─────────────────────────────────────────────────────────────────
 *  למה סקריפט ולא קובץ שהוכנס ידנית
 *
 *  3 מיליון משולשים הם 150MB. הטלפון צריך ~15 אלף. ההקטנה חייבת
 *  להיות שחזירה — אם נחליט מחר על פרופיל אחר, משנים מספר אחד
 *  ומריצים מחדש, במקום לנחש מה נעשה בקובץ.
 *
 * שימוש:
 *   1. הורדת המקורות (פעם אחת):
 *        curl -L -o base.obj  https://raw.githubusercontent.com/ *          makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj
 *        curl -L -o brain.stl https://upload.wikimedia.org/wikipedia/ *          commons/a/ad/Brain_AS.stl
 *   2. npm install --no-save meshoptimizer
 *   3. node --max-old-space-size=6144 scripts/build-models.mjs --src <תיקייה>
 *
 * לזיכרון הגדול יש סיבה: ה-STL של המוח הוא 150MB ו-3 מיליון
 * משולשים, וריתוך הקודקודים מחזיק מפה של מיליון וחצי רשומות.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'content', 'models');

const args = process.argv.slice(2);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const SRC = opt('--src', '/tmp/models');

/* ------------------------------------------------------------------ *
 * קריאת מקורות
 * ------------------------------------------------------------------ */

/** STL בינארי: כותרת 80 בתים, מונה 4, ואז 50 בתים למשולש */
function readBinaryStl(buf) {
  const count = buf.readUInt32LE(80);
  const positions = new Float32Array(count * 9);
  let o = 84;
  for (let i = 0; i < count; i += 1) {
    o += 12; // הנורמל של הפאה — נחשב מחדש אחרי ההקטנה
    for (let v = 0; v < 9; v += 1) {
      positions[i * 9 + v] = buf.readFloatLE(o);
      o += 4;
    }
    o += 2; // attribute byte count
  }
  return positions;
}

/**
 * OBJ. המרובעים של MakeHuman מפורקים למשולשים, וה-UV והנורמלים
 * נזרקים: החומר באפליקציה הוא זכוכית אחידה בלי טקסטורה.
 */
function readObj(text, keepGroup = null) {
  const verts = [];
  const tris = [];
  let group = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('g ')) {
      group = line.slice(2).trim();
    } else if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      verts.push([+p[1], +p[2], +p[3]]);
    } else if (line.startsWith('f ')) {
      /* base.obj של MakeHuman אינו רק הגוף: יש בו 171 קבוצות עזר —
         helper-skirt, helper-tights, helper-hair, שיניים, עיניים,
         ו-joint-* שהם קוביות סימון למפרקים. בלי הסינון הזה ההקטנה
         מיזגה את חצאית העזר עם הרגליים, והדמות יצאה לבושה בשמלה
         עם פסי שיער תלויים מהפנים. */
      if (keepGroup && group !== keepGroup) continue;
      const idx = line.trim().split(/\s+/).slice(1)
        .map((t) => {
          const n = parseInt(t.split('/')[0], 10);
          return n > 0 ? n - 1 : verts.length + n;
        });
      for (let i = 1; i < idx.length - 1; i += 1) {
        tris.push(idx[0], idx[i], idx[i + 1]);
      }
    }
  }
  return { verts, tris };
}

/* ------------------------------------------------------------------ *
 * ריתוך והקטנה
 * ------------------------------------------------------------------ */

/**
 * STL הוא ערמת משולשים בלי אינדקס — כל קודקוד מופיע שוב ושוב.
 * בלי ריתוך המפשט רואה 9 מיליון קודקודים נפרדים ולא יכול לקרוס
 * אף צלע, כי שום שני משולשים אינם חולקים קודקוד.
 */
function weld(positions, tolerance = 1e-4) {
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

async function simplify(positions, index, targetTris) {
  await MeshoptSimplifier.ready;
  const target = targetTris * 3;
  if (index.length <= target) return index;
  const [simplified, error] = MeshoptSimplifier.simplify(
    index, positions, 3, target, 0.02, ['LockBorder'],
  );
  console.log(`      הוקטן ל-${(simplified.length / 3).toLocaleString('he')} משולשים · שגיאה ${(error * 100).toFixed(3)}%`);
  return simplified;
}

/** נורמלים חלקים — בלעדיהם המודל נראה כמו שקית מקופלת */
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

/**
 * מסובב את המודל למוסכמה של three: y למעלה, +z אל הצופה.
 *
 * ה-STL של המוח מגיע במוסכמת LPS של הדמיה רפואית — +x שמאל,
 * +y אחורה, +z למעלה. זה נמדד ולא הונח: בתצוגה לאורך +x נראים
 * המוח הקטן וגזע המוח בצד ה--z, כלומר -z הוא התחתון ו-+z העליון,
 * והמצח נמצא ב--y.
 *
 * סיבוב של 90°- סביב x מעביר את +z אל +y (עליון למעלה) ואת -y
 * אל +z (הפנים אל הצופה). ה-x אינו זז, ולכן +x נשאר השמאל
 * האנטומי — אותה מוסכמה שהגוף כבר משתמש בה.
 */
function rotateXMinus90(positions) {
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    const z = positions[i + 2];
    positions[i + 1] = z;
    positions[i + 2] = -y;
  }
}

/**
 * מרכוז ונרמול לגובה 1, כדי שהאפליקציה תקבע את הגודל ולא יחידות
 * המקור — STL רפואי מגיע במילימטרים ו-OBJ ביחידות שרירותיות.
 */
function normalize(positions) {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const h = maxY - minY;
  const s = 1 / h;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - cx) * s;
    positions[i + 1] = (positions[i + 1] - minY) * s;   // כפות רגליים ב-0
    positions[i + 2] = (positions[i + 2] - cz) * s;
  }
  return { width: (maxX - minX) * s, depth: (maxZ - minZ) * s, height: 1 };
}

/* ------------------------------------------------------------------ *
 * כתיבת GLB
 *
 * GLB הוא JSON של glTF ואחריו גוש בינארי, בשני נתחים עם כותרת של
 * 12 בתים. אין כאן צורך בספרייה.
 * ------------------------------------------------------------------ */

function writeGlb(positions, normals, index) {
  const idx = index.length < 65536
    ? new Uint16Array(index) : new Uint32Array(index);
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

  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k += 1) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }

  const json = {
    asset: { version: '2.0', generator: 'dafdef build-models.mjs' },
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
  const jsonPad = Buffer.alloc(pad4(jsonBuf.length) - jsonBuf.length, 0x20);
  const binPad = Buffer.alloc(pad4(bin.length) - bin.length, 0);

  const jsonChunk = Buffer.concat([jsonBuf, jsonPad]);
  const binChunk = Buffer.concat([bin, binPad]);

  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

  const jsonHead = Buffer.alloc(8);
  jsonHead.writeUInt32LE(jsonChunk.length, 0);
  jsonHead.writeUInt32LE(0x4E4F534A, 4);   // 'JSON'

  const binHead = Buffer.alloc(8);
  binHead.writeUInt32LE(binChunk.length, 0);
  binHead.writeUInt32LE(0x004E4942, 4);    // 'BIN'

  return Buffer.concat([header, jsonHead, jsonChunk, binHead, binChunk]);
}

/* ------------------------------------------------------------------ */

async function build(name, positions, targetTris, index, orient = null) {
  console.log(`\n  ${name}`);
  console.log(`      מקור: ${(positions.length / 3).toLocaleString('he')} קודקודים`);

  let pos = positions;
  let idx = index;
  if (!idx) {
    const w = weld(positions);
    pos = w.positions;
    idx = w.index;
    console.log(`      אחרי ריתוך: ${(pos.length / 3).toLocaleString('he')} קודקודים · `
              + `${(idx.length / 3).toLocaleString('he')} משולשים`);
  }

  idx = await simplify(pos, idx, targetTris);

  /* הקודקודים שכבר אינם בשימוש נזרקים, אחרת הקובץ נושא מיליוני
     קודקודים יתומים שאיש אינו מצביע עליהם */
  const used = new Map();
  const newPos = [];
  const newIdx = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i += 1) {
    const old = idx[i];
    let at = used.get(old);
    if (at === undefined) {
      at = newPos.length / 3;
      used.set(old, at);
      newPos.push(pos[old * 3], pos[old * 3 + 1], pos[old * 3 + 2]);
    }
    newIdx[i] = at;
  }
  const finalPos = new Float32Array(newPos);
  if (orient) orient(finalPos);
  const box = normalize(finalPos);
  const normals = computeNormals(finalPos, newIdx);

  const glb = writeGlb(finalPos, normals, newIdx);
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, name), glb);

  console.log(`      נשמר: ${(glb.length / 1024).toFixed(0)}KB · `
            + `${(finalPos.length / 3).toLocaleString('he')} קודקודים · `
            + `${(newIdx.length / 3).toLocaleString('he')} משולשים`);
  console.log(`      תיבה (גובה=1): רוחב ${box.width.toFixed(3)} · עומק ${box.depth.toFixed(3)}`);
  return box;
}

/* ------------------------------------------------------------------ */

console.log('בונה מודלים…');

const obj = readObj(await readFile(join(SRC, 'base.obj'), 'utf8'), 'body');
const objPos = new Float32Array(obj.verts.flat());
await build('body.glb', objPos, 24000, new Uint32Array(obj.tris));

const stl = readBinaryStl(await readFile(join(SRC, 'brain.stl')));
await build('brain.glb', stl, 18000, null, rotateXMinus90);

console.log('\nהסתיים.');
