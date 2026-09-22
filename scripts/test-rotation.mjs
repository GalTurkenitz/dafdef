/**
 * test-rotation.mjs — בדיקות למנוע הסבב היומי ולשערי הרווח.
 * הרצה: node scripts/test-rotation.mjs
 */

import { createRound, roundNiches, nextTask, skip, markDone, canPerform, normalize,
         isRoundComplete, progress, roundStatus, freeNiches,
         markBonusGiven } from '../js/logic/rotation.js';
import { unitValue, taskValue, earnFor, gateTable, explainGates,
         profileFactor, roundMinutes } from '../js/logic/formula.js';
import { ROUND_NICHE_IDS } from '../js/config.js';

let fail = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${got}${ok ? '' : `  (want ${want})`}`);
};
const eq = (name, got, want) => is(name, JSON.stringify(got), JSON.stringify(want));
const near = (name, got, want, eps = 0.005) => {
  const ok = Math.abs(got - want) < eps;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${got.toFixed(3)}${ok ? '' : `  (want ${want})`}`);
};

/* ================= הרכב הסבב ================= */
console.log('— הרכב הסבב —');

const SEL = ['reading', 'fitness', 'water', 'steps', 'sleep'];
eq('צעדים ושינה לא בסבב', roundNiches(SEL), ['reading', 'fitness', 'water']);
eq('סדר יציב לפי config', roundNiches(['water', 'reading']), ['reading', 'water']);
eq('בחירה ריקה', roundNiches([]), []);
eq('הערוץ החופשי מתוך הנבחרות', freeNiches(SEL), ['reading', 'fitness']);
is('כל נישות הסבב', ROUND_NICHE_IDS.length, 6);

/* ================= המשימה הבאה ודילוגים ================= */
console.log('\n— משימה הבאה ודילוגים —');

let r = createRound('2026-09-19');
is('המשימה הראשונה', nextTask(r, SEL), 'reading');

r = skip(r, 'reading');
is('אחרי דילוג — הבאה בתור', nextTask(r, SEL), 'fitness');

r = skip(r, 'fitness');
is('אחרי שני דילוגים', nextTask(r, SEL), 'water');

r = skip(r, 'water');
is('כולם דולגו — חוזרים לראשון שדולג', nextTask(r, SEL), 'reading');

// דילוג חוזר מעביר לסוף התור
r = skip(r, 'reading');
is('דילוג חוזר דוחה לסוף', nextTask(r, SEL), 'fitness');

/* ================= ביצוע ================= */
console.log('\n— ביצוע —');

r = createRound('2026-09-19');
let res = markDone(r, SEL, 'reading');
r = res.round;
is('קריאה בוצעה', r.done.reading, true);
is('הסבב לא הושלם', res.justCompleted, false);
is('המשימה הבאה מדלגת על מה שבוצע', nextTask(r, SEL), 'fitness');
eq('התקדמות', progress(r, SEL), { done: 1, total: 3 });

res = markDone(r, SEL, 'fitness'); r = res.round;
is('עדיין לא הושלם', res.justCompleted, false);

res = markDone(r, SEL, 'water'); r = res.round;
is('הסבב הושלם עכשיו', res.justCompleted, true);
is('מגיע בונוס', res.bonusDue, true);

// V3 סעיף ג1 — הסבב מחזורי: מיד מתחיל סבב חדש באותו יום
is('סבב חדש התחיל מיד', nextTask(r, SEL), 'reading');
eq('המונים אופסו', progress(r, SEL), { done: 0, total: 3 });
is('נספר סבב אחד היום', r.roundsToday, 1);
is('היום מסומן כמכיל סבב מלא', r.roundComplete, true);

// בונוס ההשלמה — פעם ביום בלבד (V3 סעיף ג2)
r = markBonusGiven(r);
r = markDone(r, SEL, 'reading').round;
r = markDone(r, SEL, 'fitness').round;
res = markDone(r, SEL, 'water'); r = res.round;
is('הסבב השני הושלם', res.justCompleted, true);
is('אבל בלי בונוס', res.bonusDue, false);
is('שני סבבים היום', r.roundsToday, 2);

// דילוג על משימה שבוצעה לא עושה כלום
r = markDone(r, SEL, 'water').round;
const before = JSON.stringify(r);
is('דילוג על מה שבוצע — אין שינוי', JSON.stringify(skip(r, 'water')), before);

/* ================= זמינות ================= */
console.log('\n— זמינות —');

r = createRound('2026-09-19');
is('ערוץ חופשי פתוח', canPerform(r, SEL, 'reading').allowed, true);
is('ערוץ משימות פתוח בהתחלה', canPerform(r, SEL, 'water').allowed, true);
is('נישה שלא נבחרה', canPerform(r, SEL, 'writing').allowed, false);
is('  והסיבה', canPerform(r, SEL, 'writing').reason, 'not-selected');
is('צעדים לא "מבצעים"', canPerform(r, SEL, 'steps').allowed, false);
is('  והסיבה', canPerform(r, SEL, 'steps').reason, 'background');

r = markDone(r, SEL, 'water').round;
is('מים חסומים אחרי ביצוע בסבב', canPerform(r, SEL, 'water').allowed, false);
is('  והסיבה', canPerform(r, SEL, 'water').reason, 'done-this-round');

r = markDone(r, SEL, 'reading').round;
is('קריאה פתוחה גם אחרי ביצוע', canPerform(r, SEL, 'reading').allowed, true);

r = markDone(r, SEL, 'fitness').round;
is('סבב חדש — מים חזרו לתור', canPerform(r, SEL, 'water').allowed, true);

/* ================= מחוון הסבב ================= */
console.log('\n— מחוון —');

r = createRound('2026-09-19');
r = markDone(r, SEL, 'reading').round;
const status = roundStatus(r, SEL);
is('שלוש נישות במחוון', status.length, 3);
is('קריאה מסומנת', status[0].done, true);
is('כושר הוא הנוכחי', status.find((x) => x.id === 'fitness').current, true);

/* ================= שערי הרווח ================= */
console.log('\n— שערים —');

const BALANCED = { goal: 'balance', strictness: 'medium' };
const BRUTAL = { goal: 'reduce', strictness: 'brutal' };
const SOFT = { goal: 'habits', strictness: 'soft' };

near('מקדם מאוזן', profileFactor(BALANCED), 1);
near('מקדם אכזרי', profileFactor(BRUTAL), 0.335);
near('מקדם נדיב', profileFactor(SOFT), 1.6625);
near('מקדם גמילה + אכזרי', profileFactor({ goal: 'wean', strictness: 'brutal' }), 0.25);
near('מקדם שגרה + קשוח', profileFactor({ goal: 'routine', strictness: 'tough' }), 0.9775);
near('מקדם קשוח מאוד', profileFactor({ goal: 'balance', strictness: 'tougher' }), 0.7);

is('עמוד קריאה, מאוזן', unitValue('reading', BALANCED), 5);
is('סט למידה, מאוזן', unitValue('learning', BALANCED), 5);
is('כוס מים, מאוזן', unitValue('water', BALANCED), 3);
near('עמוד קריאה, אכזרי', unitValue('reading', BRUTAL), 1.675);
near('עמוד קריאה, נדיב', unitValue('reading', SOFT), 8.3125);

// כושר: חזרה בודדת שברית, משימה שלמה שווה משהו אמיתי
near('חזרת כושר, אכזרי', unitValue('fitness', BRUTAL), 0.335);
near('משימת כושר (10), אכזרי', taskValue('fitness', BRUTAL), 3.35);
is('  ומעוגל לתצוגה', roundMinutes(taskValue('fitness', BRUTAL)), 3);
is('חזרה בודדת לא מתאפסת', unitValue('fitness', BRUTAL) > 0, true);

near('7 חזרות, מאוזן', earnFor('fitness', 7, BALANCED), 7);
is('יחידות שליליות', earnFor('reading', -3, BALANCED), 0);
is('נישה לא מוכרת', unitValue('nope', BALANCED), 0);

/* ================= טבלת השערים ================= */
console.log('\n— טבלת השערים —');

const table = gateTable(['reading', 'fitness', 'water'], BALANCED);
is('שורה לכל נישה', table.length, 3);
is('קריאה', table[0].minutes, 5);
is('  יחידה', table[0].label, 'עמוד');
is('כושר מוצג כמשימה', table[1].label, '10 שכיבות');
is('  ושווה 10', table[1].minutes, 10);
is('נישה שלא נבחרה לא בטבלה', gateTable(['reading'], BALANCED).length, 1);

is('הסבר מזכיר אכזרי', explainGates(BRUTAL).includes('מחמירים'), true);
is('הסבר לגמילה', explainGates({ goal: 'wean', strictness: 'medium' }).includes('ביוקר'), true);
is('הסבר לשגרה', explainGates({ goal: 'routine', strictness: 'medium' }).includes('שגרה'), true);
is('הסבר מזכיר הרגלים', explainGates(SOFT).includes('כדאי להתחיל'), true);

/* ------------------------------------------------------------------ *
 * ריפוי סבב תקוע (רגרסיה)
 *
 * המצב נוצר כשרשימת הנישות משתנה אחרי שהן כבר סומנו — למשל
 * כשמסירים בהגדרות את הנישה היחידה שטרם בוצעה. אז כל מה שנשאר
 * מסומן, nextTask מחזיר null, והמסך נשאר בלי משימה הבאה ובלי
 * כפתורים עד חצות. זה מה שקרה אצל המשתמש בפועל.
 * ------------------------------------------------------------------ */
console.log('\n— ריפוי סבב תקוע —');
{
  const sel = ['reading', 'fitness', 'learning', 'writing', 'breathing', 'water'];
  const stuck = {
    date: '2026-01-01',
    done: { reading: true, fitness: true, learning: true,
            writing: true, breathing: true, water: true },
    skipped: [], roundComplete: true, bonusGiven: true, roundsToday: 1,
  };

  is('אין משימה הבאה לפני הריפוי', nextTask(stuck, sel), null);

  const healed = normalize(stuck, sel);
  is('אחרי הריפוי', nextTask(healed, sel), 'reading');
  is('  ושום נישה לא מסומנת', Object.keys(healed.done).length, 0);
  is('  היום עדיין נחשב מלא לרצף', healed.roundComplete, true);
  is('  והבונוס לא יינתן שוב', healed.bonusGiven, true);

  // הוסרה בהגדרות הנישה היחידה שטרם בוצעה
  const shrunk = ['reading', 'fitness', 'learning', 'writing', 'breathing'];
  const partial = { ...stuck, done: { reading: true, fitness: true,
                                      learning: true, writing: true, breathing: true } };
  is('הסרת נישה יוצרת את אותו מצב', nextTask(partial, shrunk), null);
  is('  וגם הוא נרפא', nextTask(normalize(partial, shrunk), shrunk), 'reading');

  // סבב באמצע לא נוגעים בו
  const mid = normalize({ ...stuck, done: { reading: true, fitness: true } }, sel);
  is('סבב באמצע לא נגע', nextTask(mid, sel), 'learning');
  is('  והסימון נשמר', mid.done.reading, true);
}

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
