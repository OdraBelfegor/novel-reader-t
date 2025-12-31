/**
 * Custom error classes for the player module
 * Provides typed errors for better error handling and debugging
 */

export class PlayerError extends Error {
    constructor(
        message: string,
        public readonly code: PlayerErrorCode,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = 'PlayerError';
        Error.captureStackTrace?.(this, this.constructor);
    }

    static fromUnknown(error: unknown, code: PlayerErrorCode = 'UNKNOWN'): PlayerError {
        if (error instanceof PlayerError) return error;
        if (error instanceof Error) {
            return new PlayerError(error.message, code, error);
        }
        return new PlayerError(String(error), code, error);
    }
}

export type PlayerErrorCode =
    | 'UNKNOWN'
    | 'CANCELLED'
    | 'TTS_UNAVAILABLE'
    | 'TTS_FAILED'
    | 'AUDIO_PLAYBACK_FAILED'
    | 'NO_AUDIO_BUFFER'
    | 'NO_AUDIO_CONNECTION'
    | 'SOCKET_DISCONNECTED'
    | 'SOCKET_TIMEOUT'
    | 'ALREADY_DISPOSED'
    | 'INVALID_STATE'
    | 'CONTENT_NOT_FOUND';

export class CancellationError extends PlayerError {
    constructor(message = 'Operation was cancelled') {
        super(message, 'CANCELLED');
        this.name = 'CancellationError';
    }

    static isCancellation(error: unknown): error is CancellationError {
        return error instanceof CancellationError ||
            (error instanceof Error && error.name === 'AbortError');
    }
}

export class TTSError extends PlayerError {
    constructor(
        message: string,
        public readonly statusCode?: number
    ) {
        super(message, statusCode ? 'TTS_FAILED' : 'TTS_UNAVAILABLE');
        this.name = 'TTSError';
    }
}

export class AudioError extends PlayerError {
    constructor(message: string, code: PlayerErrorCode = 'AUDIO_PLAYBACK_FAILED') {
        super(message, code);
        this.name = 'AudioError';
    }
}

export class SocketError extends PlayerError {
    constructor(message: string, public readonly socketId?: string) {
        super(message, 'SOCKET_DISCONNECTED');
        this.name = 'SocketError';
    }
}

/**
 * Type-safe result type for operations that can fail
 */
export type Result<T, E = PlayerError> =
    | { success: true; value: T }
    | { success: false; error: E };

export function ok<T>(value: T): Result<T, never> {
    return { success: true, value };
}

export function err<E>(error: E): Result<never, E> {
    return { success: false, error };
}

/**
 * Wrap async operations with proper error handling
 */
export async function tryAsync<T>(
    fn: () => Promise<T>,
    errorCode: PlayerErrorCode = 'UNKNOWN'
): Promise<Result<T>> {
    try {
        const value = await fn();
        return ok(value);
    } catch (error) {
        if (CancellationError.isCancellation(error)) {
            return err(new CancellationError());
        }
        return err(PlayerError.fromUnknown(error, errorCode));
    }
}
