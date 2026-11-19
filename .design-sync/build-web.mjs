// Prebuild web del sistema «cristal» para design-sync.
//
// La app es Expo/React Native y no publica un dist/. Este script compila la
// superficie pública (.design-sync/ds-entry.ts) para navegador con
// react-native -> react-native-web y deja un paquete interno en
// .design-sync/.cache/web-pkg/ (dist/index.mjs + types/) que el converter
// consume con --entry como si fuera el dist de una librería.
//
// Uso (desde la raíz del repo): node .design-sync/build-web.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const require = createRequire(join(ROOT, '.ds-sync', 'package.json'));
const { build } = require('esbuild');

const PKG = resolve('.design-sync/.cache/web-pkg');
const TYPES = join(PKG, 'types');
rmSync(PKG, { recursive: true, force: true });
mkdirSync(join(PKG, 'dist'), { recursive: true });

// -- 1. bundle ESM para navegador -------------------------------------------
await build({
  entryPoints: [resolve('.design-sync/ds-entry.ts')],
  outfile: join(PKG, 'dist', 'index.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  tsconfig: resolve('tsconfig.json'),
  jsx: 'automatic',
  // React lo pone el converter (vendorizado una sola vez para todo el bundle).
  external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'],
  alias: { 'react-native': resolve('.design-sync/rn-web-shim.js') },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.json'],
  mainFields: ['browser', 'module', 'main'],
  loader: { '.js': 'jsx', '.png': 'dataurl', '.jpg': 'dataurl', '.ttf': 'dataurl', '.otf': 'dataurl' },
  define: {
    __DEV__: 'false',
    'process.env.NODE_ENV': '"production"',
    'process.env.EXPO_OS': '"web"',
    global: 'globalThis',
  },
  // Código de expo lee process.env.* en runtime (Metro lo inyecta; el navegador no).
  banner: { js: 'var process = globalThis.process ?? { env: {} };' },
  plugins: [
    {
      // Módulos solo-nativos que algunas libs web importan igualmente.
      name: 'rn-native-shims',
      setup(b) {
        // require('react') desde deps CommonJS: con React externo en un ESM
        // quedaría como __require() y rompe en el navegador. Se redirige a un
        // módulo ESM que reexporta el import externo (que el converter enlaza
        // con su React vendorizado).
        b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) =>
          a.kind === 'require-call' ? { path: a.path, namespace: 'react-req' } : undefined,
        );
        b.onLoad({ filter: /.*/, namespace: 'react-req' }, (a) => ({
          contents: `import * as M from ${JSON.stringify(a.path)};
export * from ${JSON.stringify(a.path)};
export default M;`,
          loader: 'js',
        }));
        // react-native-web inyecta <style id="react-native-stylesheet">; el render
        // check de design-sync toma [id^="r"] como raíz de preview y lo lee vacío.
        // Renombrar el id es inocuo (nadie más lo busca).
        b.onLoad({ filter: /react-native-web[\\/]dist[\\/]exports[\\/]StyleSheet[\\/]dom[\\/]index\.js$/ }, (a) => ({
          contents: readFileSync(a.path, 'utf8').replace(/react-native-stylesheet/g, 'ds-native-stylesheet'),
          loader: 'js',
          resolveDir: dirname(a.path),
        }));
        b.onResolve({ filter: /^@react-native\/assets-registry\/registry$/ }, (a) => ({ path: a.path, namespace: 'rn-shim' }));
        // expo-modules-core/build/ts-declarations/*: solo tipos compilados a JS.
        b.onLoad({ filter: /expo-modules-core[\\/]build[\\/]ts-declarations[\\/]global\.js$/ }, () => ({
          contents: 'export {};\n',
          loader: 'js',
        }));
        b.onLoad({ filter: /.*/, namespace: 'rn-shim' }, () => ({
          contents: 'export function getAssetByID() { return undefined; }\nexport function registerAsset() { return 0; }\n',
          loader: 'js',
        }));
      },
    },
  ],
  logLevel: 'warning',
});

// -- 2. tipos: tsc solo sobre el entry ----------------------------------------
const tsconfigDts = resolve('.design-sync/.cache/tsconfig.dts.json');
writeFileSync(
  tsconfigDts,
  JSON.stringify(
    {
      extends: relative(dirname(tsconfigDts), resolve('tsconfig.json')).replace(/\\/g, '/'),
      compilerOptions: {
        declaration: true,
        emitDeclarationOnly: true,
        noEmit: false,
        noEmitOnError: false,
        skipLibCheck: true,
        rootDir: relative(dirname(tsconfigDts), ROOT).replace(/\\/g, '/'),
        outDir: relative(dirname(tsconfigDts), TYPES).replace(/\\/g, '/'),
        types: ['expo/types'],
      },
      include: [],
      files: [relative(dirname(tsconfigDts), resolve('.design-sync/ds-entry.ts')).replace(/\\/g, '/')],
    },
    null,
    2,
  ),
);
try {
  execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', tsconfigDts], { stdio: 'pipe' });
} catch (e) {
  // Errores de tipos no bloquean: los .d.ts se emiten igual (noEmitOnError false).
  const out = String(e.stdout ?? '') + String(e.stderr ?? '');
  if (out.trim()) console.error('[tsc]\n' + out.split('\n').slice(0, 20).join('\n'));
}

// El entry emitido pasa a types/index.d.ts; los alias @/ se reescriben a rutas
// relativas para que ts-morph resuelva sin paths.
renameSync(join(TYPES, '.design-sync', 'ds-entry.d.ts'), join(TYPES, 'index.d.ts'));
rmSync(join(TYPES, '.design-sync'), { recursive: true, force: true });
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
for (const f of walk(TYPES).filter((p) => p.endsWith('.d.ts'))) {
  const txt = readFileSync(f, 'utf8').replace(/(['"])@\/([^'"]+)\1/g, (_, q, p) => {
    let rel = relative(dirname(f), join(TYPES, 'src', p)).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    return q + rel + q;
  });
  writeFileSync(f, txt);
}

// -- 3. tokens CSS generados desde los objetos reales de theme.ts ---------------
// Se importa el bundle recién hecho (no se copia ningún valor a mano), así que
// tokens/cristal.css nunca se desincroniza de src/constants/theme.ts.
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.cancelAnimationFrame ??= clearTimeout;
globalThis.require ??= createRequire(join(ROOT, 'package.json'));
const m = await import(pathToFileURL(join(PKG, 'dist', 'index.mjs')).href);
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const px = (n) => `${n}px`;
const lines = [];
const section = (title, entries) => {
  lines.push(`  /* ${title} */`);
  for (const [k, v] of entries) lines.push(`  --${k}: ${v};`);
};
section('Color (Colors.dark; la app es solo oscura)', Object.entries(m.Colors.dark).map(([k, v]) => [`color-${kebab(k)}`, v]));
section('Espaciado (Spacing, base 4)', Object.entries(m.Spacing).map(([k, v]) => [`space-${k}`, px(v)]));
section('Radios (Radii)', Object.entries(m.Radii).map(([k, v]) => [`radius-${k}`, px(v)]));
section('Trazo (Stroke)', Object.entries(m.Stroke).map(([k, v]) => [`stroke-${k}`, px(v)]));
section('Controles (Control)', Object.entries(m.Control).map(([k, v]) => [`control-${kebab(k)}`, px(v)]));
section('Opacidad (Opacity)', Object.entries(m.Opacity).map(([k, v]) => [`opacity-${k}`, String(v)]));
section('Elevación (Elevation.dark)', Object.entries(m.Elevation.dark).map(([k, v]) => [`shadow-${k}`, v]));
section('Desenfoque (BlurIntensity, escala expo-blur 0-100)', Object.entries(m.BlurIntensity).map(([k, v]) => [`blur-${k}`, String(v)]));
section('Duración (Duration)', Object.entries(m.Duration).map(([k, v]) => [`duration-${k}`, `${v}ms`]));
section('Curvas (Curves)', Object.entries(m.Curves).map(([k, v]) => [`ease-${kebab(k)}`, `cubic-bezier(${v.join(', ')})`]));
section('Varios', [
  ['stagger', `${m.Stagger}ms`],
  ['press-scale', String(m.PressScale)],
  ['max-content-width', px(m.MaxContentWidth)],
]);
const typo = [];
for (const [role, s] of Object.entries(m.Typography)) {
  section(`Tipografía: ${role}`, [
    [`type-${kebab(role)}-family`, `'${s.fontFamily}'`],
    [`type-${kebab(role)}-size`, px(s.fontSize)],
    [`type-${kebab(role)}-line-height`, px(s.lineHeight)],
    [`type-${kebab(role)}-tracking`, px(s.letterSpacing ?? 0)],
  ]);
  typo.push(
    `.type-${kebab(role)} { font-family: var(--type-${kebab(role)}-family); font-size: var(--type-${kebab(role)}-size); ` +
      `line-height: var(--type-${kebab(role)}-line-height); letter-spacing: var(--type-${kebab(role)}-tracking);` +
      (s.fontVariant?.includes('tabular-nums') ? ' font-variant-numeric: tabular-nums;' : '') +
      ' }',
  );
}
mkdirSync(join(PKG, 'tokens'), { recursive: true });
writeFileSync(
  join(PKG, 'tokens', 'cristal.css'),
  `/* Tokens del sistema «cristal», generados desde src/constants/theme.ts por .design-sync/build-web.mjs. No editar a mano. */\n` +
    `:root {\n${lines.join('\n')}\n}\n\n/* Roles tipográficos (Typography): clase por rol. */\n${typo.join('\n')}\n`,
);
// cfg.cssEntry apunta a dist/styles.css: global.css compilado + tokens, para
// que todo llegue a los diseños por el cierre de @import de styles.css.
writeFileSync(
  join(PKG, 'dist', 'styles.css'),
  readFileSync(join(PKG, 'dist', 'index.css'), 'utf8') + '\n' + readFileSync(join(PKG, 'tokens', 'cristal.css'), 'utf8'),
);

// -- 4. docs por componente: categoría del selector + JSDoc real del código ----
// Regenerados en cada build desde src/, así que no se desactualizan.
const GROUPS = {
  Superficies: { Glass: 'glass', Frosted: 'glass', AmbientBackground: 'ambient-background', Screen: 'ambient-background' },
  Acciones: { Button: 'button', GlassButton: 'glass-button', ScalePressable: 'scale-pressable', BackArrow: 'back-arrow' },
  Texto: { ThemedText: 'themed-text' },
  Marca: { Icon: 'icon', CofounderLogo: 'cofounder-logo', ThinkingLogo: 'cofounder-logo' },
  Estado: { LoadingState: 'state-view', MessageState: 'state-view', UnreadBadge: 'unread-badge' },
  Movimiento: { RevealStack: 'reveal-stack' },
};
const DOCS = join(PKG, 'docs');
mkdirSync(DOCS, { recursive: true });
for (const [group, comps] of Object.entries(GROUPS)) {
  for (const [name, file] of Object.entries(comps)) {
    const src = readFileSync(resolve('src/components', `${file}.tsx`), 'utf8');
    const rx = new RegExp(`/\\*\\*((?:(?!\\*/)[\\s\\S])*)\\*/\\s*export\\s+(?:default\\s+)?(?:function|const)\\s+${name}\\b`);
    // En este repo el JSDoc suele ir en la cabecera del archivo, no junto a la
    // función: el adyacente gana, la cabecera es el respaldo.
    const header = /^\s*\/\*\*((?:(?!\*\/)[\s\S])*)\*\//.exec(src)?.[1];
    const jsdoc = (rx.exec(src)?.[1] ?? header ?? '')
      .split('\n')
      .map((l) => l.replace(/^\s*\* ?/, ''))
      .join('\n')
      .trim();
    if (!jsdoc) console.error(`  (sin JSDoc: ${name})`);
    writeFileSync(join(DOCS, `${name}.md`), `---\ncategory: ${group}\n---\n\n# ${name}\n\n${jsdoc}\n`);
  }
}

writeFileSync(
  join(PKG, 'package.json'),
  JSON.stringify(
    { name: 'cofounder', version: '1.0.0', type: 'module', module: 'dist/index.mjs', main: 'dist/index.mjs', types: 'types/index.d.ts' },
    null,
    2,
  ),
);
console.error(`web-pkg listo: ${relative(ROOT, PKG)}`);
process.exit(0);
