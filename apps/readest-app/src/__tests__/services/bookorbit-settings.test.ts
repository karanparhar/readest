import { describe, expect, it } from 'vitest';
import { DEFAULT_BOOKORBIT_SETTINGS, DEFAULT_SYSTEM_SETTINGS } from '@/services/constants';

describe('BookOrbit settings', () => {
  it('has safe defaults and is mounted on SystemSettings', () => {
    expect(DEFAULT_BOOKORBIT_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_BOOKORBIT_SETTINGS.serverUrl).toBe('');
    expect(DEFAULT_BOOKORBIT_SETTINGS.strategy).toBe('prompt');
    expect(DEFAULT_BOOKORBIT_SETTINGS.syncProgress).toBe(true);
    expect(DEFAULT_BOOKORBIT_SETTINGS.syncNotes).toBe(true);
    expect(DEFAULT_BOOKORBIT_SETTINGS.syncStats).toBe(true);
    expect(DEFAULT_BOOKORBIT_SETTINGS.syncBookStates).toBe(true);
    expect(DEFAULT_SYSTEM_SETTINGS.bookorbit).toEqual(DEFAULT_BOOKORBIT_SETTINGS);
  });
});
