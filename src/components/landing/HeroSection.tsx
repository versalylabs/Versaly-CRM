'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  TrendingUp, 
  Users, 
  Zap, 
  ShieldCheck, 
  Activity, 
  MessageSquare,
  Play,
  ArrowUpRight
} from 'lucide-react';
import { Spotlight } from './Spotlight';
import { AnimatedCounter } from './AnimatedCounter';

export function HeroSection() {
  const [activeMockTab, setActiveMockTab] = useState<'pipeline' | 'retention' | 'activity'>('pipeline');

  return (
    <section id="hero" className="relative overflow-hidden pt-24 pb-10 sm:pt-28 lg:pt-32 lg:pb-12">
      {/* Relatable Team / Business Operator Background with Color-Matching Gradient */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Modern business/tech team collaborating in workspace */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30 mix-blend-luminosity filter contrast-110 brightness-90 scale-105"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=2000&q=80')",
          }}
        />
        {/* Second visual layer: modern CRM / analytics screens and professionals */}
        <div 
          className="absolute inset-0 bg-cover bg-top bg-no-repeat opacity-20 mix-blend-overlay"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=2000&q=80')",
          }}
        />
        {/* Brand gradient overlay ensuring exact color alignment with #053048 */}
        <div 
          className="absolute inset-0 bg-gradient-to-b from-[#053048]/60 via-[#053048]/85 to-[#053048]"
        />
        {/* Ambient atmospheric cyan/sky radiant aura */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[1000px] rounded-full bg-sky-500/15 blur-[140px]" />
      </div>

      {/* Aceternity Spotlight Effects */}
      <Spotlight className="-top-40 left-0 md:left-40 md:-top-20" fill="#38bdf8" />
      <Spotlight className="top-1/3 right-0 md:right-20" fill="#0284c7" />

      <div className="relative z-10 mx-auto max-w-7xl px-5 lg:px-8">
        {/* Top Announcement Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center gap-2.5 rounded-full border border-sky-400/35 bg-[#07334d]/85 px-4 py-1.5 text-xs font-semibold text-sky-200 shadow-[0_4px_20px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white">Versaly CRM 2.0</span>
            <span className="text-sky-400/60">|</span>
            <span className="text-sky-300">Intelligent Pipeline & Retention Operating System</span>
            <ArrowRight className="h-3 w-3 text-sky-400" />
          </div>
        </motion.div>

        {/* Shorter & Catchier Hero Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-6 max-w-4xl text-center"
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl sm:leading-[1.12] lg:text-7xl">
            Close deals faster.<br />
            <span className="bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-200 bg-clip-text text-transparent">
              Retain every client.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-sky-100/80 sm:text-xl">
            Bring your leads, WhatsApp conversations, automated tasks, and recurring revenue into one calm command center.
          </p>

          {/* Action CTAs */}
          <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signup?plan=GROWTH_PRO"
              className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-8 py-3.5 text-base font-bold text-white shadow-xl shadow-sky-500/25 transition-all hover:bg-sky-400 hover:shadow-sky-500/40 sm:w-auto"
            >
              <span>Start 14-Day Free Trial</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <a
              href="#pipeline"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-[#06263b]/80 px-8 py-3.5 text-base font-bold text-sky-200 backdrop-blur-md transition-all hover:border-sky-400/60 hover:bg-[#083552] sm:w-auto"
            >
              <Play className="h-4 w-4 fill-sky-400 text-sky-400" />
              <span>Explore Interactive Pipeline</span>
            </a>
          </div>

          {/* Reassurance Badges */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-sky-300/80">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> KES & USD billing supported
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 100% Multi-tenant data isolation
            </span>
          </div>
        </motion.div>

        {/* Interactive Hero CRM Dashboard Preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative mx-auto mt-10 lg:mt-12 max-w-5xl"
        >
          {/* Ambient Glow behind the mockup */}
          <div className="absolute -inset-1.5 rounded-[2.5rem] bg-gradient-to-r from-sky-500/30 via-cyan-400/20 to-sky-600/30 blur-2xl" />

          {/* Floating Telemetry Micro-Surface 1: WhatsApp Automated Outreach */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: [0, -6, 0], scale: 1 }}
            transition={{
              opacity: { duration: 0.6, delay: 0.4 },
              y: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
            }}
            className="absolute -top-5 -right-2 sm:-top-7 sm:-right-4 z-20 hidden sm:flex items-center gap-3 rounded-2xl border border-sky-400/40 bg-gradient-to-b from-[#0a466a]/90 via-[#073652]/90 to-[#042438]/95 p-3.5 shadow-[0_16px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-xl"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>WhatsApp Outreach Sent</span>
              </div>
              <p className="text-[10px] text-sky-200/80">Kevin M. replied in 42s · Hot Lead</p>
            </div>
          </motion.div>

          {/* Floating Telemetry Micro-Surface 2: Customer Retention Health */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: [0, 6, 0], scale: 1 }}
            transition={{
              opacity: { duration: 0.6, delay: 0.6 },
              y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }
            }}
            className="absolute -bottom-5 -left-2 sm:-bottom-7 sm:-left-4 z-20 hidden sm:flex items-center gap-3 rounded-2xl border border-sky-400/40 bg-gradient-to-b from-[#0a466a]/90 via-[#073652]/90 to-[#042438]/95 p-3.5 shadow-[0_16px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-xl"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-white">
                <span>CS Health: 98.4%</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-300">LOW CHURN RISK</span>
              </div>
              <p className="text-[10px] text-sky-200/80">Twiga Commerce renewed · KES 4.8M</p>
            </div>
          </motion.div>

          {/* Card Frame with Level 3 Glass & Specular Light Line */}
          <div className="relative rounded-[2rem] border border-sky-400/35 bg-gradient-to-b from-[#073a5a]/85 via-[#062c45]/90 to-[#042034]/95 p-3 shadow-[0_25px_60px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.2)] backdrop-blur-2xl sm:p-5">
            {/* Top specular highlight line */}
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            {/* Window chrome header */}
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-bold text-sky-200">
                  Versaly Command Center · <span className="text-emerald-400">Live Workspace</span>
                </span>
              </div>

              {/* View Switcher inside Mockup */}
              <div className="hidden items-center gap-1 rounded-lg bg-[#041d2d] p-1 text-xs font-semibold sm:flex">
                <button
                  onClick={() => setActiveMockTab('pipeline')}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    activeMockTab === 'pipeline' ? 'bg-sky-600 text-white' : 'text-sky-300 hover:text-white'
                  }`}
                >
                  Pipeline Board
                </button>
                <button
                  onClick={() => setActiveMockTab('retention')}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    activeMockTab === 'retention' ? 'bg-sky-600 text-white' : 'text-sky-300 hover:text-white'
                  }`}
                >
                  Retention Telemetry
                </button>
                <button
                  onClick={() => setActiveMockTab('activity')}
                  className={`rounded-md px-2.5 py-1 transition-all ${
                    activeMockTab === 'activity' ? 'bg-sky-600 text-white' : 'text-sky-300 hover:text-white'
                  }`}
                >
                  WhatsApp Feed
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-md bg-sky-950/80 px-2.5 py-1 text-[11px] font-bold text-sky-300 border border-sky-500/30">
                  demo@versaly.com
                </span>
              </div>
            </div>

            {/* Mockup Body Content */}
            <div className="mt-4 rounded-xl bg-[#041d2d]/90 p-4 sm:p-6 border border-sky-500/15">
              {/* Metric Highlights Strip with Frosted Glass Styling */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-[#062d47]/70 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-sky-300/70 uppercase">Active Leads</p>
                  <p className="mt-1 text-xl font-black text-white sm:text-2xl">
                    <AnimatedCounter value={1284} duration={2} />
                  </p>
                  <span className="mt-1 inline-flex items-center text-[10px] font-bold text-emerald-400">
                    <TrendingUp className="mr-1 h-3 w-3" /> +18.4% this mo
                  </span>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#062d47]/70 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-sky-300/70 uppercase">Pipeline Value</p>
                  <p className="mt-1 text-xl font-black text-white sm:text-2xl">
                    <AnimatedCounter prefix="KES " value={14.8} decimals={1} suffix="M" duration={2.2} />
                  </p>
                  <span className="mt-1 inline-flex items-center text-[10px] font-bold text-emerald-400">
                    <TrendingUp className="mr-1 h-3 w-3" /> +24.2% MoM
                  </span>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#062d47]/70 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-sky-300/70 uppercase">Retention Score</p>
                  <p className="mt-1 text-xl font-black text-white sm:text-2xl">
                    <AnimatedCounter value={98.4} decimals={1} suffix="%" duration={1.8} />
                  </p>
                  <span className="mt-1 inline-flex items-center text-[10px] font-bold text-emerald-400">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Zero Churn
                  </span>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#062d47]/70 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-sky-300/70 uppercase">Avg Close Time</p>
                  <p className="mt-1 text-xl font-black text-white sm:text-2xl">
                    11.2 <span className="text-xs font-normal text-sky-300">Days</span>
                  </p>
                  <span className="mt-1 inline-flex items-center text-[10px] font-bold text-cyan-400">
                    <Zap className="mr-1 h-3 w-3" /> 2.4x Faster
                  </span>
                </div>
              </div>

              {/* Dynamic Content based on Mock Tab */}
              {activeMockTab === 'pipeline' && (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-sky-500/20 bg-[#072f47] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-sky-300">Discovery (5)</span>
                      <span className="text-[10px] text-sky-400">KES 4.2M</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="rounded-lg bg-[#041f30] p-2.5 border border-white/5">
                        <div className="flex justify-between text-[11px] font-bold text-white">
                          <span>Safari Logistics</span>
                          <span className="text-sky-300">KES 1.4M</span>
                        </div>
                        <p className="text-[10px] text-sky-300/60 mt-0.5">WhatsApp sequence active</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-500/20 bg-[#072f47] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-sky-300">Proposal Sent (3)</span>
                      <span className="text-[10px] text-sky-400">KES 6.8M</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="rounded-lg bg-[#041f30] p-2.5 border border-white/5">
                        <div className="flex justify-between text-[11px] font-bold text-white">
                          <span>Koko Clean Energies</span>
                          <span className="text-sky-300">KES 3.2M</span>
                        </div>
                        <p className="text-[10px] text-amber-300/80 mt-0.5">Awaiting contract sign</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-[#072f47] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-400">Closed Won (8)</span>
                      <span className="text-[10px] text-emerald-300">KES 8.9M</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="rounded-lg bg-[#041f30] p-2.5 border border-emerald-500/20">
                        <div className="flex justify-between text-[11px] font-bold text-white">
                          <span>Twiga Commerce</span>
                          <span className="text-emerald-400">KES 4.8M</span>
                        </div>
                        <p className="text-[10px] text-emerald-300/80 mt-0.5">Billed & active in CRM</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeMockTab === 'retention' && (
                <div className="mt-4 rounded-xl border border-sky-500/20 bg-[#072f47] p-4 text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-bold text-white">Client Health & Churn Telemetry</span>
                    <span className="text-emerald-400 font-bold">100% Healthy Accounts</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-[#041f30] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="font-semibold text-white">Apex FinTech Global</span>
                      </div>
                      <span className="text-sky-300">98/100 Health · Renewal in 45 days</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#041f30] p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="font-semibold text-white">Safari Logistics Ltd</span>
                      </div>
                      <span className="text-sky-300">94/100 Health · 8 seats active</span>
                    </div>
                  </div>
                </div>
              )}

              {activeMockTab === 'activity' && (
                <div className="mt-4 rounded-xl border border-sky-500/20 bg-[#072f47] p-4 text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-bold text-white">Live Automated Outreach Feed</span>
                    <span className="text-sky-400 font-semibold">Real-time webhooks</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-lg bg-[#041f30] p-2.5">
                      <span className="text-sky-200">WhatsApp delivered to Kevin Mwangi: &quot;Proposal ready for download&quot;</span>
                      <span className="text-[10px] text-sky-400 font-mono">1 min ago</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-[#041f30] p-2.5">
                      <span className="text-sky-200">Email sequence step 2 dispatched to 14 marketing leads</span>
                      <span className="text-[10px] text-sky-400 font-mono">5 mins ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
