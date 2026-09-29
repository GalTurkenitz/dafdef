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
import { PARTS, BODY_HEIGHT, BODY_CENTER_Y } from '../js/ui/body-parts.js';
import { NICHES, NICHE_IDS } from '../js/config.js';

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
ok('יש איברים פנימיים', organs.length >= 9, String(organs.length));

/* כל חלק חייב להיכנס לגובה הדמות, אחרת משהו יבלוט אל מחוץ למסגרת
   שהמצלמה חישבה */
const outside = PARTS.filter((p) => {
  if (!p.at) return false;
  const y = p.at[1];
  return y < -0.1 || y > BODY_HEIGHT + 0.1;
}).map((p) => p.name);
ok('כל החלקים בתוך גובה הדמות', outside.length === 0, outside.join(', '));

ok('מרכז הסיבוב בתוך הגוף',
   BODY_CENTER_Y > 0 && BODY_CENTER_Y < BODY_HEIGHT, String(BODY_CENTER_Y));

/* איבר פנימי שאין לו אזור הוא איבר שאי אפשר ללחוץ עליו —
   כלומר עבודה שהלכה לאיבוד */
const orphanOrgans = organs.filter((p) => !regionOfPart(p.name)).map((p) => p.name);
ok('לכל איבר פנימי יש אזור', orphanOrgans.length === 0, orphanOrgans.join(', '));

console.log('');
console.log(fail ? `${fail} בדיקות נכשלו` : 'כל הבדיקות עברו');
process.exit(fail ? 1 : 0);
