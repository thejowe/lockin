/**
 * Captura las pantallas reales de la app para las imágenes de App Store.
 *
 * Saca la app de verdad en web, con el mock, en los tres idiomas y a @3x
 * (440 × 902 pt → 1320 × 2706 px: la pantalla de un iPhone de 6,9″ sin la barra
 * de estado, que pinta `compose.mjs`). Antes de lanzarlo hay que dejar el mock
 * con el parche de capturas y arrancar el servidor de desarrollo; los pasos, en
 * `store/app-store/README.md`.
 *
 *   node store/app-store/scripts/capture.mjs [http://localhost:8081]
 *
 * Escribe en `store/app-store/build/raw/<idioma>/<pantalla>.png` (no se versiona).
 */

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(`${ROOT}package.json`);
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:8081';
const RAW = fileURLToPath(new URL('../build/raw/', import.meta.url));

const LABELS = {
  es: { groups: 'Grupos', cofounder: 'Cofundador', pass: 'Pasar' },
  en: { groups: 'Groups', cofounder: 'Cofounder', pass: 'Pass' },
  ca: { groups: 'Grups', cofounder: 'Cofundador', pass: 'Passa' },
};

const browser = await chromium.launch();
for (const [locale, label] of Object.entries(LABELS)) {
  const out = `${RAW}${locale}/`;
  mkdirSync(out, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 440, height: 902 },
    deviceScaleFactor: 3,
    timezoneId: 'Europe/Madrid',
  });
  await page.addInitScript((locale) => {
    // Sin pistas de primera vez ni tutorial: la app como la usa alguien que ya ha entrado.
    localStorage.setItem('cofounder.hint.deck-buttons.seen.me', '1');
    localStorage.setItem('cofounder.hint.card-tap.seen.v2.me', '1');
    localStorage.setItem('cofounder.tour.seen.me', '1');
    localStorage.setItem('cofounder.locale', locale);
  }, locale);
  page.on('pageerror', (error) => console.warn(`[${locale}]`, error.message));
  const settle = (ms = 1800) => page.waitForTimeout(ms);
  const shot = async (name) => {
    await settle();
    await page.screenshot({ path: `${out}${name}.png` });
    console.log(locale, name);
  };
  const go = async (path) => {
    await page.evaluate((path) => {
      window.history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
  };

  await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 300_000 });
  await page.waitForTimeout(16_000); // intro animada + primer render del deck

  // 1. Deck: la primera tarjeta, a pantalla completa.
  await shot('deck');
  // 2. La misma tarjeta, en la página de su respuesta (toque en la mitad derecha).
  await page.mouse.click(380, 380);
  await settle(600);
  await page.mouse.click(380, 380);
  await shot('prompt');
  // 3. Grupos.
  await page.getByLabel(label.groups, { exact: true }).first().click();
  await shot('groups');
  // 4. Match: pasar la primera tarjeta y dar like a la siguiente (recíproca).
  await page.getByLabel(label.cofounder, { exact: true }).first().click();
  await settle();
  await page.getByLabel(label.pass, { exact: true }).first().click();
  await settle();
  await page.getByLabel('Like', { exact: true }).first().click();
  await shot('match');
  await page.goto(`${BASE}/matches`, { waitUntil: 'load' });
  await settle(9000);
  // 5. Lista de matches.
  await shot('matches');
  // 6. Chat sin mensajes: preguntas para romper el hielo.
  await page.getByText('Omar Chaib').first().click();
  await shot('icebreakers');
  // 7. Chat con conversación.
  await page.goBack();
  await settle();
  await page.getByText('Núria Bosch').first().click();
  await shot('chat');
  // 8. Perfil propio, en el sello de GitHub verificado.
  await go('/profile');
  await shot('profile-top');
  await page.locator('[aria-label^="GitHub"]').last().scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('[aria-label^="GitHub"]')].at(-1);
    el?.scrollIntoView({ block: 'center' });
  });
  await shot('profile');
  await page.close();
}
await browser.close();
console.log(`Capturas en ${RAW}`);
