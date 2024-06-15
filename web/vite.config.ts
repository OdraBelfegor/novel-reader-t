import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// @ts-ignore
import vitePluginSocketIo from 'vite-plugin-socket-io';
import path from 'path';

import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@common/socket-events';

const socketEvents = (
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) => {
  console.log(`socket.io - connection: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`socket.io - disconnection: ${socket.id}`);
  });

  let content: string[] = [
    // {
    //   show: "Shizuka deflated again, she thought her mother really agreed. It doesn't seem to be that easy...",
    //   paragraph: 0,
    //   read: '',
    //   isGroup: false,
    // },
    // {
    //   show: 'Mrs. Hiratsuka rose from her seat, she stood in front of Eiji and said: "Don\'t be nervous. I just wanted to make sure... Aren\'t you guys really dating?".',
    //   paragraph: 1,
    //   read: '',
    //   isGroup: false,
    // },
  ];

  socket.on('player:read-this', (text: string[]) => {
    if (!text) return;

    console.log('read-this', text);

    content = text;
    socket.emit('view:load-content', content);
  });

  socket.on('player:play', () => {
    console.log('do play');
  });

  socket.on('player:stop', () => {
    console.log('stop');
  });

  socket.on('player:backward', () => {
    console.log('skip-backward');
  });

  socket.on('player:forward', () => {
    console.log('skip-forward');
  });

  socket.on('player:seek', (index: number): void => {
    console.log('skip-to', index);
  });

  socket.on('player:toggle-loop', () => {
    console.log('toggle-loop');
  });

  socket.on('player:set-loop-limit', (limit: number): void => {
    console.log('set-loop-limit', limit);
  });

  socket.on('player:remove-loop-limit', () => {
    console.log('remove-loop-limit');
  });

  socket.on('player:request-state', () => {
    socket.emit('view:update-state', {
      /** @type {'INACTIVE' | 'IDLE' | 'PAUSED' | 'PLAYING'} */
      state: 'INACTIVE',
      loop: false,
      loopActive: false,
      loopLimit: null,
    });
  });

  socket.on('player:request-load-content', () => {
    socket.emit('view:load-content', content);
  });
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    vitePluginSocketIo({ socketEvents }),
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
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@views': path.resolve(__dirname, './src/views'),
    },
  },
});
