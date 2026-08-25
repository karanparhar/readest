import { describe, test, expect } from 'vitest';
import type { SystemSettings } from '@/types/settings';
import {
  cloudProviderDisplayName,
  getEnabledFileSyncBackends,
} from '@/services/sync/cloudSyncProvider';

describe('cloudSyncProvider — single backend', () => {
  test('getEnabledFileSyncBackends returns gdrive when enabled', () => {
    expect(
      getEnabledFileSyncBackends({ googleDrive: { enabled: true } } as unknown as SystemSettings),
    ).toEqual(['gdrive']);
  });

  test('getEnabledFileSyncBackends returns [] when disabled', () => {
    expect(
      getEnabledFileSyncBackends({ googleDrive: { enabled: false } } as unknown as SystemSettings),
    ).toEqual([]);
  });

  test('getEnabledFileSyncBackends returns [] when settings is null', () => {
    expect(getEnabledFileSyncBackends(null)).toEqual([]);
  });

  test('cloudProviderDisplayName returns Google Drive', () => {
    expect(cloudProviderDisplayName('gdrive')).toBe('Google Drive');
  });
});
