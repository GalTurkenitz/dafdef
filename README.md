# דפדף — קרא כדי לפתוח

דמו דפדפן של אפליקציה שחוסמת אפליקציות ממכרות ופותחת אותן תמורת קריאת ספרים בעברית.
קוראים עמודים ⇐ צוברים דקות מסך ⇐ הדקות מנוקזות כשמשתמשים באפליקציות החסומות.

**מקור האמת של הפרויקט:** `brief-read-to-unlock.md`. כל סטייה ממנו — לשאול לפני.

## סטאק

Vanilla HTML/CSS/JS, אתר סטטי, בלי פריימוורקים ובלי build step.
ספרייה חיצונית יחידה: epub.js (cdnjs, גרסה נעוצה). פריסה: Netlify.

## הרצה מקומית

ES modules דורשים שרת — פתיחת הקובץ ישירות מהדיסק לא תעבוד.

```bash
npx serve .
```

## מבנה

```
index.html        מסך בית (טלפון מדומה)
onboarding.html   שאלון + תוצאה + בחירת אפליקציות
reader.html       הקורא
library.html      הספרייה
dashboard.html    דשבורד
settings.html     הגדרות
styleguide.html   עמוד פיתוח — מערכת העיצוב. נשאר עד שפאס העיצוב יסתיים.

css/tokens.css    כל הצבעים, המידות והטיפוגרפיה
css/app.css       רכיבי בסיס + הקורא
js/config.js      קבועים (שם המוצר הוא placeholder)
js/logic/verify.js  אימות קריאה — טהור, בלי DOM
js/logic/store.js   העטיפה היחידה של localStorage
js/ui/paginator.js  חלוקה לעמודים + ספירת מילים לעמוד
js/ui/*           קוד מסכים ורכיבים
content/          קטלוג בן-יהודה ויצירות מקומיות
scripts/          סקריפט משיכת התוכן (Node)
```

## סדר הבנייה (מפרט, סעיף 10)

1. ✅ שלד + tokens.css + רכיבי בסיס (כפתור, כרטיס, טבעת)
2. ✅ הקורא + verify.js
3. ✅ סקריפט בן-יהודה + קטלוג + מסך ספרייה
4. ✅ formula.js + bank.js + streak.js + store.js
5. ✅ שאלון + תוצאה + בחירת אפליקציות
6. ✅ בית + נעילה + אפליקציה מדומה עם טיימר
7. ✅ דשבורד + הגדרות
8. ✅ מעבר על כל סעיף 9 (פאס העיצוב נדחה בהחלטת המשתמש)

## בדיקות

```bash
node scripts/test-verify.mjs       # אימות הקריאה — 19 בדיקות
node scripts/test-logic.mjs        # נוסחה, בנק וסטריק — 38 בדיקות
```

## תוכן

```bash
node scripts/fetch-wikisource.mjs  # המקור הזמני (9 ספרים)
node scripts/fetch-benyehuda.mjs --probe   # בדיקת מפתח ומבנה תשובה
node scripts/fetch-benyehuda.mjs --limit 200
```

מפתח בן-יהודה נקרא מ-`~/.secrets/benyehuda.txt` ולעולם לא נכנס לקוד הלקוח.
הנפקה חינם ומיידית ב-https://benyehuda.org/api_keys/new

## מחוץ לסקופ

חסימה אמיתית (Screen Time API / Swift), מנויים, שאלות הבנה, אנדרואיד, שרת, התראות push.
