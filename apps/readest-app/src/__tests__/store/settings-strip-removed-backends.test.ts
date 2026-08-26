import { describe, test, expect } from 'vitest';
import { stripRemovedBackends } from '@/store/settingsStore';
import type { SystemSettings } from '@/types/settings';

// The strip pass removes backend keys the type no longer carries, so the
// "is it gone?" assertions read through an untyped view of the result.
const asRecord = (s: SystemSettings): Record<string, unknown> =>
  s as unknown as Record<string, unknown>;

describe('stripRemovedBackends', () => {
  test('drops readestCloud, webdav, s3, onedrive, icloud', () => {
    const input = {
      version: 1,
      googleDrive: { enabled: true },
      readestCloud: { enabled: true },
      webdav: { enabled: true, serverUrl: 'https://x' },
      s3: { enabled: true, bucket: 'b' },
      onedrive: { enabled: true },
      icloud: { enabled: true },
    } as unknown as SystemSettings;
    const next = asRecord(stripRemovedBackends(input));
    expect(next['googleDrive']).toEqual({ enabled: true });
    expect(next['readestCloud']).toBeUndefined();
    expect(next['webdav']).toBeUndefined();
    expect(next['s3']).toBeUndefined();
    expect(next['onedrive']).toBeUndefined();
    expect(next['icloud']).toBeUndefined();
  });

  test('is a no-op for already-clean settings', () => {
    const input = { version: 1, googleDrive: { enabled: true } } as unknown as SystemSettings;
    expect(stripRemovedBackends(input)).toEqual(input);
  });
});
