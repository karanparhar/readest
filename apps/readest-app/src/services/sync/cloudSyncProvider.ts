import type { SystemSettings } from '@/types/settings';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';

/**
 * The cloud sync provider kind for library data (book files, book rows,
 * progress, notes). Google-only — all other backends were collapsed away
 * in the Google-only auth/cloud refactor.
 */
export type CloudSyncProviderKind = 'gdrive';

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
