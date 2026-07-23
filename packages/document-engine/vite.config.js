import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.js',
      name: 'DocumentEngine',
      fileName: 'document-engine',
    },
    rollupOptions: {
      external: ['ajv'],
      output: {
        globals: {
          ajv: 'Ajv',
        },
      },
    },
  },
});
