'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthCard from '@/components/AuthCard';

function Verify() {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('This confirmation link is incomplete.');
      return;
    }
    fetch('/api/auth/verify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not confirm your email.');
        setState('done');
      })
      .catch((err) => {
        setState('error');
        setError(err.message);
      });
  }, [token]);

  if (state === 'working') return <p role="status" className="text-sm text-gray-300">Confirming your email…</p>;
  if (state === 'done') {
    return (
      <p role="status" className="text-sm text-emerald-300">
        Your email is confirmed. <Link href="/dashboard" className="font-semibold underline">Go to your dashboard</Link>.
      </p>
    );
  }
  return <p role="alert" className="text-sm text-red-300">{error} Sign in and use “Resend email” on the banner to get a new link.</p>;
}

export default function VerifyEmailPage() {
  return (
    <AuthCard title="Confirm your email">
      <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
        <Verify />
      </Suspense>
    </AuthCard>
  );
}
