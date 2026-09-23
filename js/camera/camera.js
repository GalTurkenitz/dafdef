/**
 * camera/camera.js — תשתית המצלמה המשותפת (המפרט, סעיף 5).
 *
 * ** הכל רץ על המכשיר. שום וידאו לא נשמר ולא נשלח לשום מקום. **
 * אין כאן העלאה, אין הקלטה, ואין אחסון של פריימים. הפריים נקרא,
 * מנותח, ונזרק.
 *
 * מודול אחד משותף לשלושת מודולי האימות: נשימות, מים וכושר.
 * API אחיד: start / stop / onEvent, וכל מודול מזין את הלוגיקה שלו
 * דרך callback על כל פריים.
 *
 * הערת iOS: הניתוח בדפדפן כבד בהרבה מנייטיב. הלולאה מדלגת על
 * פריימים כדי לא להרעיב את ה-UI, ויש מד FPS שמאפשר לזהות מכשיר
 * שלא עומד בקצב.
 */

/* ארוז מקומית (V5, סעיף ג): האפליקציה חייבת לעבוד בלי רשת, וטעינה
   מ-CDN בכל פתיחה היא מסך המתנה. הנתיבים מוחלטים מהשורש. */
const VENDOR = '/vendor/mediapipe';
const WASM = `${VENDOR}/wasm`;

const MODELS = {
  /* ו7: full במקום lite — מדויק בהרבה על הברכיים והירכיים, וזה
     מה שספירת הסקוואטים נשענת עליו. כבד יותר, ולכן הלולאה מדלגת
     פריימים לפי מד ה-FPS. */
  pose: `${VENDOR}/models/pose_landmarker_full.task`,
  face: `${VENDOR}/models/face_landmarker.task`,
  /* ו6: מזהה אובייקטים אמיתי — בלעדיו "הראה את הכוס" עובר עם יד ריקה */
  objects: `${VENDOR}/models/efficientdet_lite0.tflite`,
};

/** מה נחשב "כוס" לצורך משימת המים (שמות מחלקות של COCO) */
export const CUP_CLASSES = ['cup', 'wine glass', 'bottle'];

/** כמה זמן בלי זיהוי נחשב "יצא מהפריים" */
export const OUT_OF_FRAME_MS = 1500;

let visionPromise = null;

/** טוען את חבילת MediaPipe פעם אחת בלבד */
async function loadVision() {
  if (!visionPromise) {
    visionPromise = import(/* @vite-ignore */ `${VENDOR}/vision_bundle.mjs`)
      .then(async (m) => ({ m, fileset: await m.FilesetResolver.forVisionTasks(WASM) }));
  }
  return visionPromise;
}

/* ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {HTMLElement} opts.host        לאן להזריק את הווידאו והקנבס
 * @param {'pose'|'face'} opts.model
 * @param {(result, ctx) => void} opts.onFrame  נקרא על כל פריים מנותח
 * @param {(state) => void} [opts.onPresence]   נוכחות/יציאה מהפריים
 */
export function createCamera({ host, model = 'pose', detectObjects = false,
                               onFrame, onPresence }) {
  let stream = null;
  let landmarker = null;
  let detector = null;
  let objects = [];
  let raf = null;
  let running = false;
  let lastVideoTime = -1;
  let lastSeen = 0;
  let present = false;

  // מד קצב — כדי לדעת אם המכשיר בכלל עומד בזה
  let frames = 0, fpsSince = 0, fps = 0;
  let lastDetect = 0;

  host.innerHTML = `
    <div class="cam">
      <video class="cam__video" playsinline muted autoplay data-video></video>
      <canvas class="cam__overlay" data-overlay></canvas>
      <div class="cam__flow" data-flow hidden aria-hidden="true"></div>
      <div class="cam__guide" data-guide></div>
      <div class="cam__badge" data-fps hidden></div>
      <div class="cam__loading" data-loading>
        <span class="spinner" aria-hidden="true"></span>
        <p data-loading-text>מפעילים מצלמה…</p>
        <p class="cam__loading-note" data-loading-note></p>
      </div>
      <p class="cam__privacy">הכל רץ על המכשיר שלך. שום וידאו לא נשמר ולא נשלח.</p>
    </div>`;

  const video = host.querySelector('[data-video]');
  const canvas = host.querySelector('[data-overlay]');
  const guide = host.querySelector('[data-guide]');
  const fpsBadge = host.querySelector('[data-fps]');
  const loading = host.querySelector('[data-loading]');
  const loadingText = host.querySelector('[data-loading-text]');
  const loadingNote = host.querySelector('[data-loading-note]');
  const ctx2d = canvas.getContext('2d');
  const flow = host.querySelector('[data-flow]');

  /**
   * ההורדה הראשונה של MediaPipe היא כ-9MB (WASM + מודל), ולוקחת
   * שניות גם על חיבור טוב. בלי חיווי המשתמש רואה מסך שחור ותוהה
   * אם משהו נשבר. אחרי הפעם הראשונה הדפדפן מגיש מהמטמון.
   */
  const MODEL_SEEN_KEY = 'dafdef:cameraModelSeen';

  function setLoading(text, note = '') {
    if (!loading) return;
    loading.hidden = false;
    loadingText.textContent = text;
    loadingNote.textContent = note;
  }

  function doneLoading() {
    if (loading) loading.hidden = true;
    try { localStorage.setItem(MODEL_SEEN_KEY, '1'); } catch { /* ignore */ }
  }

  function firstTime() {
    try { return !localStorage.getItem(MODEL_SEEN_KEY); } catch { return true; }
  }

  /* ---------------------------------------------------------------- */

  function setGuide(html, tone = '') {
    guide.className = 'cam__guide' + (tone ? ' is-' + tone : '');
    guide.innerHTML = html;
  }

  /**
   * חיצי אוויר על הווידאו (V3, סעיף ו5).
   *
   * dir: 'in' בשאיפה — חץ מעלה עם סימני זרימה שנמשכים פנימה;
   *      'out' בנשיפה — חץ מטה והזרימה יוצאת;
   *      null בעצירת נשימה — השכבה נעלמת.
   * progress (0..1) מניע את הסימנים לאורך הפאזה, כך שהתנועה
   * מסונכרנת לקצב התרגיל ולא רצה בלולאה משל עצמה.
   */
  function setFlow(dir, progress = 0) {
    if (!flow) return;

    if (!dir) { flow.hidden = true; flow.dataset.dir = ''; return; }

    if (flow.dataset.dir !== dir) {
      flow.dataset.dir = dir;
      flow.innerHTML = `
        <span class="cam__flow-arrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>
          </svg>
        </span>
        ${[0, 1, 2].map((i) => `<i class="cam__flow-mark" style="--i:${i}"></i>`).join('')}`;
    }

    flow.hidden = false;
    flow.style.setProperty('--p', progress.toFixed(3));
  }

  function markPresence(seen, now) {
    if (seen) { lastSeen = now; }

    const wasPresent = present;
    present = now - lastSeen < OUT_OF_FRAME_MS;

    if (present !== wasPresent) onPresence?.({ present });
    return present;
  }

  async function loop() {
    if (!running) return;

    const now = performance.now();

    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      let result = null;
      try {
        result = landmarker.detectForVideo(video, now);
      } catch {
        // פריים בודד שנכשל אינו סיבה להפיל את הכל
      }

      // זיהוי אובייקטים רץ בקצב נמוך יותר — הוא יקר ולא צריך
      // להיות חד-פריימי כדי לזהות שכוס נמצאת ביד
      if (detector && now - lastDetect > 300) {
        lastDetect = now;
        try {
          objects = detector.detectForVideo(video, now)?.detections || [];
        } catch {
          // פריים בודד שנכשל אינו סיבה להפיל את הכל
        }
      }

      if (result) {
        const found = (result.landmarks?.length || result.faceLandmarks?.length || 0) > 0;
        const here = markPresence(found, now);
        onFrame?.(result, { present: here, now, ctx: ctx2d, canvas, video,
                            setGuide, objects });
      }

      frames += 1;
      if (now - fpsSince > 1000) {
        fps = frames;
        frames = 0;
        fpsSince = now;
        fpsBadge.textContent = `${fps} FPS`;
      }
    }

    raf = requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------------- */

  return {
    get fps() { return fps; },
    get present() { return present; },
    get objects() { return objects; },
    /** האם מזהה האובייקטים באמת נטען — משמש לשגיאה ברורה */
    get hasDetector() { return Boolean(detector); },
    setGuide,
    setFlow,

    /** מציג את מד ה-FPS — שימושי לאבחון מכשיר איטי */
    showFps(on = true) { fpsBadge.hidden = !on; },

    async start() {
      setLoading('מפעילים מצלמה…');

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
      } catch (err) {
        setLoading(err?.name === 'NotAllowedError'
          ? 'צריך הרשאה למצלמה כדי לבצע את המשימה הזו.'
          : 'לא הצלחנו לפתוח את המצלמה.');
        throw err;
      }

      video.srcObject = stream;
      await video.play().catch(() => {});

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      setLoading('טוען את מנוע הזיהוי…',
        firstTime() ? 'בפעם הראשונה יורדים כ-9MB. אחר כך זה מיידי.' : '');
      const { m, fileset } = await loadVision();

      if (model === 'face') {
        landmarker = await m.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODELS.face, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      } else {
        landmarker = await m.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODELS.pose, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      }

      if (detectObjects) {
        setLoading('טוען מזהה אובייקטים…');
        detector = await m.ObjectDetector.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODELS.objects, delegate: 'GPU' },
          runningMode: 'VIDEO',
          scoreThreshold: 0.35,
          maxResults: 8,
        });
      }

      doneLoading();
      running = true;
      lastSeen = performance.now();
      fpsSince = performance.now();
      loop();
    },

    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;

      // משחררים את המצלמה מיד — לא משאירים נורה דולקת
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      video.srcObject = null;

      try { landmarker?.close(); } catch { /* ignore */ }
      landmarker = null;

      try { detector?.close(); } catch { /* ignore */ }
      detector = null;
      objects = [];
    },
  };
}

/* ------------------------------------------------------------------ *
 * עזרי גאומטריה למודולים
 * ------------------------------------------------------------------ */

/** אינדקסים של נקודות ציון ב-Pose (BlazePose 33) */
export const POSE = {
  NOSE: 0,
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,    RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,    RIGHT_WRIST: 16,
  LEFT_HIP: 23,      RIGHT_HIP: 24,
  LEFT_KNEE: 25,     RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,    RIGHT_ANKLE: 28,
};

/** זווית בין שלוש נקודות, במעלות */
export function angle(a, b, c) {
  if (!a || !b || !c) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) return null;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}

/** ממוצע של כמה נקודות — מייצב מול רעש */
export function mid(...points) {
  const valid = points.filter(Boolean);
  if (!valid.length) return null;
  return {
    x: valid.reduce((s, p) => s + p.x, 0) / valid.length,
    y: valid.reduce((s, p) => s + p.y, 0) / valid.length,
  };
}

/** מצייר שלד דק על הקנבס — משוב ויזואלי שהזיהוי עובד */
export function drawPose(ctx, canvas, landmarks) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks?.length) return;

  const links = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
  ];

  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  for (const [a, b] of links) {
    const p1 = landmarks[a], p2 = landmarks[b];
    if (!p1 || !p2) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
    ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
    ctx.stroke();
  }

  ctx.fillStyle = '#B08968';
  for (const i of Object.values(POSE)) {
    const p = landmarks[i];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
