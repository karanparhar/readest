import { afterEach, describe, test, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import RecoveryPage from '@/app/auth/recovery/page';

vi.mock('@supabase/auth-ui-react', () => ({
  Auth: () => <div data-testid='auth-ui' />,
}));

vi.mock('@supabase/supabase-js', () => ({
  // Recovery no longer uses Supabase Auth UI. A stub createClient keeps the
  // import chain happy in the pre-fix state where the page still pulls in
  // @/utils/supabase.
  createClient: () => ({}),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe('recovery page — Google accounts', () => {
  afterEach(() => {
    cleanup();
  });

  test('does not render the Supabase Auth UI library', () => {
    render(<RecoveryPage />);
    expect(screen.queryByTestId('auth-ui')).toBeNull();
  });

  test('explains that Google sign-in is the password mechanism', () => {
    render(<RecoveryPage />);
    expect(screen.getByText(/Google sign-in/i)).toBeTruthy();
  });

  test('does not render a password input', () => {
    render(<RecoveryPage />);
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });
});
