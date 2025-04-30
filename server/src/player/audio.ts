import type { PlayerSocket, PlayerUsers } from '.';
import { AlertType, EndType } from '@common/types';
import { waitEventOrDisconnect } from '../extras';
import { randomBytes } from 'crypto';

export type ReasonAudioEnd = 'ended' | 'stopped' | 'disconnected' | 'no-connection';

export class Audio {
  public buffer?: ArrayBuffer;
  hash?: string;
  private _end: (reason: ReasonAudioEnd) => void;

  static playerSocket?: PlayerSocket;
  static playerUsers?: PlayerUsers;
  static audioList: Map<string, Audio> = new Map();

  static currentAudio?: {
    status: Promise<ReasonAudioEnd>;
    audio: Audio;
    socketid: string;
  };

  async play(): Promise<ReasonAudioEnd> {
    if (!Audio.playerUsers) throw new Error('No player users');

    // Stop audio if it's already playing
    if (Audio.currentAudio) {
      await Promise.allSettled([Audio.currentAudio.audio.stop(), Audio.currentAudio.status]);
    }

    if (!this.buffer) throw new Error('No audio buffer');

    if (!this.hash) this.hash = randomBytes(16).toString('hex');

    const playerSocket = Audio.playerUsers.getUserByIndex(0);
    if (!playerSocket) return 'no-connection';

    try {
      await playerSocket.timeout(20000).emitWithAck('audio:play', this.hash, this.buffer);
    } catch (error) {
      return 'no-connection';
    }

    Audio.currentAudio = {
      audio: this,
      status: new Promise(resolve => {
        this._end = resolve;
      }),
      socketid: playerSocket.id,
    }

    return Audio.currentAudio.status;
  }

  async stop() {
    if (!Audio.currentAudio || !Audio.playerUsers || !this.hash) return;
    const socket = Audio.playerUsers.getUserById(Audio.currentAudio.socketid);
    if (!socket) return;
    try {
      await socket.timeout(20000).emitWithAck('audio:stop', this.hash);
    } catch (error) {
      console.log(['Error stopping audio:'], error);
    }
  }

  get end() {
    return this._end;
  }

  static async audioEnded(hash: string, reason: EndType) {
    const currentAudio = Audio.currentAudio;
    if (!currentAudio) return;
    if (currentAudio.audio.hash !== hash) return;
    currentAudio.audio.end(reason);
  }

  static async userDisconnected(id: string) {
    const currentAudio = Audio.currentAudio;
    if (!currentAudio) return;
    if (currentAudio.socketid !== id) return;
    currentAudio.audio.end('disconnected');
  }

  static async alert(name: AlertType): Promise<void> {
    let audioSocket = Audio.playerUsers?.getUserByIndex(0);
    if (!audioSocket) return;

    console.log(['Play alert:'], name);

    try {
      await audioSocket.timeout(20000).emitWithAck('alert:play', name);
      console.log(['Alert played']);
    } catch (error) {
      console.log(['Error playing alert:'], error);
    }
  }

  static async stopCurrent() {
    const currentAudio = Audio.currentAudio;
    if (!currentAudio) return;
    currentAudio.audio.stop();
    await currentAudio.status
  }
}

