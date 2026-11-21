import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

const dismissLabels = new Set(['Cancelar', 'Cerrar', 'Ahora no', 'Mejor no', 'Dejarlo como está']);

function containsDismissLabel(node: ts.Node): boolean {
  if (ts.isStringLiteralLike(node) || ts.isJsxText(node))
    return dismissLabels.has(node.text.trim());
  // Los callbacks pueden abrir un Alert nativo con «Cancelar».
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return false;
  return ts.forEachChild(node, containsDismissLabel) === true;
}

function hasDismissButton(path: string) {
  const source = readFileSync(path, 'utf8');
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  function visit(node: ts.Node): boolean | undefined {
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'label') {
      return (node.initializer && containsDismissLabel(node.initializer)) || undefined;
    }
    if (
      ts.isJsxElement(node) &&
      /^(Text|ThemedText)$/.test(node.openingElement.tagName.getText(tree))
    ) {
      if (node.children.some(containsDismissLabel)) return true;
    }
    return ts.forEachChild(node, visit);
  }
  return visit(tree);
}

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
    return hasDismissButton(path) ? [name] : [];
  });
  expect(violations).toEqual([]);
});
