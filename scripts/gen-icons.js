import sharp from 'sharp';
import fs from 'fs';

const svg = fs.readFileSync('public/pwa-icon.svg');

sharp(svg)
  .resize(192, 192)
  .png()
  .toFile('public/pwa-192x192.png')
  .then(() => console.log('192 created'))
  .catch(console.error);

sharp(svg)
  .resize(512, 512)
  .png()
  .toFile('public/pwa-512x512.png')
  .then(() => console.log('512 created'))
  .catch(console.error);
