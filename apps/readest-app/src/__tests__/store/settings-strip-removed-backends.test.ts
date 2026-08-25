import { describe, test, expect } from 'vitest';
import { stripRemovedBackends } from '@/store/settingsStore';
import type { SystemSettings } from '@/types/settings';

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
    const next = stripRemovedBackends(input);
    expect(next.googleDrive).toEqual({ enabled: true });
    expect(next.readestCloud).toBeUndefined();
    expect(next.webdav).toBeUndefined();
    expect(next.s3).toBeUndefined();
    expect(next.onedrive).toBeUndefined();
    expect(next.icloud).toBeUndefined();
  });

  test('is a no-op for already-clean settings', () => {
    const input = { version: 1, googleDrive: { enabled: true } } as unknown as SystemSettings;
    expect(stripRemovedBackends(input)).toEqual(input);
  });
});
