// Construye el sitio público (`_site/`) que sirve GitHub Pages.
//
// El sitio sale en tres idiomas. El español vive en la raíz (esas URL ya están
// en App Store, Play y la app, y no pueden cambiar); el inglés y el catalán
// cuelgan de `/en/` y `/ca/` con las mismas carpetas.
//
// - Recursos estáticos: `web/` (se copia tal cual, salvo `web/_content`).
// - Páginas propias (portada, soporte, eliminar cuenta): fragmentos HTML en
//   `web/_content/<idioma>/<página>.html`.
// - Documentos legales: NO se duplican; se generan desde `docs/tiendas/*.md`
//   (es), `docs/tiendas/en/*.md` y `docs/tiendas/ca/*.md`, que son la fuente de
//   verdad, para que la web y el texto que revisan las tiendas —y que acepta la
//   app— no diverjan.
//
// Uso: node scripts/build-web.mjs
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Estilo en línea del subconjunto de Markdown que usa la política: código,
// negrita, enlaces y URLs sueltas. Una sola pasada sobre el texto SIN escapar:
// cada fragmento se escapa al emitirlo, de modo que el HTML generado nunca se
// vuelve a analizar (reprocesarlo duplicaba enlaces y permitía inyectar
// atributos desde una URL).
const INLINE =
  /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s<>)]+[^\s<>).,;:])/g;

function inline(text) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    out += escapeHtml(text.slice(last, m.index));
    if (m[1] !== undefined) out += `<code>${escapeHtml(m[1])}</code>`;
    else if (m[2] !== undefined) out += `<strong>${escapeHtml(m[2])}</strong>`;
    else if (m[3] !== undefined) out += `<a href="${escapeHtml(m[4])}">${escapeHtml(m[3])}</a>`;
    else out += `<a href="${escapeHtml(m[5])}">${escapeHtml(m[5])}</a>`;
    last = m.index + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}

/**
 * Id de un título h2/h3: sin el número de sección ni acentos, en minúsculas y
 * con guiones. «## 11. cofounder Premium» → `cofounder-premium`, igual en los
 * tres idiomas y estable aunque se renumeren las secciones. Así el pie puede
 * enlazar «Reembolsos» a `/terminos/#cofounder-premium`.
 */
export function headingId(text) {
  return text
    .replace(/^\d+(?:\.\d+)*\.?\s+/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Convierte el Markdown de la política (títulos, párrafos, listas) en HTML. */
export function markdownToHtml(markdown) {
  const out = [];
  let items = null; // elementos de la lista abierta, o null
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (items) {
      out.push('<ul>', ...items.map((item) => `<li>${inline(item)}</li>`), '</ul>');
    }
    items = null;
  };

  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^-\s+(.*)$/.exec(line);

    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      const id = level > 1 ? headingId(heading[2]) : '';
      const attr = id ? ` id="${id}"` : '';
      out.push(`<h${level}${attr}>${inline(heading[2])}</h${level}>`);
    } else if (item) {
      flushParagraph();
      items ??= [];
      items.push(item[1]);
    } else if (line.trim() === '') {
      // Una línea en blanco no cierra la lista: el siguiente elemento sigue en ella.
      flushParagraph();
    } else if (items && /^\s+/.test(line)) {
      // Continuación indentada del último elemento.
      items[items.length - 1] += ` ${line.trim()}`;
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  closeList();
  return out.join('\n');
}

/**
 * Deja solo el texto publicable: quita el aviso editorial del principio (un
 * blockquote) y la nota para el responsable que cierra el documento tras `---`.
 */
export function publishableBody(markdown) {
  const withoutNote = markdown.split(/\r?\n---\r?\n/)[0];
  return withoutNote
    .split(/\r?\n/)
    .filter((line) => !line.startsWith('>'))
    .join('\n');
}

/** Dominio público: base de las URL absolutas de canonical y hreflang. */
export const SITE_URL = 'https://getcofounder.app';

/**
 * Idiomas del sitio. `prefix` es la carpeta pública (vacía para el español) y
 * `legalDir` la subcarpeta de `docs/tiendas` con los textos legales.
 */
export const LANGS = [
  { code: 'es', name: 'Español', prefix: '', legalDir: '' },
  { code: 'en', name: 'English', prefix: '/en', legalDir: 'en' },
  { code: 'ca', name: 'Català', prefix: '/ca', legalDir: 'ca' },
];

/** Documentos legales: archivo fuente → carpeta publicada y título por idioma. */
export const LEGAL_PAGES = [
  {
    source: 'privacidad.md',
    dir: 'privacidad',
    titles: {
      es: 'Política de privacidad · cofounder',
      en: 'Privacy policy · cofounder',
      ca: 'Política de privacitat · cofounder',
    },
  },
  {
    source: 'terminos.md',
    dir: 'terminos',
    titles: {
      es: 'Términos de uso · cofounder',
      en: 'Terms of use · cofounder',
      ca: "Termes d'ús · cofounder",
    },
  },
  {
    source: 'normas.md',
    dir: 'normas',
    titles: {
      es: 'Normas de la comunidad · cofounder',
      en: 'Community guidelines · cofounder',
      ca: 'Normes de la comunitat · cofounder',
    },
  },
  {
    source: 'seguridad-infantil.md',
    dir: 'seguridad-infantil',
    titles: {
      es: 'Estándares de seguridad infantil · cofounder',
      en: 'Child safety standards · cofounder',
      ca: 'Estàndards de seguretat infantil · cofounder',
    },
  },
  {
    source: 'cookies.md',
    dir: 'cookies',
    titles: {
      es: 'Política de cookies · cofounder',
      en: 'Cookie policy · cofounder',
      ca: 'Política de galetes · cofounder',
    },
  },
  {
    source: 'aviso-legal.md',
    dir: 'aviso-legal',
    titles: {
      es: 'Aviso legal · cofounder',
      en: 'Legal notice · cofounder',
      ca: 'Avís legal · cofounder',
    },
  },
];

/** Páginas propias: fragmentos `web/_content/<idioma>/<nombre>.html`. */
export const OWN_PAGES = ['index', 'soporte', 'eliminar-cuenta'];

/** Carpeta publicada de una página propia ('' para la portada). */
const ownDir = (name) => (name === 'index' ? '' : name);

// El orden importa: la portada usa los índices (0-3 y 6-7 legal, 4-5 ayuda).
const FOOTER_DIRS = [
  'privacidad',
  'terminos',
  'normas',
  'seguridad-infantil',
  'soporte',
  'eliminar-cuenta',
  'cookies',
  'aviso-legal',
];
const FOOTER_LABELS = {
  es: [
    'Privacidad',
    'Términos',
    'Normas',
    'Seguridad infantil',
    'Soporte',
    'Eliminar cuenta',
    'Cookies',
    'Aviso legal',
  ],
  en: [
    'Privacy',
    'Terms',
    'Guidelines',
    'Child safety',
    'Support',
    'Delete account',
    'Cookies',
    'Legal notice',
  ],
  ca: [
    'Privacitat',
    'Termes',
    'Normes',
    'Seguretat infantil',
    'Suport',
    'Eliminar compte',
    'Galetes',
    'Avís legal',
  ],
};

/** Reembolsos: la política está en Términos §11 («cofounder Premium»), no en un documento aparte. */
export const REFUNDS_ANCHOR = 'cofounder-premium';
const REFUNDS_LABEL = { es: 'Reembolsos', en: 'Refunds', ca: 'Reemborsaments' };
const refundsHref = (lang) => `${pagePath(lang, 'terminos')}#${REFUNDS_ANCHOR}`;

/** «Saltar al contenido», primer enlace de cada página (visible al enfocarlo). */
const SKIP_LABEL = {
  es: 'Saltar al contenido',
  en: 'Skip to content',
  ca: 'Salta al contingut',
};

export const ADDRESS_LINE = {
  es: '© 2026 Joel de Torres Sainz de la Maza · carrer Nou, 37, 25153 Puigverd de Lleida (Catalunya, España)',
  en: '© 2026 Joel de Torres Sainz de la Maza · carrer Nou, 37, 25153 Puigverd de Lleida (Catalonia, Spain)',
  ca: '© 2026 Joel de Torres Sainz de la Maza · carrer Nou, 37, 25153 Puigverd de Lleida (Catalunya, Espanya)',
};

/** Ruta pública (absoluta, con barra final) de una página en un idioma. */
export function pagePath(lang, dir) {
  const { prefix } = LANGS.find((l) => l.code === lang);
  return `${prefix}/${dir ? `${dir}/` : ''}`;
}

/**
 * Marcadores que todavía esperan una decisión del responsable (`[fecha de
 * publicación…]`, `[pendiente…]`, `[PROPUESTA…]`) en el texto publicable.
 */
/**
 * Los textos legales enlazan entre sí con la URL española (`SITE_URL/normas`).
 * En en/ca esos enlaces deben quedarse en el idioma de la página: se les pone
 * el prefijo (`SITE_URL/en/normas`). El español queda tal cual.
 */
export function localizeSiteLinks(markdown, lang) {
  const { prefix } = LANGS.find((l) => l.code === lang);
  if (!prefix) return markdown;
  const dirs = [
    'privacidad',
    'terminos',
    'normas',
    'seguridad-infantil',
    'eliminar-cuenta',
    'soporte',
    'cookies',
    'aviso-legal',
  ];
  const host = SITE_URL.replace(/[.]/g, '[.]');
  const re = new RegExp(host + '/(' + dirs.join('|') + ')(?![A-Za-z0-9_-])', 'g');
  return markdown.replace(re, `${SITE_URL}${prefix}/$1`);
}

export function pendingMarkers(markdown) {
  const pattern = /\[(?:fecha de publicaci[oó]n|pendiente|propuesta|proveedor|nif)[^\]]*\]/gi;
  return [...markdown.matchAll(pattern)].map((match) => match[0]);
}

/** Hueco del NIF en el aviso legal: `[NIF no publicado: …]` (en/ca: `[NIF not published…]`, `[NIF no publicat…]`). */
const NIF_MARKER = /\[NIF[^\]]*\]/;

/**
 * El NIF NO está en el repositorio (la web pública sale de un repo público).
 * Con `nif` (la variable de entorno `LEGAL_NIF` al construir), el hueco se
 * rellena; sin él, se quita la línea entera para no publicar el marcador, y
 * `missing` avisa de que falta.
 */
export function applyNif(markdown, nif) {
  if (!NIF_MARKER.test(markdown)) return { markdown, missing: false };
  const value = typeof nif === 'string' ? nif.trim() : '';
  if (value) return { markdown: markdown.replace(NIF_MARKER, () => value), missing: false };
  const kept = markdown.split('\n').filter((line) => !NIF_MARKER.test(line));
  return { markdown: kept.join('\n'), missing: true };
}

/** Documento HTML completo: `dir` es la carpeta de la página ('' = portada). */
export function page({ lang, title, body, dir = '' }) {
  const alternates = LANGS.map(
    (l) =>
      `    <link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${pagePath(l.code, dir)}" />`
  );
  alternates.push(
    `    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${pagePath('es', dir)}" />`
  );
  const switcher = LANGS.map((l) => {
    const current = l.code === lang ? ' aria-current="page"' : '';
    return `<a href="${pagePath(l.code, dir)}" hreflang="${l.code}" lang="${l.code}"${current}>${l.name}</a>`;
  }).join(' · ');
  const labels = FOOTER_LABELS[lang];
  const nav = [
    ...FOOTER_DIRS.map((d, i) => `<a href="${pagePath(lang, d)}">${labels[i]}</a>`),
    `<a href="${refundsHref(lang)}">${REFUNDS_LABEL[lang]}</a>`,
  ].join(' · ');
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${SITE_URL}${pagePath(lang, dir)}" />
${alternates.join('\n')}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <a class="skip" href="#main">${SKIP_LABEL[lang]}</a>
    <header>
      <nav class="lang" aria-label="Language">${switcher}</nav>
      <a href="${pagePath(lang, '')}">cofounder</a>
    </header>
    <main id="main" tabindex="-1">
${body}
    </main>
    <footer>
      <p>${nav}</p>
      <p>
        ${ADDRESS_LINE[lang]} ·
        <a href="mailto:soporte@getcofounder.app">soporte@getcofounder.app</a>
      </p>
    </footer>
  </body>
</html>
`;
}

// ─── Landing (portada) ──────────────────────────────────────────────────────
//
// La portada no es un fragmento por idioma: es una sola plantilla
// (`web/_content/landing.html`) con marcadores `{{grupo.clave}}` que se llenan
// con `web/_content/<idioma>/landing.json`. Los textos son HTML de confianza
// (los escribimos nosotros; llevan `<em>` y enlaces), así que no se escapan.
// Ver `docs/plan/todo/web.md` y `docs/plan/DISENO-web.md`.

const OG_LOCALES = { es: 'es_ES', en: 'en_GB', ca: 'ca_ES' };

/** Configuración de tiendas: URL pública o `null` (= «Próximamente»). */
export const STORES_FILE = join('web', '_content', 'stores.json');

/** Logos monocromos de cada tienda (Simple Icons, CC0), en el color del texto del botón. */
const STORE_LOGOS = {
  ios: 'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701',
  android:
    'M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z',
};

/** Botones de tienda: enlace si hay URL, aviso «Próximamente» si no. */
export function storeButtons(stores, labels) {
  return ['ios', 'android']
    .map((key) => {
      const url = stores[key];
      const name = escapeHtml(labels[key]);
      const logo = `<svg class="store-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="${STORE_LOGOS[key]}" /></svg>`;
      const text = (pre) => `<span class="store-text"><small>${escapeHtml(pre)}</small>${name}</span>`;
      if (url) {
        return `<a class="store" data-store="${key}" href="${escapeHtml(url)}">${logo}${text(labels[`${key}Pre`])}</a>`;
      }
      return `<span class="store is-soon" data-store="${key}">${logo}${text(labels.soon)}</span>`;
    })
    .join('');
}

/** Rellena `{{a.b}}` con `strings`; un marcador sin texto es un error, no un hueco en la web. */
export function fillTemplate(template, strings, lang) {
  const { prefix } = LANGS.find((l) => l.code === lang);
  const filled = template.replace(
    /\{\{([a-zA-Z0-9]+)\.([a-zA-Z0-9]+)\}\}/g,
    (whole, group, key) => {
      const value = strings[group]?.[key];
      if (typeof value !== 'string')
        throw new Error(`Falta ${group}.${key} en ${lang}/landing.json`);
      return value;
    }
  );
  return filled.replaceAll('{{base}}', prefix);
}

/** Cuerpo de la portada en un idioma. */
export function renderLanding(template, strings, stores, lang) {
  const withStores = template.replaceAll('{{stores}}', storeButtons(stores, strings.storeLabels));
  const html = fillTemplate(withStores, strings, lang);
  const left = /\{\{[^}]*\}\}/.exec(html);
  if (left) throw new Error(`Marcador sin resolver en la portada ${lang}: ${left[0]}`);
  return html;
}

/** Datos estructurados de la app (schema.org `MobileApplication`). */
function appJsonLd(strings, stores, lang) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    name: 'cofounder',
    operatingSystem: 'iOS, Android',
    applicationCategory: 'SocialNetworkingApplication',
    description: strings.meta.description,
    inLanguage: lang,
    url: `${SITE_URL}${pagePath(lang, '')}`,
    image: `${SITE_URL}/og.png`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  };
  const sameAs = [stores.ios, stores.android].filter(Boolean);
  if (sameAs.length > 0) data.sameAs = sameAs;
  // `<` escapado: el JSON va dentro de un <script> y no debe poder cerrarlo.
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Documento completo de la portada: cabecera, recorrido, pie y metadatos. */
export function landingPage({ lang, strings, body, stores, assetVersion = '' }) {
  // `?v=<hash>`: cada cambio de CSS/JS cambia la URL y el navegador no sirve el viejo de caché.
  const v = assetVersion ? `?v=${assetVersion}` : '';
  const { meta, footer } = strings;
  const url = `${SITE_URL}${pagePath(lang, '')}`;
  const alternates = LANGS.map(
    (l) =>
      `    <link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${pagePath(l.code, '')}" />`
  );
  alternates.push(
    `    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${pagePath('es', '')}" />`
  );
  const switcher = LANGS.map((l) => {
    const current = l.code === lang ? ' aria-current="page"' : '';
    return `<a href="${pagePath(l.code, '')}" hreflang="${l.code}" lang="${l.code}"${current}>${l.code.toUpperCase()}</a>`;
  }).join('');
  const footSwitcher = LANGS.map((l) => {
    const current = l.code === lang ? ' aria-current="page"' : '';
    return `<a href="${pagePath(l.code, '')}" hreflang="${l.code}" lang="${l.code}"${current}>${l.name}</a>`;
  }).join('');
  const labels = FOOTER_LABELS[lang];
  const link = (i) => `<a href="${pagePath(lang, FOOTER_DIRS[i])}">${labels[i]}</a>`;
  const smartBanner = stores.iosAppId
    ? `\n    <meta name="apple-itunes-app" content="app-id=${escapeHtml(String(stores.iosAppId))}" />`
    : '';
  const ogAlternates = LANGS.filter((l) => l.code !== lang)
    .map((l) => `    <meta property="og:locale:alternate" content="${OG_LOCALES[l.code]}" />`)
    .join('\n');
  return `<!doctype html>
<html lang="${lang}" class="no-js">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="theme-color" content="#000000" />
    <meta name="color-scheme" content="dark" />${smartBanner}
    <link rel="canonical" href="${url}" />
${alternates.join('\n')}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="cofounder" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_URL}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content="${meta.ogLocale}" />
${ogAlternates}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og.png" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href="/fonts/InstrumentSerif_400Regular.ttf" as="font" type="font/ttf" crossorigin />
    <link rel="stylesheet" href="/landing.css${v}" />
    <script>document.documentElement.classList.replace('no-js', 'js');</script>
    <script src="/landing.js${v}" defer></script>
    <script type="application/ld+json">${appJsonLd(strings, stores, lang)}</script>
  </head>
  <body class="landing">
    <a class="skip" href="#como-funciona">${escapeHtml(meta.skip)}</a>
    <header class="top">
      <a class="brand" href="${pagePath(lang, '')}" aria-label="cofounder"><svg aria-hidden="true"><use href="#i-mark" /></svg><span>cofounder</span></a>
      <nav class="top-nav" aria-label="${escapeHtml(meta.navLabel)}">
        <a href="#como-funciona">${escapeHtml(meta.navHow)}</a>
        <a href="#premium">${escapeHtml(meta.navPremium)}</a>
        <a href="#faq">${escapeHtml(meta.navFaq)}</a>
      </nav>
      <nav class="lang lang-pill" aria-label="Language">${switcher}</nav>
      <a class="top-cta" href="#top">${escapeHtml(meta.navDownload)}</a>
    </header>
    <main id="main">
${body}
    </main>
    <footer class="foot">
      <div class="foot-brand">
        <a class="brand" href="${pagePath(lang, '')}"><svg aria-hidden="true"><use href="#i-mark" /></svg><span>cofounder</span></a>
        <p>${escapeHtml(footer.tagline)}</p>
        <p class="age"><span class="age-badge">16+</span>${escapeHtml(footer.age)}</p>
      </div>
      <div class="foot-col">
        <p class="foot-h">${escapeHtml(footer.legal)}</p>
        ${link(0)}${link(1)}${link(2)}${link(3)}${link(6)}${link(7)}
        <a href="${refundsHref(lang)}">${escapeHtml(REFUNDS_LABEL[lang])}</a>
      </div>
      <div class="foot-col">
        <p class="foot-h">${escapeHtml(footer.help)}</p>
        ${link(4)}${link(5)}
        <a href="mailto:soporte@getcofounder.app">soporte@getcofounder.app</a>
      </div>
      <div class="foot-col">
        <p class="foot-h">${escapeHtml(footer.language)}</p>
        <nav class="lang" aria-label="Language">${footSwitcher}</nav>
      </div>
      <p class="foot-legal">${ADDRESS_LINE[lang]}</p>
    </footer>
  </body>
</html>
`;
}

/**
 * `/descargar/` (destino del QR): manda a la tienda del sistema. Sin URL de
 * tienda, o en escritorio, vuelve a la portada en el idioma del navegador. Sin
 * JS, enseña los enlaces que haya.
 */
export function downloadPage(stores) {
  const links = [
    stores.ios && `<a href="${escapeHtml(stores.ios)}">App Store</a>`,
    stores.android && `<a href="${escapeHtml(stores.android)}">Google Play</a>`,
  ].filter(Boolean);
  const config = JSON.stringify({ ios: stores.ios, android: stores.android }).replace(
    /</g,
    '\\u003c'
  );
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Descargar cofounder</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
    <script>
      (function () {
        var s = ${config};
        var ua = navigator.userAgent || '';
        var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
        var target = ios ? s.ios : /Android/.test(ua) ? s.android : null;
        if (!target) {
          var l = (navigator.language || 'es').slice(0, 2);
          target = l === 'en' ? '/en/' : l === 'ca' ? '/ca/' : '/';
        }
        location.replace(target);
      })();
    </script>
  </head>
  <body>
    <main>
      <h1>cofounder</h1>
      <p lang="es">${links.length ? 'Descarga la app:' : 'Muy pronto en App Store y Google Play.'}</p>
      <p lang="en">${links.length ? 'Get the app:' : 'Coming soon to the App Store and Google Play.'}</p>
      ${links.length ? `<p>${links.join(' · ')}</p>` : ''}
      <p><a href="/">getcofounder.app</a></p>
    </main>
  </body>
</html>
`;
}

/** Lee un fragmento de página propia: título (primer comentario) y cuerpo. */
export function parseFragment(raw, lang) {
  const match = /^<!--\s*title:\s*(.*?)\s*-->\r?\n/.exec(raw);
  if (!match) throw new Error('Fragmento sin <!-- title: … -->');
  const { prefix } = LANGS.find((l) => l.code === lang);
  const body = raw.slice(match[0].length).trimEnd().replaceAll('{{base}}', prefix);
  return { title: match[1], body };
}

async function main() {
  const out = join(root, '_site');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  // Solo los recursos estáticos: los fragmentos de `_content` se montan abajo.
  await cp(join(root, 'web'), out, {
    recursive: true,
    filter: (src) => !/[\\/]_content(?:[\\/]|$)/.test(src),
  });

  const write = async (lang, dir, title, body) => {
    const target = join(out, ...pagePath(lang, dir).split('/').filter(Boolean));
    await mkdir(target, { recursive: true });
    await writeFile(join(target, 'index.html'), page({ lang, title, body, dir }));
  };

  const stores = JSON.parse(await readFile(join(root, STORES_FILE), 'utf8'));
  const template = await readFile(join(root, 'web', '_content', 'landing.html'), 'utf8');
  const assetVersion = createHash('sha256')
    .update(await readFile(join(root, 'web', 'landing.css')))
    .update(await readFile(join(root, 'web', 'landing.js')))
    .digest('hex')
    .slice(0, 10);

  // /descargar/ (destino del QR): una sola página, sin idioma propio.
  await mkdir(join(out, 'descargar'), { recursive: true });
  await writeFile(join(out, 'descargar', 'index.html'), downloadPage(stores));

  for (const { code, legalDir } of LANGS) {
    const strings = JSON.parse(
      await readFile(join(root, 'web', '_content', code, 'landing.json'), 'utf8')
    );
    const landingDir = join(out, ...pagePath(code, '').split('/').filter(Boolean));
    await mkdir(landingDir, { recursive: true });
    await writeFile(
      join(landingDir, 'index.html'),
      landingPage({
        lang: code,
        strings,
        stores,
        assetVersion,
        body: renderLanding(template, strings, stores, code),
      })
    );

    for (const name of OWN_PAGES) {
      if (name === 'index') continue; // la portada sale de la plantilla de arriba
      const raw = await readFile(join(root, 'web', '_content', code, `${name}.html`), 'utf8');
      const { title, body } = parseFragment(raw, code);
      await write(code, ownDir(name), title, body);
    }
    for (const { source, dir, titles } of LEGAL_PAGES) {
      const markdown = await readFile(join(root, 'docs', 'tiendas', legalDir, source), 'utf8');
      const nif = applyNif(publishableBody(markdown), process.env.LEGAL_NIF);
      if (nif.missing) {
        console.warn(
          `AVISO ${code}/${source}: sin LEGAL_NIF; se publica sin la línea del NIF (ver docs/tiendas/aviso-legal.md)`
        );
      }
      const body = nif.markdown;
      for (const marker of pendingMarkers(body)) {
        console.warn(
          `AVISO ${code}/${source}: marcador pendiente en el texto publicable: ${marker}`
        );
      }
      await write(code, dir, titles[code], markdownToHtml(localizeSiteLinks(body, code)));
    }
  }
  console.log('Sitio generado en _site/');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
