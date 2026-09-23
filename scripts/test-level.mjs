/**
 * test-level.mjs — אבני דרך ורמות (V4, סעיפים 1.4-1.5).
 *
 * כל הכללים כאן הם ספים מספריים, ולכן אפשר לאמת אותם במלואם בלי
 * דפדפן. זה מה שמונע מצב שבו אבן דרך מוכרזת פעמיים, או שרמה
 * עולה בסף הלא נכון, ומתגלה רק אצל המשתמש.
 */

import { milestoneLadder, crossedMilestones, nextMilestone,
         milestonesAround, xpForLevel, levelForXp,
         levelProgress } from '../js/logic/level.js';
import { MILESTONE_POINTS, XP } from '../js/config.js';

let fail = 0;
const is = (name, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${got}${ok ? '' : `  (want ${want})`}`);
};
const eq = (name, got, want) => is(name, JSON.stringify(got), JSON.stringify(want));

/* ------------------------------------------------------------------ *
 * סולמות אבני הדרך
 * ------------------------------------------------------------------ */

console.log('— סולמות אבני דרך —');

eq('שכיבות: חמש ראשונות בצעד 20',
   milestoneLadder('fitness.pushups', 100), [20, 40, 60, 80, 100]);

eq('ואז צעד של 100',
   milestoneLadder('fitness.pushups', 400), [20, 40, 60, 80, 100, 200, 300, 400]);

eq('קריאה: צעד 2 ואז 10',
   milestoneLadder('reading', 40), [2, 4, 6, 8, 10, 20, 30, 40]);

eq('כתיבה: צעד 100 ואז 500',
   milestoneLadder('writing', 2000), [100, 200, 300, 400, 500, 1000, 1500, 2000]);

eq('צעדים: צעד 2,000 ואז 10,000',
   milestoneLadder('steps', 30000), [2000, 4000, 6000, 8000, 10000, 20000, 30000]);

eq('סקוואטים בסולם נפרד וזהה',
   milestoneLadder('fitness.squats', 100), milestoneLadder('fitness.pushups', 100));

is('מונה לא מוכר מחזיר סולם ריק', milestoneLadder('nope', 100).length, 0);

/* ------------------------------------------------------------------ *
 * חציית ספים
 * ------------------------------------------------------------------ */

console.log('\n— חציית ספים —');

eq('0 → 25 שכיבות חוצה את 20', crossedMilestones('fitness.pushups', 0, 25), [20]);
eq('15 → 45 חוצה שניים', crossedMilestones('fitness.pushups', 15, 45), [20, 40]);
eq('0 → 250 חוצה שישה', crossedMilestones('fitness.pushups', 0, 250),
   [20, 40, 60, 80, 100, 200]);
eq('בלי שינוי — אין חצייה', crossedMilestones('reading', 8, 8), []);
eq('ירידה — אין חצייה', crossedMilestones('reading', 10, 4), []);

is('הסף הבא אחרי 25 שכיבות', nextMilestone('fitness.pushups', 25), 40);
is('הסף הבא מאפס', nextMilestone('reading', 0), 2);

{
  const marks = milestonesAround('reading', 5);
  is('שורת הסימונים מחזירה חמישה', marks.length, 5);
  is('  ומסמנת את מה שהושג', marks.filter((m) => m.done).length > 0, true);
}

/* ------------------------------------------------------------------ *
 * ספי הרמות
 * ------------------------------------------------------------------ */

console.log('\n— ספי רמות —');

is('רמה 1 מתחילה באפס', xpForLevel(1), 0);
is('רמה 2 ב-100', xpForLevel(2), 100);
is('רמה 3 ב-200', xpForLevel(3), 200);
is('רמה 4 ב-300', xpForLevel(4), 300);
is('רמה 5 ב-400', xpForLevel(5), 400);
is('רמה 6 ב-500', xpForLevel(6), 500);
is('רמה 7 ב-1,000', xpForLevel(7), 1000);
is('רמה 8 ב-1,500', xpForLevel(8), 1500);
is('רמה 9 ב-2,000', xpForLevel(9), 2000);

is('0 נקודות = רמה 1', levelForXp(0), 1);
is('99 עדיין רמה 1', levelForXp(99), 1);
is('100 = רמה 2', levelForXp(100), 2);
is('499 = רמה 5', levelForXp(499), 5);
is('500 = רמה 6', levelForXp(500), 6);
is('999 עדיין רמה 6', levelForXp(999), 6);
is('1,000 = רמה 7', levelForXp(1000), 7);

{
  const p = levelProgress(250);
  is('ב-250 נקודות — רמה 3', p.level, 3);
  is('  50 לתוך הרמה', p.into, 50);
  is('  מתוך 100', p.need, 100);
  is('  חצי הדרך', p.ratio, 0.5);
}

/* ------------------------------------------------------------------ *
 * ערכי הנקודות
 * ------------------------------------------------------------------ */

console.log('\n— ערכי נקודות —');

is('משימה', XP.task, 10);
is('שלב במסלול', XP.level, 12);
is('סבב מלא', XP.round, 20);
is('אבן דרך', XP.milestone, 100);
is('אבן דרך = הקבוע', MILESTONE_POINTS, 100);
is('ניצחון בליגה', XP.leagueWin, 250);

/* ------------------------------------------------------------------ *
 * תרחיש מלא
 * ------------------------------------------------------------------ */

console.log('\n— תרחיש: ממשימה ראשונה לרמה 2 —');
{
  // עשר משימות רגילות, בלי אבני דרך
  let xp = XP.task * 10;
  is('עשר משימות = 100 נקודות', xp, 100);
  is('  וזו כבר רמה 2', levelForXp(xp), 2);

  // אבן דרך אחת שווה עשר משימות
  xp += XP.milestone;
  is('אבן דרך מכפילה', xp, 200);
  is('  רמה 3', levelForXp(xp), 3);
}

console.log(fail ? `\n${fail} בדיקות נכשלו` : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
