'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowRight, Shield, Zap } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  popular?: boolean;
  features: string[];
  ctaText: string;
  signupKey: string;
}

const PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    annualPrice: 24,
    description: 'A focused, high-precision workspace for boutique agencies and lean sales teams.',
    signupKey: 'STARTER',
    ctaText: 'Start 14-Day Free Trial',
    features: [
      '1,000 active customer leads',
      'Up to 3 team members',
      'Visual deal pipeline & stage tracking',
      'Email sequences & task scheduler',
      'Standard conversion rate reports',
      'Community & email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth Pro',
    monthlyPrice: 79,
    annualPrice: 64,
    description: 'The complete revenue engine with automated WhatsApp outreach & customer retention analytics.',
    popular: true,
    signupKey: 'GROWTH_PRO',
    ctaText: 'Start 14-Day Free Trial',
    features: [
      '5,000 active customer leads',
      'Up to 10 team members',
      'Integrated WhatsApp & Email outreach',
      'AI Customer Retention & Churn Scoring',
      'Role-based permissions & audit log',
      'Revenue trajectory forecasting',
      'Automated SLA & task escalation',
      'Priority live chat support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Scale',
    monthlyPrice: 199,
    annualPrice: 159,
    description: 'Mission-critical capacity, unlimited automation triggers, and dedicated account onboarding.',
    signupKey: 'ENTERPRISE',
    ctaText: 'Start 14-Day Free Trial',
    features: [
      '100,000 active customer leads',
      'Up to 50 team members',
      'Custom webhook triggers & integrations',
      'Multi-currency billing (USD, KES, EUR)',
      'Custom data schemas & field validation',
      'Export audit trails & compliance logs',
      'Dedicated Customer Success Manager',
      '99.9% Uptime SLA commitment',
    ],
  },
];

export function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="relative px-5 py-10 lg:py-12 lg:px-8">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] rounded-full bg-sky-500/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/60 px-3.5 py-1 text-xs font-semibold text-sky-300">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" /> Transparent Subscription Pricing
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Predictable plans. Built for scalable growth.
          </h2>
          <p className="mt-3 text-base text-sky-200/70 sm:text-lg">
            Every subscription includes a 14-day fully featured trial. Upgrade, downgrade, or cancel anytime with zero lock-in contracts.
          </p>

          {/* Billing Switcher with Frosted Glass */}
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#041c2c]/90 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-md">
            <button
              onClick={() => setAnnual(false)}
              className={`relative rounded-full px-5 py-2 text-xs font-bold transition-colors ${
                !annual ? 'text-white' : 'text-sky-300/70 hover:text-white'
              }`}
            >
              {!annual && (
                <motion.div
                  layoutId="billingToggle"
                  className="absolute inset-0 rounded-full bg-sky-600 shadow-md shadow-sky-600/40"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">Monthly Billing</span>
            </button>

            <button
              onClick={() => setAnnual(true)}
              className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-colors ${
                annual ? 'text-white' : 'text-sky-300/70 hover:text-white'
              }`}
            >
              {annual && (
                <motion.div
                  layoutId="billingToggle"
                  className="absolute inset-0 rounded-full bg-sky-600 shadow-md shadow-sky-600/40"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">Annual Billing</span>
              <span className="relative z-10 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300 border border-emerald-400/30">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid with Level 2 & Level 3 Glass */}
        <div className="mt-8 lg:mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className={`relative overflow-hidden flex flex-col justify-between rounded-3xl p-7 sm:p-8 transition-all ${
                  plan.popular
                    ? 'border-2 border-sky-400/50 bg-gradient-to-b from-[#0a466a]/90 via-[#073a5a]/90 to-[#042438]/95 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.25)] backdrop-blur-2xl lg:-translate-y-2'
                    : 'border border-white/[0.12] bg-[#073652]/60 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-xl hover:border-sky-400/40 hover:bg-[#073652]/75'
                }`}
              >
                {/* Top specular highlight line */}
                <div
                  className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${
                    plan.popular ? 'via-white/35' : 'via-white/20'
                  } to-transparent`}
                />

                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 px-4 py-1 text-xs font-black uppercase tracking-wider text-[#041d2d] shadow-md">
                      <Sparkles className="h-3 w-3" /> Most Popular Choice
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                    {plan.popular && (
                      <span className="rounded-md bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-300 border border-sky-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                        14-Day Free Trial
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-sky-200/70 min-h-[44px]">
                    {plan.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-2 border-y border-white/10 py-4">
                    <span className="text-5xl font-black tracking-tight text-white">
                      ${price}
                    </span>
                    <span className="text-sm font-medium text-sky-300/70">
                      / month {annual && <span className="text-xs text-sky-400">(billed annually)</span>}
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <div className="mt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      Included Capabilities:
                    </p>
                    <ul className="mt-3 space-y-2.5 text-sm text-sky-100">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-7">
                  <Link
                    href={`/auth/signup?plan=${plan.signupKey}`}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-center text-sm font-bold transition-all shadow-md ${
                      plan.popular
                        ? 'bg-sky-500 text-white hover:bg-sky-400 shadow-sky-500/30 hover:shadow-sky-500/50'
                        : 'border border-sky-400/40 bg-[#083552] text-white hover:bg-sky-600/40'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <p className="mt-2 text-center text-[11px] text-sky-300/60">
                    Instant access · No credit card required
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Security & Guarantee Bar with Frosted Glass */}
        <div className="mt-8 lg:mt-10 flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-white/10 bg-[#041c2c]/85 px-6 py-3.5 text-xs font-semibold text-sky-200/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sky-400" />
            <span>Encrypted Multi-Tenant Isolation</span>
          </div>
          <span className="text-sky-500/40">•</span>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span>Instant Workspace Setup (&lt; 60 seconds)</span>
          </div>
          <span className="text-sky-500/40">•</span>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-cyan-400" />
            <span>KES, USD, EUR Multi-Currency Checkout</span>
          </div>
        </div>
      </div>
    </section>
  );
}
