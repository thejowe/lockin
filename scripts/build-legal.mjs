// Copia los documentos legales dentro de la app (`src/features/legal/texts.generated.ts`).
//
// La app los enseña en una hoja propia, sin abrir el navegador. La fuente de
// verdad sigue siendo `docs/tiendas/*.md`, la misma de la web (`build-web.mjs`),
// y se empaqueta lo mismo que publica la web (`publishableBody`: sin las notas
// internas `>` ni lo que va tras `---`), como cadenas porque Metro no importa
// `.md`. `src/features/legal/legal.test.tsx` corre `--check` y falla si el
// generado se queda atrás.
//
// Uso: node scripts/build-legal.mjs          (escribe)
//      node scripts/build-legal.mjs --check  (sale con 1 si está desfasado)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { publishableBody } from './build-web.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'src/features/legal/texts.generated.ts');

/** Clave en la app → archivo fuente. Las claves son las de `LEGAL_URLS` más `childSafety`. */
export const LEGAL_SOURCES = {
  privacy: 'privacidad.md',
  terms: 'terminos.md',
  guidelines: 'normas.md',
  childSafety: 'seguridad-infantil.md',
};

const unixLines = (text) => text.split('\r\n').join('\n');

export async function renderLegalModule() {
  const entries = [];
  for (const [key, file] of Object.entries(LEGAL_SOURCES)) {
    const source = unixLines(await readFile(join(root, 'docs/tiendas', file), 'utf8'));
    const text = publishableBody(source).trim() + '\n';
    entries.push(`  ${key}: ${JSON.stringify(text)},`);
  }
  return [
    '// GENERADO por scripts/build-legal.mjs desde docs/tiendas/*.md. No editar a mano:',
    '// cambia el .md y vuelve a ejecutar `node scripts/build-legal.mjs`.',
    '',
    'export const LEGAL_TEXTS = {',
    ...entries,
    '} as const;',
    '',
  ].join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rendered = await renderLegalModule();
  if (process.argv.includes('--check')) {
    const current = unixLines(await readFile(target, 'utf8'));
    if (current !== rendered) {
      console.error('texts.generated.ts está desfasado: node scripts/build-legal.mjs');
      process.exit(1);
    }
  } else {
    await writeFile(target, rendered);
  }
}
