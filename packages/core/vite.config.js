import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.js',
      name: 'DrawView',
      fileName: 'draw-view',
    },
  },
});
