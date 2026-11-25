'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type Status = { allowed: boolean; readOnly: boolean; status: string; reason?: string; trialDaysRemaining?: number; isPlatformAdmin?: boolean };

/** Top-of-app banners: subscription state (trial / read-only) and unconfirmed email. */
export default function SubscriptionStatusBanner() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  useEffect(() => {
    fetch('/api/subscription/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, []);

  async function resendVerification() {
    setResend('sending');
    const res = await fetch('/api/auth/verify-email', { method: 'PUT' }).catch(() => null);
    setResend(res?.ok ? 'sent' : 'failed');
  }

  const isPlatformAdmin = session?.user?.isPlatformAdmin || status?.isPlatformAdmin;
  const rows: React.ReactNode[] = [];

  if (!isPlatformAdmin && status?.status === 'trialing') {
    rows.push(
      <div key="trial" className="bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black">
        Free trial: {status.trialDaysRemaining} day{status.trialDaysRemaining === 1 ? '' : 's'} remaining.{' '}
        <Link className="underline" href="/settings/billing">Choose a plan</Link>
      </div>
    );
  } else if (!isPlatformAdmin && status?.readOnly) {
    rows.push(
      <div key="readonly" className="bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
        {status.reason || 'Subscription action required.'}{' '}
        <Link className="underline" href="/settings/billing">Manage subscription</Link>
      </div>
    );
  }

  if (session?.user && session.user.emailVerified === false) {
    rows.push(
      <div key="verify" className="bg-ink-700 px-4 py-2 text-center text-sm text-brand-cream">
        Please confirm your email address ({session.user.email}).{' '}
        {resend === 'sent' ? (
          <span role="status">Email sent. Check your inbox.</span>
        ) : (
          <button type="button" onClick={resendVerification} disabled={resend === 'sending'} className="font-semibold underline disabled:opacity-60">
            {resend === 'sending' ? 'Sending…' : resend === 'failed' ? 'Could not send. Try again' : 'Resend email'}
          </button>
        )}
      </div>
    );
  }

  if (!rows.length) return null;
  // In the page flow (not fixed), so it never covers page content.
  return <div className="mb-4 overflow-hidden rounded-xl lg:mr-24">{rows}</div>;
}
