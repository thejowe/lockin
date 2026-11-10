/**
 * Regenera las capturas del mini tutorial (`assets/images/tour/*.jpg`).
 *
 * Saca Descubrir, Grupos, Matches y Perfil de la app de verdad, en web y con el
 * mock, en los tres idiomas. Antes de lanzarlo hay que dejar el mock con perfil,
 * términos aceptados y matches con mensajes (parche temporal de
 * `src/data/mock/store.ts`, que NO se commitea) y arrancar el servidor de
 * desarrollo. Los pasos exactos, en `docs/plan/todo/tour.md`.
 *
 *   node scripts/tour-screens.mjs [http://localhost:8081]
 *
 * Necesita Playwright con Chromium y Python 3 con Pillow para recortar.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:8081';
const OUT = new URL('../assets/images/tour/', import.meta.url).pathname;
const RAW = mkdtempSync(join(tmpdir(), 'tour-'));

const LABELS = {
  es: { groups: 'Grupos', profile: 'Perfil' },
  en: { groups: 'Groups', profile: 'Profile' },
  ca: { groups: 'Grups', profile: 'Perfil' },
};

const browser = await chromium.launch();
for (const [locale, label] of Object.entries(LABELS)) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    timezoneId: 'Europe/Madrid',
  });
  await page.addInitScript((locale) => {
    // Sin las pistas de primera vez (mano de la tarjeta y botones del deck).
    localStorage.setItem('cofounder.hint.deck-buttons.seen.me', '1');
    localStorage.setItem('cofounder.hint.card-tap.seen.v2.me', '1');
    localStorage.setItem('cofounder.locale', locale);
  }, locale);
  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 240_000 });
  await page.waitForTimeout(7000);
  const shot = (name) => page.screenshot({ path: join(RAW, `${name}-${locale}.png`) });

  await shot('discover');
  await page.getByText(label.groups, { exact: true }).first().click();
  await page.waitForTimeout(3000);
  await shot('groups');
  await page.getByRole('tab', { name: 'Matches' }).first().click();
  await page.waitForTimeout(3000);
  await shot('matches');
  await page.getByRole('tab', { name: label.profile }).first().click();
  await page.waitForTimeout(3000);
  await shot('profile');
  await page.close();
}
await browser.close();

// La parte de arriba de cada pantalla (390 × 620 pt), a 600 px de ancho y en JPEG.
execFileSync('python3', [
  '-I',
  '-c',
  `
import glob, os, sys
from PIL import Image
raw, out = sys.argv[1], sys.argv[2]
for path in glob.glob(os.path.join(raw, '*.png')):
    name = os.path.splitext(os.path.basename(path))[0]
    im = Image.open(path).convert('RGB').crop((0, 0, 780, 1240)).resize((600, 954), Image.LANCZOS)
    im.save(os.path.join(out, name + '.jpg'), quality=82, optimize=True, progressive=True)
`,
  RAW,
  OUT,
]);
console.log(`Capturas en ${OUT}`);
