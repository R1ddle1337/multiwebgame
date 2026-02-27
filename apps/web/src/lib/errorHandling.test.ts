import { describe, expect, it } from 'vitest';

import {
  classifyTransportError,
  classifyTransportErrorMessage,
  isAuthInvalidMessage,
  isExplicitAuthInvalidError
} from './errorHandling';

describe('errorHandling', () => {
  it('classifies failed-to-fetch style messages as network errors', () => {
    expect(classifyTransportErrorMessage('Failed to fetch')).toBe('network');
    expect(classifyTransportError(new Error('fetch failed'))).toBe('network');
  });

  it('classifies CORS wording separately from generic network errors', () => {
    expect(classifyTransportErrorMessage('Request blocked by CORS policy')).toBe('cors');
    expect(classifyTransportErrorMessage('Cross-Origin Request Blocked')).toBe('cors');
  });

  it('treats timeout/abort as transport-level network errors', () => {
    expect(classifyTransportErrorMessage('Request timeout')).toBe('network');
    expect(classifyTransportErrorMessage('AbortError: operation was aborted')).toBe('network');
  });

  it('does not over-trigger on unrelated messages', () => {
    expect(classifyTransportErrorMessage('room capacity reached')).toBeNull();
    expect(classifyTransportErrorMessage('network-player seat mismatch')).toBeNull();
  });

  it('treats only explicit 401/403 auth/session signals as auth-invalid', () => {
    const explicitSessionInvalid = Object.assign(new Error('Session expired or invalid'), {
      status: 401
    });
    const invalidCredentials = Object.assign(new Error('Invalid credentials'), {
      status: 401
    });
    const serverError = Object.assign(new Error('Session expired or invalid'), {
      status: 500
    });

    expect(isExplicitAuthInvalidError(explicitSessionInvalid)).toBe(true);
    expect(isExplicitAuthInvalidError(invalidCredentials)).toBe(false);
    expect(isExplicitAuthInvalidError(serverError)).toBe(false);
  });

  it('accepts websocket-style auth invalid reasons too', () => {
    expect(isAuthInvalidMessage('invalid_or_expired_session')).toBe(true);
    expect(isAuthInvalidMessage('invalid_token_payload')).toBe(true);
    expect(isAuthInvalidMessage('author dashboard disabled')).toBe(false);
  });
});
