import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AuthPanel from '@/app/auth/components/AuthPanel';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string, options?: Record<string, number | string>) => {
    if (!options) return key;
    let result = key;
    for (const [name, value] of Object.entries(options)) {
      result = result.replace(`{{${name}}}`, String(value));
    }
    return result;
  },
}));

describe('AuthPanel — kicked-out banner', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the banner when lastKickedProvider is set and clears the key after first render', () => {
    localStorage.setItem('lastKickedProvider', 'github');

    const onProviderSignIn = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<AuthPanel onProviderSignIn={onProviderSignIn} />);

    const banner = container.querySelector('[data-kicked-banner]');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('GitHub');
    expect(banner?.textContent).toContain('Please sign in with Google');

    expect(localStorage.getItem('lastKickedProvider')).toBeNull();
  });

  it('does not render the banner when lastKickedProvider is absent', () => {
    const onProviderSignIn = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<AuthPanel onProviderSignIn={onProviderSignIn} />);

    expect(container.querySelector('[data-kicked-banner]')).toBeNull();
    expect(localStorage.getItem('lastKickedProvider')).toBeNull();
  });
});
