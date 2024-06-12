// import '../assets/app.css';
import App from './App.svelte';
import {
  setListener,
  sendSignal,
  recibeResponse,
  createMessage,
} from '../scripts/message-passing.js';
import type { EventHandlers } from '../scripts/message-passing.js';
import type { BackgroundToPopupEvents, ConnectionState } from '../background.js';

const app = new App({
  target: document.getElementById('app')!,
});

export default app;

const statusDisplay = <HTMLSpanElement>document.getElementById('status-display');
const urlInput = <HTMLInputElement>document.getElementById('server-url');
const connectionBtn = <HTMLButtonElement>document.getElementById('connection-btn');

statusDisplay.innerText = 'Processing...';

let connectionState: ConnectionState = {
  state: 'Disconnected',
  url: '',
};

export interface PopupToBackgroundEvents {
  'get-state': () => Promise<ConnectionState>;
}

const listeners: BackgroundToPopupEvents & EventHandlers = {
  'update-state': response => {
    console.log('update-state', response);
    connectionState.state = response.state;
    connectionState.url = response.url;
    updateStateDisplay();
  },
  test: (number: number) => {
    console.log('test on popup', number);
  },
};

setListener('popup', listeners);

function updateStateDisplay() {
  console.log('updateStateDisplay', connectionState);
  if (connectionState.state === 'Connected') {
    console.log('connected');
    connectionBtn.textContent = 'Disconnect';
    connectionBtn.classList.remove('active-btn');
    connectionBtn.classList.add('inactive-btn');

    urlInput.disabled = true;
  } else if (connectionState.state === 'Disconnected') {
    console.log('disconnected');
    connectionBtn.classList.remove('inactive-btn');
    connectionBtn.classList.add('active-btn');
    connectionBtn.textContent = 'Connect';

    urlInput.disabled = false;
  } else {
    console.log('unknown state', connectionState.state);
    return;
  }
  statusDisplay.innerText = connectionState.state;
  urlInput.value = connectionState.url;
}

(async function start() {
  await new Promise(async resolve => {
    const response: ConnectionState = await recibeResponse(
      createMessage('get-state'),
      'background'
    );

    connectionState.state = response.state;
    connectionState.url = response.url;
    resolve(null);
  });

  updateStateDisplay();

  connectionBtn.addEventListener('click', () => {
    statusDisplay.innerText = 'Loading...';

    if (connectionState.state === 'Connected') {
      sendSignal(createMessage('disconnect'), 'background');
      return;
    }
    if (connectionState.state === 'Disconnected') {
      sendSignal(createMessage('connect', urlInput.value), 'background');
      return;
    }
  });
})();
