import type { ComponentEvents } from 'svelte';
import App from './App.svelte';
import {
  setListener,
  sendSignal,
  recibeResponse,
  createMessage,
} from '../scripts/message-passing.js';
import type { EventHandlers } from '../scripts/message-passing.js';
import type { BackgroundToPopupEvents, ConnectionState } from '../background.js';

let connectionState: ConnectionState = {
  state: 'Disconnected',
  url: '',
};
const listeners: BackgroundToPopupEvents & EventHandlers = {
  'update-state': response => {
    connectionState.state = response.state;
    connectionState.url = response.url;
    updateStateDisplay();
  },
  test: (number: number) => {
    console.log('test on popup', number);
  },
};

const app = new App({
  target: document.body,
});

setListener('popup', listeners);

export default app;

function updateStateDisplay() {
  console.log('updateStateDisplay', connectionState);
  app.$set({
    status: connectionState.state,
    serverUrl: connectionState.url,
  });
}

(async function start() {
  await new Promise(async resolve => {
    const response: ConnectionState = await recibeResponse(
      createMessage('get-state'),
      'background',
    );

    connectionState.state = response.state;
    connectionState.url = response.url;
    resolve(null);
  });

  updateStateDisplay();

  app.$on('button-click', (event: ComponentEvents<App>['button-click']) => {
    app.$set({ status: undefined });

    if (connectionState.state === 'Connected') {
      sendSignal(createMessage('disconnect'), 'background');
      return;
    }
    if (connectionState.state === 'Disconnected') {
      sendSignal(createMessage('connect', event.detail), 'background');
      return;
    }
  });
})();

export interface PopupToBackgroundEvents {
  'get-state': () => Promise<ConnectionState>;
}
