import './popup.css';
import App from './App.svelte';
import { createWatchCompilerHost } from 'typescript';

const app = new App({
  target: document.body,
});

chrome.runtime.getURL('popup.html');

export default app;
