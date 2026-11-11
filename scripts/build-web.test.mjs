import assert from 'node:assert/strict';
import { test } from 'node:test';

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ADDRESS_LINE,
  LANGS,
  LEGAL_PAGES,
  REFUNDS_ANCHOR,
  applyNif,
  headingId,
  OWN_PAGES,
  SITE_URL,
  downloadPage,
  fillTemplate,
  localizeSiteLinks,
  markdownToHtml,
  page,
  pagePath,
  parseFragment,
  pendingMarkers,
  publishableBody,
  renderLanding,
  storeButtons,
} from './build-web.mjs';

const root = join(import.meta.dirname, '..');

test('quita el aviso editorial y la nota final', () => {
  const md = '> borrador\n\n# T\n\ntexto\n\n---\n\nNota editorial';
  const body = publishableBody(md);
  assert.ok(!body.includes('borrador'));
  assert.ok(!body.includes('Nota editorial'));
  assert.ok(body.includes('# T'));
});

test('convierte títulos, listas, negrita y enlaces', () => {
  const html = markdownToHtml('## A\n\n- uno **dos**\n- [x](https://e.com)\n\npárrafo `c`');
  assert.match(html, /<h2 id="a">A<\/h2>/);
  assert.match(html, /<ul>\n<li>uno <strong>dos<\/strong><\/li>/);
  assert.match(html, /<a href="https:\/\/e\.com">x<\/a>/);
  assert.match(html, /<p>párrafo <code>c<\/code><\/p>/);
});

test('escapa HTML del texto', () => {
  assert.match(markdownToHtml('a <script> b'), /&lt;script&gt;/);
});

test('no enlaza dos veces una URL ya enlazada', () => {
  const html = markdownToHtml('ver [web](https://e.com) y https://f.com.');
  assert.equal((html.match(/<a /g) ?? []).length, 2);
});

test('una URL con comillas no inyecta atributos', () => {
  const html = markdownToHtml("[x](https://e.com/(https://onmouseover='window.pwned=1'))");
  assert.ok(!/\sonmouseover=/.test(html));
  assert.ok(!html.includes('<a href="https://e.com/(<a'));
});

test('una continuación indentada y una línea en blanco siguen en la lista', () => {
  const html = markdownToHtml('- uno\n  sigue\n\n- dos\n\nfin');
  assert.equal((html.match(/<ul>/g) ?? []).length, 1);
  assert.match(html, /<li>uno sigue<\/li>/);
  assert.match(html, /<\/ul>\n<p>fin<\/p>/);
});

test('genera términos, normas y seguridad infantil además de la privacidad', () => {
  assert.deepEqual(
    LEGAL_PAGES.map((p) => p.dir),
    ['privacidad', 'terminos', 'normas', 'seguridad-infantil', 'cookies', 'aviso-legal']
  );
});

test('los títulos h2/h3 llevan un id estable sin el número de sección', () => {
  assert.equal(headingId('11. cofounder Premium'), 'cofounder-premium');
  assert.equal(headingId('2. Qué datos tratamos'), 'que-datos-tratamos');
  assert.equal(
    headingId('1. Qui és responsable de les teves dades'),
    'qui-es-responsable-de-les-teves-dades'
  );
  assert.match(markdownToHtml('# T\n\n## 3. Edad mínima'), /<h1>T<\/h1>\n<h2 id="edad-minima">/);
});

test('«Reembolsos» apunta a una sección que existe en los términos de cada idioma', async () => {
  for (const { code, legalDir } of LANGS) {
    const md = await readFile(join(root, 'docs', 'tiendas', legalDir, 'terminos.md'), 'utf8');
    const html = markdownToHtml(publishableBody(md));
    assert.ok(html.includes(`id="${REFUNDS_ANCHOR}"`), `términos ${code} sin #${REFUNDS_ANCHOR}`);
    assert.match(html, /reembols|refund|reemborsa/i, `términos ${code} sin reembolsos`);
    const footer = page({ lang: code, title: 't', body: '<p>x</p>' });
    assert.ok(footer.includes(`href="${pagePath(code, 'terminos')}#${REFUNDS_ANCHOR}"`), code);
  }
});

test('el NIF nunca se publica como marcador: con LEGAL_NIF se rellena, sin él se quita la línea', async () => {
  for (const { legalDir } of LANGS) {
    const md = await readFile(join(root, 'docs', 'tiendas', legalDir, 'aviso-legal.md'), 'utf8');
    const body = publishableBody(md);
    assert.match(body, /\[NIF[^\]]*\]/, `${legalDir}/aviso-legal sin hueco de NIF`);
    // Ningún NIF real en el repositorio: solo el hueco.
    assert.ok(!/\b\d{8}[A-Z]\b|\b[XYZ]\d{7}[A-Z]\b/.test(md), `${legalDir}/aviso-legal con un NIF`);

    const without = applyNif(body, undefined);
    assert.equal(without.missing, true);
    assert.ok(!/\[NIF/.test(without.markdown));
    assert.deepEqual(pendingMarkers(without.markdown), []);
    assert.match(without.markdown, /soporte@getcofounder\.app/);

    const filled = applyNif(body, ' 00000000T ');
    assert.equal(filled.missing, false);
    assert.ok(filled.markdown.includes('00000000T'));
    assert.ok(!/\[NIF/.test(filled.markdown));
  }
  assert.deepEqual(applyNif('sin hueco', undefined), { markdown: 'sin hueco', missing: false });
});

test('el pie lleva el domicilio completo y enlaza cookies y aviso legal', () => {
  for (const { code } of LANGS) {
    assert.match(ADDRESS_LINE[code], /carrer Nou, 37, 25153 Puigverd de Lleida \(Catal/);
    const html = page({ lang: code, title: 't', body: '<p>x</p>' });
    assert.ok(html.includes(ADDRESS_LINE[code]), code);
    for (const dir of ['cookies', 'aviso-legal']) {
      assert.ok(html.includes(`href="${pagePath(code, dir)}"`), `${code}/${dir}`);
    }
    assert.match(html, /<a class="skip" href="#main">/);
    assert.match(html, /<main id="main"/);
  }
});

test('cada documento legal existe, lleva versión y su fuente se publica sin nota', async () => {
  for (const { source } of LEGAL_PAGES) {
    const md = await readFile(join(root, 'docs', 'tiendas', source), 'utf8');
    assert.match(md, /\*\*Versi[oó]n:\*\* \d+\.\d+/, `${source} sin versión`);
    const html = markdownToHtml(publishableBody(md));
    assert.match(html, /<h1>/, `${source} sin título`);
    assert.ok(!html.includes('Nota editorial'), `${source} publica la nota editorial`);
  }
});

test('términos, normas y seguridad infantil cubren lo exigido', async () => {
  const read = (name) => readFile(join(root, 'docs', 'tiendas', name), 'utf8');
  const [terminos, normas, infantil] = await Promise.all([
    read('terminos.md'),
    read('normas.md'),
    read('seguridad-infantil.md'),
  ]);
  for (const md of [terminos, normas, infantil]) {
    assert.match(md, /tolerancia cero/i);
    assert.match(md, /16 años o más/);
    assert.match(md, /soporte@getcofounder\.app/);
  }
  assert.match(terminos, /no es una app de citas/i);
  assert.match(terminos, /bolsa de empleo/i);
  assert.match(terminos, /GitHub verificado/);
  assert.match(terminos, /No verifica quién eres/);
  assert.match(infantil, /CSAE/);
  assert.match(infantil, /autoridades competentes/);
});

test('detecta los marcadores pendientes del texto publicable', () => {
  const found = pendingMarkers(
    'a [fecha de publicación — x] b [PROPUESTA, pendiente: y] [enlace](https://e.com)'
  );
  assert.equal(found.length, 2);
});

test('el pie enlaza las cuatro páginas legales en cada idioma', () => {
  for (const { code } of LANGS) {
    const html = page({ lang: code, title: 't', body: '<p>x</p>' });
    for (const dir of ['privacidad', 'terminos', 'normas', 'seguridad-infantil']) {
      assert.ok(html.includes(`href="${pagePath(code, dir)}"`), `${code}/${dir}`);
    }
  }
});

test('las URL españolas siguen donde estaban y las otras cuelgan de /en y /ca', () => {
  assert.equal(pagePath('es', ''), '/');
  for (const dir of ['privacidad', 'terminos', 'normas', 'seguridad-infantil']) {
    assert.equal(pagePath('es', dir), `/${dir}/`);
    assert.equal(pagePath('en', dir), `/en/${dir}/`);
    assert.equal(pagePath('ca', dir), `/ca/${dir}/`);
  }
  assert.equal(pagePath('es', 'soporte'), '/soporte/');
  assert.equal(pagePath('es', 'eliminar-cuenta'), '/eliminar-cuenta/');
  assert.equal(pagePath('en', ''), '/en/');
  assert.equal(pagePath('ca', ''), '/ca/');
});

test('la página declara lang, canonical, hreflang y selector de idioma', () => {
  const html = page({ lang: 'ca', title: 't', body: '<p>x</p>', dir: 'soporte' });
  assert.match(html, /<html lang="ca">/);
  assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/ca/soporte/" />`));
  assert.ok(html.includes(`hreflang="es" href="${SITE_URL}/soporte/"`));
  assert.ok(html.includes(`hreflang="en" href="${SITE_URL}/en/soporte/"`));
  assert.ok(html.includes(`hreflang="ca" href="${SITE_URL}/ca/soporte/"`));
  assert.ok(html.includes(`hreflang="x-default" href="${SITE_URL}/soporte/"`));
  // El selector enlaza al mismo documento en los tres idiomas y marca el actual.
  assert.match(html, /<a href="\/soporte\/" hreflang="es" lang="es">Español<\/a>/);
  assert.match(html, /<a href="\/en\/soporte\/" hreflang="en" lang="en">English<\/a>/);
  assert.match(html, /<a href="\/ca\/soporte\/" hreflang="ca" lang="ca" aria-current="page">/);
});

test('un fragmento resuelve {{base}} al prefijo del idioma y exige título', () => {
  const raw = '<!-- title: T -->\n<a href="{{base}}/normas/">n</a>\n';
  assert.equal(parseFragment(raw, 'es').body, '<a href="/normas/">n</a>');
  assert.equal(parseFragment(raw, 'en').body, '<a href="/en/normas/">n</a>');
  assert.equal(parseFragment(raw, 'ca').title, 'T');
  assert.throws(() => parseFragment('<p>x</p>', 'es'));
});

test('los textos legales existen en los tres idiomas y llevan el contacto', async () => {
  for (const { legalDir } of LANGS) {
    for (const { source } of LEGAL_PAGES) {
      const md = await readFile(join(root, 'docs', 'tiendas', legalDir, source), 'utf8');
      assert.match(md, /soporte@getcofounder\.app/, `${legalDir}/${source}`);
    }
  }
});

test('las páginas propias existen en los tres idiomas con el mismo contacto', async () => {
  for (const { code } of LANGS) {
    for (const name of OWN_PAGES) {
      if (name === 'index') continue; // la portada sale de landing.html + landing.json
      const raw = await readFile(join(root, 'web', '_content', code, `${name}.html`), 'utf8');
      const { title, body } = parseFragment(raw, code);
      assert.ok(title.length > 0, `${code}/${name} sin título`);
      assert.match(body, /mailto:soporte@getcofounder\.app/, `${code}/${name}`);
    }
    const soporte = await readFile(join(root, 'web', '_content', code, 'soporte.html'), 'utf8');
    assert.match(soporte, /mailto:privacidad@getcofounder\.app/, `${code}/soporte`);
  }
});

async function htmlFiles(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await htmlFiles(full, found);
    else if (entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

test('el sitio generado tiene las rutas de cada idioma, lang correcto y sin enlaces rotos', async () => {
  await new Promise((resolve, reject) =>
    execFile(process.execPath, [join(root, 'scripts', 'build-web.mjs')], (error) =>
      error ? reject(error) : resolve()
    )
  );
  const site = join(root, '_site');
  const dirs = [
    ...OWN_PAGES.map((n) => (n === 'index' ? '' : n)),
    ...LEGAL_PAGES.map((p) => p.dir),
  ];
  const expected = new Set();
  for (const { code } of LANGS) {
    for (const dir of dirs) {
      const file = join(site, ...pagePath(code, dir).split('/').filter(Boolean), 'index.html');
      expected.add(file);
      assert.ok(existsSync(file), `falta ${code}/${dir}`);
      const html = await readFile(file, 'utf8');
      assert.match(html, new RegExp(`<html lang="${code}"[ >]`), `lang en ${code}/${dir}`);
      for (const l of LANGS) {
        assert.ok(
          html.includes(`hreflang="${l.code}" href="${SITE_URL}${pagePath(l.code, dir)}"`),
          `hreflang ${l.code} en ${code}/${dir}`
        );
      }
    }
  }
  // /descargar/ (destino del QR) es la única página fuera de los idiomas.
  expected.add(join(site, 'descargar', 'index.html'));
  // No sobra ni falta ninguna página.
  assert.deepEqual((await htmlFiles(site)).sort(), [...expected].sort());
  assert.ok(existsSync(join(site, 'style.css')));
  assert.ok(!existsSync(join(site, '_content')));

  // Cada enlace interno apunta a una página o archivo que existe, y cada
  // página enlaza solo a páginas de su mismo idioma (salvo el selector).
  for (const file of expected) {
    const html = await readFile(file, 'utf8');
    const lang = /<html lang="(\w+)"[ >]/.exec(html)[1];
    const prefix = LANGS.find((l) => l.code === lang).prefix;
    // La portada lleva dos selectores (cabecera y pie): fuera los dos.
    const body = html.replace(/<nav class="lang[ "][\s\S]*?<\/nav>/g, '');
    for (const [, rawHref] of body.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      // Sin ancla ni versión de caché (`/landing.css?v=…`): se comprueba el archivo.
      const href = rawHref.replace(/[?#].*$/, '');
      const target = join(site, ...href.split('/').filter(Boolean));
      assert.ok(
        existsSync(href.endsWith('/') ? join(target, 'index.html') : target),
        `enlace roto ${href} en ${file}`
      );
      if (href.endsWith('/') && href !== '/style.css') {
        const inLang =
          prefix === ''
            ? !href.startsWith('/en/') && !href.startsWith('/ca/')
            : href.startsWith(`${prefix}/`);
        assert.ok(inLang, `${href} sale del idioma ${lang} en ${file}`);
      }
    }
  }
});

test('los enlaces entre textos legales conservan el idioma de la página', () => {
  const md = `Ver [normas](${SITE_URL}/normas) y ${SITE_URL}/seguridad-infantil.`;
  assert.equal(localizeSiteLinks(md, 'es'), md);
  assert.equal(
    localizeSiteLinks(md, 'en'),
    `Ver [normas](${SITE_URL}/en/normas) y ${SITE_URL}/en/seguridad-infantil.`
  );
  assert.ok(localizeSiteLinks(md, 'ca').includes(`${SITE_URL}/ca/normas)`));
});

test('en el sitio generado no queda ningún enlace legal sin prefijo en en/ca', async () => {
  for (const code of ['en', 'ca']) {
    for (const { dir } of LEGAL_PAGES) {
      const html = await readFile(join(root, '_site', code, dir, 'index.html'), 'utf8');
      const main = html.slice(html.indexOf('<main>'), html.indexOf('</main>'));
      const unprefixed = new RegExp(
        `${SITE_URL.replace('.', '[.]')}/(privacidad|terminos|normas|seguridad-infantil|eliminar-cuenta|soporte)`
      );
      assert.doesNotMatch(main, unprefixed, `${code}/${dir}`);
    }
  }
});

const LABELS = {
  ios: 'App Store',
  android: 'Google Play',
  iosPre: 'Descárgalo en',
  androidPre: 'Disponible en',
  soon: 'Próximamente',
};

test('sin URL de tienda, el botón sale como «Próximamente» y no es un enlace', () => {
  const html = storeButtons({ ios: null, android: null }, LABELS);
  assert.equal((html.match(/is-soon/g) ?? []).length, 2);
  assert.ok(!html.includes('<a '));
  assert.match(html, /Próximamente/);
});

test('con URL de tienda, el botón enlaza a ella escapada', () => {
  const html = storeButtons({ ios: 'https://apps.apple.com/app/id1?x="1"', android: null }, LABELS);
  assert.match(
    html,
    /<a class="store" data-store="ios" href="https:\/\/apps\.apple\.com\/app\/id1\?x=&quot;1&quot;">/
  );
  assert.match(html, /data-store="android"[^>]*>.*Próximamente/);
});

test('un marcador sin texto rompe la build en vez de publicar un hueco', () => {
  assert.throws(() => fillTemplate('{{hero.title}}', { hero: {} }, 'es'), /hero\.title/);
  assert.equal(fillTemplate('{{a.b}} {{base}}/x/', { a: { b: 'B' } }, 'en'), 'B /en/x/');
});

test('la portada de cada idioma resuelve todos sus textos con la plantilla común', async () => {
  const template = await readFile(join(root, 'web', '_content', 'landing.html'), 'utf8');
  const stores = JSON.parse(await readFile(join(root, 'web', '_content', 'stores.json'), 'utf8'));
  const keys = (obj) =>
    Object.entries(obj)
      .flatMap(([g, v]) => Object.keys(v).map((k) => `${g}.${k}`))
      .sort();
  let reference;
  for (const { code } of LANGS) {
    const strings = JSON.parse(
      await readFile(join(root, 'web', '_content', code, 'landing.json'), 'utf8')
    );
    // Los tres idiomas tienen exactamente las mismas claves.
    reference ??= keys(strings);
    assert.deepEqual(keys(strings), reference, `claves de ${code}/landing.json`);
    const html = renderLanding(template, strings, stores, code);
    assert.ok(!/\{\{/.test(html), `marcador sin resolver en ${code}`);
    // Los textos del tour de botones son los de la app (buttons-tour.tsx).
    assert.ok(html.includes(strings.tour.superText));
  }
});

test('/descargar/ redirige por sistema y, sin tiendas, vuelve a la portada', () => {
  const none = downloadPage({ ios: null, android: null });
  assert.match(none, /location\.replace/);
  assert.match(none, /Muy pronto/);
  const both = downloadPage({ ios: 'https://a.example/ios', android: 'https://a.example/and' });
  assert.match(both, /href="https:\/\/a\.example\/ios"/);
  assert.match(both, /href="https:\/\/a\.example\/and"/);
});
