import express, { Express, Request, Response } from 'express';
import proxy from 'express-http-proxy';
import { createServer } from 'http';
import morgan from 'morgan';
import { Namespace, Server } from 'socket.io';
import path from 'path';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ProviderClientToServerEvents,
  ProviderServerToClientEvents,
} from '@common/socket-events';
import { PlayerControl, PlayerUsers } from './player';

const PORT: number = Number(process.env.PORT_SERVER) || 8000;
const TTS_PORT: number = Number(process.env.TTS_SERVER) || 8080;

const app: Express = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
  },
});

app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));
app.use(
  '/api',
  proxy(`http://127.0.0.1:${TTS_PORT}`, {
    proxyErrorHandler: (err, res, next) => {
      switch (err && err.code) {
        case 'ECONNREFUSED': {
          console.log("\x1b[31;4mTTS Server isn't running\x1b[0m");
          return res.status(503).send('TTS Server is down');
        }
        default: {
          next(err);
        }
      }
    },
  }),
);

app.post('/tts-notice', (_req: Request, res: Response) => {
  console.log('TTS Notice, server is ready');
  res.sendStatus(200);
});

const mainServer: Server<ClientToServerEvents, ServerToClientEvents> = io;
const providerServer: Namespace<ProviderClientToServerEvents, ProviderServerToClientEvents> =
  io.of('/provider');

const playerUsers = new PlayerUsers(mainServer);
const playerControl = new PlayerControl(playerUsers, `http://127.0.0.1:${TTS_PORT}`);

mainServer.on('connection', socket => {
  playerUsers.add(socket);
  console.log(`User connected: ${socket.id}`, playerUsers.getIdList());

  socket.on('disconnect', () => {
    playerUsers.remove(socket);
    console.log(`User disconnected: ${socket.id}`, playerUsers.getIdList());
  });

  socket.on('player:read-this', (contentToRead: string[]) =>
    playerControl.readThis(contentToRead, socket),
  );

  socket.on('player:play', () => playerControl.play(socket));

  socket.on('player:backward', () => playerControl.backward());

  socket.on('player:forward', () => playerControl.forward());

  socket.on('player:stop', () => playerControl.stop());

  socket.on('player:seek', (index: number) => playerControl.seek(index));

  socket.on('player:toggle-loop', () => playerControl.toggleLoop());

  socket.on('player:set-loop-limit', chapters => playerControl.setLoopLimit(chapters));

  socket.on('player:remove-loop-limit', () => playerControl.removeLoopLimit());

  // socket.on('player:request-state', () =>
  //   socket.emit('view:update-state', playerControl.getConfig()),
  // );

  // socket.on('player:request-load-content', () =>
  //   socket.emit('view:load-content', playerControl.getClientContent()),
  // );

  socket.on('request-provider', async ack => {
    ack(await playerControl.getContentFromProvider());
  });

  socket.emit('view:update-state', playerControl.getConfig());
  socket.emit('view:load-content', playerControl.getClientContent());
  socket.emit('view:highlight-sentence', playerControl.getIndex());
});

providerServer.on('connection', socket => {
  playerControl.setProvider(socket);

  socket.emit('print', 'Hello World');
  socket.on('disconnect', () => {
    playerControl.removeProvider(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});
