import { useCallback, useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { runFileLibrarySyncPass } from '@/services/sync/file/runLibrarySync';
import { eventDispatcher } from '@/utils/event';

/**
 * Manual library sync trigger for the library page (pull-to-refresh, the
 * SettingsMenu sync row, BackupWindow).
 *
 * The Readest Cloud native book channel (`useSync`/`syncBooks`) and the
 * cloud-side merge of `syncedBooks` were removed with the Readest Cloud
 * replica-sync subsystem. What remains is the Google Drive file-sync pass
 * (`runFileLibrarySyncPass`), which is also run automatically on library
 * changes by `useLibraryFileSync`. This hook exposes the manual pull a
 * user-initiated refresh asks for, plus a no-op `pushLibrary` kept for
 * call-site compatibility (the file-sync engine pushes as part of its pass).
 */
export const useBooksSync = () => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const isPullingRef = useRef(false);

  const pullLibrary = useCallback(
    async (_fullRefresh = false, verbose = false) => {
      if (isPullingRef.current) return;
      isPullingRef.current = true;
      try {
        const result = await runFileLibrarySyncPass(envConfig, _);
        if (verbose) {
          const succeeded = result !== null;
          eventDispatcher.dispatch('toast', {
            type: succeeded ? 'info' : 'error',
            message: succeeded
              ? _('{{count}} book(s) synced', { count: result?.booksSynced ?? 0 })
              : _('Sync failed'),
          });
        }
      } finally {
        isPullingRef.current = false;
      }
    },
    [_, envConfig],
  );

  const pushLibrary = useCallback(async () => {
    // The file-sync engine pushes library changes as part of its pass
    // (driven by `useLibraryFileSync`); no separate push is needed here.
  }, []);

  return { pullLibrary, pushLibrary };
};
