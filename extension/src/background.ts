import io, { type Socket } from 'socket.io-client';
import type {
  ProviderServerToClientEvents,
  ProviderClientToServerEvents,
} from '@common/socket-events';

let socket: Socket<ProviderServerToClientEvents, ProviderClientToServerEvents> | undefined;

const contents = [
  [
    'Walking up to the door, I open it to reveal Ai, her entrancing purple eyes peeking over her sunglasses.',
    '"Hey, Cassius! It\'s karaoke time!".',
    "\"Haa, you do realize that you didn't tell me anything about this like you said you would? You're lucky I wasn't heading out tonight, you would've been left alone in front of my door.\".",
    '"Oh, I did, didn\'t I? Whoopsie~".',
    '"Whatever. Come on in, the furniture got here this morning, so you have a place to sit now.".',
  ],
  [
    'He had much to do today, and he might as well try his best at multitasking;',
    'he was trying to play the role of a woman.',
    'That little joke made him slightly giggle.',
    '*beep beep beep.*.',
    '"what the?" Alex exclaimed in surprise as his computer acted up in a way it hadn\'t done before.',
    "It wasn't any of the alerts he might have expected to come from time to time.",
    'Or any of the ones he feared to ever hear.',
  ],
];

let index = 0;

function connectTo(url: string) {
  if (socket && socket.connected) {
    console.log('Already connected');
    return;
  }

  socket = io(`${url}/provider`, {
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
  });

  socket.connect();

  socket.on('connect', () => {
    console.log(`Connected to: ${url}`);
  });

  socket.on('print', (message: string) => {
    console.log(`Server print: ${message}`);
  });

  socket.on('get-content', (mod, ack) => {
    console.log('Ordered to get content with mod:', mod);
    index = index + mod;
    ack(contents[index]);
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected from: ${url}`);
    socket = undefined;
  });
}

function disconnect() {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  socket = undefined;
}

setTimeout(() => {
  connectTo('http://localhost:8080');
}, 5000);
