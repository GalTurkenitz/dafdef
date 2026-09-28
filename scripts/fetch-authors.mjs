/**
 * fetch-authors.mjs — מוריד דיוקן לכל מחבר בקטלוג.
 *
 * ─────────────────────────────────────────────────────────────────
 *  מאיפה
 *
 *  ל-API של בן-יהודה **אין תמונות בכלל** — לא לספר ולא למחבר,
 *  ו-endpoint המחברים מחזיר 404. לכן הדיוקנאות מגיעים מוויקיפדיה
 *  העברית, שמכסה 83% מהמחברים בקטלוג (105 מתוך 126).
 *
 *  מי שאין לו תמונה נשאר עם כרטיס הצבע הרגיל — זה מצב תקין ולא
 *  חור.
 * ─────────────────────────────────────────────────────────────────
 *  רישוי
 *
 *  תמונות ויקיפדיה אינן "חינם בלי תנאים". רובן נחלת הכלל, אבל
 *  חלקן CC-BY-SA ודורשות ייחוס. האפליקציה הולכת לחנות, ולכן
 *  הרישיון והיוצר נשמרים לצד כל תמונה ומוצגים בעמוד הקרדיטים.
 * ─────────────────────────────────────────────────────────────────
 *
 * שימוש: node scripts/fetch-authors.mjs
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'content', 'catalog.json');
const OUT_DIR = join(ROOT, 'content', 'authors');
const CREDITS = join(ROOT, 'content', 'authors', 'credits.json');

const UA = { 'User-Agent': 'dafdef/1.0 (https://dafdef-demo.netlify.app)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * שם קובץ ASCII דטרמיניסטי.
 *
 * שמות עבריים עובדים באינטרנט אחרי קידוד, אבל האפליקציה נארזת
 * ל-APK והם הופכים לשמות נכסים באנדרואיד. ASCII מוציא מהמשוואה
 * מחלקה שלמה של תקלות, והמיפוי לשם האמיתי נשמר ב-credits.json.
 */
function slug(name) {
  return 'a' + createHash('sha1').update(name).digest('hex').slice(0, 10);
}

/** הדיוקן והרישיון שלו מוויקיפדיה */
async function portrait(name) {
  const api = 'https://he.wikipedia.org/w/api.php?action=query&format=json&redirects=1'
    + '&titles=' + encodeURIComponent(name)
    + '&prop=pageimages|pageprops&piprop=thumbnail|name&pithumbsize=320';

  const d = await (await fetch(api, { headers: UA })).json();
  const page = Object.values(d.query?.pages || {})[0];
  const src = page?.thumbnail?.source;
  if (!src) return null;

  /* שם הקובץ ב-Commons, כדי למשוך ממנו רישיון ויוצר */
  const file = page.pageimage ? 'File:' + page.pageimage : null;
  let license = '', artist = '';

  if (file) {
    try {
      const meta = 'https://commons.wikimedia.org/w/api.php?action=query&format=json'
        + '&titles=' + encodeURIComponent(file)
        + '&prop=imageinfo&iiprop=extmetadata';
      const m = await (await fetch(meta, { headers: UA })).json();
      const info = Object.values(m.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata || {};
      license = info.LicenseShortName?.value || '';
      artist = String(info.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 80);
    } catch { /* בלי מטא-דאטה — עדיין נשמור את התמונה */ }
  }

  /* הכתובת נושאת פרמטרי מעקב — מנקים */
  return { src: src.split('?')[0], license, artist };
}

/* ------------------------------------------------------------------ */

const books = JSON.parse(await readFile(CATALOG, 'utf8'));
const authors = [...new Set(
  books.map((b) => (b.author || '').split('/')[0].trim()).filter(Boolean),
)];

await mkdir(OUT_DIR, { recursive: true });
console.log(`${authors.length} מחברים\n`);

const found = new Map();
const credits = [];
let missing = 0;

for (const name of authors) {
  try {
    const p = await portrait(name);
    if (!p) { missing += 1; continue; }

    const img = await fetch(p.src, { headers: UA });
    if (!img.ok) { missing += 1; continue; }

    const buf = Buffer.from(await img.arrayBuffer());
    const ext = p.src.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
    const file = slug(name) + ext;

    await writeFile(join(OUT_DIR, file), buf);
    found.set(name, file);
    credits.push({ author: name, file, license: p.license, artist: p.artist, source: p.src });

    console.log(`  ${String(found.size).padStart(3)}. ${name.slice(0, 26).padEnd(28)} ${String(Math.round(buf.length / 1024)).padStart(3)}KB  ${p.license}`);
  } catch { missing += 1; }
  await sleep(150);
}

/* חיבור לקטלוג */
for (const b of books) {
  const key = (b.author || '').split('/')[0].trim();
  const file = found.get(key);
  if (file) b.authorImage = 'content/authors/' + file;
}

await writeFile(CATALOG, JSON.stringify(books, null, 2), 'utf8');
await writeFile(CREDITS, JSON.stringify(credits, null, 2), 'utf8');

const withImg = books.filter((b) => b.authorImage).length;
console.log(`\n${found.size} דיוקנאות · ${missing} בלי`);
console.log(`${withImg} מתוך ${books.length} ספרים עם תמונה (${Math.round(withImg / books.length * 100)}%)`);
