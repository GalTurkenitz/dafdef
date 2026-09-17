/**
 * fetch-dev-works.mjs — ** זמני, לשלב 2 בלבד **
 *
 * מושך כמה יצירות עבריות מנחלת הכלל כדי שיהיה על מה לפתח ולבדוק את הקורא
 * לפני שקטלוג בן-יהודה מחובר (שלב 3). המקור כאן הוא ויקיטקסט, כי ה-API
 * של בן-יהודה דורש מפתח.
 *
 * בשלב 3 הקובץ הזה נמחק ומוחלף ב-scripts/fetch-benyehuda.mjs.
 *
 * הרצה:  node scripts/fetch-dev-works.mjs
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countWords, WPM } from '../js/logic/verify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'content', 'works');

const WORKS = [
  { id: 'dev-safiach',      page: 'פרוזה (ביאליק)/ספיח',        author: 'חיים נחמן ביאליק', genre: 'פרוזה' },
  { id: 'dev-meahorei',     page: 'פרוזה (ביאליק)/מאחורי הגדר', author: 'חיים נחמן ביאליק', genre: 'פרוזה' },
  { id: 'dev-hanaar-david', page: 'פרוזה (ביאליק)/הנער דוד',    author: 'חיים נחמן ביאליק', genre: 'אגדה' },
  { id: 'dev-megilat-orpa', page: 'פרוזה (ביאליק)/מגילת ערפה',  author: 'חיים נחמן ביאליק', genre: 'אגדה' },
  { id: 'dev-hamatmid',     page: 'המתמיד',                     author: 'חיים נחמן ביאליק', genre: 'שירה' },
];

/** משאיר רק פסקאות, כותרות ושירה — בלי ניווט, הערות שוליים וקטגוריות של ויקי */
function cleanHtml(raw, verse = false) {
  let html = raw;

  // בלוקים שלמים שלא שייכים לטקסט
  html = html.replace(/<table[\s\S]*?<\/table>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<sup[\s\S]*?<\/sup>/gi, '');
  html = html.replace(/<span class="mw-editsection"[\s\S]*?<\/span>/gi, '');
  html = html.replace(/<div class="(?:printfooter|catlinks|navbox|mw-references-wrap|reflist)"[\s\S]*?<\/div>/gi, '');
  html = html.replace(/<ol class="references"[\s\S]*?<\/ol>/gi, '');

  // אוספים רק את מה שנקרא בפועל
  const keep = [];
  const re = /<(p|h2|h3|blockquote|dd|dl)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    const inner = m[2]
      .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')     // קישורים ⇐ טקסט
      .replace(/<(?!\/?(?:b|i|em|strong|br)\b)[^>]+>/gi, ' ') // רק עיצוב טקסט בסיסי נשאר
      .replace(/&#160;|&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?׃־])/g, '$1')   // רווח שנוצר לפני סימן פיסוק
      .trim();

    if (!inner) continue;
    if (tag === 'h2' || tag === 'h3') keep.push(`<h3>${inner}</h3>`);
    // שירה היא שורות, לא פסקאות — הקורא מציג אותן בלי מרווח ובלי יישור
    else if (verse || tag === 'blockquote' || tag === 'dd' || tag === 'dl') keep.push(`<p class="verse">${inner}</p>`);
    else keep.push(`<p>${inner}</p>`);
  }
  return keep.join('\n');
}

function plainText(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

await mkdir(OUT, { recursive: true });

const index = [];
for (const w of WORKS) {
  const url = 'https://he.wikisource.org/w/api.php?action=parse&format=json&prop=text&page='
    + encodeURIComponent(w.page);

  const res = await fetch(url);
  const json = await res.json();
  if (!json.parse) {
    console.error('דילוג —', w.page, json.error?.info || '');
    continue;
  }

  const html = cleanHtml(json.parse.text['*'], w.genre === 'שירה');
  const wordCount = countWords(plainText(html));
  const estMinutes = Math.max(1, Math.round(wordCount / WPM));

  const work = {
    id: w.id,
    title: json.parse.title.replace(/^.*\//, ''),
    author: w.author,
    genre: w.genre,
    wordCount,
    estMinutes,
    source: 'he.wikisource.org — נחלת הכלל (זמני, עד חיבור בן-יהודה)',
    html,
  };

  await writeFile(join(OUT, w.id + '.json'), JSON.stringify(work, null, 2), 'utf8');
  index.push({ id: work.id, title: work.title, author: work.author, genre: work.genre,
               wordCount, estMinutes });
  console.log(`${work.title} — ${wordCount} מילים, ~${estMinutes} דק׳`);
}

await writeFile(join(ROOT, 'content', 'dev-works.json'), JSON.stringify(index, null, 2), 'utf8');
console.log(`\nנשמרו ${index.length} יצירות ל-content/works/`);
