import type { PlayerSocket, PlayerUsers } from '.';
import { AlertType, EndType } from '@common/types';

export type ReasonAudioEnd = 'ended' | 'stopped' | 'disconnected' | 'no-connection';

export class PlayerAudioControl {
  state: 'IDLE' | 'PLAYING';
  users: PlayerUsers;
  audioSocket?: PlayerSocket;
  constructor(users: PlayerUsers) {
    this.state = 'IDLE';
    this.users = users;
  }

  async play(
    audio: ArrayBuffer,
    onEvent: (event: { type: ReasonAudioEnd }) => void,
  ): Promise<void> {
    if (this.state === 'PLAYING') {
      console.log('Already playing, stopping first');
      await this.stop();
    }

    const audioSocket = this.users.getUserByIndex(0);

    if (!audioSocket) {
      onEvent({ type: 'no-connection' });
      return;
    }

    this.state = 'PLAYING';
    // if(this.audioSocket !== audioSocket){}

    try {
      // * Timeout can be affected by network latency
      await audioSocket.timeout(20000).emitWithAck('audio:play', audio);
    } catch (error) {
      onEvent({ type: 'no-connection' });
      return;
    }

    this.audioSocket = audioSocket;

    const handleAudioEnd = (type: 'ended' | 'stopped') => {
      this.audioSocket = undefined;
      this.state = 'IDLE';
      onEvent({ type });
      removeHandlers();
    };

    const handleDisconnection = () => {
      this.audioSocket = undefined;
      this.state = 'IDLE';
      onEvent({ type: 'disconnected' });
      removeHandlers();
    };

    const removeHandlers = () => {
      audioSocket.off('audio:ended', handleAudioEnd);
      audioSocket.off('disconnect', handleDisconnection);
    };

    audioSocket.on('audio:ended', handleAudioEnd);
    audioSocket.on('disconnect', handleDisconnection);
  }

  async asynchronousPlay(audio: ArrayBuffer): Promise<ReasonAudioEnd> {
    if (this.state === 'PLAYING') {
      console.log('Already playing, stopping first');
      await this.stop();
    }

    const audioSocket = this.users.getUserByIndex(0);

    if (!audioSocket) return 'no-connection';

    this.state = 'PLAYING';

    try {
      await audioSocket.timeout(20000).emitWithAck('audio:play', audio);
    } catch (error) {
      return 'no-connection';
    }
    this.audioSocket = audioSocket;

    return new Promise(resolve => {
      const handleAudioEnd = (type: 'ended' | 'stopped') => {
        cleanup();
        resolve(type);
      };
      const handleDisconnection = () => {
        cleanup();
        resolve('disconnected');
      };

      const cleanup = () => {
        this.audioSocket = undefined;
        this.state = 'IDLE';
        audioSocket.off('audio:ended', handleAudioEnd);
        audioSocket.off('disconnect', handleDisconnection);
      };

      audioSocket.on('audio:ended', handleAudioEnd);
      audioSocket.on('disconnect', handleDisconnection);
    });
  }

  async stop(): Promise<void> {
    if (this.state === 'IDLE' || this.audioSocket === undefined) {
      console.log(['No audio socket or in idle state']);
      return;
    }
    await this.audioSocket.timeout(20000).emitWithAck('audio:stop');
  }

  async alert(name: AlertType): Promise<void> {
    let audioSocket: PlayerSocket | undefined;

    if (!this.audioSocket) audioSocket = this.users.getUserByIndex(0);
    else audioSocket = this.audioSocket;

    if (!audioSocket) return;

    console.log('Play alert:', name);

    try {
      await audioSocket.timeout(20000).emitWithAck('alert:play', name);
      console.log('Alert played');
    } catch (error) {
      console.log('Error playing alert:', error);
    }
  }
}
