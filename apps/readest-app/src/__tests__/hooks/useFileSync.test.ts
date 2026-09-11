import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor as waitForWithOptions } from '@testing-library/react';
import type { Book, BookConfig } from '@/types/book';
import type { SystemSettings } from '@/types/settings';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';
import { FileSyncError } from '@/services/sync/file/provider';
import { eventDispatcher } from '@/utils/event';

const waitFor = <T>(callback: () => T | Promise<T>) =>
  waitForWithOptions(callback, { interval: 1 });

/**
 * `useFileSync` drives the per-book config/file/cover push-pull against the
 * single Google Drive file-sync backend. These tests pin the lock-release
 * and failure-isolation paths: a failed upload releases its own backend
 * lock so a later "Sync now" retries, a successful upload is not re-uploaded,
 * and the expired-session hint fires once across many push cycles instead of
 * spamming on every cycle.
 */

const pushBookConfig = vi.fn(
  async (_book: Book, _config: BookConfig, _deviceId: string) => undefined,
);
const pullBookConfig = vi.fn(
  async (_book: Book, _config: BookConfig) => ({ applied: false }) as never,
);
const pushBookFile = vi.fn(async (_book: Book) => ({ uploaded: true }));
const pushBookCover = vi.fn(async (_book: Book) => ({ uploaded: true }));

vi.mock('@/services/sync/file/engine', () => ({
  FileSyncEngine: vi.fn(function (this: Record<string, unknown>) {
    this['pushBookConfig'] = pushBookConfig;
    this['pullBookConfig'] = pullBookConfig;
    this['pushBookFile'] = pushBookFile;
    this['pushBookCover'] = pushBookCover;
  }),
}));

vi.mock('@/services/sync/file/providerRegistry', () => ({
  createFileSyncProvider: vi.fn(async () => ({}) as never),
}));

vi.mock('@/services/sync/file/appLocalStore', () => ({
  createAppLocalStore: vi.fn(() => ({}) as never),
}));

vi.mock('@/services/sync/file/runLibrarySync', () => ({
  canBackendRun: vi.fn(() => true),
}));

// Per-test-settable routing input: which backends are enabled right now.
const routing = vi.hoisted(() => ({
  backends: [] as FileSyncBackendKind[],
}));

vi.mock('@/services/sync/cloudSyncProvider', () => ({
  getActiveFileSyncBackends: () => routing.backends,
  settingsKeyForBackend: (kind: FileSyncBackendKind) => (kind === 'gdrive' ? 'googleDrive' : kind),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (s: string) => s,
}));

// Stable references across renders: a fresh object per call would make the
// engine-building effect (keyed in part on `appService`/`envConfig`) refire
// every render and loop forever.
const envMocks = vi.hoisted(() => ({ envConfig: {}, appService: {} }));
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => envMocks,
}));

vi.mock('@/app/reader/hooks/useWindowActiveChanged', () => ({
  useWindowActiveChanged: () => {},
}));

const settingsState = vi.hoisted(() => ({
  settings: {
    googleDrive: { enabled: true, syncBooks: true },
  } as unknown as SystemSettings,
}));
const setSettingsMock = vi.fn((next: SystemSettings) => {
  settingsState.settings = next;
});
const saveSettingsMock = vi.fn(async () => {});

vi.mock('@/store/settingsStore', () => {
  const useSettingsStore = () => ({
    settings: settingsState.settings,
    setSettings: setSettingsMock,
    saveSettings: saveSettingsMock,
  });
  useSettingsStore.getState = () => ({
    settings: settingsState.settings,
    setSettings: setSettingsMock,
    saveSettings: saveSettingsMock,
  });
  return { useSettingsStore };
});

const makeBook = (): Book => ({
  hash: 'h1',
  format: 'EPUB',
  title: 'Book 1',
  sourceTitle: 'Book 1',
  author: 'A',
  createdAt: 1,
  updatedAt: 1,
});

const bookDataState = vi.hoisted(() => ({
  config: { updatedAt: 1, location: 'local-loc', booknotes: [] } as BookConfig,
}));
const getConfigMock = vi.fn((_key: string) => bookDataState.config);
const setConfigMock = vi.fn((_key: string, partial: Partial<BookConfig>) => {
  bookDataState.config = { ...bookDataState.config, ...partial };
});
const saveConfigMock = vi.fn(async () => {});
const getBookDataMock = vi.fn(() => ({ book: makeBook() }));

vi.mock('@/store/bookDataStore', () => {
  const state = {
    getConfig: getConfigMock,
    setConfig: setConfigMock,
    saveConfig: saveConfigMock,
    getBookData: getBookDataMock,
  };
  const useBookDataStore = <R>(selector?: (s: typeof state) => R) =>
    selector ? selector(state) : (state as unknown as R);
  useBookDataStore.getState = () => state;
  return { useBookDataStore };
});

vi.mock('@/store/readerStore', () => {
  const state = {
    getView: () => null,
    getViewsById: () => [],
    getViewState: () => ({ previewMode: false }),
  };
  const useReaderStore = <R>(selector?: (s: typeof state) => R) =>
    selector ? selector(state) : (state as unknown as R);
  useReaderStore.getState = () => state;
  return { useReaderStore };
});

// Mutable so lock tests can drive the real user path: dispatch the manual
// pull event, then change the location (a page turn) to make the open-book
// effect re-fire, instead of calling the uploaders directly.
const progressState = vi.hoisted(() => ({ location: 'local-loc' }));
vi.mock('@/store/readerProgressStore', () => ({
  useBookProgress: () => ({ location: progressState.location }),
}));

const { useFileSync } = await import('@/app/reader/hooks/useFileSync');

beforeEach(() => {
  vi.clearAllMocks();
  routing.backends = ['gdrive'];
  settingsState.settings = {
    googleDrive: { enabled: true, syncBooks: true },
  } as unknown as SystemSettings;
  bookDataState.config = { updatedAt: 1, location: 'local-loc', booknotes: [] };
  progressState.location = 'local-loc';
  pushBookConfig.mockResolvedValue(undefined);
  pullBookConfig.mockResolvedValue({ applied: false } as never);
  pushBookFile.mockResolvedValue({ uploaded: true });
  pushBookCover.mockResolvedValue({ uploaded: true });
});

afterEach(() => {
  cleanup();
});

// These tests drive the real user path instead of calling the uploaders
// directly: `handlePull` (the manual "Sync now" pull bridge) resets
// `lastPulledAtRef` / `hasPulledOnce` but does NOT touch the upload locks, so
// the open-book effect re-firing on the next `progress.location` change (a
// page turn) re-runs `pushBookFileNow` / `pushBookCoverNow` with the locks
// intact — a genuine "tap Sync now, then turn a page" flow. Every
// `pullBookConfig` call is made to reject so `lastPulledAtRef` stays 0 and the
// `OPEN_PULL_SKIP_MS` gate never blocks the re-run; no fake timers needed.

describe('useFileSync lock + failure isolation', () => {
  test('a failed book-file upload releases the backend lock so a later attempt retries', async () => {
    pullBookConfig.mockRejectedValue(new Error('remote unreachable'));
    pushBookFile.mockRejectedValueOnce(new Error('network blip'));

    const { rerender } = renderHook(() => useFileSync('h1-view1'));

    // The natural book-open flow drives the first (failing) attempt.
    await waitFor(() => expect(pushBookFile).toHaveBeenCalledTimes(1));

    // Tap "Sync now", then turn a page.
    await eventDispatcher.dispatch('pull-file-sync', { bookKey: 'h1-view1' });
    progressState.location = 'local-loc-2';
    rerender();

    // Must retry because the failed attempt released its own lock.
    await waitFor(() => expect(pushBookFile).toHaveBeenCalledTimes(2));
  });

  test('a backend that uploaded its book file successfully is not re-uploaded on a later attempt', async () => {
    pullBookConfig.mockRejectedValue(new Error('remote unreachable'));
    // Default mock resolves { uploaded: true } — the natural attempt succeeds.

    const { rerender } = renderHook(() => useFileSync('h1-view1'));

    await waitFor(() => expect(pushBookFile).toHaveBeenCalledTimes(1));

    // Tap "Sync now", then turn a page.
    await eventDispatcher.dispatch('pull-file-sync', { bookKey: 'h1-view1' });
    progressState.location = 'local-loc-2';
    rerender();

    // The second push cycle has been entered (proxy signal for the re-fired
    // effect having run), then flush any remaining microtasks.
    await waitFor(() => expect(pushBookConfig).toHaveBeenCalledTimes(2));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // Still 1 — the lock from the successful attempt stays set.
    expect(pushBookFile).toHaveBeenCalledTimes(1);
  });

  test('a failed cover upload releases the backend lock so a later attempt retries', async () => {
    pullBookConfig.mockRejectedValue(new Error('remote unreachable'));
    pushBookCover.mockRejectedValueOnce(new Error('network blip'));

    const { rerender } = renderHook(() => useFileSync('h1-view1'));

    await waitFor(() => expect(pushBookCover).toHaveBeenCalledTimes(1));

    // Tap "Sync now", then turn a page.
    await eventDispatcher.dispatch('pull-file-sync', { bookKey: 'h1-view1' });
    progressState.location = 'local-loc-2';
    rerender();

    await waitFor(() => expect(pushBookCover).toHaveBeenCalledTimes(2));
  });

  test('a backend that uploaded its cover successfully is not re-uploaded on a later attempt', async () => {
    pullBookConfig.mockRejectedValue(new Error('remote unreachable'));
    // Default mock resolves { uploaded: true } — the natural attempt succeeds.

    const { rerender } = renderHook(() => useFileSync('h1-view1'));

    await waitFor(() => expect(pushBookCover).toHaveBeenCalledTimes(1));

    // Tap "Sync now", then turn a page.
    await eventDispatcher.dispatch('pull-file-sync', { bookKey: 'h1-view1' });
    progressState.location = 'local-loc-2';
    rerender();

    await waitFor(() => expect(pushBookConfig).toHaveBeenCalledTimes(2));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // Still 1 — the lock from the successful attempt stays set.
    expect(pushBookCover).toHaveBeenCalledTimes(1);
  });

  test('the expired-session hint fires once across many push cycles instead of on every cycle', async () => {
    // Every push cycle hits the same expired-session error from the backend.
    pushBookConfig.mockImplementation(async () => {
      throw new FileSyncError('Drive session expired', 'AUTH_FAILED');
    });

    const hints: string[] = [];
    const onHint = (e: CustomEvent) => {
      const detail = e.detail as { message?: string } | undefined;
      if (detail?.message) hints.push(detail.message);
    };
    eventDispatcher.on('hint', onHint);

    const { result } = renderHook(() => useFileSync('h1-view1'));

    // Cycle 1: the natural book-open flow (default pull resolves
    // `applied: false`, which falls through to an immediate push).
    await waitFor(() => expect(pushBookConfig).toHaveBeenCalledTimes(1));

    // Cycles 2 and 3, driven directly instead of waiting on the 15s debounce.
    await act(async () => {
      await result.current.pushNow();
    });
    await act(async () => {
      await result.current.pushNow();
    });

    eventDispatcher.off('hint', onHint);

    expect(pushBookConfig).toHaveBeenCalledTimes(3);
    const expiredHints = hints.filter((m) => m === 'Google Drive session expired');
    // The hint is de-duplicated: it fires once for the first expired cycle,
    // not once per push.
    expect(expiredHints).toHaveLength(1);
  });
});
