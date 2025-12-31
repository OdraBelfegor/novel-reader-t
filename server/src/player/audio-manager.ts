/**
 * AudioManager - Centralized audio state and playback management
 * Replaces the static state pattern from the old Audio class
 * Uses dependency injection and event-driven architecture
 */

import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import type { AlertType, EndType } from '@common/types';
import type { PlayerSocket } from './control';
import type { PlayerUsers } from './users';
import { AudioError, CancellationError, SocketError, type Result, ok, err } from './errors';
import { CancellationToken } from './cancellation';

export type AudioEndReason = 'ended' | 'stopped' | 'disconnected' | 'no-connection' | 'cancelled';

export interface AudioPlaybackResult {
    reason: AudioEndReason;
    hash: string;
}

interface AudioManagerEvents {
    'playback:started': [hash: string];
    'playback:ended': [result: AudioPlaybackResult];
    'error': [error: Error];
}

interface CurrentPlayback {
    hash: string;
    socketId: string;
    resolve: (reason: AudioEndReason) => void;
    cancellationToken: CancellationToken;
}

/**
 * AudioManager handles all audio playback state and coordination
 * - No static state - fully instance-based
 * - Proper cleanup and disposal
 * - Event-driven notifications
 */
export class AudioManager extends EventEmitter<AudioManagerEvents> {
    private _playerUsers: PlayerUsers | null = null;
    private _currentPlayback: CurrentPlayback | null = null;
    private _disposed = false;

    constructor() {
        super();
    }

    /**
     * Set the player users reference (dependency injection)
     */
    setPlayerUsers(users: PlayerUsers): void {
        this._playerUsers = users;
    }

    /**
     * Get the primary audio socket (first user in the list)
     */
    private getPrimarySocket(): PlayerSocket | undefined {
        return this._playerUsers?.getUserByIndex(0);
    }

    /**
     * Play audio buffer on the client
     */
    async play(
        buffer: ArrayBuffer,
        cancellationToken?: CancellationToken
    ): Promise<Result<AudioPlaybackResult>> {
        if (this._disposed) {
            return err(new AudioError('AudioManager is disposed', 'ALREADY_DISPOSED'));
        }

        if (!this._playerUsers) {
            return err(new AudioError('No player users configured', 'NO_AUDIO_CONNECTION'));
        }

        // Stop any currently playing audio
        if (this._currentPlayback) {
            await this.stopCurrent();
        }

        const socket = this.getPrimarySocket();
        if (!socket) {
            return err(new AudioError('No audio connection available', 'NO_AUDIO_CONNECTION'));
        }

        const hash = randomBytes(16).toString('hex');
        const token = cancellationToken ?? CancellationToken.create();

        // Check if already cancelled
        if (token.isCancelled) {
            return err(new CancellationError());
        }

        // Send audio to client
        try {
            await socket.timeout(20000).emitWithAck('audio:play', hash, buffer);
        } catch (error) {
            return err(new SocketError('Failed to send audio to client', socket.id));
        }

        // Create promise that resolves when audio ends
        const endPromise = new Promise<AudioEndReason>((resolve) => {
            this._currentPlayback = {
                hash,
                socketId: socket.id,
                resolve,
                cancellationToken: token,
            };

            // Handle cancellation
            token.onCancel(() => {
                if (this._currentPlayback?.hash === hash) {
                    this.stopCurrent().catch(console.error);
                }
            });
        });

        this.emit('playback:started', hash);

        const reason = await endPromise;

        return ok({ reason, hash });
    }

    /**
     * Stop the currently playing audio
     */
    async stopCurrent(): Promise<void> {
        const playback = this._currentPlayback;
        if (!playback) return;

        const socket = this._playerUsers?.getUserById(playback.socketId);

        if (socket) {
            try {
                await socket.timeout(20000).emitWithAck('audio:stop', playback.hash);
            } catch (error) {
                console.error('Error stopping audio:', error);
                // Still resolve the playback even if stop fails
                playback.resolve('stopped');
            }
        } else {
            // Socket disconnected, just resolve
            playback.resolve('disconnected');
        }

        this._currentPlayback = null;
    }

    /**
     * Handle audio ended event from client
     */
    handleAudioEnded(hash: string, reason: EndType): void {
        const playback = this._currentPlayback;
        if (!playback || playback.hash !== hash) return;

        const endReason: AudioEndReason = reason;
        playback.resolve(endReason);
        this._currentPlayback = null;

        this.emit('playback:ended', { reason: endReason, hash });
    }

    /**
     * Handle user disconnection
     */
    handleUserDisconnected(socketId: string): void {
        const playback = this._currentPlayback;
        if (!playback || playback.socketId !== socketId) return;

        playback.resolve('disconnected');
        this._currentPlayback = null;

        this.emit('playback:ended', { reason: 'disconnected', hash: playback.hash });
    }

    /**
     * Play an alert sound
     */
    async playAlert(name: AlertType): Promise<Result<void>> {
        if (this._disposed) {
            return err(new AudioError('AudioManager is disposed', 'ALREADY_DISPOSED'));
        }

        const socket = this.getPrimarySocket();
        if (!socket) {
            return err(new AudioError('No audio connection available', 'NO_AUDIO_CONNECTION'));
        }

        console.log(['Play alert:'], name);

        try {
            await socket.timeout(20000).emitWithAck('alert:play', name);
            console.log(['Alert played']);
            return ok(undefined);
        } catch (error) {
            console.error(['Error playing alert:'], error);
            return err(new SocketError('Failed to play alert', socket.id));
        }
    }

    /**
     * Check if audio is currently playing
     */
    get isPlaying(): boolean {
        return this._currentPlayback !== null;
    }

    /**
     * Get current playback hash (if any)
     */
    get currentHash(): string | null {
        return this._currentPlayback?.hash ?? null;
    }

    /**
     * Dispose of the audio manager and clean up resources
     */
    dispose(): void {
        if (this._disposed) return;

        this._disposed = true;

        // Cancel any current playback
        if (this._currentPlayback) {
            this._currentPlayback.cancellationToken.cancel();
            this._currentPlayback.resolve('cancelled');
            this._currentPlayback = null;
        }

        this._playerUsers = null;
        this.removeAllListeners();
    }

    /**
     * Check if this manager has been disposed
     */
    get isDisposed(): boolean {
        return this._disposed;
    }
}

// Create singleton instance for backwards compatibility during migration
let _defaultManager: AudioManager | null = null;

export function getDefaultAudioManager(): AudioManager {
    if (!_defaultManager) {
        _defaultManager = new AudioManager();
    }
    return _defaultManager;
}

export function setDefaultAudioManager(manager: AudioManager): void {
    _defaultManager = manager;
}
