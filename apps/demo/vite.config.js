import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Dev server runs at '/', production build is served from '/draw/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/draw/' : '/',
  plugins: [vue()],
  server: {
    // Listen on all interfaces so a phone on the same Wi-Fi can load the demo
    // for on-device testing. Vite defaults to localhost, which is unreachable
    // from another device. Note this exposes the dev server to the local
    // network while it is running.
    host: true,
  },
}));
