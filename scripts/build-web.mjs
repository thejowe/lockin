// Construye el sitio público (`_site/`) que sirve GitHub Pages.
//
// Las páginas estáticas viven en `web/`. Los documentos legales NO se duplican:
// se generan desde `docs/tiendas/*.md` (privacidad, términos, normas y
// seguridad infantil), que son la fuente de verdad, para que la web y el texto
// que revisan las tiendas —y que acepta la app— no diverjan.
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

/** Documentos legales: archivo fuente → carpeta publicada y título. */
export const LEGAL_PAGES = [
  { source: 'privacidad.md', dir: 'privacidad', title: 'Política de privacidad · cofounder' },
  { source: 'terminos.md', dir: 'terminos', title: 'Términos de uso · cofounder' },
  { source: 'normas.md', dir: 'normas', title: 'Normas de la comunidad · cofounder' },
  {
    source: 'seguridad-infantil.md',
    dir: 'seguridad-infantil',
    title: 'Estándares de seguridad infantil · cofounder',
  },
];

/**
 * Marcadores que todavía esperan una decisión del responsable (`[fecha de
 * publicación…]`, `[pendiente…]`, `[PROPUESTA…]`) en el texto publicable.
 */
export function pendingMarkers(markdown) {
  const pattern = /\[(?:fecha de publicaci[oó]n|pendiente|propuesta|proveedor)[^\]]*\]/gi;
  return [...markdown.matchAll(pattern)].map((match) => match[0]);
}

export const page = (title, body) => `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link rel="stylesheet" href="../style.css" />
  </head>
  <body>
    <header><a href="../">cofounder</a></header>
    <main>
${body}
    </main>
    <footer>
      <a href="../privacidad/">Privacidad</a> · <a href="../terminos/">Términos</a> ·
      <a href="../normas/">Normas</a> · <a href="../seguridad-infantil/">Seguridad infantil</a> ·
      <a href="../soporte/">Soporte</a> · <a href="../eliminar-cuenta/">Eliminar cuenta</a>
    </footer>
  </body>
</html>
`;

async function main() {
  const out = join(root, '_site');
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(join(root, 'web'), out, { recursive: true });

  for (const { source, dir, title } of LEGAL_PAGES) {
    const markdown = await readFile(join(root, 'docs', 'tiendas', source), 'utf8');
    const body = publishableBody(markdown);
    for (const marker of pendingMarkers(body)) {
      console.warn(`AVISO ${source}: marcador pendiente en el texto publicable: ${marker}`);
    }
    await mkdir(join(out, dir), { recursive: true });
    await writeFile(join(out, dir, 'index.html'), page(title, markdownToHtml(body)));
  }
  console.log('Sitio generado en _site/');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
