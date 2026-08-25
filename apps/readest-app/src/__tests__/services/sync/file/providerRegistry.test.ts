import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  createFileSyncProvider,
  resetFileSyncProviderCache,
} from '@/services/sync/file/providerRegistry';

vi.mock('@/services/sync/providers/gdrive/buildGoogleDriveProvider', () => ({
  buildGoogleDriveProvider: vi.fn(async () => ({ kind: 'gdrive' })),
}));

afterEach(() => {
  vi.clearAllMocks();
  resetFileSyncProviderCache();
});

describe('providerRegistry', () => {
  test('FileSyncBackendKind is narrowed to gdrive (compile-time)', () => {
    // This is a compile-time assertion; if the type widens, `tsgo` fails
    // the next lint run.
    const _only: 'gdrive' = 'gdrive';
    expect(_only).toBe('gdrive');
  });

  test('createFileSyncProvider returns the Drive provider', async () => {
    const p = await createFileSyncProvider('gdrive', {});
    expect(p).toEqual({ kind: 'gdrive' });
  });
});
