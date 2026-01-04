import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

const svgBuffer = readFileSync(join(publicDir, 'icon.svg'));

// Generate 192x192
await sharp(svgBuffer)
  .resize(192, 192)
  .png()
  .toFile(join(publicDir, 'pwa-192x192.png'));

console.log('✅ Created pwa-192x192.png');

// Generate 512x512
await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile(join(publicDir, 'pwa-512x512.png'));

console.log('✅ Created pwa-512x512.png');

// Generate favicon
await sharp(svgBuffer)
  .resize(32, 32)
  .png()
  .toFile(join(publicDir, 'favicon.png'));

console.log('✅ Created favicon.png');

console.log('\n🎉 All icons generated successfully!');

