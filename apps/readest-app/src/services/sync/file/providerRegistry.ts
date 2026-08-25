/**
 * Registry that maps a backend kind to a concrete {@link FileSyncProvider}, so
 * the reader hook and the Sync-now form stay backend-agnostic: they ask which
 * backends are enabled and build each one by kind.
 *
 * Google-only since the auth/cloud refactor: Drive is the only third-party
 * library-sync backend, and it builds itself from the env-baked client id plus
 * the keychain token — so it needs no settings to construct.
 */
import type { FileSyncProvider } from './provider';
import { buildGoogleDriveProvider } from '@/services/sync/providers/gdrive/buildGoogleDriveProvider';

export type FileSyncBackendKind = 'gdrive';

const providerCache = new Map<FileSyncBackendKind, { provider: FileSyncProvider }>();

export const resetFileSyncProviderCache = (): void => {
  providerCache.clear();
};

/**
 * Build the provider for the Google Drive backend, or `null` when it cannot
 * run here (no baked client id / no secure storage). Async because Drive
 * probes the keychain to assemble its token store. Memoised so every surface
 * (the reader's per-book sync, the library auto-sync, Sync now) shares one
 * warm path->id cache.
 */
export const createFileSyncProvider = async (
  _kind: FileSyncBackendKind,
  // Accepted for backward compatibility with multi-backend call sites; Drive
  // builds itself from the env-baked client id + the keychain token, so no
  // settings are read here.
  _settings?: unknown,
): Promise<FileSyncProvider | null> => {
  const cached = providerCache.get('gdrive');
  if (cached) return cached.provider;
  const provider = await buildGoogleDriveProvider();
  if (provider) providerCache.set('gdrive', { provider });
  return provider;
};
