import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import IntegrationsPanel from '@/components/settings/IntegrationsPanel';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomOPDSStore } from '@/store/customOPDSStore';
import { useABSServerStore } from '@/store/absServerStore';
import { useFileSyncStore } from '@/store/fileSyncStore';
import type { SystemSettings } from '@/types/settings';

vi.mock('@/hooks/useQuotaStats', () => ({
  useQuotaStats: () => ({ userProfilePlan: 'free' }),
}));
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {}, appService: {} }),
}));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u' } }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/services/sync/providers/gdrive/buildGoogleDriveProvider', () => ({
  getGoogleWebClientId: () => 'mock-client-id',
}));
vi.mock('@/services/sync/replicaPublish', () => ({
  publishReplicaUpsert: vi.fn(),
  publishReplicaDelete: vi.fn(),
}));
vi.mock('@/services/environment', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/environment')>('@/services/environment');
  return { ...actual, isWebAppPlatform: () => true };
});

const baseSettings = {
  version: 1,
  kosync: { enabled: false },
  bookorbit: { enabled: false },
  readwise: { enabled: false },
  hardcover: { enabled: false },
  googleDrive: { enabled: false },
  opdsCatalogs: [],
  absServers: [],
} as unknown as SystemSettings;

describe('IntegrationsPanel — Google Drive only', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    // Stub the load functions to be synchronous no-ops so the panel's effects
    // don't kick off real network/disk work in jsdom.
    useCustomOPDSStore.setState({ catalogs: [] });
    useABSServerStore.setState({ servers: [] });
    useSettingsStore.setState({ settings: baseSettings });
    useFileSyncStore.setState({ byKind: {}, activeKind: null, lastErrorByKind: {} });
  });

  test('renders only the Google Drive row in Cloud Sync', () => {
    render(<IntegrationsPanel />);
    expect(screen.getByText(/Google Drive/i)).toBeTruthy();
    expect(screen.queryByText(/^WebDAV$/)).toBeNull();
    expect(screen.queryByText(/S3/)).toBeNull();
    expect(screen.queryByText(/OneDrive/)).toBeNull();
    expect(screen.queryByText(/iCloud/)).toBeNull();
    expect(screen.queryByText(/Readest Cloud/)).toBeNull();
  });

  test('does not show a Premium badge on the Drive row', () => {
    render(<IntegrationsPanel />);
    expect(screen.queryByText(/Premium/)).toBeNull();
  });
});
