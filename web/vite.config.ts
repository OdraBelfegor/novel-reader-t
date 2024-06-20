import { PluginOption, defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
// @ts-ignore
import vitePluginSocketIo from 'vite-plugin-socket-io';
import path from 'path';

import type { Server, Socket } from 'socket.io';
import type { ServerToClientEvents, ClientToServerEvents } from '@common/socket-events';
import type { ContentClient } from '@common/types';

const socketEvents = (
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
) => {
  let content: ContentClient = [
    {
      id: 0,
      sentences: [
        {
          id: 0,
          paragraphId: 0,
          inParagraphId: 0,
          sentence:
            '"What is Project: X, sir?" A woman\'s voice! I have heard her voice once before... Ah! That day at the hospital...',
        },
      ],
    },
    {
      id: 1,
      sentences: [
        {
          id: 1,
          paragraphId: 1,
          inParagraphId: 0,
          sentence:
            '"Project: X is him," the older man pointed his finger at me. "Have you ever heard of a perfect human, Doc. Hazel?".',
        },
      ],
    },
    {
      id: 2,
      sentences: [
        {
          id: 2,
          paragraphId: 2,
          inParagraphId: 0,
          sentence: '"Perfect human... What does Subject 0x have to do with it?".',
        },
      ],
    },
  ];

  socket.on('player:read-this', (text: string[]) => {
    if (!text) return;

    console.log('read-this', text);

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
      loopCounter: null,
    });
  });

  socket.on('player:request-load-content', () => {
    socket.emit('view:load-content', content);
  });

  socket.on('player:request-provider', ack => {
    ack([
      '"Is that why you tried to get me fuck you?" I asked flatly.',
      '"Because, I smelled really good?" I said, mocking her. \'What the hell is she talking about? I used that cheap deo that Peter used to use.\'.',
    ]);
  });
};

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
      '@common': path.resolve(__dirname, '../common'),
    },
  },
});
