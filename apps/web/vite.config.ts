import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Osnovna putanja. Za GitHub Pages je `/Titlo/` (postavlja workflow), a za
 * lokalni razvoj i Capacitor aplikaciju ostaje `/`.
 */
const base = process.env.TITLO_BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Titlo — animirani titlovi',
        short_name: 'Titlo',
        description:
          'Animirani titlovi riječ po riječ i filteri za kratke videe. Sve ostaje na uređaju.',
        theme_color: '#101012',
        background_color: '#101012',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'bs',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,png,svg}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            // ONNX runtime za Whisper (.wasm i .mjs) s CDN-a. Bez roka trajanja:
            // URL sadrži verziju, pa nova verzija runtimea dobija novi unos.
            urlPattern: /\/onnxruntime-web@[^/]+\/dist\/.+\.(wasm|mjs)(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'titlo-onnx-runtime',
              expiration: { maxEntries: 8 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
});
