/**
 * test-background.mjs — בדיקות לנישות הרקע: צעדים ושינה.
 * הרצה: node scripts/test-background.mjs
 */

import { stepUnits, stepsToNextUnit, sleepUnits, duePayout } from '../js/logic/background.js';

let fail = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${got}${ok ? '' : `  (want ${want})`}`);
};
const eq = (name, got, want) => is(name, JSON.stringify(got), JSON.stringify(want));

console.log('— צעדים —');
is('מתחת לקו הבסיס', stepUnits(3000, 4000), 0);
is('בדיוק על הקו', stepUnits(4000, 4000), 0);
is('999 מעל — עוד לא', stepUnits(4999, 4000), 0);
is('1,000 מעל', stepUnits(5000, 4000), 1);
is('3,500 מעל — שלוש יחידות', stepUnits(7500, 4000), 3);
is('קו בסיס גבוה', stepUnits(12000, 10000), 2);
is('אפס צעדים', stepUnits(0, 4000), 0);
is('קו בסיס שלילי לא שובר', stepUnits(2000, -5), 2);

is('כמה עוד ליחידה הבאה', stepsToNextUnit(4300, 4000), 700);
is('בדיוק אחרי יחידה', stepsToNextUnit(5000, 4000), 1000);

console.log('\n— שינה —');
is('מתחת ליעד', sleepUnits(6, 7), 0);
is('בדיוק ביעד', sleepUnits(7, 7), 1);
is('מעל היעד — עדיין אחת', sleepUnits(9, 7), 1);
is('בלי שינה', sleepUnits(0, 7), 0);

console.log('\n— תשלום, בלי כפילויות —');
const config = { steps: { baseline: 4000 }, sleep: { targetHours: 7 } };

eq('יום ריק', duePayout({ steps: 0, sleepHours: 0 }, config), { steps: 0, sleep: 0 });

eq('6,000 צעדים ו-8 שעות',
   duePayout({ steps: 6000, sleepHours: 8 }, config), { steps: 2, sleep: 1 });

eq('אחרי ששולם — אין שוב',
   duePayout({ steps: 6000, sleepHours: 8, paid: { steps: 2, sleep: 1 } }, config),
   { steps: 0, sleep: 0 });

eq('עוד 1,000 צעדים אחרי תשלום',
   duePayout({ steps: 7000, sleepHours: 8, paid: { steps: 2, sleep: 1 } }, config),
   { steps: 1, sleep: 0 });

eq('שולם יותר מהמגיע — לא שלילי',
   duePayout({ steps: 4500, sleepHours: 5, paid: { steps: 3, sleep: 1 } }, config),
   { steps: 0, sleep: 0 });

eq('בלי config — ברירות המחדל תופסות',
   duePayout({ steps: 5000, sleepHours: 7 }, {}), { steps: 1, sleep: 1 });

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
