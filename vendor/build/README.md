# vendor/build — כלים לזמן בנייה בלבד

הקבצים כאן **אינם נטענים באפליקציה**. הם משמשים את
`scripts/build-organs.mjs`, שמריץ דפדפן כדי לקרוא FBX (אין ל-node
מפרש FBX) וממיר את המודלים ל-GLB.

מקור: three.js r186, `examples/jsm`. הייבוא מהמפרט `three` הוחלף
בנתיב יחסי, כי אין כאן build step ואין import map.
