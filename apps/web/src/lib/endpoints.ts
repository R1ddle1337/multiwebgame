type EndpointEnv = Partial<Record<'VITE_API_BASE_URL' | 'VITE_WS_URL', string>>;

interface RuntimeLocation {
  protocol: string;
  hostname: string;
  host: string;
  port: string;
  origin: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeConfiguredUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimTrailingSlash(trimmed);
}

function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isLocalDevWebLocation(location: RuntimeLocation): boolean {
  return isLocalHost(location.hostname) && location.port === '5173';
}

function toRuntimeLocation(value: Location | RuntimeLocation | null): RuntimeLocation | null {
  if (!value) {
    return null;
  }

  return {
    protocol: value.protocol,
    hostname: value.hostname,
    host: value.host,
    port: value.port,
    origin: value.origin
  };
}

function wsSchemeFromProtocol(protocol: string): 'ws:' | 'wss:' {
  return protocol === 'https:' ? 'wss:' : 'ws:';
}

function normalizeWsUrl(value: string): string {
  const normalized = value.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
  return trimTrailingSlash(normalized);
}

export function resolveApiBaseUrl(
  env: EndpointEnv = import.meta.env as EndpointEnv,
  locationInput: Location | RuntimeLocation | null = typeof window !== 'undefined' ? window.location : null
): string {
  const configured = normalizeConfiguredUrl(env.VITE_API_BASE_URL);
  if (configured) {
    return configured;
  }

  const location = toRuntimeLocation(locationInput);
  if (!location) {
    return 'http://localhost:4000';
  }

  if (isLocalDevWebLocation(location)) {
    return `${location.protocol}//${location.hostname}:4000`;
  }

  return trimTrailingSlash(`${trimTrailingSlash(location.origin)}/api`);
}

export function resolveWsUrl(
  env: EndpointEnv = import.meta.env as EndpointEnv,
  locationInput: Location | RuntimeLocation | null = typeof window !== 'undefined' ? window.location : null
): string {
  const configured = normalizeConfiguredUrl(env.VITE_WS_URL);
  if (configured) {
    return normalizeWsUrl(configured);
  }

  const location = toRuntimeLocation(locationInput);
  if (!location) {
    return 'ws://localhost:4001';
  }

  if (isLocalDevWebLocation(location)) {
    return `${wsSchemeFromProtocol(location.protocol)}//${location.hostname}:4001`;
  }

  return trimTrailingSlash(`${wsSchemeFromProtocol(location.protocol)}//${location.host}/ws`);
}
