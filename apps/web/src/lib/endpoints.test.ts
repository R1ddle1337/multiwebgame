import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl, resolveWsUrl } from './endpoints';

const localDevLocation = {
  protocol: 'http:',
  hostname: 'localhost',
  host: 'localhost:5173',
  port: '5173',
  origin: 'http://localhost:5173'
};

const productionLocation = {
  protocol: 'https:',
  hostname: 'game.example.com',
  host: 'game.example.com',
  port: '',
  origin: 'https://game.example.com'
};

describe('endpoints', () => {
  it('prefers configured API and WS urls', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://api.example.com/' }, localDevLocation)).toBe(
      'https://api.example.com'
    );

    expect(resolveWsUrl({ VITE_WS_URL: 'https://realtime.example.com/' }, localDevLocation)).toBe(
      'wss://realtime.example.com'
    );
  });

  it('derives localhost defaults for dev web port when env is missing', () => {
    expect(resolveApiBaseUrl({}, localDevLocation)).toBe('http://localhost:4000');
    expect(resolveWsUrl({}, localDevLocation)).toBe('ws://localhost:4001');
  });

  it('derives same-origin api and wss on https deployments', () => {
    expect(resolveApiBaseUrl({}, productionLocation)).toBe('https://game.example.com');
    expect(resolveWsUrl({}, productionLocation)).toBe('wss://game.example.com');
  });
});
