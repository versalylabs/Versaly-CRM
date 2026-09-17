'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Star, ShieldCheck, TrendingUp, Building, Award } from 'lucide-react';
import { AnimatedCounter } from './AnimatedCounter';

const METRICS = [
  { label: 'Active Pipeline Tracked', value: 42, prefix: '$', suffix: 'M+', decimals: 0 },
  { label: 'Qualified Deals Closed', value: 12400, prefix: '', suffix: '+', decimals: 0 },
  { label: 'Customer Retention Rate', value: 99.4, prefix: '', suffix: '%', decimals: 1 },
  { label: 'Average Response Time', value: 14, prefix: '< ', suffix: ' mins', decimals: 0 },
];

const TESTIMONIALS = [
  {
    quote:
      'Versaly CRM eliminated lead leakage completely. The native WhatsApp outreach and SLA follow-up triggers alone increased our monthly close rate by 34%.',
    author: 'Michael Otieno',
    title: 'Managing Director, Rift Digital Media',
    company: '14 Seats on Growth Pro',
    rating: 5,
  },
  {
    quote:
      'Most legacy CRMs feel like bloated spreadsheets from 2008. Versaly is the first platform where our reps and Customer Success team genuinely love their daily workflow.',
    author: 'Claire Muthoni',
    title: 'VP of Commercial Operations',
    company: 'Twiga Logistics Group',
    rating: 5,
  },
  {
    quote:
      'Being able to invoice in KES and USD while tracking customer retention health scores has transformed how we forecast recurring revenue.',
    author: 'David Kimani',
    title: 'Founder & CEO, Apex FinTech Solutions',
    company: 'Enterprise Scale Plan',
    rating: 5,
  },
];

export function TestimonialsAndMetrics() {
  return (
    <section id="testimonials" className="relative px-5 py-10 lg:py-12 lg:px-8 border-y border-sky-500/15 bg-[#041d2d]/60">
      <div className="mx-auto max-w-7xl">
        {/* Animated Metrics Ribbon with Level 1 Glass */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 sm:gap-6">
          {METRICS.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative overflow-hidden text-center rounded-2xl border border-white/[0.08] bg-[#062c44]/50 p-5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.1)] backdrop-blur-md"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                <AnimatedCounter
                  value={m.value}
                  prefix={m.prefix}
                  suffix={m.suffix}
                  decimals={m.decimals}
                />
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-sky-300/70 sm:text-sm">
                {m.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Customer Testimonials Grid */}
        <div className="mt-8 lg:mt-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/60 px-3.5 py-1 text-xs font-semibold text-sky-300">
              <Award className="h-3.5 w-3.5 text-sky-400" /> Proven Commercial ROI
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Trusted by operators who value execution over friction.
            </h2>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="relative overflow-hidden flex flex-col justify-between rounded-3xl border border-white/[0.12] bg-[#073652]/60 p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-xl hover:border-sky-400/40 hover:bg-[#073652]/75 transition-all"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <div>
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: t.rating }).map((_, r) => (
                      <Star key={r} className="h-4 w-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-sky-100/90 sm:text-base italic">
                    &quot;{t.quote}&quot;
                  </p>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4">
                  <p className="font-bold text-white text-sm">{t.author}</p>
                  <p className="text-xs text-sky-300/80">{t.title}</p>
                  <span className="mt-1 inline-block rounded-md bg-sky-950/60 px-2 py-0.5 text-[10px] font-semibold text-sky-400 border border-sky-500/20">
                    {t.company}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
