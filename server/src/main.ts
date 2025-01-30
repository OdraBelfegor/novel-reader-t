import express, { Express, Request, Response } from 'express';
import proxy from 'express-http-proxy';
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'https';
import morgan from 'morgan';
import { Namespace, Server as IoServer } from 'socket.io';
import { readFileSync } from 'fs';
import path from 'path';

import type {
  ClientToServerEvents,
  ServerToClientEvents,
  ProviderClientToServerEvents,
  ProviderServerToClientEvents,
} from '@common/socket-events';
import { PlayerControl, PlayerUsers } from './player';
import { validateCerts } from './extras';

const PORT_MAIN: number = Number(process.env.PORT_SERVER) || 8000;
const PORT_PROVIDER: number = Number(process.env.PORT_PROVIDER) || 8001;
const TTS_PORT: number = Number(process.env.TTS_SERVER) || 8080;
const TTS_HOSTNAME: string = process.env.TTS_HOSTNAME || '127.0.0.1';
const TTS_URL: string = `http://${TTS_HOSTNAME}:${TTS_PORT}`;

const ioOptions = {
  cors: {
    origin: '*',
  },
};

const playerUsers = new PlayerUsers();
const playerControl = new PlayerControl(playerUsers, TTS_URL);

const startServers = serversGenerator(
  (app, socketServer) => {
    app.use(morgan('dev'));
    app.use(express.static(path.join(__dirname, '../public')));
    app.use(
      '/api',
      proxy(TTS_URL, {
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

    socketServer.on('connection', socket => {
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

      socket.on('request-provider', async ack => {
        ack(await playerControl.getContentFromProvider());
      });

      socket.on('audio:change-device', () => {
        console.log('Audio device changed: ', socket.id);
        playerUsers.prioritize(socket);
        // playerControl.backward();
      });

      socket.emit('view:update-state', playerControl.getConfig());
      socket.emit('view:load-content', playerControl.getClientContent());
      socket.emit('view:highlight-sentence', playerControl.getIndex());
    });

    playerUsers.setServer(socketServer);
  },
  (app, socketServer) => {
    socketServer.on('connection', socket => {
      playerControl.setProvider(socket);

      socket.emit('print', 'Hello World');
      socket.on('disconnect', () => {
        playerControl.removeProvider(socket);
      });
    });
  },
);

startServers();

type MainSocketServer = IoServer<ClientToServerEvents, ServerToClientEvents>;
type ProviderSocketServer = Namespace<ProviderClientToServerEvents, ProviderServerToClientEvents>;

type CustomHttpsServer = HttpsServer & {
  serverType: 'https';
};
type CustomHttpServer = HttpsServer & {
  serverType: 'http';
};

function serversGenerator(
  mainSetup: (server: Express, socketServer: MainSocketServer) => void,
  providerSetup: (server: Express, socketServer: ProviderSocketServer) => void,
): () => void {
  const credentials = validateCerts();

  let startServer: () => void;

  if (credentials.result === false) {
    const app = express();

    const server = createHttpServer(app) as CustomHttpServer;

    const io = new IoServer(server, ioOptions);

    mainSetup(app, io);
    providerSetup(app, io.of('/provider'));

    startServer = () => {
      server.listen(PORT_MAIN, () => {
        console.log(`HTTP Server started on port ${PORT_MAIN}`);
      });
    };
  } else {
    const appMain = express();
    const appProvider = express();

    const serverMain = createHttpsServer(
      {
        key: readFileSync(credentials.certs.key),
        cert: readFileSync(credentials.certs.cert),
      },
      appMain,
    ) as CustomHttpsServer;
    const serverProvider = createHttpServer(appProvider) as CustomHttpServer;

    const io = new IoServer(serverMain, ioOptions);

    const ioProvider = new IoServer(serverProvider, ioOptions);

    mainSetup(appMain, io);
    providerSetup(appProvider, ioProvider.of('/provider'));

    startServer = () => {
      serverMain.listen(PORT_MAIN, () => {
        console.log(`HTTPS Main server started on port ${PORT_MAIN}`);
      });
      serverProvider.listen(PORT_PROVIDER, () => {
        console.log(`HTTP Provider server started on port ${PORT_PROVIDER}`);
      });
    };
  }

  return startServer;
}
