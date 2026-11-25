'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthCard, { authButtonClass, authInputClass } from '@/components/AuthCard';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';

function ResetForm() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset the password.');
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-300">This reset link is incomplete. <Link href="/auth/forgot-password" className="underline">Request a new one</Link>.</p>;
  }
  if (done) {
    return (
      <p role="status" className="text-sm text-emerald-300">
        Your password has been changed. <Link href="/auth/signin" className="font-semibold underline">Sign in</Link> with your new password.
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-semibold text-gray-300">New password</label>
        <input id="password" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInputClass} />
        <p className="mt-1 text-xs text-gray-400">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-semibold text-gray-300">Confirm new password</label>
        <input id="confirm" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={authInputClass} />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error} {error.includes('expired') && <Link href="/auth/forgot-password" className="underline">Request a new link</Link>}
        </p>
      )}
      <button type="submit" disabled={busy} className={authButtonClass}>{busy ? 'Saving…' : 'Set new password'}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Choose a new password">
      <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AuthCard>
  );
}
