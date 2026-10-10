import assert from 'node:assert/strict';
import { test } from 'node:test';

import { markdownToHtml, publishableBody } from './build-web.mjs';

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
