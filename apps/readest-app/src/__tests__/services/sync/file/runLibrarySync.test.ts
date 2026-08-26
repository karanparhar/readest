import { describe, test, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { setCachedUserPlan } from '@/services/sync/cloudSyncProvider';
import { useLibraryStore } from '@/store/libraryStore';
import { useFileSyncStore } from '@/store/fileSyncStore';
import type { SystemSettings } from '@/types/settings';

const syncLibrary = vi.fn().mockResolvedValue({ booksSynced: 0 });
const pushBookFile = vi.fn().mockResolvedValue({ uploaded: true });
const pushBookCover = vi.fn().mockResolvedValue({ uploaded: true });
const downloadBookFile = vi.fn().mockResolvedValue(true);

vi.mock('@/services/sync/file/providerRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/sync/file/providerRegistry')>();
  return {
    ...actual,
    createFileSyncProvider: vi.fn(async () => ({}) as never),
  };
});

vi.mock('@/services/sync/file/appLocalStore', () => ({
  createAppLocalStore: vi.fn(() => ({}) as never),
}));

vi.mock('@/services/sync/file/engine', () => ({
  FileSyncEngine: vi.fn(function (this: Record<string, unknown>) {
    this['syncLibrary'] = syncLibrary;
    this['pushBookFile'] = pushBookFile;
    this['pushBookCover'] = pushBookCover;
    this['downloadBookFile'] = downloadBookFile;
  }),
}));

// Defaults keep `canBackendRun('gdrive')` true (non-web), so the existing pass
// tests still run gdrive; the getReadyFileSyncBackends block toggles them.
vi.mock('@/services/environment', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/environment')>()),
  isWebAppPlatform: vi.fn(() => false),
}));
vi.mock('@/services/sync/providers/gdrive/auth/webTokenStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/sync/providers/gdrive/auth/webTokenStore')>()),
  hasValidWebDriveToken: vi.fn(() => false),
}));

import { isWebAppPlatform } from '@/services/environment';
import { hasValidWebDriveToken } from '@/services/sync/providers/gdrive/auth/webTokenStore';
import {
  canBackendRun,
  getReadyFileSyncBackends,
  runFileBookDownload,
  runFileBookUpload,
  runFileLibrarySyncPass,
} from '@/services/sync/file/runLibrarySync';
import type { Book } from '@/types/book';

const makeBook = (hash: string): Book => ({
  hash,
  format: 'EPUB',
  title: `Book ${hash}`,
  sourceTitle: `Book ${hash}`,
  author: 'A',
  createdAt: 1,
  updatedAt: 1,
});

const translationFn = (key: string, params?: Record<string, string | number>) => {
  if (params) {
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), key);
  }
  return key;
};

const envConfig = {
  getAppService: vi.fn(async () => ({ saveSettings: vi.fn() }) as never),
} as never;

const gdriveSettings = {
  version: 1,
  googleDrive: { enabled: true, syncBooks: true },
} as unknown as SystemSettings;

describe('runFileLibrarySyncPass', () => {
  beforeEach(() => {
    syncLibrary.mockReset().mockResolvedValue({ booksSynced: 1 });
    useSettingsStore.getState().setSettings(gdriveSettings);
    useLibraryStore.setState({ library: [makeBook('h1')], libraryLoaded: true });
    useFileSyncStore.setState({ byKind: {}, activeKind: null, lastErrorByKind: {} });
    setCachedUserPlan('pro');
  });

  test('runs the enabled backend and sums the result', async () => {
    const result = await runFileLibrarySyncPass(envConfig, translationFn);
    expect(syncLibrary).toHaveBeenCalledTimes(1);
    expect(result?.booksSynced).toBe(1);
  });

  test('holds the mutex for the whole pass', async () => {
    let lockedDuringPass: boolean | null = null;
    syncLibrary.mockImplementation(async () => {
      // A racing auto-sync must be refused while the pass is mid-flight.
      lockedDuringPass = useFileSyncStore.getState().beginSync('gdrive', 'Syncing…') === false;
      return { booksSynced: 1 };
    });
    await runFileLibrarySyncPass(envConfig, translationFn);
    expect(lockedDuringPass).toBe(true);
    // ...and the lock is free again afterwards.
    expect(useFileSyncStore.getState().activeKind).toBeNull();
  });

  // The check above only observes the lock from inside the backend's own
  // syncLibrary call, which is always mid-acquisition by construction.
  // Subscribing to the store directly records every transition `set()`
  // produces (beginSync/endSync each call it once), so a premature release
  // mid-pass would show up as a stray `null` before the final endSync.
  test('holds the lock for the whole pass and releases it exactly once at the end', async () => {
    const activeKindHistory: (string | null)[] = [];
    const unsubscribe = useFileSyncStore.subscribe((state) => {
      activeKindHistory.push(state.activeKind);
    });
    await runFileLibrarySyncPass(envConfig, translationFn);
    unsubscribe();
    // The final entry is the pass's own closing endSync; every transition
    // before it must still hold the backend's lock.
    expect(activeKindHistory.slice(0, -1)).not.toContain(null);
    expect(activeKindHistory.at(-1)).toBeNull();
  });

  test('returns null when the backend fails', async () => {
    syncLibrary.mockRejectedValue(new Error('offline'));
    expect(await runFileLibrarySyncPass(envConfig, translationFn)).toBeNull();
    expect(useFileSyncStore.getState().activeKind).toBeNull();
  });

  test('does nothing when no backend is enabled', async () => {
    useSettingsStore.getState().setSettings({ version: 1 } as SystemSettings);
    expect(await runFileLibrarySyncPass(envConfig, translationFn)).toBeNull();
    expect(syncLibrary).not.toHaveBeenCalled();
  });

  test('skips when the library has not loaded (would push an empty index)', async () => {
    useLibraryStore.setState({ libraryLoaded: false });
    expect(await runFileLibrarySyncPass(envConfig, translationFn)).toBeNull();
    expect(syncLibrary).not.toHaveBeenCalled();
  });

  test('skips when the library-sync mutex is already held', async () => {
    useFileSyncStore.getState().beginSync('gdrive', 'busy');
    expect(await runFileLibrarySyncPass(envConfig, translationFn)).toBeNull();
    expect(syncLibrary).not.toHaveBeenCalled();
  });
});

describe('runFileBookUpload', () => {
  beforeEach(() => {
    pushBookFile.mockReset().mockResolvedValue({ uploaded: true });
    pushBookCover.mockReset().mockResolvedValue({ uploaded: true });
    useSettingsStore.getState().setSettings(gdriveSettings);
    setCachedUserPlan('pro');
  });

  test('pushes the book to the enabled backend', async () => {
    expect(await runFileBookUpload(envConfig, makeBook('h1'))).toBe(true);
    expect(pushBookFile).toHaveBeenCalledTimes(1);
  });

  test('succeeds when the backend takes the book', async () => {
    pushBookFile.mockResolvedValueOnce({ uploaded: true });
    expect(await runFileBookUpload(envConfig, makeBook('h1'))).toBe(true);
  });

  test('fails when the backend does not take the book', async () => {
    pushBookFile.mockRejectedValue(new Error('offline'));
    expect(await runFileBookUpload(envConfig, makeBook('h1'))).toBe(false);
  });

  test('treats an already-mirrored file as success', async () => {
    pushBookFile.mockResolvedValueOnce({ uploaded: false, reason: 'remote-matches' });
    expect(await runFileBookUpload(envConfig, makeBook('h1'))).toBe(true);
  });
});

describe('runFileBookDownload', () => {
  beforeEach(() => {
    downloadBookFile.mockReset();
    useSettingsStore.getState().setSettings(gdriveSettings);
    setCachedUserPlan('pro');
  });

  test('succeeds when the backend has the file', async () => {
    downloadBookFile.mockResolvedValueOnce(true);
    expect(await runFileBookDownload(envConfig, makeBook('h1'))).toBe(true);
    expect(downloadBookFile).toHaveBeenCalledTimes(1);
  });

  test('fails when the backend does not have the file', async () => {
    downloadBookFile.mockResolvedValueOnce(false);
    expect(await runFileBookDownload(envConfig, makeBook('h1'))).toBe(false);
    expect(downloadBookFile).toHaveBeenCalledTimes(1);
  });

  test('stamps downloadedAt and coverDownloadedAt on success', async () => {
    downloadBookFile.mockResolvedValueOnce(true);
    const book = makeBook('h1');
    expect(await runFileBookDownload(envConfig, book)).toBe(true);
    expect(book.downloadedAt).toBeTruthy();
    expect(book.coverDownloadedAt).toBeTruthy();
  });
});

describe('getReadyFileSyncBackends', () => {
  const settings = {
    version: 1,
    googleDrive: { enabled: true },
  } as unknown as SystemSettings;

  beforeEach(() => {
    vi.mocked(isWebAppPlatform).mockReturnValue(true);
    vi.mocked(hasValidWebDriveToken).mockReturnValue(true);
    setCachedUserPlan('pro');
  });

  test('includes gdrive when the web token is valid', () => {
    expect(getReadyFileSyncBackends(settings)).toEqual(['gdrive']);
  });

  test('drops gdrive when the web token is gone (canBackendRun false)', () => {
    vi.mocked(hasValidWebDriveToken).mockReturnValue(false);
    expect(canBackendRun('gdrive')).toBe(false);
    expect(getReadyFileSyncBackends(settings)).toEqual([]);
  });

  test('native (non-web) keeps gdrive regardless of the web token', () => {
    vi.mocked(isWebAppPlatform).mockReturnValue(false);
    vi.mocked(hasValidWebDriveToken).mockReturnValue(false);
    expect(getReadyFileSyncBackends(settings)).toEqual(['gdrive']);
  });
});
