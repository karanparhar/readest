import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FcGoogle } from 'react-icons/fc';
import { useTranslation } from '@/hooks/useTranslation';
import { ProviderLogin, type OAuthProvider } from './ProviderLogin';

interface AuthPanelProps {
  onProviderSignIn: (provider: OAuthProvider) => Promise<void>;
}

const KICKED_PROVIDER_LABELS: Record<string, string> = {
  apple: 'Apple',
  azure: 'Azure',
  github: 'GitHub',
  discord: 'Discord',
};

const capitalizeProvider = (raw: string): string => {
  const titled = KICKED_PROVIDER_LABELS[raw.toLowerCase()];
  if (titled) return titled;
  return raw.length > 0 ? raw[0]!.toUpperCase() + raw.slice(1) : raw;
};

export default function AuthPanel({ onProviderSignIn }: AuthPanelProps) {
  const _ = useTranslation();
  const [kickedProvider, setKickedProvider] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('lastKickedProvider');
    if (raw) {
      localStorage.removeItem('lastKickedProvider');
      setKickedProvider(raw);
    }
  }, []);

  return (
    <div className='flex w-full max-w-sm flex-col items-center gap-6'>
      {kickedProvider && (
        <div
          data-kicked-banner='true'
          role='alert'
          className='eink-bordered border-warning/30 bg-warning/10 text-base-content/80 w-full rounded-lg border px-3 py-2.5 text-center text-sm leading-relaxed'
        >
          {_('This account uses {{oldProvider}}. Please sign in with Google.', {
            oldProvider: capitalizeProvider(kickedProvider),
          })}
        </div>
      )}
      <div className='flex flex-col items-center gap-3 text-center'>
        <Image src='/icon.png' alt='' width={56} height={56} className='eink-bordered rounded-xl' />
        <div>
          <h1 className='text-xl font-semibold tracking-tight'>{_('Sign in to Readest')}</h1>
          <p className='text-base-content/70 mt-1.5 text-sm leading-relaxed'>
            {_('Sync your library, reading progress, and highlights across your devices.')}
          </p>
        </div>
      </div>
      <div className='flex w-full flex-col gap-2.5'>
        <ProviderLogin
          provider='google'
          handleSignIn={onProviderSignIn}
          Icon={FcGoogle}
          label={_('Sign in with Google')}
        />
      </div>
    </div>
  );
}
