import type { SystemSettings } from '@/types/settings';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';

/**
 * The cloud sync provider kind for library data (book files, book rows,
 * progress, notes). Google-only — all other backends (WebDAV, S3, OneDrive,
 * iCloud) and the native Readest Cloud sync/storage were collapsed away in
 * the Google-only auth/cloud refactor.
 */
export type CloudSyncProviderKind = 'gdrive';

/** Settings slice key for the (sole) third-party backend kind. */
export const settingsKeyForBackend = (_kind: FileSyncBackendKind): 'googleDrive' => 'googleDrive';

/** Human-readable provider name (product names — deliberately untranslated). */
export const cloudProviderDisplayName = (kind: CloudSyncProviderKind): string =>
  kind === 'gdrive' ? 'Google Drive' : '';

/**
 * The third-party backends the user has switched on, in a STABLE order that
 * every loop, list, and sync pass in the app relies on.
 */
export const getEnabledFileSyncBackends = (
  settings: SystemSettings | null | undefined,
): FileSyncBackendKind[] => (settings?.googleDrive?.enabled ? ['gdrive'] : []);

/** Any third-party file-sync backend switched on. */
export const hasAnyThirdPartyEnabled = (settings: SystemSettings | null | undefined): boolean =>
  getEnabledFileSyncBackends(settings).length > 0;

/**
 * The backends that may actually run right now. Google Drive is not plan-gated
 * (the quota gate was removed with Readest Cloud), so this is just the enabled
 * set. Kept as a distinct name from {@link getEnabledFileSyncBackends} because
 * call sites model "active vs enabled" separately and may re-introduce a gate.
 */
export const getActiveFileSyncBackends = (
  settings: SystemSettings | null | undefined,
): FileSyncBackendKind[] => getEnabledFileSyncBackends(settings);

/** Every provider syncing the library on this device (Google-only). */
export const getCloudSyncProviders = (
  settings: SystemSettings | null | undefined,
): CloudSyncProviderKind[] => getEnabledFileSyncBackends(settings);

/** Comma-joined product names, for the "Synced via {{provider}}" copy. */
export const cloudProvidersDisplayName = (kinds: CloudSyncProviderKind[]): string =>
  kinds.map(cloudProviderDisplayName).filter(Boolean).join(', ');

/**
 * Native Readest Cloud sync was removed in the Google-only refactor (its
 * provider kind, settings slice, and storage endpoints are all gone). This
 * stub keeps the legacy call sites that still gate on it compiling while
 * permanently disabling the native library-sync leg — they read `false` and
 * skip. The native annotation/progress replica sync (useNotesSync /
 * useProgressSync) is independent and unaffected.
 */
export const isReadestCloudEnabled = (_settings: SystemSettings | null | undefined): boolean =>
  false;

/**
 * Readest Cloud *storage* (S3/R2 book-file hosting) was removed alongside the
 * provider. Stubbed `false` so the storage-gated surfaces (cloud-upload badge,
 * share-to-cloud, delete-from-cloud, the transfer queue) stay disabled. Google
 * Drive file sync replaces book-file mirroring.
 */
export const isReadestCloudStorageActive = (
  _settings: SystemSettings | null | undefined,
): boolean => false;

export interface CloudSyncGate {
  /** Readest Cloud syncs the library channels. Always false post-refactor. */
  readest: boolean;
  /** Third-party backends switched on, in the fixed gdrive order. */
  backends: FileSyncBackendKind[];
  /** True when backends are switched on but the plan does not allow cloud sync. Always false now. */
  paused: boolean;
}

/**
 * Resolve the cloud-sync gate. Post-refactor this is a thin Google-only
 * wrapper: `readest` is always false and nothing is ever paused (no plan gate).
 */
export const resolveCloudSyncGate = (
  settings: SystemSettings | null | undefined,
): CloudSyncGate => ({
  readest: false,
  backends: getEnabledFileSyncBackends(settings),
  paused: false,
});
