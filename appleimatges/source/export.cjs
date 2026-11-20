// Run with Playwright available on the local Node module path.
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const frames = ['discover', 'matches', 'chat', 'profile', 'prompt', 'groups', 'matched'];
const sizes = [
  { width: 440, height: 956, directory: '' },
  { width: 393, height: 852, directory: '1179x2556' },
];

async function exportScreenshots() {
  const requested = process.argv.slice(2);
  const unknown = requested.find((frame) => !frames.includes(frame));
  if (unknown) throw new Error('Unknown frame: ' + unknown);
  const browser = await chromium.launch({
    ...(process.platform === 'win32' && { channel: 'msedge' }),
    args: ['--allow-file-access-from-files', '--force-color-profile=srgb'],
  });
  try {
    for (const { width, height, directory } of sizes) {
      const dest = path.join(__dirname, '..', 'screenshots', directory);
      await fs.mkdir(dest, { recursive: true });
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 3 });
      for (const [index, frame] of frames.entries()) {
        if (requested.length && !requested.includes(frame)) continue;
        const url = pathToFileURL(path.join(__dirname, 'artwork.html'));
        url.searchParams.set('frame', frame);
        await page.goto(url.href);
        await page.evaluate(async (width) => {
          document.querySelector('main').style.transformOrigin = 'top left';
          document.querySelector('main').style.transform = 'scale(' + width / 440 + ')';
          await document.fonts.ready;
          const current = document.querySelector('article:not([hidden])');
          await Promise.all(Array.from(current.querySelectorAll('img'), (image) => image.decode()));
        }, width);
        const fileName = String(index + 1).padStart(2, '0') + '-' + frame + '.png';
        await page.screenshot({ path: path.join(dest, fileName) });
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

exportScreenshots().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
