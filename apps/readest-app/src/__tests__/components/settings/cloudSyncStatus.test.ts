import { describe, expect, test } from 'vitest';
import {
  canToggleCloudProvider,
  getThirdPartyRowStatus,
} from '@/components/settings/integrations/cloudSyncStatus';

const _ = (key: string) => key;

describe('getThirdPartyRowStatus', () => {
  const base = {
    enabled: true,
    configured: true,
    syncing: false,
    lastError: null,
    syncBooks: true,
  };

  test('not connected / configured when inactive', () => {
    expect(getThirdPartyRowStatus(_, { ...base, enabled: false, configured: false })).toBe(
      'Not connected',
    );
    expect(getThirdPartyRowStatus(_, { ...base, enabled: false })).toBe('Configured');
  });

  test('syncing while a run is in flight', () => {
    expect(getThirdPartyRowStatus(_, { ...base, syncing: true })).toBe('Syncing…');
  });

  test('needs reauth when the web token is gone (outranks syncing and active)', () => {
    expect(getThirdPartyRowStatus(_, { ...base, needsReauth: true })).toBe('Reconnect required');
    // A gone token must never read as active or as an in-flight sync.
    expect(getThirdPartyRowStatus(_, { ...base, needsReauth: true, syncing: true })).toBe(
      'Reconnect required',
    );
  });

  test('sync failed after a terminal error', () => {
    expect(getThirdPartyRowStatus(_, { ...base, lastError: 'AUTH_FAILED' })).toBe('Sync failed');
  });

  test('warns when book file uploads are off', () => {
    expect(getThirdPartyRowStatus(_, { ...base, syncBooks: false })).toBe(
      'Active · Book file uploads off',
    );
  });

  test('healthy active state', () => {
    expect(getThirdPartyRowStatus(_, base)).toBe('Active');
  });
});

describe('canToggleCloudProvider', () => {
  test('configured and not enabled can be toggled on', () => {
    expect(canToggleCloudProvider({ isConfigured: true, isEnabled: false })).toBe(true);
  });

  test('unconfigured and not enabled cannot be toggled', () => {
    expect(canToggleCloudProvider({ isConfigured: false, isEnabled: false })).toBe(false);
  });

  test('an enabled provider can always be switched off', () => {
    expect(canToggleCloudProvider({ isConfigured: false, isEnabled: true })).toBe(true);
  });
});
