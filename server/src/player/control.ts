/**
 * PlayerControl - High-level player controller
 * 
 * Manages the Player lifecycle, provider communication, and user coordination.
 * Updated to use the new AudioManager and proper disposal patterns.
 */

import type { Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  ProviderServerToClientEvents,
  ProviderClientToServerEvents,
} from '@common/socket-events';
import type { PlayerState, ContentClient } from '@common/types';
import TextToSpeech from '../tts-use';
import { Player, type EndedCause } from './core';
import { Audio } from './audio';
import { AudioManager, getDefaultAudioManager } from './audio-manager';
import type { PlayerUsers } from './users';

export type PlayerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export type ProviderSocket = Socket<ProviderClientToServerEvents, ProviderServerToClientEvents>;

interface PlayerControlConfig {
  audioManager?: AudioManager;
}

export class PlayerControl {
  readonly users: PlayerUsers;
  readonly tts: TextToSpeech;
  readonly audioManager: AudioManager;

  provider?: ProviderSocket;
  loading = false;

  player?: Player;
  loop = false;
  loopActive = false;
  loopCounter: number | null = null;
  loopLimit: number | null = null;

  private _disposed = false;

  constructor(
    users: PlayerUsers,
    ttsUrl: string,
    config?: PlayerControlConfig
  ) {
    this.users = users;
    this.tts = new TextToSpeech(ttsUrl);
    this.audioManager = config?.audioManager ?? getDefaultAudioManager();

    // Initialize audio manager with users
    this.audioManager.setPlayerUsers(users);
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  restartConfig(): void {
    this.loop = false;
    this.loopActive = false;
    this.loopCounter = null;
    this.loopLimit = null;
  }

  // ==========================================================================
  // Player Event Handlers
  // ==========================================================================

  private createPlayerEventHandlers(isLoop: boolean) {
    return {
      onPlay: () => {
        if (!this.player) return;
        this.users.server.emit('view:highlight-sentence', this.player.index);
      },

      onAction: () => {
        if (!this.player) return;
        this.users.server.emit('view:update-state', this.getConfig());
      },

      onEnded: isLoop
        ? this.handleLoopEnded.bind(this)
        : this.handleSingleEnded.bind(this),
    };
  }

  private handleSingleEnded(cause: EndedCause): void {
    console.log(['Player onEnded (single)']);

    this.disposeCurrentPlayer();
    Audio.alert('primary');
    this.restartConfig();

    this.users.server.emit('view:update-state', this.getConfig());
    this.users.server.emit('view:load-content', this.getClientContent());
  }

  private async handleLoopEnded(cause: EndedCause): Promise<void> {
    console.log(['Player onEnded (loop)']);

    this.disposeCurrentPlayer();

    const canContinue = this.canContinueLoop(cause);

    if (!canContinue || !this.provider) {
      console.log("Player can't/shouldn't continue");
      this.restartConfig();
      this.users.server.emit('view:load-content', this.getClientContent());
      this.users.server.emit('view:update-state', this.getConfig());
      await Audio.alert('primary');
      return;
    }

    // Continue reading
    await Audio.alert('secondary');
    this.users.server.emit('view:update-state', this.getConfig());
    this.users.server.emit('view:load-content', this.getClientContent());

    let rawContent: string[] | undefined;

    if (cause === 'end:forward') {
      console.log('Player ended naturally/forward');
      if (typeof this.loopCounter === 'number') this.loopCounter++;

      rawContent = await this.provider
        .timeout(10000)
        .emitWithAck('get-content', 1)
        .catch(() => undefined);
    } else {
      console.log('Player ended backward');
      if (typeof this.loopCounter === 'number') this.loopCounter--;

      rawContent = await this.provider
        .timeout(10000)
        .emitWithAck('get-content', -1)
        .catch(() => undefined);
    }

    if (!rawContent || rawContent.length === 0) {
      await Audio.alert('primary');
      console.log('Cannot get more content from provider');
      this.restartConfig();
      return;
    }

    // Create new player with event handlers
    this.player = this.createPlayer(rawContent, true);

    if (cause === 'end:backward') {
      this.player.content.setToLastSentence();
    }

    await this.player.run();

    this.users.server.emit('view:load-content', this.getClientContent());
    this.users.server.emit('view:update-state', this.getConfig());
  }

  private canContinueLoop(cause: EndedCause): boolean {
    if (cause === 'stopped') return false;
    if (!this.loopActive) return false;
    if (
      typeof this.loopLimit === 'number' &&
      typeof this.loopCounter === 'number' &&
      this.loopCounter >= this.loopLimit
    ) {
      return false;
    }
    return true;
  }

  // ==========================================================================
  // Player Factory
  // ==========================================================================

  private createPlayer(rawContent: string[], isLoop: boolean): Player {
    const player = new Player(rawContent, this.tts, this.audioManager);
    const handlers = this.createPlayerEventHandlers(isLoop);

    player.on('play', handlers.onPlay);
    player.on('action', handlers.onAction);
    player.on('ended', handlers.onEnded);

    return player;
  }

  private disposeCurrentPlayer(): void {
    if (this.player) {
      this.player.dispose();
      this.player = undefined;
    }
  }

  // ==========================================================================
  // Public Actions
  // ==========================================================================

  async readThis(rawContent: string[], user: PlayerSocket): Promise<void> {
    console.log(['Action read this']);

    if (this.player) {
      console.log('Already reading something');
      return;
    }

    console.log('Read this:', rawContent);

    this.restartConfig();
    this.player = this.createPlayer(rawContent, false);

    await this.player.run();

    this.users.server.emit('view:update-state', this.getConfig());
    this.users.server.emit('view:load-content', this.getClientContent());
  }

  async readFromProvider(user: PlayerSocket): Promise<void> {
    if (!this.provider) {
      console.log('No provider of content');
      user.emit('alert:show', 'No provider connected');
      return;
    }

    if (this.loading) return;

    this.loading = true;

    const rawContent = await this.provider
      .timeout(10000)
      .emitWithAck('get-content', 0)
      .catch(() => undefined);

    this.loading = false;

    if (!rawContent || rawContent.length === 0) {
      console.log('Cannot get content from provider');
      user.emit('alert:show', 'Cannot get content');
      return;
    }

    this.restartConfig();
    this.loop = true;
    this.loopActive = true;

    this.player = this.createPlayer(rawContent, true);

    await this.player.run();

    this.users.server.emit('view:load-content', this.getClientContent());
    this.users.server.emit('view:update-state', this.getConfig());
  }

  async play(user: PlayerSocket): Promise<void> {
    console.log(['Action play']);

    if (!this.player) {
      console.log(['No player']);
      await this.readFromProvider(user);
      return;
    }

    await this.player.play();
  }

  async stop(): Promise<void> {
    console.log(['Action stop']);

    if (!this.player) {
      console.log('Stop emitted with no player');
      return;
    }

    await this.player.stop();
  }

  async forward(): Promise<void> {
    console.log(['Action forward']);

    if (!this.player) {
      console.log('Forward emitted with no player');
      return;
    }

    await this.player.forward();
  }

  async backward(): Promise<void> {
    console.log(['Action backward']);

    if (!this.player) {
      console.log('Backward emitted with no player');
      return;
    }

    await this.player.backward();
  }

  async seek(index: number): Promise<void> {
    console.log(['Action seek', index]);

    if (!this.player) {
      console.log('Seek emitted with no player');
      return;
    }

    await this.player.seek(index);
  }

  async stopAudio(): Promise<void> {
    console.log(['Action stop audio']);
    await this.player?.stopAudio();
  }

  // Legacy method - now unused but kept for compatibility
  async audioEnded(reason: 'ended' | 'stopped'): Promise<void> {
    // Audio ended events are now handled by AudioManager
  }

  toggleLoop(): void {
    console.log(['Action toggle loop']);
    this.loopActive = !this.loopActive;
    this.users.server.emit('view:update-state', this.getConfig());
  }

  setLoopLimit(limit: number): void {
    console.log(['Action set loop limit', limit]);
    this.loopLimit = limit;
    if (this.loopCounter === null) this.loopCounter = 0;
    this.users.server.emit('view:update-state', this.getConfig());
  }

  removeLoopLimit(): void {
    console.log(['Action remove loop limit']);
    this.loopLimit = null;
    this.loopCounter = null;
    this.users.server.emit('view:update-state', this.getConfig());
  }

  // ==========================================================================
  // Provider Management
  // ==========================================================================

  async getContentFromProvider(): Promise<string[] | []> {
    if (!this.provider) {
      console.log('No provider');
      return [];
    }

    const text: string[] | [] = await this.provider
      .timeout(10000)
      .emitWithAck('get-content', 0)
      .catch(() => []);

    return text || [];
  }

  setProvider(provider: ProviderSocket): void {
    if (this.provider) {
      console.log('Provider already set');
      return;
    }
    console.log('Set provider:', provider.id);
    this.provider = provider;
  }

  removeProvider(provider: ProviderSocket): void {
    if (!this.provider) {
      console.log('Provider already removed');
      return;
    }

    if (this.provider.id !== provider.id) return;

    console.log('Remove provider:', this.provider.id);
    this.provider = undefined;
  }

  // ==========================================================================
  // State Getters
  // ==========================================================================

  getConfig(): PlayerState {
    return {
      state: (this.player && this.player.state.name) || 'INACTIVE',
      loop: this.loop,
      loopActive: this.loopActive,
      loopLimit: this.loopLimit,
      loopCounter: this.loopCounter,
    };
  }

  getClientContent(): ContentClient | [] {
    if (this.player) return this.player.clientContent;
    return [];
  }

  getIndex(): number {
    if (this.player) return this.player.index;
    return 0;
  }

  // ==========================================================================
  // Disposal
  // ==========================================================================

  /**
   * Dispose of the player control and all resources
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;

    // Dispose current player
    this.disposeCurrentPlayer();

    // Dispose TTS
    this.tts.dispose();

    // Dispose audio manager
    this.audioManager.dispose();

    // Clear provider
    this.provider = undefined;

    console.log('[PlayerControl] Disposed');
  }

  get isDisposed(): boolean {
    return this._disposed;
  }
}
