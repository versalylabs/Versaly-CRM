'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export function CtaSection() {
  return (
    <section className="relative px-5 py-10 lg:py-14 lg:px-8 overflow-hidden">
      {/* Radiant glow background */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[700px] rounded-full bg-gradient-to-r from-sky-500/20 via-cyan-400/15 to-sky-600/20 blur-[130px]" />

      {/* Level 3 Strong Glass Container */}
      <div className="relative mx-auto max-w-5xl rounded-[2.5rem] border border-sky-400/40 bg-gradient-to-b from-[#0a466a]/85 via-[#073652]/90 to-[#042438]/95 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.25)] backdrop-blur-2xl sm:p-12">
        {/* Specular Top Edge Light Refraction */}
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

        <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/60 px-3.5 py-1 text-xs font-semibold text-sky-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <Sparkles className="h-3.5 w-3.5 text-sky-400" /> Start Scaling Today
        </div>

        <h2 className="mx-auto mt-4 sm:mt-5 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl sm:leading-tight">
          Ready to take complete control of your client revenue?
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-sky-200/80 sm:text-lg">
          Get started in under 60 seconds. Test our full Growth Pro suite with your team for 14 days, completely free. No contracts, no risk.
        </p>

        <div className="mt-6 sm:mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/auth/signup?plan=GROWTH_PRO"
            className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-sky-500/30 transition-all hover:bg-sky-400 hover:shadow-sky-500/50 sm:w-auto"
          >
            <span>Start 14-Day Free Trial</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/auth/signin"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-[#041c2c]/90 px-8 py-3.5 text-base font-bold text-sky-200 backdrop-blur-md transition-all hover:border-sky-400/60 hover:bg-[#072a42] sm:w-auto"
          >
            <span>Sign In to Existing Workspace</span>
          </Link>
        </div>

        <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-sky-300/80">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-emerald-400" /> Instant activation
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Cancel anytime
          </span>
        </div>
      </div>
    </section>
  );
}
