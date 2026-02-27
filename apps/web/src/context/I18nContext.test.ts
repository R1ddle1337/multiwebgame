import { describe, expect, it } from 'vitest';

import { normalizeLocale, resolveInitialLocale } from './I18nContext';

describe('I18n locale resolution', () => {
  it('normalizes locale aliases to supported locales', () => {
    expect(normalizeLocale('en')).toBe('en-US');
    expect(normalizeLocale('en-GB')).toBe('en-US');
    expect(normalizeLocale('zh-CN')).toBe('zh-CN');
  });

  it('uses saved locale first so english choice persists', () => {
    expect(
      resolveInitialLocale({
        savedLocale: 'en-US',
        navigatorLanguage: 'zh-CN'
      })
    ).toBe('en-US');
  });

  it('defaults to chinese unless browser locale is explicitly chinese', () => {
    expect(resolveInitialLocale({ navigatorLanguage: 'en-US' })).toBe('zh-CN');
    expect(resolveInitialLocale({ navigatorLanguage: 'zh-Hans-CN' })).toBe('zh-CN');
  });
});
