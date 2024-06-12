import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  publicDir: '../public',
  envDir: '../',
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: '',
    rollupOptions: {
      input: {
        popup: './src/popup/index.html',
        background: './src/background.ts',
        content: './src/content.ts',
      },
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: '[name].js',
      },
    },
  },
});
