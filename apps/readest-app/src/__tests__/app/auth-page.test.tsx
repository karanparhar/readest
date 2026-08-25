import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/auth-ui-react', () => ({ Auth: () => null }));
vi.mock('@supabase/auth-ui-shared', () => ({ ThemeSupa: {} }));

import { ProviderLogin } from '@/app/auth/components/ProviderLogin';
import AuthPanel from '@/app/auth/components/AuthPanel';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ProviderLogin', () => {
  it('contains a rejected native sign-in request', async () => {
    const error = new Error('The operation could not be completed. Authentication error 1.');
    const handleSignIn = vi.fn().mockRejectedValue(error);
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <ProviderLogin
        provider='google'
        handleSignIn={handleSignIn}
        Icon={() => null}
        label='Sign in with Google'
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

    await waitFor(() => {
      expect(consoleWarn).toHaveBeenCalledWith('Failed to sign in with google:', error);
    });
  });
});

describe('AuthPanel — Google-only', () => {
  it('renders exactly one OAuth button for Google and invokes handler with "google"', async () => {
    const onProviderSignIn = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<AuthPanel onProviderSignIn={onProviderSignIn} />);

    const buttons = screen.getAllByRole('button', { name: /Sign in with Google/i });
    expect(buttons).toHaveLength(1);

    const googleButton = buttons[0] as HTMLElement;
    fireEvent.click(googleButton);
    await waitFor(() => {
      expect(onProviderSignIn).toHaveBeenCalledWith('google');
    });

    expect(container.textContent).not.toMatch(/Sign in with Apple/i);
    expect(container.textContent).not.toMatch(/Sign in with GitHub/i);
    expect(container.textContent).not.toMatch(/Sign in with Discord/i);
  });
});
