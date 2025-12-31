/**
 * Text-to-Speech service client
 * Handles communication with the TTS server with:
 * - Retry logic with exponential backoff
 * - Cancellation support via CancellationToken
 * - Proper error typing
 */

import { CancellationToken } from './player/cancellation';
import { TTSError, CancellationError, type Result, ok, err } from './player/errors';

export interface TTSConfig {
  retries?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
}

export interface TTSRequestOptions {
  cancellationToken?: CancellationToken;
}

export default class TextToSpeech {
  private readonly url: string;
  private readonly retries: number;
  private readonly retryDelay: number;
  private readonly maxRetryDelay: number;
  private _disposed = false;

  constructor(urlTTS: string, config?: TTSConfig) {
    this.url = urlTTS;
    this.retries = config?.retries ?? 5;
    this.retryDelay = config?.retryDelay ?? 800;
    this.maxRetryDelay = config?.maxRetryDelay ?? 5000;

    console.log(`TTS URL: ${this.url}`);
  }

  /**
   * Get audio for text with Result return type
   */
  async getAudioSafe(
    text: string,
    options?: TTSRequestOptions
  ): Promise<Result<ArrayBuffer>> {
    if (this._disposed) {
      return err(new TTSError('TTS service has been disposed'));
    }

    const token = options?.cancellationToken;

    let attempt = 0;
    let lastError: Error | undefined;

    while (attempt < this.retries) {
      // Check cancellation before each attempt
      if (token?.isCancelled) {
        return err(new CancellationError());
      }

      try {
        const result = await this.fetchWithCancellation(text, token);
        return ok(result);
      } catch (error) {
        // Check if this was a cancellation
        if (CancellationError.isCancellation(error)) {
          return err(new CancellationError());
        }

        // Check for unrecoverable errors
        if (error instanceof Error && error.name === 'TypeError') {
          return err(new TTSError('TTS service not available'));
        }

        lastError = error instanceof Error ? error : new Error(String(error));

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryDelay * Math.pow(2, attempt),
          this.maxRetryDelay
        );

        // Wait before retry (interruptible by cancellation)
        if (token) {
          try {
            await token.race(this.delay(delay));
          } catch {
            return err(new CancellationError());
          }
        } else {
          await this.delay(delay);
        }

        attempt++;
      }
    }

    return err(
      new TTSError(
        `Failed after ${this.retries} attempts: ${lastError?.message ?? 'Unknown error'}`
      )
    );
  }

  /**
   * Get audio for text (throws on error - legacy API)
   */
  async getAudio(text: string, options?: TTSRequestOptions): Promise<ArrayBuffer> {
    const result = await this.getAudioSafe(text, options);

    if (!result.success) {
      throw result.error;
    }

    return result.value;
  }

  /**
   * Perform fetch with cancellation support
   */
  private async fetchWithCancellation(
    text: string,
    token?: CancellationToken
  ): Promise<ArrayBuffer> {
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: text,
    };

    // Add abort signal if we have a cancellation token
    if (token) {
      fetchOptions.signal = token.signal;
    }

    const res = await fetch(this.url, fetchOptions);

    if (!res.ok) {
      throw new TTSError(`HTTP Error -${res.status}-: ${res.statusText}`, res.status);
    }

    return res.arrayBuffer();
  }

  /**
   * Create a cancellable delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Dispose of the TTS client
   */
  dispose(): void {
    this._disposed = true;
  }

  /**
   * Check if disposed
   */
  get isDisposed(): boolean {
    return this._disposed;
  }
}
