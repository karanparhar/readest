import { beforeEach, describe, expect, test } from 'vitest';
import { useFileSyncStore } from '@/store/fileSyncStore';

const reset = () =>
  useFileSyncStore.setState({ byKind: {}, activeKind: null, lastErrorByKind: {} });

describe('fileSyncStore', () => {
  beforeEach(reset);

  test('beginSync acquires the mutex and marks the backend syncing', () => {
    const { beginSync } = useFileSyncStore.getState();
    expect(beginSync('gdrive', 'Syncing 0 / 3')).toBe(true);
    const s = useFileSyncStore.getState();
    expect(s.activeKind).toBe('gdrive');
    expect(s.byKind.gdrive?.isSyncing).toBe(true);
    expect(s.byKind.gdrive?.progressLabel).toBe('Syncing 0 / 3');
  });

  test('a second run cannot begin while the lock is held', () => {
    const { beginSync } = useFileSyncStore.getState();
    expect(beginSync('gdrive', 'a')).toBe(true);
    // The global library-sync mutex blocks a second Sync now while one is mid-run.
    expect(beginSync('gdrive', 'b')).toBe(false);
    expect(useFileSyncStore.getState().activeKind).toBe('gdrive');
  });

  test('endSync releases the lock and resets that backend to idle', () => {
    const { beginSync, endSync } = useFileSyncStore.getState();
    beginSync('gdrive', 'a');
    endSync('gdrive');
    const s = useFileSyncStore.getState();
    expect(s.activeKind).toBeNull();
    expect(s.byKind.gdrive?.isSyncing).toBe(false);
    // Lock is free again for the next run.
    expect(s.beginSync('gdrive', 'c')).toBe(true);
    expect(useFileSyncStore.getState().activeKind).toBe('gdrive');
  });

  test('updateProgress sets the label + detail for the active backend', () => {
    const { beginSync, updateProgress } = useFileSyncStore.getState();
    beginSync('gdrive', 'start');
    updateProgress('gdrive', 'Uploading 2 / 3', 'Project Hail Mary');
    const p = useFileSyncStore.getState().byKind.gdrive;
    expect(p?.progressLabel).toBe('Uploading 2 / 3');
    expect(p?.progressDetail).toBe('Project Hail Mary');
  });

  test('lastError is recorded for the backend and survives endSync until cleared', () => {
    const { beginSync, setLastError, endSync } = useFileSyncStore.getState();
    beginSync('gdrive', 'a');
    setLastError('gdrive', 'AUTH_FAILED: 401');
    endSync('gdrive');
    // The health surface reads this after the run finished.
    expect(useFileSyncStore.getState().lastErrorByKind.gdrive).toBe('AUTH_FAILED: 401');
    // A later successful run clears it.
    setLastError('gdrive', null);
    expect(useFileSyncStore.getState().lastErrorByKind.gdrive).toBeNull();
  });
});

describe('fileSyncStore pass mutex', () => {
  beforeEach(reset);

  test('switchSync while the lock is held keeps the backend syncing', () => {
    const store = useFileSyncStore.getState();
    expect(store.beginSync('gdrive', 'Syncing…')).toBe(true);

    useFileSyncStore.getState().switchSync('gdrive', 'Syncing…');

    const s = useFileSyncStore.getState();
    expect(s.activeKind).toBe('gdrive');
    expect(s.byKind.gdrive?.isSyncing).toBe(true);
    // An auto-sync trying to start mid-pass is still refused.
    expect(useFileSyncStore.getState().beginSync('gdrive', 'Syncing…')).toBe(false);
  });

  test('endSync after a switch releases the lock', () => {
    useFileSyncStore.getState().beginSync('gdrive', 'Syncing…');
    useFileSyncStore.getState().switchSync('gdrive', 'Syncing…');
    useFileSyncStore.getState().endSync('gdrive');

    expect(useFileSyncStore.getState().activeKind).toBeNull();
    expect(useFileSyncStore.getState().beginSync('gdrive', 'Syncing…')).toBe(true);
  });

  test('switchSync with lock free is a no-op and does not acquire the lock', () => {
    const store = useFileSyncStore.getState();
    // Call switchSync when activeKind is null (lock is free).
    store.switchSync('gdrive', 'Syncing…');

    const s = useFileSyncStore.getState();
    // Lock must remain free.
    expect(s.activeKind).toBeNull();
    // No byKind entry should have been created for gdrive.
    expect(s.byKind.gdrive).toBeUndefined();
    // A subsequent beginSync must succeed, proving the lock was never taken.
    expect(store.beginSync('gdrive', 'Syncing…')).toBe(true);
    // After beginSync, the lock should be acquired.
    expect(useFileSyncStore.getState().activeKind).toBe('gdrive');
  });
});
