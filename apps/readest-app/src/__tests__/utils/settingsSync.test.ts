import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SystemSettings } from '@/types/settings';
import type { FileSystem } from '@/types/system';

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({ label: 'main' })),
}));

vi.mock('@/services/environment', () => ({
  isTauriAppPlatform: vi.fn(() => true),
}));

import { emit } from '@tauri-apps/api/event';
import { getDefaultViewSettings } from '@/services/settingsService';
import { DEFAULT_SYSTEM_SETTINGS, DEFAULT_READSETTINGS } from '@/services/constants';
import { broadcastGlobalSettings, type SettingsSyncPayload } from '@/utils/settingsSync';

// Real SystemSettings fixture built from the app's own default-settings
// factories (the same ones `loadSettings` uses), so this exercises the real
// `broadcastGlobalSettings` end to end instead of mocking the whole module.
const defaultGlobalViewSettings = getDefaultViewSettings({
  fs: {} as FileSystem,
  isMobile: false,
  isEink: false,
  isAppDataSandbox: false,
});

function makeFullSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    ...DEFAULT_SYSTEM_SETTINGS,
    version: 1,
    localBooksDir: '/books',
    customFonts: [],
    customTextures: [],
    opdsCatalogs: [],
    savedBookCoverForLockScreen: '',
    savedBookCoverForLockScreenPath: '',
    globalReadSettings: DEFAULT_READSETTINGS,
    globalViewSettings: defaultGlobalViewSettings,
    ...overrides,
  } as SystemSettings;
}

describe('broadcastGlobalSettings: googleDrive in the emitted payload', () => {
  beforeEach(() => {
    vi.mocked(emit).mockClear();
  });

  const capturePayload = (): SettingsSyncPayload => {
    const call = vi.mocked(emit).mock.calls[0];
    return call![1] as SettingsSyncPayload;
  };

  test('carries enabled + providerSelectedAt faithfully', async () => {
    const settings = makeFullSettings({
      googleDrive: {
        ...DEFAULT_SYSTEM_SETTINGS.googleDrive,
        enabled: true,
        providerSelectedAt: 1234,
      },
    });

    await broadcastGlobalSettings(settings, { includeCloudSyncProviders: true });

    const payload = capturePayload();
    expect(payload.cloudSyncProviders?.googleDrive).toEqual({
      enabled: true,
      providerSelectedAt: 1234,
    });
  });

  test('carries enabled:false', async () => {
    const settings = makeFullSettings({
      googleDrive: { ...DEFAULT_SYSTEM_SETTINGS.googleDrive, enabled: false },
    });

    await broadcastGlobalSettings(settings, { includeCloudSyncProviders: true });

    const payload = capturePayload();
    expect(payload.cloudSyncProviders?.googleDrive?.enabled).toBe(false);
  });

  test('never carries credentials or lastSyncedAt', async () => {
    const settings = makeFullSettings({
      googleDrive: {
        ...DEFAULT_SYSTEM_SETTINGS.googleDrive,
        enabled: true,
        accountLabel: 'hunter2@example.com',
        lastSyncedAt: 999,
      },
    });

    await broadcastGlobalSettings(settings, { includeCloudSyncProviders: true });

    const payload = capturePayload();
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('lastSyncedAt');
  });

  test('omits cloudSyncProviders when the flag is not set', async () => {
    const settings = makeFullSettings({
      googleDrive: { ...DEFAULT_SYSTEM_SETTINGS.googleDrive, enabled: true },
    });

    await broadcastGlobalSettings(settings);

    const payload = capturePayload();
    expect(payload.cloudSyncProviders).toBeUndefined();
  });
});
