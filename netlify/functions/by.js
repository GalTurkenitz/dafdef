/**
 * by.js — מביא טקסט ספר מפרויקט בן-יהודה.
 *
 * שתי סיבות שזה לא יכול לקרות בדפדפן:
 *
 *   1. **אין CORS.** נמדד: fetch ל-benyehuda.org מהאתר שלנו
 *      נכשל ב-"Failed to fetch".
 *   2. **הכתובת מחזירה 302** אל blob חתום של ActiveStorage.
 *      פרוקסי פשוט ב-netlify.toml מעביר את ההפניה כמו שהיא,
 *      והדפדפן נשלח חזרה למקור שאין לו CORS.
 *
 * הפונקציה עוקבת אחרי ההפניה בצד השרת ומחזירה את התוכן עם
 * הכותרות הנכונות. אין כאן מפתח API — download_url ציבורי.
 */

const ALLOWED = /^[0-9]+\.html$/;

export default async (req) => {
  const name = new URL(req.url).pathname.split('/').pop();

  /* רק מזהה מספרי — לא לתת לפתוח את הפונקציה כפרוקסי כללי */
  if (!ALLOWED.test(name)) {
    return new Response('bad id', { status: 400 });
  }

  try {
    const upstream = await fetch(`https://benyehuda.org/download/${name}`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'dafdef/1.0 (+https://dafdef-demo.netlify.app)' },
    });

    if (!upstream.ok) {
      return new Response('upstream ' + upstream.status, { status: 502 });
    }

    return new Response(await upstream.text(), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        /* התוכן אינו משתנה — שנה של מטמון */
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (e) {
    return new Response('fetch failed', { status: 502 });
  }
};

export const config = { path: '/by/:name' };
