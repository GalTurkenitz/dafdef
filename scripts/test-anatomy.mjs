/**
 * test-anatomy.mjs — שלמות המפה בין נישה, אזור וגיאומטריה.
 *
 * שלושה קבצים חייבים להסכים: anatomy.js (איזה אזור שייך לאיזו
 * נישה), body-parts.js (אילו חלקים קיימים בתלת-מימד) ו-config.js
 * (אילו נישות יש בכלל). אף אחד מהם אינו מכיר את השני בזמן ריצה,
 * ולכן טעות הקלדה בשם חלק פשוט הופכת אזור לבלתי לחיץ בשקט.
 *
 * זה כבר קרה: החזה פורק לשני שרירי pec, ו-anatomy.js המשיך
 * להצביע על חלק בשם 'chest' שלא היה קיים יותר. שום דבר לא נשבר,
 * פשוט אי אפשר היה ללחוץ על החזה.
 *
 * רץ ב-node בלי דפדפן ובלי three.
 *
 * שימוש: node scripts/test-anatomy.mjs
 */

import { REGIONS, REGION_IDS, regionOfPart } from '../js/ui/anatomy.js';
import { PARTS, BRAIN_FIT, BODY_HEIGHT, BODY_CENTER_Y } from '../js/ui/body-parts.js';
import { NICHES, NICHE_IDS } from '../js/config.js';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let fail = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) fail += 1;
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${extra ? '  → ' + extra : ''}`);
};

const partNames = new Set(PARTS.map((p) => p.name));

/* ---------- שמות ---------- */

console.log('\n— שמות החלקים —');

const missing = [];
for (const [id, r] of Object.entries(REGIONS)) {
  for (const p of r.parts) if (!partNames.has(p)) missing.push(`${id}:${p}`);
}
ok('כל חלק שאזור מצביע עליו קיים בגיאומטריה', missing.length === 0, missing.join(', '));

ok('אין שם חלק כפול', partNames.size === PARTS.length,
   `${partNames.size} שמות · ${PARTS.length} חלקים`);

const twice = [];
const seen = new Set();
for (const r of Object.values(REGIONS)) {
  for (const p of r.parts) { if (seen.has(p)) twice.push(p); seen.add(p); }
}
ok('אף חלק אינו שייך לשני אזורים', twice.length === 0, twice.join(', '));

/* ---------- נישות ---------- */

console.log('\n— נישות —');

const badNiche = Object.entries(REGIONS)
  .filter(([, r]) => !NICHES[r.niche]).map(([id, r]) => `${id}→${r.niche}`);
ok('כל אזור מצביע על נישה קיימת', badNiche.length === 0, badNiche.join(', '));

const covered = new Set(Object.values(REGIONS).map((r) => r.niche));
const uncovered = NICHE_IDS.filter((n) => !covered.has(n));
ok('לכל שמונה הנישות יש אזור בגוף', uncovered.length === 0, uncovered.join(', '));

/* ---------- תוכן ---------- */

console.log('\n— תוכן —');

const noWhat = REGION_IDS.filter((id) => !REGIONS[id].what || REGIONS[id].what.length < 40);
ok('לכל אזור יש משפט הסבר', noWhat.length === 0, noWhat.join(', '));

const noSource = REGION_IDS.filter((id) => !REGIONS[id].source);
ok('לכל אזור יש מקור', noSource.length === 0, noSource.join(', '));

/* הניסוח הוא "מפעיל" ולא "משפר" — זה מה שמחזיק אותנו מחוץ
   להגדרה של טענה בריאותית, ולכן זו בדיקה ולא הערה. */
const claims = REGION_IDS.filter((id) => /משפר|מגדיל את המוח|יגדל אצלך/.test(REGIONS[id].what));
ok('אין טענה שאזור "השתפר" אצל המשתמש', claims.length === 0, claims.join(', '));

/* ---------- גיאומטריה ---------- */

console.log('\n— גיאומטריה —');

const organs = PARTS.filter((p) => p.organ);
const decor = PARTS.filter((p) => p.decor);
ok('יש איברים פנימיים', organs.length >= 9, String(organs.length));

/* איבר פנימי שאין לו אזור הוא איבר שאי אפשר ללחוץ עליו —
   כלומר עבודה שהלכה לאיבוד */
const orphanOrgans = organs.filter((p) => !regionOfPart(p.name)).map((p) => p.name);
ok('לכל איבר פנימי יש אזור', orphanOrgans.length === 0, orphanOrgans.join(', '));

/* שכבת הרקע היא ההפך: היא **חייבת** להיות בלי אזור, אחרת היא
   תהפוך ללחיצה ותסמן נישה שלא ביקשנו לסמן. */
const markedDecor = decor.filter((p) => regionOfPart(p.name)).map((p) => p.name);
ok('שכבת הרקע אינה מסומנת', markedDecor.length === 0, markedDecor.join(', '));
ok('יש שכבת רקע', decor.length >= 4, String(decor.length));

/* כל חלק חייב להיות מוגדר בדרך אחת: מודל GLB משלו, או כתם
   שנחתך מרשת המוח. חלק בלי אף אחת מהן פשוט לא ייווצר. */
const undefinedParts = PARTS
  .filter((p) => !p.model && !(p.from === 'brain' && p.patch))
  .map((p) => p.name);
ok('לכל חלק יש הגדרה', undefinedParts.length === 0, undefinedParts.join(', '));

/* אין יותר פרימיטיבים. זו הייתה הבקשה המפורשת: כל איבר באותה
   רמה כמו המוח, לא כדור ולא ביצה. */
const primitives = PARTS.filter((p) => p.type || p.r).map((p) => p.name);
ok('אין איברים מפרימיטיבים', primitives.length === 0, primitives.join(', '));

/* קובץ המודל חייב להיות קיים בפועל */
const missingModels = PARTS.filter((p) => p.model)
  .filter((p) => !existsSync(join(ROOT, 'content', 'models', p.model)))
  .map((p) => p.model);
ok('כל קובצי המודלים קיימים', missingModels.length === 0, missingModels.join(', '));

/* הכל ביחידות "גובה הגוף = 1" — מספר מחוץ לטווח הזה הוא כמעט
   תמיד שריד מהגרסה שעבדה ביחידות עולם */
const outside = PARTS.filter((p) => p.at)
  .filter((p) => p.at[1] < 0 || p.at[1] > 1 || Math.abs(p.at[0]) > 0.5)
  .map((p) => p.name);
ok('האיברים ביחידות מנורמלות', outside.length === 0, outside.join(', '));

/* המוח חייב להיכנס לגולגולת. הראש נמדד מרשת הגוף:
   רוחב 0.106, גובה 0.145, עומק 0.125. */
const brainBox = { w: 0.829, h: 1.000, d: 1.076 };
const fit = {
  w: brainBox.w * BRAIN_FIT.scale,
  h: brainBox.h * BRAIN_FIT.scale,
  d: brainBox.d * BRAIN_FIT.scale,
};
ok('המוח צר מהראש', fit.w < 0.106, fit.w.toFixed(3) + ' מול 0.106');
ok('המוח רדוד מהראש', fit.d < 0.125, fit.d.toFixed(3) + ' מול 0.125');
ok('המוח בתוך גובה הראש',
   BRAIN_FIT.at[1] - fit.h / 2 > 0.855 && BRAIN_FIT.at[1] + fit.h / 2 < 1.001,
   (BRAIN_FIT.at[1] - fit.h / 2).toFixed(3) + '–' + (BRAIN_FIT.at[1] + fit.h / 2).toFixed(3));

/* כתם על המוח חייב להיות בתוך הקופסה של המוח, אחרת הוא לא
   יחתוך אף משולש והאזור פשוט לא יופיע */
const badPatch = PARTS.filter((p) => p.patch)
  .filter((p) => {
    const [x, y, z] = p.patch.at;
    return Math.abs(x) > brainBox.w / 2 || y < 0 || y > 1 || Math.abs(z) > brainBox.d / 2;
  }).map((p) => p.name);
ok('כתמי המוח בתוך המוח', badPatch.length === 0, badPatch.join(', '));

console.log('');
console.log(fail ? `${fail} בדיקות נכשלו` : 'כל הבדיקות עברו');
process.exit(fail ? 1 : 0);
