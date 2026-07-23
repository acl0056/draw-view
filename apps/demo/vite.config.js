import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Dev server runs at '/', production build is served from '/draw/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/draw/' : '/',
  plugins: [vue()],
}));
