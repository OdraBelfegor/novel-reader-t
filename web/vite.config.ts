import { PluginOption, defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// @ts-ignore
import vitePluginSocketIo from 'vite-plugin-socket-io';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

import socketEvents from './socket.server';

export default defineConfig({
  plugins: [
    svelte(),
    // vitePluginSocketIo({ socketEvents }),
    {
      name: 'inject-script',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml(html, ctx) {
        return html.replace(
          '</head>',
          '  <script src="/socket.io/socket.io.js"></script>\n</head>',
        );
      },
    },
    VitePWA({
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'masked-icon-512x512.svg'],
      manifest: {
        name: 'Novel Reader Client',
        short_name: 'NovelReader',
        description: 'Client to read novels with local tts server and connect to other devices',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      registerType: 'autoUpdate',
      // devOptions: {
      //   enabled: true,
      // },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@views': path.resolve(__dirname, './src/views'),
      '@common': path.resolve(__dirname, '../common'),
    },
  },
});
