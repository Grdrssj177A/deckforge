import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Content Security Policy de la app empaquetada.
 *
 * Se inyecta solo en build: el dev server de Vite necesita inyectar scripts y
 * estilos inline (HMR, react-refresh) que una política estricta bloquearía.
 *
 * - style-src permite 'unsafe-inline' porque la UI usa atributos style={{...}}.
 * - img-src permite data: por los iconos del pack y los subidos por el usuario.
 * - media-src permite file: porque el soundboard reproduce rutas locales.
 * - object-src/base-uri/form-action cerrados: la app no los usa.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "media-src 'self' data: file:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'deckforge-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: CSP,
            },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
});
