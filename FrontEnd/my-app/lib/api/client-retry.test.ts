import { describe, it, expect } from 'vitest';
import { isRetryableError, getRetryAfterMs } from './client';
import { createAppError, ERROR_CODES } from '@/lib/utils/error-handler';

/**
 * The response interceptor runs `transformAxiosError` before any failure
 * reaches the retry layer, so the retry predicates almost never see a real
 * Axios error. These tests pin the transformed `AppError` shape specifically,
 * because classifying only on the Axios shape silently made every failed GET
 * retryable — including permanent 4xx responses.
 */
describe('isRetryableError – transformed AppError shapes', () => {
  it('retries server errors', () => {
    expect(
      isRetryableError(createAppError('boom', ERROR_CODES.SERVER_ERROR, 500))
    ).toBe(true);
    expect(
      isRetryableError(createAppError('boom', ERROR_CODES.SERVER_ERROR, 502))
    ).toBe(true);
    expect(
      isRetryableError(createAppError('boom', ERROR_CODES.SERVER_ERROR, 503))
    ).toBe(true);
  });

  it('does not retry 501, a permanent capability gap', () => {
    expect(
      isRetryableError(createAppError('nope', ERROR_CODES.SERVER_ERROR, 501))
    ).toBe(false);
  });

  it('does not retry ordinary client errors', () => {
    expect(
      isRetryableError(
        createAppError('bad', ERROR_CODES.VALIDATION_ERROR, 400)
      )
    ).toBe(false);
    expect(
      isRetryableError(createAppError('authz', ERROR_CODES.UNAUTHORIZED, 401))
    ).toBe(false);
    expect(
      isRetryableError(createAppError('authz', ERROR_CODES.FORBIDDEN, 403))
    ).toBe(false);
    expect(
      isRetryableError(createAppError('gone', ERROR_CODES.NOT_FOUND, 404))
    ).toBe(false);
  });

  it('retries timeout and rate-limit responses', () => {
    expect(
      isRetryableError(createAppError('slow', ERROR_CODES.SERVER_ERROR, 408))
    ).toBe(true);
    expect(
      isRetryableError(createAppError('early', ERROR_CODES.SERVER_ERROR, 425))
    ).toBe(true);
    expect(
      isRetryableError(createAppError('rate', ERROR_CODES.SERVER_ERROR, 429))
    ).toBe(true);
  });

  it('treats a response-less failure (statusCode 0) as transient', () => {
    expect(
      isRetryableError(
        createAppError('offline', ERROR_CODES.NETWORK_ERROR, 0)
      )
    ).toBe(true);
    expect(
      isRetryableError(
        createAppError('timed out', ERROR_CODES.TIMEOUT_ERROR, 0)
      )
    ).toBe(true);
  });

  it('keeps unrecognised errors retryable for the withRetry helper', () => {
    // `withRetry` is used by useAPIBootstrap for non-HTTP operations, which
    // reject with plain Errors and have always been replayed.
    expect(isRetryableError(new Error('mystery'))).toBe(true);
  });
});

describe('getRetryAfterMs', () => {
  it('reads the hint preserved on the transformed error', () => {
    const error = createAppError('rate', ERROR_CODES.SERVER_ERROR, 429, {
      retryAfter: '2',
    });
    expect(getRetryAfterMs(error)).toBe(2_000);
  });

  it('returns null when the server sent no hint', () => {
    expect(
      getRetryAfterMs(createAppError('boom', ERROR_CODES.SERVER_ERROR, 500))
    ).toBeNull();
  });

  it('returns null for an unparseable hint', () => {
    const error = createAppError('rate', ERROR_CODES.SERVER_ERROR, 429, {
      retryAfter: 'soon',
    });
    expect(getRetryAfterMs(error)).toBeNull();
  });
});
