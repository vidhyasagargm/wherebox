// Renders the PWA icons, and the Android and iOS app icons and splash screens, from
// public/icon.svg. Run with: npm run icons
import sharp from 'sharp'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

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

// --- Android and iOS apps (only when their projects exist) ---
const file = (f) => new URL(`../${f}`, import.meta.url).pathname
const paper = '#F4F5F1'
const toFile = (svg, size, f) => sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(file(f))

// Android adaptive icon layers are 108dp; the launcher shows the middle 72dp or less.
const layer = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 54 54"><g transform="translate(9 9.5)">${inner}</g></svg>`
// Themed icons (Android 13+) use only the shape, so the pin's hole is left out.
const monochrome = mark.replace(/<circle[^>]*\/>/, '')
// A splash is the icon in the middle of the app's background colour.
const splash = (w, h, icon) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${paper}"/><svg x="${(w - icon) / 2}" y="${(h - icon) / 2}" width="${icon}" height="${icon}" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="${green}"/>${mark}</svg></svg>`

const res = 'android/app/src/main/res'
if (existsSync(file(res))) {
  const dpi = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  await Promise.all(
    Object.entries(dpi).flatMap(([d, x]) => [
      png(square(0.9).replace('<rect ', '<rect rx="8" '), 48 * x, `../${res}/mipmap-${d}/ic_launcher.png`),
      png(square(0.9).replace('<rect ', '<rect rx="18" '), 48 * x, `../${res}/mipmap-${d}/ic_launcher_round.png`),
      png(layer(mark), 108 * x, `../${res}/mipmap-${d}/ic_launcher_foreground.png`),
      png(layer(monochrome), 108 * x, `../${res}/mipmap-${d}/ic_launcher_monochrome.png`),
    ]),
  )
  // Shortcut icons (Speak, Places) at 48dp on the densest screens.
  for (const name of ['speak', 'places']) await sharp(out(`shortcut-${name}.png`).pathname).resize(192, 192).toFile(file(`${res}/drawable-nodpi/shortcut_${name}.png`))
  // Splash screens for Android 11 and older, at the sizes Capacitor generated.
  for (const dir of readdirSync(file(res)).filter((d) => d.startsWith('drawable'))) {
    const f = `${res}/${dir}/splash.png`
    if (!existsSync(file(f))) continue
    const { width, height } = await sharp(file(f)).metadata()
    await sharp(Buffer.from(splash(width, height, Math.round(Math.min(width, height) * 0.28)))).png().toFile(file(f))
  }
}

const assets = 'ios/App/App/Assets.xcassets'
if (existsSync(file(assets))) {
  // iOS needs one 1024px icon without transparency; it rounds the corners itself.
  await sharp(Buffer.from(square(0.9)), { density: 1200 }).resize(1024, 1024).flatten({ background: green }).png().toFile(file(`${assets}/AppIcon.appiconset/AppIcon-512@2x.png`))
  for (const f of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
    await sharp(Buffer.from(splash(2732, 2732, 520))).png().toFile(file(`${assets}/Splash.imageset/${f}`))
}
console.log('icons written')
