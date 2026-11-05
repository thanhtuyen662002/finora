/**
 * Generates the PWA icon set from the brand mark.
 *
 * Source: public/brand/finora-icon.png (transparent, non-square)
 * Output: public/icons/*.png
 *
 * Run: node scripts/generate-pwa-icons.mjs
 * The generated files are committed; re-run only when the brand mark changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = 'public/brand/finora-icon.png';
const OUT_DIR = 'public/icons';

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/**
 * size: output square size
 * scale: share of the square the logo may occupy
 * background: canvas color
 */
const VARIANTS = [
  // "any" purpose: transparent, small margin.
  { file: 'icon-192.png', size: 192, scale: 0.84, background: TRANSPARENT },
  { file: 'icon-512.png', size: 512, scale: 0.84, background: TRANSPARENT },
  // "maskable": opaque, logo inside the 80% safe zone so launchers can crop to any shape.
  { file: 'maskable-192.png', size: 192, scale: 0.6, background: WHITE },
  { file: 'maskable-512.png', size: 512, scale: 0.6, background: WHITE },
  // iOS home screen ignores transparency (renders black), so use an opaque canvas.
  { file: 'apple-touch-icon.png', size: 180, scale: 0.72, background: WHITE },
  // Browser tab favicon.
  { file: 'favicon-32.png', size: 32, scale: 0.94, background: TRANSPARENT },
];

async function render({ file, size, scale, background }) {
  const box = Math.round(size * scale);
  const logo = await sharp(SOURCE)
    .resize(box, box, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, file));

  console.log(`wrote ${OUT_DIR}/${file} (${size}x${size})`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const variant of VARIANTS) {
  await render(variant);
}
