// Genera una sola vez el QR de la landing (`web/img/qr-descargar.svg`).
//
// Apunta a `https://getcofounder.app/descargar/`, que redirige a la tienda
// según el sistema; como esa URL no cambia, el SVG tampoco. Se versiona el
// resultado y este script solo hace falta si un día cambia la URL.
// Usa `toqr`, que ya llega con Expo (no es una dependencia nueva).
//
// Uso: node scripts/make-qr.mjs
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toQR } from 'toqr';

export const QR_URL = 'https://getcofounder.app/descargar/';

/** SVG con margen de 4 módulos (zona de silencio), módulos oscuros sobre claro. */
export function qrSvg(content) {
  const modules = toQR(content);
  const size = Math.sqrt(modules.length);
  const quiet = 4;
  const total = size + quiet * 2;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y * size + x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" rx="3" fill="#F5F5F7"/><path d="${d}" fill="#000"/></svg>\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  await writeFile(join(root, 'web', 'img', 'qr-descargar.svg'), qrSvg(QR_URL));
  console.log('QR escrito en web/img/qr-descargar.svg');
}
