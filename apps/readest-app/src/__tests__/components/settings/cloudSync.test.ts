import { describe, expect, test, vi, beforeEach } from 'vitest';

vi.mock('@/utils/settingsSync', () => ({
  broadcastGlobalSettings: vi.fn(),
}));

import {
  persistCloudProviderEnabled,
  withCloudProviderEnabled,
} from '@/services/sync/cloudSyncActivation';
import { useSettingsStore } from '@/store/settingsStore';
import { broadcastGlobalSettings } from '@/utils/settingsSync';
import type { SystemSettings } from '@/types/settings';
import type { EnvConfigType } from '@/services/environment';

const mockBroadcastGlobalSettings = vi.mocked(broadcastGlobalSettings);

describe('withCloudProviderEnabled (Google Drive only)', () => {
  const base = {
    googleDrive: { enabled: false, accountLabel: 'a@b.com' },
  } as unknown as SystemSettings;

  test('enabling Drive sets enabled and stamps syncBooks + providerSelectedAt on the off-to-on edge', () => {
    const next = withCloudProviderEnabled(base, 'gdrive', true);
    expect(next.googleDrive.enabled).toBe(true);
    expect(next.googleDrive.syncBooks).toBe(true);
    expect(next.googleDrive.providerSelectedAt).toBeTruthy();
  });

  test('an explicit syncBooks opt-out survives a redundant re-activation', () => {
    const next = withCloudProviderEnabled(base, 'gdrive', true);
    const optedOut = {
      ...next,
      googleDrive: { ...next.googleDrive, syncBooks: false },
    } as SystemSettings;
    const again = withCloudProviderEnabled(optedOut, 'gdrive', true);
    expect(again.googleDrive.syncBooks).toBe(false);
  });

  test('disabling Drive keeps its config so reconnecting is one click', () => {
    const configured = {
      googleDrive: {
        enabled: true,
        accountLabel: 'a@b.com',
        syncBooks: true,
        providerSelectedAt: 100,
      },
    } as unknown as SystemSettings;
    const next = withCloudProviderEnabled(configured, 'gdrive', false);
    expect(next.googleDrive.enabled).toBe(false);
    expect(next.googleDrive.accountLabel).toBe('a@b.com');
  });
});

// The single write path for Google Drive sync — every side effect below must
// survive a future refactor of this orchestrator.
describe('persistCloudProviderEnabled', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: {} as SystemSettings });
    mockBroadcastGlobalSettings.mockClear();
  });

  const makeEnvConfig = (
    saveSettings: (settings: SystemSettings) => Promise<void>,
    loadSettings?: () => Promise<SystemSettings>,
  ): EnvConfigType =>
    ({
      getAppService: vi.fn().mockResolvedValue({ saveSettings, loadSettings }),
    }) as unknown as EnvConfigType;

  test('hydrates the store, persists, and broadcasts with the provider flags included', async () => {
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    const envConfig = makeEnvConfig(saveSettings);
    useSettingsStore.setState({
      settings: { version: 1 } as unknown as SystemSettings,
    });

    const next = await persistCloudProviderEnabled(envConfig, 'gdrive', true);

    expect(useSettingsStore.getState().settings.googleDrive.enabled).toBe(true);
    expect(saveSettings).toHaveBeenCalledWith(next);
    expect(mockBroadcastGlobalSettings).toHaveBeenCalledWith(next, {
      includeCloudSyncProviders: true,
    });
  });

  test('loads settings from the app service when the store was never hydrated (OAuth callback route)', async () => {
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    const loadSettings = vi.fn().mockResolvedValue({ version: 1 } as unknown as SystemSettings);
    const envConfig = makeEnvConfig(saveSettings, loadSettings);
    useSettingsStore.setState({ settings: {} as SystemSettings });

    const next = await persistCloudProviderEnabled(envConfig, 'gdrive', true);

    expect(loadSettings).toHaveBeenCalled();
    expect(useSettingsStore.getState().settings.googleDrive.enabled).toBe(true);
    expect(saveSettings).toHaveBeenCalledWith(next);
    expect(mockBroadcastGlobalSettings).toHaveBeenCalledWith(next, {
      includeCloudSyncProviders: true,
    });
  });
});
