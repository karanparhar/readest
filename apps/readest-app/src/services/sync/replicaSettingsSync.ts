/**
 * Settings sync stub.
 *
 * The Readest Cloud replica-sync subsystem (CRDT-based cross-device
 * settings/dictionary/font/texture/OPDS/ABS sync) was removed. This module
 * previously orchestrated per-field LWW publish/apply of bundled
 * `SystemSettings` preferences through that transport. With the transport
 * gone, the public functions are retained as no-ops so surviving callers
 * (the `Providers` boot hook and the dictionary store's
 * provider-order publish marker) keep compiling without their old
 * cross-device side effects.
 */
import type { SystemSettings } from '@/types/settings';
import type { EnvConfigType } from '@/services/environment';

/**
 * Formerly seeded the in-memory "last published" snapshot from the on-disk
 * settings so the boot-time `setSettings(disk_default)` didn't diff every
 * field against `undefined`. No-op now that there is no publish path.
 */
export const initSettingsSync = (_initialSettings?: SystemSettings): void => {
  void _initialSettings;
};

/**
 * Formerly marked `dictionarySettings.providerOrder` as eligible for the next
 * publish pass. No-op now that there is no publish path; kept so the
 * dictionary store's save path doesn't need to special-case the removal.
 */
export const markExplicitProviderOrderPublish = (): void => {};

/**
 * Formerly pushed changed whitelisted settings fields as a replica upsert.
 * No-op now that there is no replica transport.
 */
export const publishSettingsIfChanged = async (_settings: SystemSettings): Promise<void> => {
  void _settings;
};

/**
 * Formerly merged a remote partial settings record into the settings store.
 * No-op now that there is no replica pull path. The type is kept loose to
 * avoid carrying the deleted `SettingsRemoteRecord` type.
 */
export const applyRemoteSettings = async (
  _envConfig: EnvConfigType,
  _record: unknown,
): Promise<void> => {
  void _envConfig;
  void _record;
};

/** Formerly cleared persisted encrypted-field hashes for orphaned ciphers. */
export const clearStoredEncryptedHashes = (_paths: readonly string[]): void => {
  void _paths;
};

/** Formerly returned the persisted last-seen cipher fingerprint map. */
export const getStoredLastSeenCipher = (): Record<string, string> => ({});

/** Test seam — reset any module-level state. No-op now. */
export const __resetSettingsSyncForTests = (): void => {};
