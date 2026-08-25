'use client';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/hooks/useTranslation';

export default function RecoveryPage() {
  const _ = useTranslation();
  const router = useRouter();
  return (
    <div className='bg-base-100 flex min-h-screen flex-col items-center px-6 pb-12 pt-20'>
      <h1 className='text-xl font-semibold tracking-tight'>{_('Password recovery')}</h1>
      <p className='text-base-content/70 mt-3 max-w-sm text-center text-sm leading-relaxed'>
        {_(
          'Readest accounts use Google sign-in. To recover access, sign in with Google on the sign-in page.',
        )}
      </p>
      <button className='btn btn-contrast mt-6' onClick={() => router.push('/auth')}>
        {_('Back to sign in')}
      </button>
    </div>
  );
}
