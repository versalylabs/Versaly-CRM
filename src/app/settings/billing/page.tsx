'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ShieldCheck, Clock, Sparkles, CheckCircle2 } from 'lucide-react';

type BillingData = {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    planStatus: string;
    currency: string;
    createdAt: string;
    trialDaysRemaining: number;
    isTrialing: boolean;
    leadLimit: number;
    leadUsed: number;
    leadPercentage: number;
    seatLimit: number;
    seatUsed: number;
    seatPercentage: number;
  };
  plans: {
    id: string;
    name: string;
    badge?: string;
    priceMonthly: number;
    currency: string;
    description: string;
    leadLimit: number;
    seatLimit: number;
    features: string[];
  }[];
  currentPlan: {
    id: string;
    name: string;
    priceMonthly: number;
    currency: string;
  };
  invoices: {
    id: string;
    date: string;
    amount: number;
    currency: string;
    status: string;
    plan: string;
  }[];
};

export default function BillingPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load billing details');
      setData(body);
    } catch (err: any) {
      setError(err.message || 'Unable to load billing data right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const handlePlanChange = async (planId: string) => {
    if (actionLoading || data?.organization.plan === planId) return;
    setActionLoading(planId);
    setNotification(null);
    try {
      const res = await fetch('/api/billing/create-checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, interval: 'month' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to start secure checkout');
      window.location.href = body.url;
    } catch (err: any) {
      setNotification({ message: err.message || 'Unable to start checkout', type: 'error' });
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    try {
      const res = await fetch('/api/billing/create-portal-session', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to open billing portal');
      window.location.href = body.url;
    } catch (err: any) {
      setNotification({ message: err.message || 'Unable to open billing portal', type: 'error' });
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 animate-pulse pb-12">
        <div className="h-10 w-72 rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-20 w-full rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl dark:bg-red-900/50">
          ⚠️
        </div>
        <h2 className="mt-3 text-lg font-bold text-red-900 dark:text-red-200">Billing Unavailable</h2>
        <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>
        <button onClick={loadBilling} className="btn-primary mt-4 px-5 py-2 text-xs shadow">
          Try Again
        </button>
      </div>
    );
  }

  const org = data.organization;
  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Header & Settings Tab Navigation */}
      <div>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
              <span>{org.name} Workspace</span>
              <span className="text-gray-300 dark:text-gray-700">·</span>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                {org.plan.replace('_', ' ')}
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Subscription & Billing
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Manage your subscription package, lead and team quotas, and invoice receipts.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-6 flex border-b border-gray-200 dark:border-gray-800">
          <Link
            href="/settings"
            className="border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition"
          >
            👤 Profile & Security
          </Link>
          <Link
            href="/settings/billing"
            className="border-b-2 border-sky-600 px-4 py-2.5 text-xs font-bold text-sky-600 dark:border-sky-400 dark:text-sky-400"
          >
            ⚡ Subscription & Plans
          </Link>
        </div>
      </div>

      {/* Dynamic Toast Notification */}
      {notification && (
        <div
          className={`rounded-2xl border p-4 text-xs font-semibold transition animate-in fade-in ${
            notification.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Subscription Health Banner */}
      <div
        className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${
          session?.user?.isPlatformAdmin
            ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-[#073652] to-emerald-950/20 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-gray-900 dark:to-emerald-950/20'
            : org.isTrialing
            ? 'border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-amber-50/40 dark:border-amber-900/40 dark:from-amber-950/20 dark:via-gray-900 dark:to-amber-950/20'
            : 'border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/40 dark:border-emerald-900/40 dark:from-emerald-950/20 dark:via-gray-900 dark:to-emerald-950/20'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md ${
                session?.user?.isPlatformAdmin
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : org.isTrialing
                  ? 'bg-amber-500 text-white shadow-amber-500/20'
                  : 'bg-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              {session?.user?.isPlatformAdmin ? (
                <ShieldCheck className="h-6 w-6 text-white" />
              ) : org.isTrialing ? (
                <Clock className="h-6 w-6 text-white" />
              ) : (
                <Sparkles className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {session?.user?.isPlatformAdmin
                    ? 'Platform Master Access'
                    : org.isTrialing
                    ? '14-Day Free Trial'
                    : 'Active Monthly Subscription'}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    session?.user?.isPlatformAdmin
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : org.isTrialing
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {session?.user?.isPlatformAdmin
                    ? 'Lifetime Unlimited'
                    : org.isTrialing
                    ? `${org.trialDaysRemaining} Days Remaining`
                    : 'Active'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {session?.user?.isPlatformAdmin
                  ? 'System Owner account with trial exemption, unlimited platform resources, and full administrative rights.'
                  : org.isTrialing
                  ? `Your trial gives full access to all ${data.currentPlan.name} features. Choose a plan below to keep uninterrupted access.`
                  : `Subscribed to ${data.currentPlan.name} ($${data.currentPlan.priceMonthly}/mo). Renews automatically next billing cycle.`}
              </p>
            </div>
          </div>

          {session?.user?.isPlatformAdmin ? (
            <Link
              href="/platform"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-emerald-500"
            >
              Platform Console →
            </Link>
          ) : (
            <a
              href="#pricing-tiers"
              className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {org.isTrialing ? 'Select Paid Plan ↓' : 'Change Tier ↓'}
            </a>
          )}
        </div>
      </div>

      {/* Resource Quota Overview Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Leads Quota Card */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Prospect Capacity</span>
            <span className="text-lg">👥</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {org.leadUsed} <span className="text-sm font-semibold text-gray-400">/ {org.leadLimit >= 100000 ? 'Unlimited' : org.leadLimit}</span>
            </span>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400">
              {org.leadLimit >= 100000 ? 'Unlimited' : `${org.leadPercentage}% used`}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${org.leadLimit >= 100000 ? 5 : Math.max(3, org.leadPercentage)}%` }}
            />
          </div>
        </div>

        {/* Team Seats Quota Card */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Team Seats</span>
            <span className="text-lg">🛡️</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {org.seatUsed} <span className="text-sm font-semibold text-gray-400">/ {org.seatLimit} seats</span>
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {org.seatPercentage}% used
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.max(5, org.seatPercentage)}%` }}
            />
          </div>
        </div>

        {/* Current Billing Cycle */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Billing Cycle</span>
            <span className="text-lg">💳</span>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              ${data.currentPlan.priceMonthly} <span className="text-xs font-semibold text-gray-400">/ month</span>
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Billed in {org.currency} · Auto-renews monthly
          </p>
        </div>
      </section>

      {/* 3-Tier Interactive Pricing Comparison Matrix */}
      <section id="pricing-tiers" className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Select a Plan Tier</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Upgrade or switch tiers at any time. Changes take effect immediately.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {data.plans.map((plan) => {
            const isCurrent = org.plan === plan.id;
            const isUpgrading = actionLoading === plan.id;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-6 transition-all duration-200 ${
                  isCurrent
                    ? 'border-sky-500 bg-sky-50/20 ring-2 ring-sky-500/20 shadow-lg dark:border-sky-400 dark:bg-sky-950/20'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
                }`}
              >
                {/* Badge if featured / popular */}
                {plan.badge && (
                  <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-sky-600 to-sky-500 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                    {isCurrent && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-snug">{plan.description}</p>

                  <div className="mt-4 flex items-baseline gap-1 border-b border-gray-100 pb-4 dark:border-gray-800">
                    <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">/ month</span>
                  </div>

                  <ul className="mt-5 space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-800">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-xl border border-sky-300 bg-sky-50 py-2.5 text-xs font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                    >
                      ✓ Active Workspace Tier
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlanChange(plan.id)}
                      disabled={!isAdmin || Boolean(actionLoading)}
                      className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 py-2.5 text-xs font-bold text-white shadow transition hover:from-sky-500 hover:to-sky-600 disabled:opacity-50"
                    >
                      {isUpgrading ? (
                        'Updating...'
                      ) : !isAdmin ? (
                        'Admin Only'
                      ) : plan.id === 'ENTERPRISE' ? (
                        'Upgrade to Scale →'
                      ) : (
                        `Switch to ${plan.name}`
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Payment Method & Invoices */}
      <section className="grid gap-6 lg:grid-cols-[1fr_1.5fr] pt-4">
        {/* Payment Method Card */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Payment Method</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Card used for recurring monthly charges</p>
          {isAdmin && (
            <button onClick={handleManageBilling} disabled={Boolean(actionLoading)} className="mt-3 rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-50">
              {actionLoading === 'portal' ? 'Opening…' : 'Manage billing in Stripe →'}
            </button>
          )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-12 items-center justify-center rounded-lg bg-white font-bold text-xs shadow-sm border border-gray-200 dark:bg-gray-900 dark:border-gray-700 text-sky-600">
                VISA
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">•••• •••• •••• 4242</p>
                <p className="text-[10px] text-gray-500">Expires 08/2029</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              Default
            </span>
          </div>

          <button
            onClick={() => alert('Billing portal integration: update payment method')}
            className="w-full rounded-xl border border-gray-300 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition"
          >
            Update Payment Card
          </button>
        </div>

        {/* Invoices History Table */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Invoices & Receipts</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Past subscription billing transactions</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-gray-100 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <tr>
                  <th className="pb-3 font-semibold">Invoice ID</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="py-3 font-semibold text-gray-900 dark:text-white">{inv.id}</td>
                    <td className="py-3 text-gray-500">{inv.date}</td>
                    <td className="py-3 font-bold text-gray-900 dark:text-white">
                      ${inv.amount} {inv.currency}
                    </td>
                    <td className="py-3">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => alert(`Downloading receipt for ${inv.id}`)}
                        className="font-semibold text-sky-600 hover:underline dark:text-sky-400"
                      >
                        PDF ↓
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
