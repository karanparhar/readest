import { v4 as uuidv4 } from 'uuid';
import type { Book } from '@/types/book';
import type { EnvConfigType } from '@/services/environment';
import type { ProgressHandler } from '@/utils/transfer';
import type { TranslationFunc } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useFileSyncStore } from '@/store/fileSyncStore';
import { isWebAppPlatform } from '@/services/environment';
import { hasValidWebDriveToken } from '@/services/sync/providers/gdrive/auth/webTokenStore';
import { getEnabledFileSyncBackends } from '@/services/sync/cloudSyncProvider';
import {
  createFileSyncProvider,
  type FileSyncBackendKind,
} from '@/services/sync/file/providerRegistry';
import { createAppLocalStore } from '@/services/sync/file/appLocalStore';
import { FileSyncEngine, type SyncLibraryResult } from '@/services/sync/file/engine';

/**
 * Whether the Google Drive backend's transport can work at all right now.
 * Web Google Drive tokens are session-scoped with no refresh; once expired,
 * every run aborts with a terminal AUTH_FAILED on the index pull. Skipping
 * is quieter than failing: the Drive settings form already shows a
 * Reconnect CTA, and a doomed request on every library change would just
 * spam the log and the row's error state.
 */
export const canBackendRun = (kind: FileSyncBackendKind): boolean => {
  if (kind === 'gdrive' && isWebAppPlatform() && !hasValidWebDriveToken()) return false;
  return true;
};

/** Build the Google Drive engine, or null when it cannot run here. */
const buildEngine = async (
  envConfig: EnvConfigType,
  kind: FileSyncBackendKind,
): Promise<FileSyncEngine | null> => {
  if (!canBackendRun(kind)) return null;
  const settings = useSettingsStore.getState().settings;
  const appService = await envConfig.getAppService();
  const fileProvider = await createFileSyncProvider(kind, settings);
  if (!fileProvider) return null;
  const store = createAppLocalStore({ appService, settings, envConfig });
  return new FileSyncEngine(fileProvider, store);
};

/** The single-backend library sync. Throws; the caller isolates the failure. */
const syncOneBackend = async (
  envConfig: EnvConfigType,
  kind: FileSyncBackendKind,
  _: TranslationFunc,
): Promise<SyncLibraryResult | null> => {
  const appService = await envConfig.getAppService();
  const current = useSettingsStore.getState().settings;
  const engine = await buildEngine(envConfig, kind);
  if (!engine) return null;

  const ps = current.googleDrive;
  let deviceId = ps?.deviceId;
  if (!deviceId) {
    deviceId = uuidv4();
    const next = {
      ...current,
      googleDrive: { ...current.googleDrive, deviceId },
    };
    useSettingsStore.getState().setSettings(next);
    await appService.saveSettings(next);
  }

  const strategy = ps?.strategy ?? 'silent';
  const result = await engine.syncLibrary(useLibraryStore.getState().library, {
    strategy: strategy === 'prompt' ? 'silent' : strategy,
    syncBooks: ps?.syncBooks ?? false,
    fullSync: false,
    concurrency: 6,
    deviceId,
    onProgress: ({ index, total, action }) => {
      const label = action === 'downloading' ? _('Downloading') : _('Uploading');
      useFileSyncStore
        .getState()
        .updateProgress(
          kind,
          _('{{action}} {{n}} / {{total}}', { action: label, n: index + 1, total }),
        );
    },
  });

  const latest = useSettingsStore.getState().settings;
  const next = {
    ...latest,
    googleDrive: { ...latest.googleDrive, lastSyncedAt: Date.now() },
  };
  useSettingsStore.getState().setSettings(next);
  await appService.saveSettings(next);
  return result;
};

/**
 * Run one library-wide sync PASS against Google Drive — the shared
 * execution owner for surfaces outside the auto-sync hooks (the
 * SettingsMenu sync row, pull to refresh).
 *
 * The mutex is held for the WHOLE pass, not per backend: releasing
 * between backends would let an auto-sync start a second reconcile of
 * the same library.
 *
 * Returns the engine's result, or null when nothing was synced.
 */
export const runFileLibrarySyncPass = async (
  envConfig: EnvConfigType,
  _: TranslationFunc,
): Promise<SyncLibraryResult | null> => {
  const [kind] = getEnabledFileSyncBackends(useSettingsStore.getState().settings);
  if (!kind) return null;

  // NEVER sync a library that is not loaded from disk: pushing an empty index
  // would clobber the remote.
  if (!useLibraryStore.getState().libraryLoaded) return null;

  if (!useFileSyncStore.getState().beginSync(kind, _('Syncing…'))) return null;

  try {
    try {
      const result = await syncOneBackend(envConfig, kind, _);
      useFileSyncStore.getState().setLastError(kind, null);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      useFileSyncStore.getState().setLastError(kind, message);
      console.warn('[cloudSync] library file sync failed', kind, e);
      return null;
    }
  } finally {
    useFileSyncStore.getState().endSync(kind);
  }
};

/**
 * Explicit per-book Upload, mirrored to Google Drive — the Book Details
 * / bookshelf cloud buttons call this. Pushes the binary (HEAD
 * short-circuited; an already-mirrored file counts as success) plus the
 * cover, best-effort. Toasts are the caller's job.
 */
export const runFileBookUpload = async (envConfig: EnvConfigType, book: Book): Promise<boolean> => {
  const [kind] = getEnabledFileSyncBackends(useSettingsStore.getState().settings);
  if (!kind) return false;
  try {
    const engine = await buildEngine(envConfig, kind);
    if (!engine) return false;
    const result = await engine.pushBookFile(book);
    if (!result.uploaded && result.reason !== 'remote-matches') return false;
    try {
      await engine.pushBookCover(book);
    } catch (e) {
      console.warn('[cloudSync] book cover upload failed', kind, book.hash, e);
    }
    return true;
  } catch (e) {
    console.warn('[cloudSync] book upload failed', kind, book.hash, e);
    return false;
  }
};

/**
 * Explicit per-book Download (also reached when opening a book whose
 * file is not local). Stamps downloadedAt/coverDownloadedAt like the
 * native download path; persisting the book row (updateBook) and
 * toasts are the caller's job.
 */
export const runFileBookDownload = async (
  envConfig: EnvConfigType,
  book: Book,
  onProgress?: ProgressHandler,
): Promise<boolean> => {
  const [kind] = getEnabledFileSyncBackends(useSettingsStore.getState().settings);
  if (!kind) return false;
  try {
    const engine = await buildEngine(envConfig, kind);
    if (!engine) return false;
    if (!(await engine.downloadBookFile(book, onProgress))) return false;
    book.downloadedAt = Date.now();
    if (!book.coverDownloadedAt) book.coverDownloadedAt = Date.now();
    return true;
  } catch (e) {
    console.warn('[cloudSync] book download failed', kind, book.hash, e);
    return false;
  }
};
