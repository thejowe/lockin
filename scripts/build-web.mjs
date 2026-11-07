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
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
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
];

/** Páginas propias: fragmentos `web/_content/<idioma>/<nombre>.html`. */
export const OWN_PAGES = ['index', 'soporte', 'eliminar-cuenta'];

/** Carpeta publicada de una página propia ('' para la portada). */
const ownDir = (name) => (name === 'index' ? '' : name);

const FOOTER_DIRS = [
  'privacidad',
  'terminos',
  'normas',
  'seguridad-infantil',
  'soporte',
  'eliminar-cuenta',
];
const FOOTER_LABELS = {
  es: ['Privacidad', 'Términos', 'Normas', 'Seguridad infantil', 'Soporte', 'Eliminar cuenta'],
  en: ['Privacy', 'Terms', 'Guidelines', 'Child safety', 'Support', 'Delete account'],
  ca: ['Privacitat', 'Termes', 'Normes', 'Seguretat infantil', 'Suport', 'Eliminar compte'],
};
const ADDRESS_LINE = {
  es: '© 2026 Joel de Torres Sainz de la Maza · carrer Nou, 37, 25153 Lleida (España)',
  en: '© 2026 Joel de Torres Sainz de la Maza · carrer Nou, 37, 25153 Lleida (Spain)',
  ca: '© 2026 Joel de Torres Sainz de la Maza · carrer Nou, 37, 25153 Lleida (Espanya)',
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
  ];
  const host = SITE_URL.replace(/[.]/g, '[.]');
  const re = new RegExp(host + '/(' + dirs.join('|') + ')(?![A-Za-z0-9_-])', 'g');
  return markdown.replace(re, `${SITE_URL}${prefix}/$1`);
}

export function pendingMarkers(markdown) {
  const pattern = /\[(?:fecha de publicaci[oó]n|pendiente|propuesta|proveedor)[^\]]*\]/gi;
  return [...markdown.matchAll(pattern)].map((match) => match[0]);
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
  const nav = FOOTER_DIRS.map((d, i) => `<a href="${pagePath(lang, d)}">${labels[i]}</a>`).join(
    ' · '
  );
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${SITE_URL}${pagePath(lang, dir)}" />
${alternates.join('\n')}
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <header>
      <nav class="lang" aria-label="Language">${switcher}</nav>
      <a href="${pagePath(lang, '')}">cofounder</a>
    </header>
    <main>
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

  for (const { code, legalDir } of LANGS) {
    for (const name of OWN_PAGES) {
      const raw = await readFile(join(root, 'web', '_content', code, `${name}.html`), 'utf8');
      const { title, body } = parseFragment(raw, code);
      await write(code, ownDir(name), title, body);
    }
    for (const { source, dir, titles } of LEGAL_PAGES) {
      const markdown = await readFile(join(root, 'docs', 'tiendas', legalDir, source), 'utf8');
      const body = publishableBody(markdown);
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
