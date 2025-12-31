/**
 * Audio class - Represents an audio buffer that can be played
 * 
 * This is a simplified version that delegates playback to AudioManager.
 * Maintains backward compatibility with existing code while using the new architecture.
 */

import type { AlertType, EndType } from '@common/types';
import type { PlayerUsers } from './users';
import type { PlayerSocket } from './control';
import { AudioManager, getDefaultAudioManager, type AudioEndReason } from './audio-manager';

// Re-export for convenience
export type ReasonAudioEnd = AudioEndReason;

/**
 * Audio class represents an audio buffer that can be played.
 * Uses the AudioManager for actual playback coordination.
 */
export class Audio {
  public buffer?: ArrayBuffer;
  public hash?: string;

  // Static references for backwards compatibility during migration
  static playerSocket?: PlayerSocket;
  private static _playerUsers?: PlayerUsers;
  private static _manager: AudioManager | null = null;

  /**
   * Get or create the default audio manager
   */
  private static getManager(): AudioManager {
    if (!this._manager) {
      this._manager = getDefaultAudioManager();
    }
    return this._manager;
  }

  /**
   * Set player users on both static reference and manager
   */
  static get playerUsers(): PlayerUsers | undefined {
    return this._playerUsers;
  }

  static set playerUsers(users: PlayerUsers | undefined) {
    this._playerUsers = users;
    if (users) {
      this.getManager().setPlayerUsers(users);
    }
  }

  /**
   * Play this audio buffer
   */
  async play(): Promise<ReasonAudioEnd> {
    if (!this.buffer) {
      throw new Error('No audio buffer');
    }

    const manager = Audio.getManager();
    const result = await manager.play(this.buffer);

    if (!result.success) {
      // Map error to legacy reason
      const errorCode = result.error.code;
      if (errorCode === 'NO_AUDIO_CONNECTION') return 'no-connection';
      if (errorCode === 'SOCKET_DISCONNECTED') return 'disconnected';
      return 'no-connection';
    }

    return result.value.reason;
  }

  /**
   * Stop this audio if it's currently playing
   */
  async stop(): Promise<void> {
    const manager = Audio.getManager();
    await manager.stopCurrent();
  }

  // ==========================================================================
  // Static methods for backward compatibility
  // ==========================================================================

  /**
   * Handle audio ended event from client
   */
  static async audioEnded(hash: string, reason: EndType): Promise<void> {
    this.getManager().handleAudioEnded(hash, reason);
  }

  /**
   * Handle user disconnection
   */
  static async userDisconnected(id: string): Promise<void> {
    this.getManager().handleUserDisconnected(id);
  }

  /**
   * Play an alert sound
   */
  static async alert(name: AlertType): Promise<void> {
    const result = await this.getManager().playAlert(name);
    if (!result.success) {
      console.error('Failed to play alert:', result.error.message);
    }
  }

  /**
   * Stop currently playing audio
   */
  static async stopCurrent(): Promise<void> {
    await this.getManager().stopCurrent();
  }

  /**
   * Get the underlying AudioManager instance
   */
  static getAudioManager(): AudioManager {
    return this.getManager();
  }

  /**
   * Set a custom AudioManager instance
   */
  static setAudioManager(manager: AudioManager): void {
    this._manager = manager;
  }
}
