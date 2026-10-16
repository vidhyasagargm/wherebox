// Renders the PWA icons from public/icon.svg. Run with: npm run icons
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'

const out = (f) => new URL(`../public/${f}`, import.meta.url)
const green = '#1F6B45'
const mark = '<path d="M10 17h16v9a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M15 21.5h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M18 14.5s-3.5-3-3.5-5.6a3.5 3.5 0 0 1 7 0c0 2.6-3.5 5.6-3.5 5.6z" fill="#fff"/><circle cx="18" cy="8.9" r="1.3" fill="#1F6B45"/>'

// Full-bleed square for iOS and maskable icons; the OS applies its own rounding.
const square = (scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><rect width="36" height="36" fill="${green}"/><g transform="translate(18 18.5) scale(${scale}) translate(-18 -18.5)">${mark}</g></svg>`
const rounded = readFileSync(out('icon.svg'))
const glyph = (paths) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="12" fill="${green}"/><g transform="translate(5 5) scale(0.583)" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>`

const png = (svg, size, file) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(out(file).pathname)

await Promise.all([
  png(rounded, 64, 'pwa-64x64.png'),
  png(rounded, 192, 'pwa-192x192.png'),
  png(rounded, 512, 'pwa-512x512.png'),
  png(square(0.78), 512, 'maskable-icon-512x512.png'),
  png(square(0.9), 180, 'apple-touch-icon-180x180.png'),
  png(glyph('<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'), 96, 'shortcut-speak.png'),
  png(glyph('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'), 96, 'shortcut-places.png'),
])
// A 48px PNG works as favicon.ico in every current browser.
writeFileSync(out('favicon.ico').pathname, await sharp(rounded, { density: 600 }).resize(48, 48).png().toBuffer())
console.log('icons written')
