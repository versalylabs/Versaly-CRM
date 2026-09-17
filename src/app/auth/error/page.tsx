'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, KeyRound, ShieldAlert } from 'lucide-react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  let title = 'Authentication Notice';
  let message = 'An unexpected authentication event occurred. Please try signing in again.';

  if (error === 'Configuration') {
    title = 'Server Configuration Initializing';
    message =
      'The authentication service is initializing its session keys. Please click below to try signing in again.';
  } else if (error === 'AccessDenied') {
    title = 'Access Restricted';
    message = 'You do not have administrative permissions to view this resource.';
  } else if (error === 'CredentialsSignin') {
    title = 'Invalid Credentials';
    message = 'The email or password entered does not match our records. Please try again.';
  } else if (error === 'Verification') {
    title = 'Verification Expired';
    message = 'The verification token has expired or has already been used.';
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-[#053048] to-[#031d2e] flex items-center justify-center px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#073652]/80 p-8 shadow-2xl backdrop-blur-2xl text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-400/30 shadow-inner">
          <KeyRound className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
          <p className="text-sm text-sky-200/80 leading-relaxed">{message}</p>
        </div>

        <div className="space-y-3 pt-2">
          <Link
            href="/auth/signin"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 py-3.5 text-center text-xs font-black uppercase tracking-wider text-[#031d2e] shadow-lg shadow-sky-500/30 hover:brightness-110 active:scale-95 transition-all"
          >
            <span>Sign In to Your Account →</span>
          </Link>

          <Link
            href="/"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-center text-xs font-bold text-sky-200 hover:bg-white/10 hover:text-white transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Homepage</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function AuthError() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#053048] grid place-items-center text-white text-xs">
          Loading authentication status...
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}