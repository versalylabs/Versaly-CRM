'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowRight, Shield, Zap, HelpCircle, PhoneCall } from 'lucide-react';

interface PricingPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  annualSavings: number;
  description: string;
  popular?: boolean;
  highlightFeatures: string[];
  features: string[];
  ctaText: string;
  signupKey: 'STARTER' | 'GROWTH_PRO' | 'ENTERPRISE';
}

const PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    annualPrice: 24,
    annualSavings: 60,
    description: 'A focused, high-precision workspace for boutique agencies and lean sales teams.',
    signupKey: 'STARTER',
    ctaText: 'Start 14-Day Free Trial',
    highlightFeatures: ['Visual deal pipeline', 'Email sequences'],
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
    annualSavings: 180,
    description: 'The complete revenue engine with automated WhatsApp outreach & customer retention analytics.',
    popular: true,
    signupKey: 'GROWTH_PRO',
    ctaText: 'Start 14-Day Free Trial',
    highlightFeatures: ['Integrated WhatsApp outreach', 'AI Customer Retention & Churn Scoring'],
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
    annualSavings: 480,
    description: 'Mission-critical capacity, unlimited automation triggers, and dedicated account onboarding.',
    signupKey: 'ENTERPRISE',
    ctaText: 'Start 14-Day Free Trial',
    highlightFeatures: ['100,000 active customer leads', 'Dedicated Customer Success Manager'],
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

/**
 * Interactive React Bits inspired Glass Spotlight Card
 */
function PricingCard({
  plan,
  annual,
}: {
  plan: PricingPlan;
  annual: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const price = annual ? plan.annualPrice : plan.monthlyPrice;
  const originalPrice = plan.monthlyPrice;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  return (
    <div className="relative pt-6 pb-2">
      {/* Most Popular Floating Badge - Positioned cleanly with high z-index and zero clipping */}
      {plan.popular && (
        <div className="absolute top-0.5 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 via-sky-300 to-cyan-400 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-[#041e30] shadow-[0_4px_20px_rgba(34,211,238,0.55)] ring-2 ring-white/50">
            <Sparkles className="h-3.5 w-3.5 fill-[#041e30] animate-pulse" />
            Most Popular Choice
          </span>
        </div>
      )}

      {/* Main Glass Spotlight Card */}
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        whileHover={{ y: -8 }}
        className={`group relative flex flex-col justify-between rounded-3xl p-7 sm:p-8 transition-all duration-300 backdrop-blur-2xl ${
          plan.popular
            ? 'border-2 border-sky-400/70 bg-gradient-to-b from-[#093d5f]/95 via-[#062d47]/95 to-[#041f32]/98 shadow-[0_20px_50px_rgba(0,0,0,0.55),0_0_35px_rgba(14,165,233,0.25),inset_0_1px_2px_rgba(255,255,255,0.3)]'
            : 'border border-white/15 bg-gradient-to-b from-[#073652]/70 via-[#052b42]/75 to-[#031d2e]/85 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.15)] hover:border-sky-400/50 hover:shadow-[0_20px_45px_rgba(0,0,0,0.55),0_0_25px_rgba(14,165,233,0.18)]'
        }`}
      >
        {/* Dynamic Mouse Spotlight Glow */}
        {isHovered && (
          <div
            className="pointer-events-none absolute -inset-px rounded-3xl opacity-100 transition-opacity duration-300 z-0"
            style={{
              background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(56, 189, 248, 0.18), transparent 70%)`,
            }}
          />
        )}

        {/* Top Specular Edge Highlight */}
        <div
          className={`pointer-events-none absolute inset-x-8 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent ${
            plan.popular ? 'via-cyan-300/80' : 'via-white/30'
          } to-transparent z-10`}
        />

        <div className="relative z-10">
          {/* Plan Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black tracking-tight text-white">{plan.name}</h3>
            {plan.popular ? (
              <span className="rounded-full bg-sky-400/20 px-3 py-0.5 text-[11px] font-extrabold text-sky-200 border border-sky-400/40 shadow-inner">
                14-Day Free Trial
              </span>
            ) : (
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-sky-300/80 border border-white/10">
                14-Day Trial
              </span>
            )}
          </div>

          <p className="mt-3 text-sm text-sky-100/75 leading-relaxed min-h-[44px]">
            {plan.description}
          </p>

          {/* Pricing Display */}
          <div className="mt-5 border-y border-white/10 py-4">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black tracking-tight text-white">
                ${price}
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  {annual && (
                    <span className="text-sm font-semibold text-sky-400/60 line-through">
                      ${originalPrice}
                    </span>
                  )}
                  <span className="text-xs font-semibold text-sky-200/80">
                    / month
                  </span>
                </div>
                {annual && (
                  <span className="text-[11px] font-bold text-emerald-300">
                    Billed annually (Save ${plan.annualSavings}/yr)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Included Features Checklist */}
          <div className="mt-6">
            <p className="text-xs font-black uppercase tracking-wider text-sky-300/90 flex items-center gap-1.5">
              <span>Included Capabilities</span>
            </p>
            <ul className="mt-3.5 space-y-3 text-sm text-sky-100/90">
              {plan.features.map((feature, i) => {
                const isHighlighted = plan.highlightFeatures.some((hf) =>
                  feature.toLowerCase().includes(hf.toLowerCase())
                );
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                        isHighlighted || plan.popular
                          ? 'bg-cyan-400/25 text-cyan-300 ring-1 ring-cyan-400/40'
                          : 'bg-sky-500/20 text-sky-400'
                      }`}
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                    <span className={isHighlighted ? 'font-semibold text-white' : ''}>
                      {feature}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* CTA Button and Microcopy */}
        <div className="relative z-10 mt-8 pt-4 border-t border-white/10">
          <Link
            href={`/auth/signup?plan=${plan.signupKey}&billing=${annual ? 'annual' : 'monthly'}`}
            className={`group/btn flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-center text-sm font-extrabold transition-all duration-200 ${
              plan.popular
                ? 'bg-gradient-to-r from-sky-500 via-cyan-400 to-sky-500 bg-[length:200%_auto] text-[#031d2e] hover:brightness-110 shadow-[0_4px_20px_rgba(14,165,233,0.5)] active:scale-[0.98]'
                : 'border border-sky-400/40 bg-sky-950/50 text-white hover:bg-sky-500/20 hover:border-sky-300 shadow-[0_4px_16px_rgba(0,0,0,0.3)] active:scale-[0.98]'
            }`}
          >
            <span>{plan.ctaText}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
          </Link>

          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-sky-200/60">
            <span>Instant access</span>
            <span>·</span>
            <span>No credit card required</span>
          </div>

          {/* Enterprise custom contact link */}
          {plan.id === 'enterprise' && (
            <div className="mt-3 text-center">
              <a
                href="#contact"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-white transition-colors"
              >
                <PhoneCall className="h-3 w-3" />
                <span>Need custom SLA or invoice? Talk to us →</span>
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="relative px-5 py-12 lg:py-16 lg:px-8">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[550px] w-[900px] rounded-full bg-sky-500/10 blur-[150px]" />

      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-950/70 px-4 py-1.5 text-xs font-bold text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Transparent Subscription Pricing</span>
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">
            Predictable plans. Built for scalable growth.
          </h2>

          <p className="mt-3.5 text-base text-sky-200/80 sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Every subscription starts with a 14-day full access trial. Switch plans or cancel anytime with zero lock-in contracts.
          </p>

          {/* Billing Switcher with Frosted Glass Pill */}
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-white/15 bg-[#031d2e]/90 p-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12),0_8px_24px_rgba(0,0,0,0.4)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`relative rounded-full px-5 py-2 text-xs font-bold transition-colors ${
                !annual ? 'text-white' : 'text-sky-300/70 hover:text-white'
              }`}
            >
              {!annual && (
                <motion.div
                  layoutId="billingToggle"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-600 to-sky-500 shadow-md shadow-sky-600/40"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">Monthly Billing</span>
            </button>

            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-colors ${
                annual ? 'text-white' : 'text-sky-300/70 hover:text-white'
              }`}
            >
              {annual && (
                <motion.div
                  layoutId="billingToggle"
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-600 to-sky-500 shadow-md shadow-sky-600/40"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">Annual Billing</span>
              <span className="relative z-10 rounded-full bg-emerald-400/25 px-2 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-400/40 shadow-sm">
                SAVE 20%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-8 lg:mt-12 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan) => (
            <PricingCard key={plan.id} plan={plan} annual={annual} />
          ))}
        </div>

        {/* Security, Compliance & Multi-Currency Assurance Bar */}
        <div className="mt-10 lg:mt-12 flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-white/15 bg-[#031e30]/80 px-6 py-4 text-xs font-semibold text-sky-200/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sky-400" />
            <span>Encrypted Multi-Tenant Isolation</span>
          </div>
          <span className="text-sky-500/40 hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span>Instant Workspace Setup (&lt; 60 seconds)</span>
          </div>
          <span className="text-sky-500/40 hidden sm:inline">•</span>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-cyan-400" />
            <span>KES, USD, EUR Multi-Currency Checkout</span>
          </div>
        </div>
      </div>
    </section>
  );
}

