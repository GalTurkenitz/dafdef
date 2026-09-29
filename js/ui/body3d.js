/**
 * body3d.js — גוף האדם התלת-מימדי של מסך הסטטיסטיקה.
 *
 * ─────────────────────────────────────────────────────────────────
 *  למה הגיאומטריה נבנית בקוד ולא נטענת ממודל
 *
 *  מודל אנטומי מוכן שוקל בין 5 ל-80 מגה-בייט, מגיע עם רישיון
 *  שצריך לבדוק לכל שימוש מסחרי, ומגיע כרשת אחת — כדי ללחוץ על
 *  "ריאות" בלבד היה צריך לפרק אותו ידנית.
 *
 *  כאן כל איבר הוא פרימיטיב עם שם. המחיר: הגוף מסוגנן ולא
 *  אנטומי לחלוטין. התמורה: 12KB במקום 40MB, אפס שאלות רישוי,
 *  וכל אזור כבר אובייקט נפרד שאפשר לצבוע, להאיר וללחוץ עליו.
 * ─────────────────────────────────────────────────────────────────
 *  איך נראה "לראות את הפנים"
 *
 *  העור שקוף ואינו כותב לבאפר העומק, והאיברים אטומים. three
 *  מצייר אטום לפני שקוף, ולכן האיברים יוצאים ראשונים והעור
 *  נמרח מעליהם — בדיוק התמונה של איברים בתוך גוף, בלי שום
 *  שיידר מיוחד ובלי בעיות מיון.
 * ─────────────────────────────────────────────────────────────────
 *  כיווני הגוף
 *
 *  הדמות פונה אל +z, כלומר אל המצלמה. לאדם שפונה אל +z היד
 *  הימנית נמצאת ב--x והשמאלית ב-+x. זה חשוב ולא קישוט: הלב
 *  יושב שמאלה, וגם אזור זיהוי המילים שבמוח הוא שמאלי.
 * ─────────────────────────────────────────────────────────────────
 */

import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { REGIONS, regionOfPart } from './anatomy.js';
import { PARTS, BODY_HEIGHT, BODY_WIDTH, BODY_CENTER_Y } from './body-parts.js';

const FOV = 32;

/**
 * כמה רחוק צריכה המצלמה לעמוד כדי שכל הדמות תיכנס.
 *
 * הניסיון הראשון קיבע את המרחק על 5.6 ובמסך טלפון הראש והרגליים
 * יצאו מהמסגרת. המרחק חייב להיגזר מהמסך: במסך צר הרוחב הוא
 * שקובע, במסך רחב הגובה.
 */
function fitDistance(aspect) {
  const half = THREE.MathUtils.degToRad(FOV) / 2;
  const byHeight = (BODY_HEIGHT * 0.58) / Math.tan(half);
  const byWidth = (BODY_WIDTH * 0.62) / Math.tan(half) / Math.max(aspect, 0.001);
  return Math.max(byHeight, byWidth);
}

/* ------------------------------------------------------------------ */

function geometryFor(p) {
  switch (p.type) {
    case 'capsule':  return new THREE.CapsuleGeometry(p.r, p.l, 6, 18);
    /* קונוס קטום: איבר מתחדד. גליל בעל רדיוס אחד נראה כמו צינור. */
    case 'cone':     return new THREE.CylinderGeometry(p.r, p.r2, p.l, 20, 1);
    case 'cylinder': return new THREE.CylinderGeometry(p.r, p.r, p.l, 20);
    case 'box':      return new THREE.BoxGeometry(p.d[0], p.d[1], p.d[2], 1, 1, 1);
    case 'lathe': {
      const pts = p.profile.map(([r, y]) => new THREE.Vector2(r, y));
      const g = new THREE.LatheGeometry(pts, 40);
      /* הפרופיל נושא גובה מוחלט, ולכן החלק יושב ב-0 ונדחס בלבד */
      g.scale(1, 1, p.zs ?? 1);
      g.computeVertexNormals();
      return g;
    }
    default:         return new THREE.SphereGeometry(p.r, 28, 20);
  }
}

/** קורא צבע מטוקן CSS, כדי שהתלת-מימד ישתמש באותה פלטה כמו המסך */
function cssColor(varName, fallback) {
  const probe = document.createElement('i');
  probe.style.cssText = `position:absolute;visibility:hidden;color:var(${varName},${fallback})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return new THREE.Color(value);
}

/* ------------------------------------------------------------------ *
 * הרכבה
 * ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount     לאן להיכנס
 * @param {Set<string>} opts.active    אילו נישות בסבב — השאר כבויות
 * @param {(regionId: string|null) => void} opts.onPick
 * @returns {{ select: Function, resize: Function, destroy: Function, reset: Function }}
 */
export function createBody({ mount, active = new Set(), onPick = () => {} }) {
  const colors = {};
  for (const [id, r] of Object.entries(REGIONS)) {
    colors[id] = cssColor(`--niche-${r.niche}`, '#B08968');
  }
  const idle = cssColor('--text-dim', '#6B635D');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'body3d__canvas';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, fitDistance(1));

  /* אור: מפתח חם מימין, מילוי קר משמאל, ואור סביבה חלש כדי
     שהצללים לא ייבלעו לגמרי בשחור. */
  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x140f0c, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2.5, 4, 3.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.45);
  fill.position.set(-3, 1, -2.5);
  scene.add(fill);

  /* אור מאחור. בלעדיו הגוף השקוף כמעט נעלם על רקע שחור: אין לו
     שום קצה שתופס אור, והצללית נבלעת. הוא מדליק את הדפנות ונותן
     לזכוכית מתאר בלי להוסיף שיידר. */
  const rim = new THREE.DirectionalLight(0xd8ecff, 1.6);
  rim.position.set(-1.2, 2.2, -4.5);
  scene.add(rim);

  const body = new THREE.Group();
  body.position.y = -BODY_CENTER_Y;
  scene.add(body);

  /** כל המשנים לפי שם */
  const meshes = new Map();
  /** משנים שאפשר ללחוץ עליהם */
  const pickable = [];
  /** שמות החלקים שהם איבר פנימי */
  const organParts = new Set(PARTS.filter((p) => p.organ).map((p) => p.name));
  /** מה לעשות לכל משנה במצב מנוחה ובמצב נבחר */
  const skins = [];

  /* זכוכית קרה אחת לכל העור.

     הניסיון הקודם צבע כל אזור בצבע הנישה שלו כבר במנוחה. התוצאה:
     הזרועות והרגליים יצאו ורודות — שתיהן שייכות לכושר — והגזע
     נשאר שחור, כי אין לו אזור. הגוף נראה כמו צעצוע צבוע.

     עכשיו הגוף כולו זכוכית ניטרלית, האיברים הפנימיים זוהרים
     בצבע הנישה שלהם, והצבע על העור מופיע רק כשבוחרים אזור. */
  const GLASS = new THREE.Color(0x9ec7e8);

  for (const p of PARTS) {
    const regionId = regionOfPart(p.name);
    const tint = regionId ? colors[regionId] : null;
    const on = regionId ? active.has(REGIONS[regionId].niche) : false;

    const material = p.organ
      ? new THREE.MeshStandardMaterial({
        color: (tint || idle).clone().multiplyScalar(0.5),
        emissive: (tint || idle).clone(),
        emissiveIntensity: on ? 0.85 : 0.22,
        roughness: 0.32,
        metalness: 0.05,
      })
      : new THREE.MeshStandardMaterial({
        color: GLASS.clone(),
        emissive: GLASS.clone().multiplyScalar(0.45),
        emissiveIntensity: 0.34,
        transparent: true,
        /* העור אינו כותב עומק — כך האיברים האטומים מצוירים לפניו
           והוא נמרח מעליהם במקום להסתיר אותם. */
        depthWrite: false,
        opacity: 0.22,
        roughness: 0.35,
        metalness: 0,
        side: THREE.DoubleSide,
      });

    const mesh = new THREE.Mesh(geometryFor(p), material);
    mesh.name = p.name;
    if (p.at) mesh.position.set(p.at[0], p.at[1], p.at[2]);
    if (p.s) mesh.scale.set(p.s[0], p.s[1], p.s[2]);
    if (p.rz) mesh.rotation.z = p.rz;
    /* האיברים נצבעים לפני העור, כדי שמיון השקיפות יהיה יציב */
    mesh.renderOrder = p.organ ? 0 : 1;

    body.add(mesh);
    meshes.set(p.name, mesh);
    skins.push({ mesh, regionId, tint, on, organ: !!p.organ });
    if (regionId) pickable.push(mesh);
  }

  /* ---------- שליטה ---------- */

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  /* גבולות היחס למרחק המסגור, ולא מספרים קבועים: במסך צר
     המרחק הבסיסי גדול יותר, ותקרה קבועה הייתה חוסמת זום החוצה. */
  controls.minDistance = fitDistance(1) * 0.42;
  controls.maxDistance = fitDistance(0.45) * 1.35;
  /* לא נותנים להגיע בדיוק לקוטב: שם הסיבוב מתהפך ומרגיש שבור */
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI - 0.35;
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 0.8;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;

  /* הסיבוב האוטומטי נעצר ברגע שנוגעים, ולא חוזר. הוא נועד להזמין
     סיבוב, לא להילחם במשתמש שכבר מצא זווית. */
  const stopAuto = () => { controls.autoRotate = false; };
  renderer.domElement.addEventListener('pointerdown', stopAuto);
  renderer.domElement.addEventListener('wheel', stopAuto, { passive: true });

  /* ---------- בחירה בלחיצה ---------- */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;
  let selected = null;

  function setSelected(id) {
    selected = id;

    for (const part of skins) {
      const isPick = id && part.regionId === id;
      const m = part.mesh.material;

      if (part.organ) {
        /* איבר: תמיד בצבע הנישה שלו. נבחר — בוער; לא נבחר בזמן
           שמשהו אחר נבחר — כמעט כבוי. */
        m.emissiveIntensity = isPick ? 1.6 : (id ? 0.1 : (part.on ? 0.85 : 0.22));
      } else if (isPick) {
        /* עור נבחר: עובר לצבע הנישה ומתעבה, כדי שהשריר ייראה
           דרך הזכוכית ולא ייבלע בה. */
        m.color.copy(part.tint);
        m.emissive.copy(part.tint);
        m.emissiveIntensity = 0.75;
        m.opacity = 0.5;
      } else {
        m.color.copy(GLASS);
        m.emissive.copy(GLASS).multiplyScalar(0.45);
        m.emissiveIntensity = 0.34;
        /* כשמשהו נבחר שאר הגוף נסוג, אחרת אי אפשר לראות מה נבחר */
        m.opacity = id ? 0.09 : 0.22;
      }
    }
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickable, false);
    if (!hits.length) return null;

    /* איבר פנימי גובר על שריר שנמצא לפניו.
       נמדד על רשת של 13×17 נקודות: שרירי החזה יושבים מלפנים
       ובלעו כל פגיעה בריאות ובלב — מהחזית אי אפשר היה ללחוץ
       עליהם בכלל. השרירים גדולים וניתן להגיע אליהם דרך הזרועות
       והכתפיים; לאיברים אין דרך אחרת. */
    const organ = hits.find((h) => organParts.has(h.object.name));
    return regionOfPart((organ || hits[0]).object.name);
  }

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: Date.now() };
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const slow = Date.now() - downAt.t > 700;
    downAt = null;
    /* גרירה היא סיבוב, לא בחירה. 8px הוא הסף שבו אצבע על מסך
       עדיין נחשבת נגיעה ולא משיכה. */
    if (moved > 8 || slow) return;

    const id = pickAt(e.clientX, e.clientY);
    setSelected(id === selected ? null : id);
    onPick(selected);
  });

  /* ---------- לולאה ---------- */

  let framed = false;

  function resize() {
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    /* המסגור הראשון בלבד. אחריו המרחק שייך למשתמש — שינוי גודל
       בגלל מקלדת שנפתחה לא אמור לזרוק אותו חזרה. */
    if (!framed) {
      framed = true;
      camera.position.set(0, 0, fitDistance(camera.aspect));
      controls.minDistance = fitDistance(camera.aspect) * 0.42;
      controls.maxDistance = fitDistance(camera.aspect) * 1.6;
      controls.update();
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  /* טאב מוסתר — אין טעם להעסיק את ה-GPU */
  const onVisibility = () => {
    renderer.setAnimationLoop(document.hidden ? null : () => {
      controls.update();
      renderer.render(scene, camera);
    });
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    select: (id) => { setSelected(id); },
    reset: () => {
      setSelected(null);
      controls.reset();
      camera.position.set(0, 0, fitDistance(camera.aspect));
      controls.update();
    },
    resize,
    destroy() {
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      controls.dispose();
      for (const mesh of meshes.values()) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** האם לדפדפן יש WebGL בכלל — אחרת נופלים לרשת הכרטיסים */
export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext
      && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}
