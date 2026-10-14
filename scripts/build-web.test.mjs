import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  LEGAL_PAGES,
  markdownToHtml,
  page,
  pendingMarkers,
  publishableBody,
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
  assert.match(html, /<h2>A<\/h2>/);
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
    ['privacidad', 'terminos', 'normas', 'seguridad-infantil']
  );
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
    assert.match(md, /cofounder\.soporte@gmail\.com/);
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

test('el pie enlaza las cuatro páginas legales', () => {
  const html = page('t', '<p>x</p>');
  for (const dir of ['privacidad', 'terminos', 'normas', 'seguridad-infantil']) {
    assert.ok(html.includes(`../${dir}/`), dir);
  }
});
