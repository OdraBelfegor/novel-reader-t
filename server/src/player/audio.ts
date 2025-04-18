import type { PlayerSocket, PlayerUsers } from '.';
import { AlertType, EndType } from '@common/types';
import { waitEventOrDisconnect } from '../extras';
import { randomBytes } from 'crypto';

export type ReasonAudioEnd = 'ended' | 'stopped' | 'disconnected' | 'no-connection';

export class Audio {
  public buffer?: ArrayBuffer;
  hash?: string;
  playerSocket?: PlayerSocket;
  private _end: (reason: ReasonAudioEnd) => void;

  static playerUsers?: PlayerUsers;
  static audioList: Map<string, Audio> = new Map();

  async play(): Promise<ReasonAudioEnd> {
    if (!Audio.playerUsers) throw new Error('No player users');
    Audio.stopAll();
    if (!this.buffer) throw new Error('No audio buffer');
    if (!this.hash) this.hash = randomBytes(16).toString('hex');

    this.playerSocket = Audio.playerUsers.getUserByIndex(0);
    if (!this.playerSocket) return 'no-connection';

    try {
      await this.playerSocket.timeout(20000).emitWithAck('audio:play', this.hash, this.buffer);
    } catch (error) {
      return 'no-connection';
    }

    Audio.audioList.set(this.hash, this);

    return new Promise(resolve => {
      this._end = resolve;
    })
  }

  async stop() {
    if (!this.playerSocket) return;
    try {
      await this.playerSocket.timeout(20000).emitWithAck('audio:stop');
    } catch (error) {
      console.log(['Error stopping audio:'], error);
    }
  }

  get end() {
    return this._end;
  }

  static async audioEnded(id: string, reason: EndType) {
    if (!Audio.audioList.has(id)) return;

    const audio = Audio.audioList.get(id) as Audio;
    Audio.audioList.delete(id);
    audio.end(reason);
  }

  static async userDisconnected(id: string) {
    const audioList = Array.from(Audio.audioList.values());
    audioList.map(audio => audio.playerSocket?.id === id && audio.end('disconnected'));
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

  static async stopAll() {
    const audioList = Array.from(Audio.audioList.values());
    return audioList.map(audio => audio.stop());
  }
}

