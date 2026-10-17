/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  // App unit tests only; the backend has its own runner (npm run test:backend).
  test: { include: ['src/**/*.test.ts'] },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'Wherebox',
        short_name: 'Wherebox',
        description: 'Remember where you put things. Say it or type it, ask later.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4F5F1',
        theme_color: '#1F6B45',
        categories: ['productivity', 'lifestyle', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the app icon on Android (or right-click on desktop) for these.
        shortcuts: [
          { name: 'Speak', short_name: 'Speak', description: 'Open straight into listening', url: '/#/listen', icons: [{ src: 'shortcut-speak.png', sizes: '96x96' }] },
          { name: 'Places', short_name: 'Places', url: '/#/places', icons: [{ src: 'shortcut-places.png', sizes: '96x96' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
