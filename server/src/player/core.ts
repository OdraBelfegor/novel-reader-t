/**
 * Player Core - Event-driven audio player with state machine
 * 
 * Key improvements:
 * - Event-driven architecture for loose coupling
 * - Cancellation support for all async operations
 * - Proper cleanup and disposal
 * - Better error handling with typed errors
 */

import { EventEmitter } from 'events';
import type { SentenceServer } from '@common/types';
import TextToSpeech from '../tts-use';
import { ContentControl } from './content-control';
import {
  AudioManager,
  type AudioEndReason,
  getDefaultAudioManager
} from './audio-manager';
import { CancellationToken, CancellationTokenSource } from './cancellation';
import {
  PlayerError,
  CancellationError,
  AudioError,
  type Result,
  ok,
  err,
  tryAsync
} from './errors';

// ============================================================================
// Types and Events
// ============================================================================

export type PlayerStateName = 'IDLE' | 'PLAYING' | 'PAUSED' | 'LOADING';
export type EndedCause = 'stopped' | 'end:forward' | 'end:backward';

// Legacy event types for compatibility
export type onEndedPlayer = (cause: EndedCause) => void;
export type onPlayPlayer = () => void;
export type onActionPlayer = () => void;

// Legacy event map for the compatibility emitter
interface LegacyPlayerEvents {
  ended: [cause: EndedCause];
  play: [];
  action: [];
}

// ============================================================================
// Audio Fetcher - Handles TTS with caching and prefetching
// ============================================================================

class AudioFetcher {
  private _pending = new Map<number, Promise<void>>();
  private _disposed = false;

  constructor(
    private readonly tts: TextToSpeech,
    private readonly content: ContentControl
  ) { }

  /**
   * Fetch audio for a sentence with cancellation support
   */
  async fetch(
    sentence: SentenceServer,
    cancellationToken?: CancellationToken
  ): Promise<Result<ArrayBuffer | undefined>> {
    if (this._disposed) {
      return err(new PlayerError('AudioFetcher disposed', 'ALREADY_DISPOSED'));
    }

    // Skip non-readable sentences or already cached
    if (!sentence.isReadable || sentence.audio.buffer) {
      return ok(sentence.audio.buffer);
    }

    // Check if already fetching
    const existing = this._pending.get(sentence.index);
    if (existing) {
      await existing;
      return ok(sentence.audio.buffer);
    }

    // Create fetch promise
    const fetchPromise = (async () => {
      const result = await this.tts.getAudioSafe(sentence.sentence, {
        cancellationToken,
      });

      if (result.success) {
        sentence.audio.buffer = result.value;
        console.log('Got audio for:', { index: sentence.index, sentence: sentence.sentence });
      } else {
        console.error('Failed to get audio:', result.error.message);
      }

      this._pending.delete(sentence.index);
    })();

    this._pending.set(sentence.index, fetchPromise);
    await fetchPromise;

    return ok(sentence.audio.buffer);
  }

  /**
   * Prefetch audio for upcoming sentences
   */
  async prefetch(startIndex: number, count: number = 1): Promise<void> {
    if (this._disposed) return;

    const sentences = this.content.serverContent;

    for (let i = 0; i < count; i++) {
      const index = startIndex + 1 + i;
      if (index >= sentences.length) break;

      const sentence = sentences[index];
      if (sentence.isReadable && !sentence.audio.buffer) {
        // Fire and forget - don't wait for prefetch
        this.fetch(sentence).catch(e =>
          console.error('Prefetch error:', e)
        );
      }
    }
  }

  /**
   * Cancel all pending fetches
   */
  cancelAll(): void {
    // Note: The actual cancellation happens via CancellationToken
    // This just clears our tracking map
    this._pending.clear();
  }

  dispose(): void {
    this._disposed = true;
    this.cancelAll();
  }
}

// ============================================================================
// Player - Main class
// ============================================================================

export class Player {
  private readonly _content: ContentControl;
  private readonly _tts: TextToSpeech;
  private readonly _audioManager: AudioManager;
  private readonly _fetcher: AudioFetcher;

  private _state: PlayerStateName = 'IDLE';
  private _disposed = false;

  // Cancellation for current operation
  private _operationCts = new CancellationTokenSource();

  // Track current playback
  private _currentPlayback: Promise<void> | null = null;

  // Legacy compatibility - separate event emitter (untyped for flexibility)
  public stopped = false;
  public eventEmitter = new EventEmitter();

  // Internal event emitter for new-style events
  private _internalEmitter = new EventEmitter();

  constructor(
    rawContent: string[],
    tts: TextToSpeech,
    audioManager?: AudioManager
  ) {
    this._tts = tts;
    this._content = new ContentControl(rawContent);
    this._audioManager = audioManager ?? getDefaultAudioManager();
    this._fetcher = new AudioFetcher(tts, this._content);
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  private setState(newState: PlayerStateName): void {
    if (this._state === newState) return;

    const previousState = this._state;
    this._state = newState;

    console.log(`[Player] State: ${previousState} -> ${newState}`);
    this._internalEmitter.emit('state:changed', newState, previousState);
    this.eventEmitter.emit('action');
  }

  // ==========================================================================
  // Public Actions
  // ==========================================================================

  /**
   * Start or resume playback
   */
  async run(): Promise<void> {
    if (this._disposed || this.stopped) return;

    if (this._state === 'PLAYING' || this._state === 'LOADING') {
      return; // Already running
    }

    await this.playCurrentSentence();
  }

  /**
   * Toggle play/pause
   */
  async play(): Promise<void> {
    if (this._disposed) return;

    switch (this._state) {
      case 'IDLE':
        await this.run();
        break;
      case 'PLAYING':
      case 'LOADING':
        await this.pause();
        break;
      case 'PAUSED':
        await this.run();
        break;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (this._disposed) return;
    if (this._state !== 'PLAYING' && this._state !== 'LOADING') return;

    // Cancel current operation
    this._operationCts.cancel();

    // Stop audio
    await this._audioManager.stopCurrent();

    // Wait for current playback to finish
    if (this._currentPlayback) {
      await this._currentPlayback.catch(() => { });
    }

    this.setState('PAUSED');
  }

  /**
   * Stop playback completely
   */
  async stop(): Promise<void> {
    if (this._disposed) return;

    this.stopped = true;
    this._operationCts.cancel();

    await this._audioManager.stopCurrent();

    if (this._currentPlayback) {
      await this._currentPlayback.catch(() => { });
    }

    this.setState('IDLE');
    this.eventEmitter.emit('ended', 'stopped');
  }

  /**
   * Go to previous sentence
   */
  async backward(): Promise<void> {
    if (this._disposed) return;

    const wasPlaying = this._state === 'PLAYING';

    // Cancel current operation
    this._operationCts.cancel();
    await this._audioManager.stopCurrent();

    if (this._currentPlayback) {
      await this._currentPlayback.catch(() => { });
    }

    const ended = this._content.previous();

    if (ended) {
      this.setState('IDLE');
      this.eventEmitter.emit('ended', 'end:backward');
      return;
    }

    if (wasPlaying) {
      await this.playCurrentSentence();
    } else {
      this.setState('IDLE');
    }
  }

  /**
   * Go to next sentence
   */
  async forward(): Promise<void> {
    if (this._disposed) return;

    const wasPlaying = this._state === 'PLAYING';

    // Cancel current operation
    this._operationCts.cancel();
    await this._audioManager.stopCurrent();

    if (this._currentPlayback) {
      await this._currentPlayback.catch(() => { });
    }

    const ended = this._content.next();

    if (ended) {
      this.setState('IDLE');
      this.eventEmitter.emit('ended', 'end:forward');
      return;
    }

    if (wasPlaying) {
      await this.playCurrentSentence();
    } else {
      this.setState('IDLE');
    }
  }

  /**
   * Seek to specific sentence by index
   */
  async seek(index: number): Promise<void> {
    if (this._disposed) return;
    if (index < 0 || index >= this._content.serverContent.length) return;

    const wasPlaying = this._state === 'PLAYING';

    // Cancel current operation
    this._operationCts.cancel();
    await this._audioManager.stopCurrent();

    if (this._currentPlayback) {
      await this._currentPlayback.catch(() => { });
    }

    this._content.seek(index);

    if (wasPlaying) {
      await this.playCurrentSentence();
    } else {
      this.setState('IDLE');
    }
  }

  /**
   * Stop current audio (legacy compatibility)
   */
  async stopAudio(): Promise<void> {
    await this._audioManager.stopCurrent();
  }

  // ==========================================================================
  // Internal Playback Logic
  // ==========================================================================

  private async playCurrentSentence(): Promise<void> {
    // Create new cancellation token for this operation
    const token = this._operationCts.reset();

    const sentence = this._content.currentSentence;
    const index = this._content.currentIndex;

    // Skip non-readable sentences
    if (!sentence.isReadable) {
      this.setState('IDLE');
      const ended = this._content.next();

      if (ended) {
        this.eventEmitter.emit('ended', 'end:forward');
      } else if (!token.isCancelled) {
        await this.playCurrentSentence();
      }
      return;
    }

    // Loading state while fetching
    this.setState('LOADING');

    // Fetch audio with cancellation support
    const audioResult = await this._fetcher.fetch(sentence, token);

    if (token.isCancelled) return;

    if (!audioResult.success || !sentence.audio.buffer) {
      console.error('Cannot play sentence:', sentence.sentence);
      await this._audioManager.playAlert('ping');
      this.setState('PAUSED');
      return;
    }

    // Start prefetching next sentences
    this._fetcher.prefetch(index, 2);

    // Switch to playing state
    this.setState('PLAYING');
    this.eventEmitter.emit('play');
    this._internalEmitter.emit('sentence:started', index, sentence);

    console.log('Playing sentence:', [sentence.sentence]);

    // Create the playback promise
    this._currentPlayback = this.performPlayback(sentence, index, token);
    await this._currentPlayback;
  }

  private async performPlayback(
    sentence: SentenceServer,
    index: number,
    token: CancellationToken
  ): Promise<void> {
    const buffer = sentence.audio.buffer;
    if (!buffer) return;

    const result = await this._audioManager.play(buffer, token);

    if (token.isCancelled) return;

    if (!result.success) {
      this._internalEmitter.emit('error', result.error);
      this.setState('PAUSED');
      return;
    }

    const reason = result.value.reason;
    console.log('Audio ended:', { reason });

    this._internalEmitter.emit('sentence:ended', index, reason);

    // Handle end reason
    switch (reason) {
      case 'ended':
        await this.handleSentenceEnded(token);
        break;
      case 'stopped':
      case 'cancelled':
        // User initiated - don't auto-advance
        break;
      case 'disconnected':
      case 'no-connection':
        this.setState('PAUSED');
        break;
    }
  }

  private async handleSentenceEnded(token: CancellationToken): Promise<void> {
    if (token.isCancelled) return;

    const ended = this._content.next();

    if (ended) {
      console.log('All content played');
      this.setState('IDLE');
      this.eventEmitter.emit('ended', 'end:forward');
      return;
    }

    // Continue to next sentence
    if (!token.isCancelled) {
      await this.playCurrentSentence();
    }
  }

  // ==========================================================================
  // Getters
  // ==========================================================================

  get state() {
    // Return a compatible object for legacy code
    return {
      name: this._state,
    };
  }

  get currentlyPlaying(): Promise<void> {
    return this._currentPlayback ?? Promise.resolve();
  }

  get index(): number {
    return this._content.currentIndex;
  }

  set index(value: number) {
    this._content.seek(value);
  }

  get content(): ContentControl {
    return this._content;
  }

  get serverContent() {
    return this._content.serverContent;
  }

  get clientContent() {
    return this._content.clientContent;
  }

  getRawContent(): string[] {
    return this._content.rawContent;
  }

  // Legacy event binding - use methods instead of getters to avoid conflicts
  /**
   * Register a legacy event listener
   * @deprecated Use the new event system instead
   */
  on(event: 'ended', listener: (cause: EndedCause) => void): this;
  on(event: 'play', listener: () => void): this;
  on(event: 'action', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Emit a legacy event
   * @deprecated Use the new event system instead
   */
  emit(event: 'ended', cause: EndedCause): boolean;
  emit(event: 'play'): boolean;
  emit(event: 'action'): boolean;
  emit(event: string, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  // New-style event methods
  onStateChanged(listener: (state: PlayerStateName, previous: PlayerStateName) => void): this {
    this._internalEmitter.on('state:changed', listener);
    return this;
  }

  onSentenceStarted(listener: (index: number, sentence: SentenceServer) => void): this {
    this._internalEmitter.on('sentence:started', listener);
    return this;
  }

  onSentenceEnded(listener: (index: number, reason: AudioEndReason) => void): this {
    this._internalEmitter.on('sentence:ended', listener);
    return this;
  }

  onError(listener: (error: PlayerError) => void): this {
    this._internalEmitter.on('error', listener);
    return this;
  }

  // ==========================================================================
  // Disposal
  // ==========================================================================

  /**
   * Dispose of the player and clean up all resources
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;
    this.stopped = true;

    // Cancel all operations
    this._operationCts.cancel();

    // Clean up fetcher
    this._fetcher.dispose();

    // Clear event listeners
    this._internalEmitter.removeAllListeners();
    this.eventEmitter.removeAllListeners();

    console.log('[Player] Disposed');
  }

  get isDisposed(): boolean {
    return this._disposed;
  }
}
