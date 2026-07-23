import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: './src/index.js',
      name: 'DrawVue',
      fileName: 'draw-vue',
    },
    rollupOptions: {
      external: ['vue', '@adamlockhart/draw-view'],
      output: {
        globals: {
          vue: 'Vue',
          '@adamlockhart/draw-view': 'DrawView',
        },
      },
    },
  },
});
