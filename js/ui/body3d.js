/**
 * body3d.js — גוף האדם התלת-מימדי של מסך הסטטיסטיקה.
 *
 * ─────────────────────────────────────────────────────────────────
 *  המודלים
 *
 *  גוף — MakeHuman base mesh, **CC0**.
 *  מוח — "Brain AS" מאת AgnieszkaStarostecka, ויקישיתוף, **CC BY 4.0**.
 *
 *  שניהם עוברים דרך scripts/build-models.mjs, שמוריד את המקור,
 *  מקטין אותו למידה של טלפון וכותב GLB. המקורות המלאים והסיבות
 *  יושבים שם ובקובץ content/models/CREDITS.md.
 *
 *  הגרסה הקודמת בנתה גוף מכדורים וקפסולות. המשתמש אמר שזה נראה
 *  כמו בובת מפרקים, וצדק — פרימיטיבים לא מייצרים גוף אדם, ובוודאי
 *  לא מוח: מוח חייב שתי המיספרות, גירי וסולסי, מוח קטן וגזע.
 * ─────────────────────────────────────────────────────────────────
 *  איך אזור הופך ללחיץ
 *
 *  המודלים מגיעים כרשת אחת. חיתוך לפי מבחן על מרכז כל משולש
 *  (ראו body-parts.js) מייצר רשת נפרדת לכל אזור, ומה שלא נכנס
 *  לאף אזור נשאר בזכוכית הניטרלית. כך הלחיצה, ההארה וההדגשה
 *  עובדות בדיוק כמו קודם, בלי לשנות מילה ב-anatomy.js.
 *
 *  אזורי המוח נחתכים מרשת המוח עצמה, ולכן ההילה מונחת על הגירי
 *  ועוקבת אחרי פני השטח — לא כדור שמרחף מעליהם.
 * ─────────────────────────────────────────────────────────────────
 *  איך נראה "לראות את הפנים"
 *
 *  העור שקוף ואינו כותב לבאפר העומק, והאיברים אטומים. three
 *  מצייר אטום לפני שקוף, ולכן האיברים יוצאים ראשונים והעור נמרח
 *  מעליהם — בלי שום שיידר ובלי בעיות מיון.
 * ─────────────────────────────────────────────────────────────────
 */

import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/OrbitControls.js';
import { GLTFLoader } from '../../vendor/three/GLTFLoader.js';
import { REGIONS, regionOfPart } from './anatomy.js';
import { PARTS, BRAIN_FIT, BODY_HEIGHT, BODY_CENTER_Y, BODY_WIDTH } from './body-parts.js';

const MODELS = 'content/models/';
const FOV = 32;

/**
 * כמה רחוק צריכה המצלמה לעמוד כדי שכל הדמות תיכנס.
 * במסך צר הרוחב הוא שקובע, במסך רחב הגובה.
 */
function fitDistance(aspect) {
  const half = THREE.MathUtils.degToRad(FOV) / 2;
  const byHeight = (BODY_HEIGHT * 0.58) / Math.tan(half);
  const byWidth = (BODY_WIDTH * 0.62) / Math.tan(half) / Math.max(aspect, 0.001);
  return Math.max(byHeight, byWidth);
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
 * חיתוך רשת לאזורים
 * ------------------------------------------------------------------ */

/**
 * מחלק גיאומטריה אחת לכמה, לפי מבחן על מרכז המשולש.
 * המפתח '' הוא השארית — כל מה שלא נכנס לאף אזור.
 */
function splitGeometry(geo, slices) {
  const pos = geo.getAttribute('position');
  const nrm = geo.getAttribute('normal');
  const idx = geo.getIndex();
  const count = idx ? idx.count : pos.count;
  const at = (i) => (idx ? idx.getX(i) : i);

  const buckets = new Map();
  for (let i = 0; i < count; i += 3) {
    const a = at(i);
    const b = at(i + 1);
    const c = at(i + 2);
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;

    let name = '';
    for (const s of slices) {
      if (s.accept(cx, cy, cz)) { name = s.name; break; }
    }

    let bucket = buckets.get(name);
    if (!bucket) { bucket = { p: [], n: [] }; buckets.set(name, bucket); }
    for (const v of [a, b, c]) {
      bucket.p.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      if (nrm) bucket.n.push(nrm.getX(v), nrm.getY(v), nrm.getZ(v));
    }
  }

  const out = new Map();
  for (const [name, bucket] of buckets) {
    if (!bucket.p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(bucket.p, 3));
    if (bucket.n.length === bucket.p.length) {
      g.setAttribute('normal', new THREE.Float32BufferAttribute(bucket.n, 3));
    } else {
      g.computeVertexNormals();
    }
    out.set(name, g);
  }
  return out;
}

/** מאחד את כל הרשתות שבקובץ GLB לגיאומטריה אחת במרחב העולם */
function flatten(scene) {
  scene.updateMatrixWorld(true);
  const p = [];
  const n = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    g.applyMatrix4(o.matrixWorld);
    const pa = g.getAttribute('position').array;
    for (let i = 0; i < pa.length; i += 1) p.push(pa[i]);
    const na = g.getAttribute('normal');
    if (na) for (let i = 0; i < na.array.length; i += 1) n.push(na.array[i]);
    g.dispose();
  });
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  if (n.length === p.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  else merged.computeVertexNormals();
  return merged;
}

/* ------------------------------------------------------------------ *
 * הרכבה
 * ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {HTMLElement} opts.mount
 * @param {Set<string>} opts.active   אילו נישות בסבב — השאר כבויות
 * @param {(regionId: string|null) => void} opts.onPick
 * @param {(err?: Error) => void} [opts.onReady]
 */
export function createBody({ mount, active = new Set(), onPick = () => {}, onReady = () => {} }) {
  const colors = {};
  for (const [id, r] of Object.entries(REGIONS)) {
    colors[id] = cssColor(`--niche-${r.niche}`, '#B08968');
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'body3d__canvas';
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, fitDistance(1));

  scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x140f0c, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2.5, 4, 3.5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.45);
  fill.position.set(-3, 1, -2.5);
  scene.add(fill);

  /* אור מאחור. בלעדיו הגוף השקוף כמעט נעלם על רקע שחור: אין לו
     קצה שתופס אור, והצללית נבלעת. */
  const rim = new THREE.DirectionalLight(0xd8ecff, 1.6);
  rim.position.set(-1.2, 2.2, -4.5);
  scene.add(rim);

  const body = new THREE.Group();
  body.position.y = -BODY_CENTER_Y;
  scene.add(body);

  /* זכוכית קרה אחת לכל העור. הצבע מופיע רק כשבוחרים אזור — גרסה
     שצבעה כל אזור כבר במנוחה הוציאה זרועות ורגליים ורודות (שתיהן
     כושר) וגוף שחור, וזה נראה כמו צעצוע. */
  const GLASS = new THREE.Color(0x9ec7e8);

  const glassMaterial = () => new THREE.MeshStandardMaterial({
    color: GLASS.clone(),
    emissive: GLASS.clone().multiplyScalar(0.45),
    emissiveIntensity: 0.34,
    transparent: true,
    depthWrite: false,
    opacity: 0.22,
    roughness: 0.35,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  const organMaterial = (tint, on) => new THREE.MeshStandardMaterial({
    color: tint.clone().multiplyScalar(0.5),
    emissive: tint.clone(),
    emissiveIntensity: on ? 0.85 : 0.22,
    roughness: 0.32,
    metalness: 0.05,
  });

  const skins = [];
  const pickable = [];
  const organParts = new Set(PARTS.filter((p) => p.organ).map((p) => p.name));
  let brainGroup = null;
  let selected = null;
  let destroyed = false;

  function addMesh(name, geometry, { organ, tint }) {
    const regionId = regionOfPart(name);
    const on = regionId ? active.has(REGIONS[regionId].niche) : false;
    const material = organ ? organMaterial(tint || GLASS, on) : glassMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.renderOrder = organ ? 0 : 1;
    skins.push({ mesh, regionId, tint, on, organ: !!organ });
    if (regionId) pickable.push(mesh);
    return mesh;
  }

  /* ---------- טעינה ---------- */

  const loader = new GLTFLoader();
  const load = (file) => new Promise((resolve, reject) => {
    loader.load(MODELS + file, (g) => resolve(flatten(g.scene)), undefined, reject);
  });

  Promise.all([load('body.glb'), load('brain.glb')]).then(([bodyGeo, brainGeo]) => {
    if (destroyed) return;

    /* --- הגוף --- */
    const bodySlices = PARTS.filter((p) => p.from === 'body')
      .map((p) => ({ name: p.name, accept: p.test }));

    for (const [name, geo] of splitGeometry(bodyGeo, bodySlices)) {
      geo.scale(BODY_HEIGHT, BODY_HEIGHT, BODY_HEIGHT);
      body.add(addMesh(name || 'bodyRest', geo, { organ: false }));
    }

    /* --- המוח --- */
    brainGroup = new THREE.Group();
    brainGroup.scale.setScalar(BRAIN_FIT.scale * BODY_HEIGHT);
    brainGroup.position.set(
      BRAIN_FIT.at[0] * BODY_HEIGHT,
      BRAIN_FIT.at[1] * BODY_HEIGHT,
      BRAIN_FIT.at[2] * BODY_HEIGHT,
    );
    body.add(brainGroup);

    /* הגיאומטריה מנורמלת עם y=0 בתחתית. מזיזים למרכז, כדי שקנה
       המידה והמיקום של הקבוצה יתייחסו למרכז המוח ולא לקצהו. */
    brainGeo.translate(0, -0.5, 0);

    const brainSlices = PARTS.filter((p) => p.from === 'brain').map((p) => {
      const [ax, ay, az] = p.patch.at;
      const r2 = p.patch.r * p.patch.r;
      return {
        name: p.name,
        accept: (x, y, z) => {
          const dx = x - ax;
          const dy = (y + 0.5) - ay;   // חזרה ליחידות המודל המקורי
          const dz = z - az;
          return dx * dx + dy * dy + dz * dz <= r2;
        },
      };
    });

    for (const [name, geo] of splitGeometry(brainGeo, brainSlices)) {
      if (name) {
        brainGroup.add(addMesh(name, geo, { organ: true, tint: colors[regionOfPart(name)] }));
      } else {
        /* שארית המוח — רקמה, לא אזור. אטומה כדי שההילות ייראו
           עליה, אבל בגוון ניטרלי ועמום. */
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
          color: 0xc7aeb4, roughness: 0.72, metalness: 0,
          emissive: new THREE.Color(0x5b4750), emissiveIntensity: 0.6,
        }));
        mesh.name = 'brainTissue';
        mesh.renderOrder = 0;
        skins.push({ mesh, regionId: null, tint: null, on: false, organ: true, tissue: true });
        brainGroup.add(mesh);
      }
    }

    /* --- איברים פנימיים --- */
    for (const p of PARTS.filter((x) => x.type)) {
      const geo = new THREE.SphereGeometry(p.r * BODY_HEIGHT, 26, 18);
      const mesh = addMesh(p.name, geo, { organ: true, tint: colors[regionOfPart(p.name)] });
      mesh.position.set(p.at[0] * BODY_HEIGHT, p.at[1] * BODY_HEIGHT, p.at[2] * BODY_HEIGHT);
      if (p.s) mesh.scale.set(p.s[0], p.s[1], p.s[2]);
      body.add(mesh);
    }

    setSelected(null);

    /* תפר לבדיקות, על אלמנט הבד.

       בלי זה אין דרך לדעת מבחוץ אם אזור לא נפתח כי החיתוך לא
       ייצר אותו או כי הקרן פספסה אותו, והדיבוג מתנהל בניחושים.
       זה בדיוק מה שקרה כאן: ארבעת אזורי המוח נראו "לא נגישים"
       בעוד שהקרן פגעה בהם מצוין, והלחיצה השנייה בסריקה היא זו
       שהחזירה את המצלמה החוצה. */
    renderer.domElement.__parts = {
      pickable: pickable.map((m) => m.name),
      brain: brainGroup.children.map((m) => m.name),
      /* מה הקרן פוגעת בנקודת מסך נתונה, לפי שם ולא לפי אזור */
      hitsAt: (cx, cy) => {
        const r = renderer.domElement.getBoundingClientRect();
        ndc.x = ((cx - r.left) / r.width) * 2 - 1;
        ndc.y = -((cy - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ndc, camera);
        return {
          pickable: ray.intersectObjects(pickable, false).map((h) => h.object.name),
          brain: ray.intersectObjects(brainGroup.children, false).map((h) => h.object.name),
          ndc: [ndc.x, ndc.y],
        };
      },
      box: (name) => {
        const m = skins.find((p) => p.mesh.name === name);
        if (!m) return null;
        const b = new THREE.Box3().setFromObject(m.mesh);
        return { min: b.min.toArray(), max: b.max.toArray() };
      },
    };

    onReady();
  }).catch((err) => {
    console.error('טעינת המודלים נכשלה', err);
    onReady(err);
  });

  /* ---------- שליטה ---------- */

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = fitDistance(1) * 0.22;
  controls.maxDistance = fitDistance(0.45) * 1.35;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI - 0.35;
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 0.8;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;

  const stopAuto = () => { controls.autoRotate = false; };
  renderer.domElement.addEventListener('pointerdown', stopAuto);
  renderer.domElement.addEventListener('wheel', stopAuto, { passive: true });

  /* ---------- בחירה ---------- */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = null;

  function setSelected(id) {
    selected = id;
    for (const part of skins) {
      const isPick = id && part.regionId === id;
      const m = part.mesh.material;

      if (part.tissue) {
        m.emissiveIntensity = id ? 0.22 : 0.55;
      } else if (part.organ) {
        m.emissiveIntensity = isPick ? 1.6 : (id ? 0.1 : (part.on ? 0.85 : 0.22));
      } else if (isPick) {
        m.color.copy(part.tint || GLASS);
        m.emissive.copy(part.tint || GLASS);
        m.emissiveIntensity = 0.75;
        m.opacity = 0.5;
      } else {
        m.color.copy(GLASS);
        m.emissive.copy(GLASS).multiplyScalar(0.45);
        m.emissiveIntensity = 0.34;
        m.opacity = id ? 0.07 : 0.22;
      }
    }
  }

  /**
   * זום אל המוח. ארבעת אזורי המוח קטנים מכדי לבחור ביניהם
   * מהמרחק של גוף מלא, ולכן לחיצה על המוח מקרבת אליו.
   */
  function focusBrain(on) {
    if (!brainGroup || destroyed) return;
    const dist = on ? fitDistance(camera.aspect) * 0.16 : fitDistance(camera.aspect);

    /* המטרה מונמכת מתחת למוח, כדי שהמוח יעלה אל החלק העליון של
       המסך ולא יישב מאחורי הגיליון שנפתח מלמטה. ההזזה היא חלק
       מהגובה הנראה ולכן היא נכונה בכל גודל מסך. */
    const visibleH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const target = on
      ? new THREE.Vector3(0,
        BRAIN_FIT.at[1] * BODY_HEIGHT - BODY_CENTER_Y - visibleH * 0.20, 0)
      : new THREE.Vector3(0, 0, 0);

    const from = controls.target.clone();
    const fromPos = camera.position.clone();
    const dir = fromPos.clone().sub(from).normalize();
    const toPos = target.clone().add(dir.multiplyScalar(dist));

    const t0 = performance.now();
    const step = () => {
      if (destroyed) return;
      const k = Math.min(1, (performance.now() - t0) / 420);
      /* האטה בסוף — תנועת מצלמה לינארית נראית מכנית */
      const e = 1 - (1 - k) ** 3;
      controls.target.lerpVectors(from, target, e);
      camera.position.lerpVectors(fromPos, toPos, e);
      controls.update();
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(pickable, false);
    if (!hits.length) return null;

    /* איבר פנימי גובר על שריר שלפניו. נמדד: שרירי החזה יושבים
       מלפנים ובלעו כל פגיעה בריאות ובלב — מהחזית אי אפשר היה
       ללחוץ עליהם בכלל. */
    const organ = hits.find((h) => organParts.has(h.object.name));
    return regionOfPart((organ || hits[0]).object.name);
  }

  /** האם הלחיצה נחתה על המוח, גם על רקמה שאינה אזור */
  function hitBrain(clientX, clientY) {
    if (!brainGroup) return false;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(brainGroup.children, false).length > 0;
  }

  renderer.domElement.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: Date.now() };
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const slow = Date.now() - downAt.t > 700;
    downAt = null;
    if (moved > 8 || slow) return;   // גרירה היא סיבוב, לא בחירה

    const id = pickAt(e.clientX, e.clientY);
    const onBrain = !id && hitBrain(e.clientX, e.clientY);

    /* לחיצה על המוח בלי לפגוע באזור מסוים — מתקרבים אליו, כדי
       שאפשר יהיה לבחור בין ארבעת האזורים שעליו. */
    if (onBrain) { focusBrain(true); return; }

    const next = id === selected ? null : id;
    setSelected(next);
    if (next && next.startsWith('brain-')) focusBrain(true);
    if (!next) focusBrain(false);
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

    if (!framed) {
      framed = true;
      camera.position.set(0, 0, fitDistance(camera.aspect));
      controls.minDistance = fitDistance(camera.aspect) * 0.22;
      controls.maxDistance = fitDistance(camera.aspect) * 1.6;
      controls.update();
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(mount);
  resize();

  const frame = () => { controls.update(); renderer.render(scene, camera); };
  renderer.setAnimationLoop(frame);

  const onVisibility = () => renderer.setAnimationLoop(document.hidden ? null : frame);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    select: (id) => { setSelected(id); if (!id) focusBrain(false); },
    reset: () => {
      setSelected(null);
      controls.target.set(0, 0, 0);
      camera.position.set(0, 0, fitDistance(camera.aspect));
      controls.update();
    },
    resize,
    destroy() {
      destroyed = true;
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      controls.dispose();
      for (const part of skins) {
        part.mesh.geometry.dispose();
        part.mesh.material.dispose();
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
