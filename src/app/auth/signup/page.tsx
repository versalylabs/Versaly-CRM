'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPlan = searchParams.get('plan') || 'GROWTH_PRO';
  const [plan, setPlan] = useState(initialPlan);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Create Organization & User Account
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          companyName,
          email,
          password,
          currency,
          plan,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create workspace');
      }

      // 2. Automatically log the user into their fresh workspace
      const loginResult = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!loginResult || loginResult.error) {
        // Fallback: If auto-login didn't succeed, redirect to signin with banner
        router.push('/auth/signin?registered=true');
        return;
      }

      // 3. Smooth landing on dashboard
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to register right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12 dark:from-gray-950 dark:to-gray-900">
      <div className="w-full max-w-lg space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white font-black text-xl shadow-lg shadow-sky-500/20">
            S
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Start your 14-day free trial
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            No credit card required · Instant dedicated workspace setup
          </p>
        </div>

        {/* Feature Highlights Pill Banner */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 p-3 text-center text-xs dark:border-sky-900/40 dark:bg-sky-950/20">
          <div>
            <span className="block font-bold text-sky-900 dark:text-sky-200">Growth Pro</span>
            <span className="text-[10px] text-sky-700 dark:text-sky-400">14 Days Free</span>
          </div>
          <div className="border-x border-sky-200/60 dark:border-sky-800/60">
            <span className="block font-bold text-sky-900 dark:text-sky-200">500 Leads</span>
            <span className="text-[10px] text-sky-700 dark:text-sky-400">Included Quota</span>
          </div>
          <div>
            <span className="block font-bold text-sky-900 dark:text-sky-200">10 Seats</span>
            <span className="text-[10px] text-sky-700 dark:text-sky-400">Team Workload</span>
          </div>
        </div>

        {/* Registration Form Card */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-7 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Your Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                placeholder="Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-gray-900 placeholder-gray-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Company / Workspace Name */}
            <div>
              <label htmlFor="companyName" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Company / Agency Workspace Name
              </label>
              <input
                id="companyName"
                type="text"
                required
                placeholder="Horizon Realty Partners"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-gray-900 placeholder-gray-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Email & Currency in 2-cols */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="sarah@horizonrealty.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-gray-900 placeholder-gray-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="currency" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-xs font-medium text-gray-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="KES">KES (Ksh)</option>
                  <option value="ZAR">ZAR (R)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Create Password <span className="font-normal text-gray-400">(minimum 6 characters)</span>
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-gray-900 placeholder-gray-400 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 py-3 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-500 hover:to-sky-600 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Setting up workspace...
                </span>
              ) : (
                'Create Workspace & Start Free Trial →'
              )}
            </button>
          </form>

          {/* Terms & Privacy note */}
          <p className="mt-4 text-center text-[11px] text-gray-400 dark:text-gray-500">
            By signing up, you agree to our Terms of Service & Privacy Policy.
          </p>
        </div>

        {/* Existing User Link */}
        <div className="text-center text-xs text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/auth/signin" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
            Sign in to your workspace →
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center"><div className="text-xs text-gray-400">Loading signup...</div></div>}>
      <SignUpForm />
    </Suspense>
  );
}
