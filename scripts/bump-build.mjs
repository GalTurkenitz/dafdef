/**
 * bump-build.mjs — מטביע חותמת גרסה חדשה.
 *
 * מריצים לפני כל דחיפה. כותב version.json ומעדכן את BUILD
 * ב-js/boot.js, כך שכל דפדפן שמחזיק גרסה ישנה יזהה את הפער
 * ויטען מחדש מכתובת שהמטמון שלו לא מכיר.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const d = new Date();
const pad = (n) => String(n).padStart(2, '0');
const build = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
            + `-${pad(d.getHours())}${pad(d.getMinutes())}`;

const bootPath = path.join(root, 'js', 'boot.js');
let boot = fs.readFileSync(bootPath, 'utf8');
boot = boot.replace(/var BUILD = '[^']*';/, `var BUILD = '${build}';`);
fs.writeFileSync(bootPath, boot);

fs.writeFileSync(path.join(root, 'version.json'),
  JSON.stringify({ build }, null, 2) + '\n');

console.log('build = ' + build);
