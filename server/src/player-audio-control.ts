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
    if (this.state === 'PLAYING') await this.stop();

    const audioSocket = this.users.getUserByIndex(0);

    if (!audioSocket) {
      onEvent({ type: 'no-connection' });
      return;
    }

    this.state = 'PLAYING';
    this.audioSocket = audioSocket;

    try {
      // * Timeout can be affected by network latency
      await audioSocket.timeout(2000).emitWithAck('audio:play', audio);
    } catch (error) {
      onEvent({ type: 'no-connection' });
      return;
    }

    const handleAudioEnd = (type: 'ended' | 'stopped') => {
      onEvent({ type });
      removeHandlers();
      this.state = 'IDLE';
    };

    const handleDisconnection = () => {
      onEvent({ type: 'disconnected' });
      if (this.audioSocket === audioSocket) this.audioSocket = undefined;
      removeHandlers();
      this.state = 'IDLE';
    };

    const removeHandlers = () => {
      audioSocket.off('audio:ended', handleAudioEnd);
      audioSocket.off('disconnect', handleDisconnection);
    };

    audioSocket.on('audio:ended', handleAudioEnd);
    audioSocket.on('disconnect', handleDisconnection);
  }

  async stop(): Promise<void> {
    if (this.state === 'IDLE' || !this.audioSocket) return;
    await this.audioSocket.timeout(1000).emitWithAck('audio:stop');
  }

  async alert(name: AlertType): Promise<void> {
    if (!this.audioSocket) {
      const audioSocket = this.users.getUserByIndex(0);
      if (!audioSocket) return;
      this.audioSocket = audioSocket;
    }
    console.log('Play alert:', name);

    try {
      await this.audioSocket.timeout(5000).emitWithAck('alert:play', name);
      console.log('Alert played');
    } catch (error) {
      console.log('Error playing alert:', error);
    }
  }
}
