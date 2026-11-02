// Los tests de `e2e/` fijan las etiquetas de los flujos contra el código de la app.
// Los textos van envueltos en `t('…')` (ver `src/i18n`), que aquí no aporta nada:
// se quita para seguir comprobando que el flujo y el producto dicen lo mismo.
const KEY = `'((?:[^'\\\\]|\\\\.)*)'`;

export function withoutTranslationCalls(source) {
  return source
    .replace(
      new RegExp(
        `get\\s+('?[\\w-]+'?)\\(\\)\\s*\\{\\s*return\\s+t\\(\\s*${KEY}\\s*\\);\\s*\\}`,
        'g'
      ),
      "$1: '$2'"
    )
    .replace(new RegExp(`=\\{tk?\\(\\s*${KEY}\\s*,?\\s*\\)\\}`, 'g'), '="$1"')
    .replace(new RegExp(`\\{tk?\\(\\s*${KEY}\\s*,?\\s*\\)\\}`, 'g'), '$1')
    .replace(new RegExp(`\\btk?\\(\\s*${KEY}\\s*,?\\s*\\)`, 'g'), "'$1'");
}
