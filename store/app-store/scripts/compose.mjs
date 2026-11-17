/**
 * Compone las imágenes de App Store a partir de las capturas reales.
 *
 * Concepto «el hilo» (ver `docs/tiendas/DISENO-app-store.md`): una sola línea de
 * brasa recorre la galería entera de izquierda a derecha. Empieza en un punto
 * solo («tú»), encuentra a otro en la imagen del match y desde ahí siguen dos
 * líneas juntas hasta cerrarse en el símbolo de cofounder en la última imagen.
 * Por eso las siete imágenes se pintan en un único lienzo panorámico y luego se
 * recortan: el hilo pasa de una a otra sin cortes.
 *
 *   node store/app-store/scripts/compose.mjs [es|en|ca ...]
 *
 * Lee `build/raw/<idioma>/*.png` (de `capture.mjs`) y escribe
 * `store/app-store/<idioma>/NN-<pantalla>.png` a 1320 × 2868 (iPhone 6,9″), más
 * una hoja de contacto en `build/preview-<idioma>.jpg`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HERE = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(`${ROOT}package.json`);
const { chromium } = require('playwright');

// ---------------------------------------------------------------- tokens
const W = 1320; // ancho de una imagen (iPhone 6,9″)
const H = 2868;
const C = {
  bg: '#000000',
  ink: '#F5F5F7',
  muted: '#BEBEC4',
  accent: '#FF8645', // brasa: el hilo y la palabra en cursiva
  bezel: '#1C1C1E',
};
const MARGIN = 110;
const PHONE = { x: 190, y: 900, w: 940, bezel: 26 };
PHONE.screenW = PHONE.w - PHONE.bezel * 2; // 888
const SCALE = PHONE.screenW / 1320; // captura @3x → pantalla del teléfono
const STATUS = Math.round(54 * (PHONE.screenW / 440)); // barra de estado de 54 pt
PHONE.screenH = STATUS + Math.round(2706 * SCALE);
PHONE.h = PHONE.screenH + PHONE.bezel * 2;
PHONE.radius = 137;
const THREAD = 6;
const POP = 1.3; // cuánto crece lo que sale del teléfono

/** De coordenadas de la captura (px @3x) a coordenadas de la imagen. */
const toFrame = (rx, ry) => [
  PHONE.x + PHONE.bezel + rx * SCALE,
  PHONE.y + PHONE.bezel + STATUS + ry * SCALE,
];

// ---------------------------------------------------------------- textos
/** `*palabra*` va en cursiva y en brasa. */
const COPY = {
  es: {
    deck: [
      'Encuentra con quién *fundar*.',
      'Gente que quiere empezar algo, como tú. No hace falta tener nada construido.',
    ],
    prompt: [
      'Perfiles que dicen cómo *piensas*.',
      'Nada de CV: lo que dominas, lo que buscas y un par de respuestas tuyas.',
    ],
    match: [
      'Si es *mutuo*, hay match.',
      'Solo conectáis cuando los dos queréis. Y la app te dice por qué encajáis.',
    ],
    icebreakers: [
      'El primer mensaje, *resuelto*.',
      'Preguntas sugeridas a partir de lo que tenéis en común.',
    ],
    groups: [
      'Equipos de hasta *seis*.',
      'Crea un grupo o únete a uno que busca justo lo que dominas.',
    ],
    profile: [
      'Tu GitHub, *verificado*.',
      'Vincula tu cuenta y luce el sello en tu perfil. Enlaces a LinkedIn y web, también.',
    ],
    closer: [
      'Aquí nadie contrata a *nadie*.',
      'Entre pares, en igualdad. Ni una app de citas ni una bolsa de empleo.',
    ],
    facts: ['Gratis', 'Sin anuncios', 'Bloquea y reporta'],
  },
  en: {
    deck: [
      'Find who you’ll *build* with.',
      'People who want to start something, like you. Nothing built yet? Perfect.',
    ],
    prompt: [
      'Profiles that show how you *think*.',
      'Not a CV: what you’re great at, what you need and a couple of your answers.',
    ],
    match: [
      'When it’s *mutual*, it’s a match.',
      'You only connect when you both want to. And the app tells you why you fit.',
    ],
    icebreakers: [
      'The first message, *sorted*.',
      'Suggested openers based on what you have in common.',
    ],
    groups: ['Teams of up to *six*.', 'Start a group or join one looking for exactly what you do.'],
    profile: [
      'Your GitHub, *verified*.',
      'Link your account and show the badge on your profile. LinkedIn and web links too.',
    ],
    closer: [
      'Nobody hires *anybody*.',
      'Peers, on equal terms. Not a dating app. Not a job board.',
    ],
    facts: ['Free', 'No ads', 'Block & report'],
  },
  ca: {
    deck: [
      'Troba amb qui *fundar*.',
      'Gent que vol començar alguna cosa, com tu. No cal tenir res construït.',
    ],
    prompt: [
      'Perfils que diuen com *penses*.',
      'Res de CV: el que domines, el que busques i un parell de respostes teves.',
    ],
    match: [
      'Si és *mutu*, hi ha match.',
      'Només connecteu quan tots dos ho voleu. I l’app et diu per què encaixeu.',
    ],
    icebreakers: [
      'El primer missatge, *resolt*.',
      'Preguntes suggerides a partir del que teniu en comú.',
    ],
    groups: [
      'Equips de fins a *sis*.',
      'Crea un grup o uneix-te a un que busca just el que domines.',
    ],
    profile: [
      'El teu GitHub, *verificat*.',
      'Vincula el compte i llueix el segell al perfil. Enllaços a LinkedIn i web, també.',
    ],
    closer: [
      'Aquí ningú contracta *ningú*.',
      'Entre iguals. Ni una app de cites ni una borsa de feina.',
    ],
    facts: ['Gratis', 'Sense anuncis', 'Bloqueja i denuncia'],
  },
};

/**
 * Las siete imágenes. `raw` es la captura del teléfono; `pop`, la zona de la
 * captura (x, y, ancho, alto en px @3x) que sale del teléfono ampliada, y su
 * radio (el de la tarjeta si recorta una, o un panel de cristal si no).
 */
const FRAMES = [
  { key: 'deck', raw: 'deck' },
  { key: 'prompt', raw: 'prompt' },
  { key: 'match', raw: 'match', pop: { box: [66, 675, 1188, 1356], radius: 90, panel: false } },
  {
    key: 'icebreakers',
    raw: 'icebreakers',
    pop: { box: [40, 870, 1240, 690], radius: 60, panel: true },
  },
  { key: 'groups', raw: 'groups' },
  {
    key: 'profile',
    raw: 'profile-top',
    popRaw: 'profile',
    pop: { box: [40, 630, 1240, 450], radius: 60, panel: true },
  },
  { key: 'closer' },
];
const N = FRAMES.length;

// ---------------------------------------------------------------- el hilo
/** Catmull-Rom → Bézier cúbicas: una curva suave que pasa por todos los puntos. */
function smooth(points) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const [p1, p2] = [points[i], points[i + 1]];
    const p3 = points[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
const X = (frame, x) => frame * W + x;

/** Centro del símbolo en la última imagen y sus extremos (las dos medias lunas). */
const LOGO = { x: X(6, W / 2), y: 1560, scale: 12 };
// Borde exterior de cada media luna: el arco grande llega a 18 + √(18² − 16,12²) ≈ 26 unidades
// del centro, más la unidad que separa las dos piezas.
const LOGO_REACH = 27 * LOGO.scale;

// «Tú»: un punto solo en la primera imagen. Por los márgenes, por detrás de los teléfonos.
const START = [X(0, MARGIN + 20), 880];
const MEET = [X(2, 1236), 1520]; // donde aparece la otra persona: junto al match
const LINE_A = [
  START,
  [X(0, 150), 1180],
  [X(0, 120), 1640],
  [X(0, 660), 2140],
  [X(0, 1230), 1780],
  [X(1, 60), 1620],
  [X(1, 110), 1240],
  [X(1, 660), 1180],
  [X(1, 1220), 1040],
  [X(2, 90), 1080],
  [X(2, 120), 1300],
  [X(2, 660), 1720],
  MEET,
  [X(3, 40), 1900],
  [X(3, 110), 2300],
  [X(3, 660), 2560],
  [X(3, 1225), 2240],
  [X(4, 70), 2060],
  [X(4, 110), 1500],
  [X(4, 660), 1160],
  [X(4, 1220), 1300],
  [X(5, 60), 1460],
  [X(5, 120), 1980],
  [X(5, 660), 2300],
  [X(5, 1225), 1960],
  [X(6, 110), 1690],
  [X(6, 240), 1580],
  [LOGO.x - LOGO_REACH, LOGO.y],
];
// La otra persona: sale del punto del match y acompaña al primero hasta el final.
const GAP = 40;
const LINE_B = [
  [MEET[0], MEET[1] + GAP + 30],
  ...LINE_A.slice(LINE_A.indexOf(MEET) + 1, -2).map(([x, y]) => [x, y + GAP]),
  [X(6, 230), 2110],
  [X(6, 660), 2190],
  [X(6, 1110), 2030],
  [X(6, 1150), 1700],
  [LOGO.x + LOGO_REACH, LOGO.y],
];

const threadSvg = () => `
<svg class="thread" width="${W * N}" height="${H}" viewBox="0 0 ${W * N} ${H}">
  <g fill="none" stroke="${C.accent}" stroke-width="${THREAD}" stroke-linecap="round">
    <path d="${smooth(LINE_A)}"/>
    <path d="${smooth(LINE_B)}"/>
  </g>
  <circle cx="${START[0]}" cy="${START[1]}" r="20" fill="${C.accent}"/>
  <circle cx="${MEET[0]}" cy="${MEET[1] + GAP + 30}" r="20" fill="${C.accent}"/>
</svg>`;

// ---------------------------------------------------------------- piezas
const rich = (text) => text.replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/ ([?!:;»])/g, '&nbsp;$1');

const statusBar = `
<div class="status">
  <span class="time">9:41</span>
  <svg class="icons" viewBox="0 0 160 30" width="160" height="30" aria-hidden="true">
    <g fill="${C.ink}">
      <rect x="0" y="20" width="7" height="10" rx="2"/><rect x="11" y="14" width="7" height="16" rx="2"/>
      <rect x="22" y="8" width="7" height="22" rx="2"/><rect x="33" y="2" width="7" height="28" rx="2"/>
      <path d="M66 26 a4 4 0 1 1 0.01 0z"/>
      <path d="M54 15 a17 17 0 0 1 24 0" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M48 9 a26 26 0 0 1 36 0" stroke="${C.ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <rect x="100" y="3" width="52" height="25" rx="8" fill="none" stroke="${C.ink}" stroke-opacity=".45" stroke-width="3"/>
      <rect x="105" y="8" width="38" height="15" rx="4"/>
      <rect x="155" y="11" width="4" height="9" rx="2" fill-opacity=".45"/>
    </g>
  </svg>
</div>`;

function phone(rawUrl) {
  return `
<div class="phone">
  <div class="screen">
    ${statusBar}
    <img class="shot" src="${rawUrl}" alt="">
    <div class="home"></div>
  </div>
</div>`;
}

function pop(rawUrl, { box: [bx, by, bw, bh], radius, panel }) {
  const [fx, fy] = toFrame(bx + bw / 2, by + bh / 2);
  const w = bw * SCALE * POP;
  const h = bh * SCALE * POP;
  const s = SCALE * POP;
  return `
<div class="pop ${panel ? 'panel' : ''}" style="left:${fx - w / 2}px;top:${fy - h / 2}px;width:${w}px;height:${h}px;border-radius:${radius * s}px">
  <img src="${rawUrl}" alt="" style="width:${1320 * s}px;left:${-bx * s}px;top:${-by * s}px">
</div>`;
}

const LOGO_PATHS = `
  <path d="M32 15.88 A18 18 0 1 0 32 48.12 A18 18 0 0 1 32 15.88 Z" transform="translate(-1 0)" fill="${C.ink}"/>
  <path d="M32 15.88 A18 18 0 1 1 32 48.12 A18 18 0 0 0 32 15.88 Z" transform="translate(1 0)" fill="${C.ink}"/>
  <circle cx="32" cy="32" r="5" fill="${C.accent}"/>`;

function frame(i, f, locale) {
  const copy = COPY[locale];
  const raw = (name) => `file://${HERE}build/raw/${locale}/${name}.png`;
  const [title, sub] = copy[f.key];
  const head = `
  <header class="${f.key === 'closer' ? 'closer-head' : ''}">
    <h1>${rich(title)}</h1>
    <p>${rich(sub)}</p>
  </header>`;
  if (f.key === 'closer') {
    const lx = LOGO.x - i * W;
    return `
<section class="frame" style="left:${i * W}px">
  <div class="light"></div>
  ${head}
  <svg class="logo" width="${64 * LOGO.scale}" height="${64 * LOGO.scale}" viewBox="0 0 64 64"
       style="left:${lx - 32 * LOGO.scale}px;top:${LOGO.y - 32 * LOGO.scale}px">${LOGO_PATHS}</svg>
  <div class="wordmark">cofounder</div>
  <ul class="facts">${copy.facts.map((t) => `<li>${t}</li>`).join('')}</ul>
</section>`;
  }
  return `
<section class="frame" style="left:${i * W}px">
  <div class="light"></div>
  ${head}
</section>
<div class="layer" style="left:${i * W}px">
  ${phone(raw(f.raw))}
  ${f.pop ? pop(raw(f.popRaw ?? f.raw), f.pop) : ''}
</div>`;
}

const font = (family, file, style = 'normal', weight = 400) =>
  `@font-face{font-family:'${family}';src:url('file://${ROOT}web/fonts/${file}');font-style:${style};font-weight:${weight}}`;

function page(locale) {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><style>
${font('Serif', 'InstrumentSerif_400Regular.ttf')}
${font('Serif', 'InstrumentSerif_400Regular_Italic.ttf', 'italic')}
${font('Sans', 'InstrumentSans_400Regular.ttf')}
${font('Sans', 'InstrumentSans_600SemiBold.ttf', 'normal', 600)}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${C.bg};width:${W * N}px;height:${H}px;overflow:hidden}
body{position:relative;-webkit-font-smoothing:antialiased;color:${C.ink}}
.frame,.layer{position:absolute;top:0;width:${W}px;height:${H}px}
.frame{z-index:0}
.layer{z-index:2;pointer-events:none}
.thread{position:absolute;left:0;top:0;z-index:1}
/* Una sola luz, tenue, que entra por arriba: la de la dirección «cristal». */
.light{position:absolute;inset:0;background:
  radial-gradient(ellipse 1500px 1150px at 50% -14%, rgba(255,134,69,.26), rgba(255,134,69,.07) 55%, transparent 76%)}
header{position:absolute;left:${MARGIN}px;right:${MARGIN}px;top:190px;z-index:3}
h1{font-family:Serif;font-weight:400;font-size:164px;line-height:.96;letter-spacing:-.012em;text-wrap:balance}
h1 em{font-style:italic;color:${C.accent}}
header p{margin-top:40px;font-family:Sans;font-size:50px;line-height:1.28;color:${C.muted};max-width:1040px;text-wrap:pretty}
.phone{position:absolute;left:${PHONE.x}px;top:${PHONE.y}px;width:${PHONE.w}px;height:${PHONE.h}px;
  border-radius:${PHONE.radius}px;padding:${PHONE.bezel}px;
  background:linear-gradient(160deg,#3A3A3D 0%,${C.bezel} 18%,#0E0E10 60%,#2A2A2D 100%);
  box-shadow:0 0 0 2px #2C2C2F inset, 0 80px 160px rgba(0,0,0,.75)}
.screen{position:relative;width:100%;height:100%;border-radius:${PHONE.radius - PHONE.bezel}px;overflow:hidden;background:#000}
.status{height:${STATUS}px;display:flex;align-items:center;justify-content:space-between;padding:12px 66px 0 98px}
.time{font-family:Sans;font-weight:600;font-size:36px;letter-spacing:-.01em}
.icons{width:150px;height:28px}
.shot{display:block;width:100%}
.home{position:absolute;left:50%;bottom:16px;width:280px;height:10px;margin-left:-140px;border-radius:5px;background:${C.ink};opacity:.9}
.pop{position:absolute;overflow:hidden;box-shadow:0 70px 140px rgba(0,0,0,.8), 0 0 0 2px rgba(255,255,255,.14)}
.pop.panel{background:#0B0B0C}
.pop img{position:absolute;display:block}
.closer-head{top:190px}
.logo{position:absolute;z-index:2}
.wordmark{position:absolute;left:0;right:0;top:${LOGO.y + 230}px;text-align:center;font-family:Serif;font-size:120px;letter-spacing:-.01em;z-index:2}
.facts{position:absolute;left:${MARGIN}px;right:${MARGIN}px;bottom:420px;display:flex;justify-content:center;gap:28px;list-style:none;z-index:2}
.facts li{font-family:Sans;font-weight:600;font-size:40px;color:${C.ink};padding:22px 40px;border-radius:999px;
  background:rgba(255,255,255,.08);box-shadow:0 0 0 2px rgba(255,255,255,.18) inset}
</style></head><body>
${threadSvg()}
${FRAMES.map((f, i) => frame(i, f, locale)).join('\n')}
</body></html>`;
}

// ---------------------------------------------------------------- render
const locales = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(COPY);
mkdirSync(`${HERE}build`, { recursive: true });
const browser = await chromium.launch();
for (const locale of locales) {
  const html = `${HERE}build/gallery-${locale}.html`;
  writeFileSync(html, page(locale));
  const tab = await browser.newPage({
    viewport: { width: W * N, height: H },
    deviceScaleFactor: 1,
  });
  await tab.goto(`file://${html}`, { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
  const out = `${HERE}${locale}/`;
  mkdirSync(out, { recursive: true });
  for (const [i, f] of FRAMES.entries()) {
    const file = `${out}${String(i + 1).padStart(2, '0')}-${f.key}.png`;
    await tab.screenshot({ path: file, clip: { x: i * W, y: 0, width: W, height: H } });
  }
  // Hoja de contacto: la galería entera a escala, como se ve al deslizar en la tienda.
  await tab.screenshot({
    path: `${HERE}build/preview-${locale}.jpg`,
    type: 'jpeg',
    quality: 80,
    scale: 'css',
    fullPage: false,
  });
  await tab.close();
  console.log(`${locale}: ${FRAMES.length} imágenes en ${out}`);
}
await browser.close();
