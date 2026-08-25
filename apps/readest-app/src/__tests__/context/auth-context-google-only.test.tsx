import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import React from 'react';

type SessionPayload = {
  access_token: string;
  refresh_token: string;
  user: { id: string; app_metadata: { provider?: string } };
} | null;

type Listener = (event: string, session: SessionPayload) => void;

interface MockAuth {
  onAuthStateChange: (cb: Listener) => { data: { subscription: { unsubscribe: () => void } } };
  signOut: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
  __fire: (event: string, session: SessionPayload) => void;
}

vi.mock('@/utils/supabase', () => {
  const listeners: Listener[] = [];
  const signOut = vi.fn(async () => ({ error: null }));
  const refreshSession = vi.fn(async () => ({ data: { session: null }, error: null }));
  const mockAuth: MockAuth = {
    onAuthStateChange: (cb: Listener) => {
      listeners.push(cb);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signOut,
    refreshSession,
    __fire: (event: string, session: SessionPayload) => {
      for (const l of listeners) l(event, session);
    },
  };
  return {
    supabase: { auth: mockAuth },
  };
});

import { supabase } from '@/utils/supabase';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const mockAuth = supabase.auth as unknown as MockAuth;

const Probe: React.FC = () => {
  const { user } = useAuth();
  return <span data-testid='user'>{user ? user.id : 'null'}</span>;
};

describe('AuthContext — Google-only enforcement', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAuth.signOut.mockClear();
  });

  test('non-Google session is signed out and localStorage stays empty', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      mockAuth.__fire('SIGNED_IN', {
        access_token: 't',
        refresh_token: 'r',
        user: { id: 'u1', app_metadata: { provider: 'github' } },
      });
    });
    await waitFor(() => {
      expect(mockAuth.signOut).toHaveBeenCalled();
    });
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  test('Google session is accepted', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => {
      mockAuth.__fire('SIGNED_IN', {
        access_token: 'tok',
        refresh_token: 'ref',
        user: { id: 'u2', app_metadata: { provider: 'google' } },
      });
    });
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('tok');
    });
    expect(localStorage.getItem('user')).toContain('"provider":"google"');
  });
});
