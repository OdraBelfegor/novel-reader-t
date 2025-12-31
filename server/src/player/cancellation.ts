/**
 * Cancellation token system for managing async operation cancellation
 * Provides a clean way to cancel TTS requests, audio playback, and other async operations
 */

import { CancellationError } from './errors';

export class CancellationToken {
    private _abortController: AbortController;
    private _onCancelCallbacks: Set<() => void> = new Set();

    constructor() {
        this._abortController = new AbortController();
    }

    /**
     * Get the AbortSignal for use with fetch and other abortable APIs
     */
    get signal(): AbortSignal {
        return this._abortController.signal;
    }

    /**
     * Check if this token has been cancelled
     */
    get isCancelled(): boolean {
        return this._abortController.signal.aborted;
    }

    /**
     * Cancel all operations using this token
     */
    cancel(): void {
        if (this.isCancelled) return;
        this._abortController.abort();
        this._onCancelCallbacks.forEach(cb => cb());
        this._onCancelCallbacks.clear();
    }

    /**
     * Register a callback to be called when this token is cancelled
     */
    onCancel(callback: () => void): void {
        if (this.isCancelled) {
            callback();
            return;
        }
        this._onCancelCallbacks.add(callback);
    }

    /**
     * Remove a previously registered callback
     */
    offCancel(callback: () => void): void {
        this._onCancelCallbacks.delete(callback);
    }

    /**
     * Throw CancellationError if this token has been cancelled
     */
    throwIfCancelled(): void {
        if (this.isCancelled) {
            throw new CancellationError();
        }
    }

    /**
     * Create a promise that rejects when this token is cancelled
     */
    toPromise(): Promise<never> {
        return new Promise((_, reject) => {
            if (this.isCancelled) {
                reject(new CancellationError());
                return;
            }
            this.onCancel(() => reject(new CancellationError()));
        });
    }

    /**
     * Race a promise against cancellation
     */
    async race<T>(promise: Promise<T>): Promise<T> {
        return Promise.race([promise, this.toPromise()]);
    }

    /**
     * Create a new token - static factory method
     */
    static create(): CancellationToken {
        return new CancellationToken();
    }

    /**
     * Create a linked token that cancels when any of the parent tokens cancel
     */
    static linked(...tokens: CancellationToken[]): CancellationToken {
        const linked = new CancellationToken();

        const cancelLinked = () => linked.cancel();

        for (const token of tokens) {
            if (token.isCancelled) {
                linked.cancel();
                return linked;
            }
            token.onCancel(cancelLinked);
        }

        return linked;
    }
}

/**
 * Source for creating and controlling cancellation tokens
 * Use this when you need to cancel operations from outside
 */
export class CancellationTokenSource {
    private _token: CancellationToken;

    constructor() {
        this._token = new CancellationToken();
    }

    get token(): CancellationToken {
        return this._token;
    }

    cancel(): void {
        this._token.cancel();
    }

    /**
     * Create a new source with a fresh token (after cancelling the old one)
     */
    reset(): CancellationToken {
        this.cancel();
        this._token = new CancellationToken();
        return this._token;
    }
}
