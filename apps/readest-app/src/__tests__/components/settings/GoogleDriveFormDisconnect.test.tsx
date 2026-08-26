import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { SystemSettings } from '@/types/settings';
import { useFileSyncStore } from '@/store/fileSyncStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Regression for #5062: a provider's Disconnect used to call the old
 * exclusive-provider activation helper, which wrote `enabled: false` to
 * every backend slice (that era's "no third-party provider active" meaning).
 * Under multi-select that silently turned off every other mirror too.
 *
 * Google Drive is now the only cloud backend, so this guards the narrower
 * invariant: Disconnect flips only the Google Drive `enabled` flag and
 * leaves the rest of the settings untouched.
 *
 * This renders the real GoogleDriveForm component and clicks its actual
 * Disconnect button (not just the underlying `withCloudProviderEnabled`
 * reducer) so a regression in the component's wiring — not only in the
 * shared helper — would be caught.
 */

const saveSettings = vi.fn(async () => {});

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({
    envConfig: { getAppService: async () => ({ saveSettings }) },
    appService: null,
  }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/utils/settingsSync', () => ({
  broadcastGlobalSettings: vi.fn(),
}));

vi.mock('@/services/sync/providers/gdrive/googleDriveConnect', () => ({
  runGoogleDriveConnect: vi.fn(),
  runGoogleDriveDisconnect: vi.fn(async () => {}),
}));

import GoogleDriveForm from '@/components/settings/integrations/GoogleDriveForm';

const googleDriveEnabled = {
  version: 1,
  googleDrive: { enabled: true, accountLabel: 'alice@example.com' },
} as unknown as SystemSettings;

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsStore.setState({ settings: googleDriveEnabled } as never);
  useLibraryStore.setState({ library: [], libraryLoaded: true } as never);
  useFileSyncStore.setState({ byKind: {}, activeKind: null, lastErrorByKind: {} });
});

afterEach(() => {
  cleanup();
});

describe('GoogleDriveForm disconnect (#5062 regression)', () => {
  test('disconnecting Google Drive flips only the Google Drive enabled flag', async () => {
    render(<GoogleDriveForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.googleDrive.enabled).toBe(false);
    });

    // Disconnect is a full teardown of the Google Drive slice: the account
    // label is cleared too (the keychain token went with runGoogleDriveDisconnect).
    expect(useSettingsStore.getState().settings.googleDrive.accountLabel).toBeUndefined();
  });
});
