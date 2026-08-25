import type { SystemSettings } from '@/types/settings';
import type { EnvConfigType } from '@/services/environment';
import type { CloudSyncProviderKind } from '@/services/sync/cloudSyncProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { broadcastGlobalSettings } from '@/utils/settingsSync';

/**
 * Turn the Google Drive cloud sync provider on or off, leaving every other
 * provider exactly as it was.
 *
 * Provider config (Drive account label) is left untouched when switching
 * off, so re-enabling it later needs no re-entry; only an explicit
 * Disconnect tears the config down.
 *
 * Switching ON (off -> on edge only) also turns `syncBooks` on and stamps
 * `providerSelectedAt`: checking the provider means "mirror my library
 * here". An explicit `syncBooks` opt-out while the provider stays on is
 * respected — a redundant re-activation changes nothing.
 */
export const withCloudProviderEnabled = (
  settings: SystemSettings,
  _kind: CloudSyncProviderKind,
  enabled: boolean,
): SystemSettings => {
  const slice = settings.googleDrive;
  const activating = enabled && !slice?.enabled;
  return {
    ...settings,
    googleDrive: {
      ...slice,
      enabled,
      ...(activating ? { syncBooks: true, providerSelectedAt: Date.now() } : {}),
    },
  };
};

/**
 * The single write path for switching the Google Drive cloud sync provider
 * on or off. Every surface (the Cloud Sync checkbox, the Drive OAuth
 * callback) routes through here so the change always (a) persists, (b)
 * hydrates the settings store even on routes where it was never loaded
 * (the OAuth callback), and (c) broadcasts to other windows — a stale
 * reader window would otherwise clobber the change on its next whole-file
 * save.
 *
 * `mutate` runs BEFORE the toggle so connect flows can apply credentials or
 * an account label without pre-setting `enabled` (which would suppress the
 * activation side effects).
 */
export const persistCloudProviderEnabled = async (
  envConfig: EnvConfigType,
  kind: CloudSyncProviderKind,
  enabled: boolean,
  mutate: (settings: SystemSettings) => SystemSettings = (s) => s,
): Promise<SystemSettings> => {
  const store = useSettingsStore.getState();
  const appService = await envConfig.getAppService();
  const current = store.settings?.version ? store.settings : await appService.loadSettings();
  const next = withCloudProviderEnabled(mutate(current), kind, enabled);
  store.setSettings(next);
  await appService.saveSettings(next);
  void broadcastGlobalSettings(next, { includeCloudSyncProviders: true });
  return next;
};
