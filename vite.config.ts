import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['pwa-48x48.png', 'pwa-64x64.png', 'pwa-128x128.png', 'pwa-180x180.png', 'pwa-192x192.png', 'pwa-256x256.png', 'pwa-512x512.png'],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
        manifest: {
          name: 'E-dit Professional',
          short_name: 'E-dit',
          description: 'A high-performance text formatting workspace for content creators',
          theme_color: '#0b0f1a',
          background_color: '#0b0f1a',
          display: 'standalone',
          start_url: './',
          scope: './',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-48x48.png',
              sizes: '48x48',
              type: 'image/png'
            },
            {
              src: 'pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png'
            },
            {
              src: 'pwa-128x128.png',
              sizes: '128x128',
              type: 'image/png'
            },
            {
              src: 'pwa-180x180.png',
              sizes: '180x180',
              type: 'image/png'
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-256x256.png',
              sizes: '256x256',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
