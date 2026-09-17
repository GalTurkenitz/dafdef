import { countWords, requiredMs, createPageVerifier, FLOOR_MS, IDLE_MS } from '../js/logic/verify.js';
let fail = 0;
const is = (name, got, want) => { const ok = got === want; if (!ok) fail++; console.log((ok?'ok  ':'FAIL') + ' ' + name + ' → ' + got + (ok?'':' (want ' + want + ')')); };

is('countWords simple', countWords('שלום עולם יפה'), 3);
is('countWords niqqud', countWords('וְהָיָה בַּיּוֹם הַהוּא'), 3);
is('countWords punct', countWords('שלום, עולם! מה — נשמע?'), 4);
is('countWords empty', countWords(''), 0);
is('requiredMs floor', requiredMs(10), FLOOR_MS);
is('requiredMs 170w', requiredMs(170), 60000);
is('requiredMs 340w', requiredMs(340), 120000);

// עמוד של 170 מילים = 60 שניות
let t = 0;
let v = createPageVerifier({ words: 170, now: t });
is('not satisfied at 0', v.isSatisfied(0), false);
is('not satisfied at 59s', v.isSatisfied(59000), false);
is('satisfied at 60s', v.isSatisfied(60000), true);
is('claim once', v.claim(60000), true);
is('claim twice', v.claim(61000), false);

// דפדוף מוקדם לא נספר
v = createPageVerifier({ words: 170, now: 0 });
is('early flip rejected', v.claim(15000), false);

// חוסר פעילות עוצר את הטיימר אחרי 2.5 דקות
v = createPageVerifier({ words: 1000, now: 0 });          // דורש ~353 שניות
is('idle freezes elapsed', v.elapsed(IDLE_MS + 600000), IDLE_MS);
is('still paused', v.isPaused(IDLE_MS + 600000), true);
v.activity(IDLE_MS + 600000);                              // נגיעה מחזירה
is('resumes after touch', v.elapsed(IDLE_MS + 660000), IDLE_MS + 60000);

// מעבר אפליקציה עוצר מיידית
v = createPageVerifier({ words: 1000, now: 0 });
v.hide(10000);
is('hidden stops clock', v.elapsed(300000), 10000);
v.show(300000);
is('resumes on show', v.elapsed(330000), 40000);

// פעילות רציפה לא נחסמת ע"י ה-idle
v = createPageVerifier({ words: 1000, now: 0 });
for (let i = 1; i <= 10; i++) v.activity(i * 60000);       // נגיעה כל דקה
is('continuous activity counts', v.elapsed(600000), 600000);

console.log(fail ? '\n' + fail + ' FAILED' : '\nכל הבדיקות עברו');
process.exit(fail ? 1 : 0);
