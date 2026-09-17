'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

type InviteData = {
  email: string;
  role: string;
  organizationName: string;
};

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [inviteData, setInviteData] = useState<InviteData | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setTokenError('No invitation token was provided in the link.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/auth/accept-invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Invalid or expired invitation token');
        }
        setInviteData(data);
      } catch (err: any) {
        setTokenError(err.message || 'Invalid or expired invitation link');
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!name.trim()) {
      setFormError('Please enter your full name');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept invitation');

      // Auto sign in
      const loginRes = await signIn('credentials', {
        redirect: false,
        email: inviteData!.email,
        password,
      });

      if (loginRes?.error) {
        router.push('/auth/signin?message=' + encodeURIComponent('Account created! Please sign in with your password.'));
      } else {
        router.push('/');
      }
    } catch (err: any) {
      setFormError(err.message || 'Unable to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-[#053048]">
      <div className="w-full max-w-md space-y-6">
        
        {/* Top Logo & Branding */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 text-xl font-black text-white shadow-lg shadow-sky-500/25">
            V
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            Versaly CRM
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Cloud Workspace Member Invitation
          </p>
        </div>

        {/* Card Content */}
        <div className="rounded-3xl border border-gray-200/80 bg-white p-8 shadow-xl dark:border-gray-800 dark:bg-gray-900/90">
          {checking ? (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Verifying your workspace invitation...</p>
            </div>
          ) : tokenError ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-2xl dark:bg-rose-950/60">
                ⚠️
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  Invitation Invalid or Expired
                </h2>
                <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 leading-relaxed">
                  {tokenError}
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Please contact your workspace administrator to request a new invitation link.
              </p>
              <Link
                href="/auth/signin"
                className="inline-block w-full rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleAccept} className="space-y-5">
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50/50 p-4 text-center dark:border-sky-800/50 dark:bg-sky-950/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
                  Workspace Invitation
                </span>
                <h2 className="mt-1 text-base font-black text-gray-900 dark:text-white">
                  {inviteData?.organizationName}
                </h2>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-2xs dark:bg-gray-800 dark:text-gray-300">
                  <span>Role:</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400">{inviteData?.role}</span>
                </div>
              </div>

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteData?.email || ''}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3.5 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Create Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 py-3 text-xs font-bold text-white shadow-md hover:from-sky-500 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 transition disabled:opacity-50"
              >
                {submitting ? 'Creating Account & Joining...' : 'Accept & Join Workspace'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-bold text-sky-600 hover:underline dark:text-sky-400">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="text-xs text-gray-400">Loading invitation...</div></div>}>
      <AcceptInviteForm />
    </Suspense>
  );
}
