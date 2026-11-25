'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { FEATURES, PLANS, planHasFeature, type Feature } from '@/lib/plans';

/** Shown in place of a page (or panel) whose feature the workspace's plan does not include. */
export function UpgradeCard({ feature }: { feature: Feature }) {
  const plan = PLANS[FEATURES[feature].minPlan];
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-brand-orange/30 bg-ink-800 p-8 text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-brand-orange">Upgrade to unlock</p>
      <h1 className="mt-2 text-2xl font-bold text-white">{FEATURES[feature].label}</h1>
      <p className="mt-3 text-base text-brand-cream/80">
        This is included from the <strong>{plan.name}</strong> plan (from KES {plan.priceKes.annual.toLocaleString('en-US')} a month, billed
        annually). Your data stays as it is; upgrading simply switches this on.
      </p>
      <Link href="/settings/billing" className="btn-primary mt-6 inline-block px-6 py-3 text-sm font-bold">
        See plans and upgrade
      </Link>
    </div>
  );
}

/** Renders children only when the workspace's plan includes the feature. The server enforces the same rule. */
export default function PlanGate({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { data: session, status } = useSession();
  if (status === 'loading') return null;
  if (session?.user?.isPlatformAdmin || planHasFeature(session?.user?.plan, feature)) return <>{children}</>;
  return <UpgradeCard feature={feature} />;
}
