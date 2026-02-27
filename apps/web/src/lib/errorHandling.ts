export type TransportErrorKind = 'network' | 'cors';

const AUTH_INVALID_SIGNALS = [
  'missing bearer token',
  'invalid token payload',
  'invalid token',
  'session expired or invalid',
  'session not found',
  'session invalid',
  'invalid or expired session',
  'unauthorized'
];

const CORS_PATTERNS = [
  /\bcors\b/i,
  /cross[- ]origin/i,
  /same[- ]origin policy/i,
  /blocked by .*origin policy/i
];

const NETWORK_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /networkerror when attempting to fetch resource/i,
  /network request failed/i,
  /the network connection was lost/i,
  /load failed/i,
  /err_network/i,
  /econnrefused/i
];

interface StatusError {
  status?: unknown;
}

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function getMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}

function getStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const status = (error as StatusError).status;
  return typeof status === 'number' ? status : null;
}

export function classifyTransportErrorMessage(message: string): TransportErrorKind | null {
  const normalized = normalizeMessage(message);
  if (!normalized) {
    return null;
  }

  if (CORS_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'cors';
  }

  if (NETWORK_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return 'network';
  }

  return null;
}

export function classifyTransportError(error: unknown): TransportErrorKind | null {
  return classifyTransportErrorMessage(getMessage(error));
}

export function isExplicitAuthInvalidError(error: unknown): boolean {
  const status = getStatus(error);
  if (status !== 401 && status !== 403) {
    return false;
  }

  const normalized = normalizeMessage(getMessage(error));
  if (!normalized) {
    return false;
  }

  return AUTH_INVALID_SIGNALS.some((signal) => normalized.includes(signal));
}
