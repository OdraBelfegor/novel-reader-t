import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  publicDir: '../public',
  envDir: '../',
  root: 'src',

  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
      // '$lib/*': './src/lib/*',
    },
  },
  build: {
    sourcemap: 'inline',
    outDir: '../dist',
    emptyOutDir: true,
    assetsDir: '',
    rollupOptions: {
      input: {
        popup: './src/popup.html',
        background: './src/background.ts',
        content: './src/content.ts',
      },
      output: {
        assetFileNames: 'assets/[name][extname]',
        chunkFileNames: 'assets/[name].js',
        entryFileNames: '[name].js',
      },
    },
    watch: {
      buildDelay: 1000,
      exclude: ['**/node_modules/**', '**/dist/**'],
      include: ['src/**/*', 'public/**/*'],
    },
  },
});
