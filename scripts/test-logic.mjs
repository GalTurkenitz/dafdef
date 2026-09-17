/**
 * test-logic.mjs — בדיקות למודולים הטהורים: formula, bank, streak.
 * (verify.js נבדק בנפרד ב-test-verify.mjs)
 *
 * הרצה: node scripts/test-logic.mjs
 */

import { computePageValue, graceFactor, roundToHalf, explainPageValue } from '../js/logic/formula.js';
import { createBank, earn, drain, touch, isEmpty, remainingMs, resetDaily } from '../js/logic/bank.js';
import { createStreak, registerRead, closeDay, daysBetween } from '../js/logic/streak.js';

let fail = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${got}${ok ? '' : `  (want ${want})`}`);
};
const near = (name, got, want, eps = 1e-6) => {
  const ok = Math.abs(got - want) < eps;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${got}${ok ? '' : `  (want ${want})`}`);
};

console.log('— formula —');
is('עיגול לחצי', roundToHalf(12.3), 12.5);
is('עיגול לחצי 2', roundToHalf(12.1), 12);

// המטרות, במצב בינוני, לקורא קבוע
is('לצמצם · בינוני', computePageValue({ goal: 'reduce', strictness: 'medium', readingHabit: 'regular' }), 10);
is('לאזן · בינוני',  computePageValue({ goal: 'balance', strictness: 'medium', readingHabit: 'regular' }), 15);
is('לקרוא · בינוני', computePageValue({ goal: 'read', strictness: 'medium', readingHabit: 'regular' }), 20);

// מקדמי קשיחות
is('לאזן · רך',     computePageValue({ goal: 'balance', strictness: 'soft', readingHabit: 'regular' }), 19);
is('לאזן · אכזרי',  computePageValue({ goal: 'balance', strictness: 'brutal', readingHabit: 'regular' }), 7.5);
is('לצמצם · אכזרי', computePageValue({ goal: 'reduce', strictness: 'brutal', readingHabit: 'regular' }), 5);
is('לקרוא · רך',    computePageValue({ goal: 'read', strictness: 'soft', readingHabit: 'regular' }), 25);

// הטווח כולו נשאר בתוך 5-30 של מחוון ההגדרות (המפרט, סעיף 7.7)
const all = [];
for (const goal of ['reduce', 'balance', 'read'])
  for (const strictness of ['soft', 'medium', 'brutal'])
    for (const readingHabit of ['none', 'some', 'regular'])
      for (const daysSinceStart of [0, 7, 14, 30])
        all.push(computePageValue({ goal, strictness, readingHabit, daysSinceStart }));
is('כל התוצאות ≥ 5', Math.min(...all) >= 5, true);
is('כל התוצאות ≤ 30', Math.max(...all) <= 30, true);

// חסד למי שלא קורא
near('חסד ביום 0',  graceFactor('none', 0), 1.25);
near('חסד ביום 7',  graceFactor('none', 7), 1.125);
near('חסד ביום 14', graceFactor('none', 14), 1);
near('חסד ביום 30', graceFactor('none', 30), 1);
near('אין חסד לקורא קבוע', graceFactor('regular', 0), 1);
is('לאזן · בינוני · לא קורא · יום 0', computePageValue({ goal: 'balance', strictness: 'medium', readingHabit: 'none', daysSinceStart: 0 }), 19);
is('אותו דבר ביום 14', computePageValue({ goal: 'balance', strictness: 'medium', readingHabit: 'none', daysSinceStart: 14 }), 15);

is('הסבר מזכיר אכזרי', explainPageValue({ goal: 'reduce', strictness: 'brutal', readingHabit: 'regular' }).includes('מחמיר'), true);

console.log('\n— bank —');
let b = createBank(0);
is('בנק מתחיל ריק', b.minutes, 0);
is('ריק', isEmpty(b), true);

b = earn(b, 3, 15, 0);
is('3 עמודים × 15', b.minutes, 45);
is('לא ריק', isEmpty(b), false);
is('זמן שנותר ms', remainingMs(b), 45 * 60000);

// ניקוז לפי חותמות זמן
let r = drain(b, 60_000);          // דקה
near('אחרי דקה', r.bank.minutes, 44);
near('נוצלה דקה', r.spent, 1);
is('לא התרוקן', r.emptied, false);

r = drain(r.bank, 60_000 + 44 * 60_000);
near('אחרי עוד 44 דקות', r.bank.minutes, 0);
is('התרוקן', r.emptied, true);

// דילוג ארוך (המכשיר היה ברקע) לא יוצר יתרה שלילית
r = drain(earn(createBank(0), 1, 10, 0), 99 * 60_000);
is('אין יתרה שלילית', r.bank.minutes, 0);
near('לא ניקזנו יותר ממה שהיה', r.spent, 10);

// touch מקדם את השעון בלי לנקז
const t = touch(earn(createBank(0), 2, 10, 0), 500_000);
is('touch לא מנקז', t.minutes, 20);
is('touch מעדכן שעון', t.lastUpdate, 500_000);

// איפוס חצות
is('איפוס בחצות', resetDaily({ minutes: 30, lastUpdate: 0 }, 'midnight', 1).minutes, 0);
is('שמירה בחצות', resetDaily({ minutes: 30, lastUpdate: 0 }, 'keep', 1).minutes, 30);

console.log('\n— streak —');
is('ימים בין תאריכים', daysBetween('2026-09-17', '2026-09-18'), 1);
is('מעבר חודש', daysBetween('2026-09-30', '2026-10-01'), 1);
is('מעבר שנה', daysBetween('2026-12-31', '2027-01-01'), 1);

let s = createStreak();
s = registerRead(s, '2026-09-17');
is('יום ראשון', s.current, 1);
is('שיא', s.best, 1);

s = registerRead(s, '2026-09-17');
is('קריאה שנייה באותו יום לא סופרת', s.current, 1);

s = registerRead(s, '2026-09-18');
is('יום שני ברצף', s.current, 2);

s = registerRead(s, '2026-09-20');   // דילגנו על ה-19
is('פספוס מאפס ל-1', s.current, 1);
is('השיא נשמר', s.best, 2);

// סגירת יום
let c = closeDay({ current: 3, best: 5, lastReadDate: '2026-09-17' }, '2026-09-18');
is('קראנו אתמול — הרצף חי', c.broke, false);
c = closeDay({ current: 3, best: 5, lastReadDate: '2026-09-17' }, '2026-09-19');
is('פספסנו יום — נשבר', c.broke, true);
is('current התאפס', c.streak.current, 0);
is('best לא נגע', c.streak.best, 5);

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
