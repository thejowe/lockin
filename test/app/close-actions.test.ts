import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Los textos de un Alert son datos, no acciones JSX. El único formulario con
// Cancelar pertenece a una pantalla completa con BackArrow propia.
function screens(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return screens(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

it('las pantallas usan el cierre accesible en lugar de botones de texto para salir', () => {
  const root = join(__dirname, '../../src');
  const violations = screens(root).flatMap((path) => {
    const name = relative(root, path).split(sep).join('/');
    if (name === 'features/profile/unblock-request-form.tsx') return [];
    const source = readFileSync(path, 'utf8');
    const oldButton = /(?:label=\{t\('|<ThemedText[^>]*>\s*\{t\(')(?:Cancelar|Cerrar|Ahora no)'\)/;
    return oldButton.test(source) ? [name] : [];
  });
  expect(violations).toEqual([]);
});
