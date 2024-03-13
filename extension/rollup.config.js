import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import css from 'rollup-plugin-import-css';
import sveltePreprocess from 'svelte-preprocess';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';

const production = !process.env.ROLLUP_WATCH;

const commonPlugins = [
  production && terser(),
  !production && livereload('dist'),
  typescript({
    sourceMap: false,
  }),
];

/** @type {import('rollup').RollupOptions[]} */
export default [
  {
    input: 'src/background.ts',
    output: {
      sourcemap: 'inline',
      format: 'esm',
      name: 'background',
      file: 'dist/background.js',
    },
    plugins: [
      ...commonPlugins,
      copy({
        targets: [{ src: 'public/*', dest: 'dist' }],
      }),
      resolve({
        browser: true,
      }),
      commonjs(),
    ],
    watch: {
      clearScreen: false,
    },
  },
  {
    input: 'src/popup/popup.ts',
    output: {
      sourcemap: 'inline',
      format: 'esm',
      name: 'popup',
      file: 'dist/popup/popup.js',
      assetFileNames: '[name][extname]',
    },
    plugins: [
      ...commonPlugins,
      css(),
      svelte({
        preprocess: sveltePreprocess({ sourceMap: !production }),
        compilerOptions: {
          dev: !production,
        },
      }),
      resolve({
        browser: true,
        dedupe: ['svelte'],
        exportConditions: ['svelte'],
      }),
      commonjs(),
    ],
    watch: {
      clearScreen: false,
    },
  },
];
