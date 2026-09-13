import { describe, expect, it } from 'vitest';

import { migrateMobileFitWidthZoom } from '@/services/settingsService';
import type { ViewSettings } from '@/types/book';

const baseView = (): ViewSettings => ({ zoomMode: 'fit-page' }) as unknown as ViewSettings;

describe('migrateMobileFitWidthZoom', () => {
  it('bumps the old fit-page default to fit-width on mobile (v1 settings)', () => {
    const view = baseView();

    migrateMobileFitWidthZoom(view, true, 1);

    expect(view.zoomMode).toBe('fit-width');
  });

  it('leaves desktop settings untouched', () => {
    const view = baseView();

    migrateMobileFitWidthZoom(view, false, 1);

    expect(view.zoomMode).toBe('fit-page');
  });

  it('leaves already-migrated (v2+) settings untouched', () => {
    const view = baseView();

    migrateMobileFitWidthZoom(view, true, 2);

    expect(view.zoomMode).toBe('fit-page');
  });

  it("preserves a user's explicit non-default zoom choice", () => {
    const view = baseView();
    view.zoomMode = 'original-size';

    migrateMobileFitWidthZoom(view, true, 1);

    expect(view.zoomMode).toBe('original-size');
  });
});
