'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

type Status = { allowed: boolean; readOnly: boolean; status: string; reason?: string; trialDaysRemaining?: number; isPlatformAdmin?: boolean };

export default function SubscriptionStatusBanner() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch('/api/subscription/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, []);

  // Platform admin is exempt from any trial or payment banner
  if (session?.user?.isPlatformAdmin || status?.isPlatformAdmin) return null;
  if (!status) return null;
  if (status.status === 'trialing') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-black">
        Free trial: {status.trialDaysRemaining} day{status.trialDaysRemaining === 1 ? '' : 's'} remaining.{' '}
        <Link className="underline" href="/settings/billing">
          Choose a plan
        </Link>
      </div>
    );
  }
  if (!status.readOnly) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 px-4 py-2 text-center text-sm font-semibold text-white">
      {status.reason || 'Subscription action required.'}{' '}
      <Link className="underline" href="/settings/billing">
        Manage subscription
      </Link>
    </div>
  );
}
