import type { PlayerUsers, PlayerSocket } from './player';
import { AlertType, EndType } from '@common/types';

export default class PlayerAudioControl {
  state: 'IDLE' | 'PLAYING';
  users: PlayerUsers;
  audioSocket?: PlayerSocket;
  constructor(users: PlayerUsers) {
    this.state = 'IDLE';
    this.users = users;
  }

  async play(
    audio: ArrayBuffer,
    onEvent: (event: { type: 'ended' | 'stopped' | 'disconnected' | 'no-connection' }) => void,
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

  async stop(): Promise<void> {
    if (this.state === 'IDLE' || this.audioSocket === undefined) {
      console.log(['No audio socket or in idle state']);
      return;
    }
    await this.audioSocket.timeout(20000).emitWithAck('audio:stop');
  }

  async alert(name: AlertType): Promise<void> {
    if (!this.audioSocket) {
      const audioSocket = this.users.getUserByIndex(0);
      if (!audioSocket) return;
      this.audioSocket = audioSocket;
    }
    console.log('Play alert:', name);

    try {
      await this.audioSocket.timeout(20000).emitWithAck('alert:play', name);
      console.log('Alert played');
    } catch (error) {
      console.log('Error playing alert:', error);
    }
  }
}
