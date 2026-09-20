# דפדף — זמן מסך לא מקבלים, מרוויחים

אפליקציה שחוסמת אפליקציות ממכרות, והמשתמש מרוויח דקות מסך על ידי
פעולות שמשפרות אותו: קריאה, כושר, למידה, כתיבה, נשימות, מים,
צעדים ושינה. המשתמש בוחר את הנישות שלו, וכל יום עובר סבב שנוגע בכולן.

**מקור האמת:** `brief-v2-multi-niche.md`. כל סטייה ממנו — לשאול לפני.
המסמכים הקודמים ב-`archive/`.

## סטאק

Vanilla HTML/CSS/JS, אתר סטטי, בלי פריימוורקים ובלי build step.
שתי ספריות חיצוניות, שתיהן בגרסה נעוצה ונטענות רק כשצריך אותן:
epub.js (ייבוא EPUB) ו-MediaPipe tasks-vision (מודולי המצלמה).
פריסה: Netlify. **דמו חי: https://dafdef-demo.netlify.app**

## הרצה מקומית

ES modules דורשים שרת, והמצלמה דורשת HTTPS או localhost.

```bash
npx serve .
```

## מבנה

```
index.html        מסך בית — סטריק, טבעת, המשימה שלי, הסבב, הערוץ החופשי
onboarding.html   שאלון תשע שאלות + טבלת השערים האישית
task.html         עטיפה אחידה לכל משימת רוטציה
reader.html       הקורא
library.html      הספרייה
dashboard.html    דשבורד
settings.html     הגדרות
styleguide.html   עמוד פיתוח — מערכת העיצוב

css/tokens.css    כל הצבעים, המידות והטיפוגרפיה. שני מצבים בלבד.
css/app.css       כל הרכיבים

js/config.js          קטלוג הנישות, שערי הרווח, מקדמי השאלון, ספי אימות
js/logic/             לוגיקה טהורה — בלי DOM, כדי שתעבור כמו שהיא ל-iOS
  rotation.js         מנוע הסבב היומי
  formula.js          שערי הרווח
  bank.js             בנק הזמן
  streak.js           רצף הימים
  verify.js           אימות קריאה
  learning.js         בניית סט השאלות
  writing.js          אימות רישום היומן
  background.js       צעדים ושינה
  store.js            העטיפה היחידה של localStorage + חוקי החצות
js/camera/camera.js   תשתית המצלמה המשותפת
js/ui/                קוד מסכים
js/ui/modules/        מודול לכל נישה
content/              קטלוג הספרים ומאגר המילים
scripts/              סקריפטי תוכן ובדיקות
```

## בדיקות

```bash
node scripts/test-verify.mjs      # אימות קריאה
node scripts/test-logic.mjs       # בנק ורצף
node scripts/test-rotation.mjs    # מנוע הסבב ושערי הרווח
node scripts/test-background.mjs  # צעדים ושינה
```

## תוכן

```bash
node scripts/build-learning.mjs            # מאגר המילים ללמידה
node scripts/fetch-wikisource.mjs          # מקור הספרים הזמני
node scripts/fetch-benyehuda.mjs --probe   # בדיקת מפתח בן-יהודה
node scripts/fetch-benyehuda.mjs --limit 200
```

מפתח בן-יהודה נקרא מ-`~/.secrets/benyehuda.txt` ולעולם לא נכנס לקוד
הלקוח. הנפקה חינם ומיידית ב-https://benyehuda.org/api_keys/new

## סדר הבנייה (מפרט, סעיף 11)

1. ✅ פלטה, כפתורי חזרה, הבלטת סטריק
2. ✅ store מורחב + rotation.js + בדיקות
3. ✅ Onboarding חדש + formula.js המורחב
4. ✅ בית + נעילה + מסך משימה — סגירת הלולאה
5. ✅ עדכוני הקורא והספרייה
6. ✅ למידה + כתיבה
7. ✅ תשתית המצלמה + נשימות, מים, כושר
8. ✅ צעדים ושינה + דשבורד והגדרות מורחבים
9. ✅ ליטוש ומעבר על סעיף 12

## פרטיות

מודולי המצלמה רצים במלואם על המכשיר. אין העלאה, אין הקלטה ואין
אחסון של פריימים — הפריים נקרא, מנותח ונזרק. השורה הזו מופיעה
בכל מסך מצלמה.

## מחוץ לסקופ

חסימה אמיתית (Screen Time / Swift), HealthKit אמיתי, מנויים,
אנדרואיד, שרת/חשבונות, התראות push.
