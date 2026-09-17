'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Mail, 
  Activity, 
  Zap, 
  ShieldCheck, 
  Users, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export function BentoGridFeatures() {
  return (
    <section id="features" className="relative px-5 py-10 lg:py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/60 px-3.5 py-1 text-xs font-semibold text-sky-300">
            <Zap className="h-3.5 w-3.5 text-sky-400" /> Platform Architecture
          </div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Engineered for high-performing subscription businesses.
          </h2>
          <p className="mt-3 text-base text-sky-200/70 sm:text-lg">
            Say goodbye to fragmented tools, disconnected WhatsApp chats, and invisible churn risks. Versaly CRM brings every signal into one calm, predictable command center.
          </p>
        </div>

        {/* Bento Grid with Level 2 Glass */}
        <div className="mt-8 lg:mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-3">
          {/* Card 1: Omnichannel WhatsApp + Email (Col Span 2) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="group relative overflow-hidden rounded-3xl border border-white/[0.12] bg-[#073652]/60 p-6 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-xl md:col-span-2 hover:border-sky-400/40 hover:bg-[#073652]/75 transition-all"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl group-hover:bg-sky-500/20 transition-all" />
            
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-300 border border-sky-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-[11px] font-bold text-emerald-300">
                Live Multi-Channel Sync
              </span>
            </div>

            <h3 className="mt-5 text-xl font-bold text-white sm:text-2xl">
              Omnichannel Outreach: WhatsApp & Email in One Thread
            </h3>
            <p className="mt-2 max-w-xl text-sm text-sky-200/70">
              Run personalized WhatsApp nudges and multi-step email campaigns without switching apps. Every customer interaction is logged and attached directly to the lead timeline.
            </p>

            {/* Simulated Live Chat / Outreach UI */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#042033]/80 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5 text-xs text-sky-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  WhatsApp Business API · Connected
                </span>
                <span className="text-[11px] text-sky-400">Response Rate: 84%</span>
              </div>
              
              <div className="mt-3 space-y-2 text-xs">
                <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-[#0a3550] p-3 text-sky-100 border border-sky-500/20">
                  <p className="font-medium text-sky-300 text-[10px]">Automated Trigger · Deal in Discovery &gt; 48h</p>
                  <p className="mt-0.5">Hi Kevin! We noticed you checked our Growth Pro pricing. Would you like a 10-minute walkthrough tailored for Safari Logistics?</p>
                  <span className="mt-1 block text-[9px] text-sky-400 text-right">09:14 AM · Delivered ✓✓</span>
                </div>

                <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-sky-600/90 p-3 text-white shadow-sm">
                  <p className="font-medium text-white/80 text-[10px]">Kevin Mwangi · Safari Logistics</p>
                  <p className="mt-0.5">Yes please! Does Thursday 2 PM work? Also, can we onboard 8 team seats right away?</p>
                  <span className="mt-1 block text-[9px] text-sky-200 text-right">09:17 AM</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: AI Retention & CS Health Scoring */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="group relative overflow-hidden rounded-3xl border border-white/[0.12] bg-[#073652]/60 p-6 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-xl hover:border-sky-400/40 hover:bg-[#073652]/75 transition-all flex flex-col justify-between"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-indigo-500/30 bg-indigo-950/60 px-3 py-1 text-[11px] font-bold text-indigo-300">
                  CS Engine
                </span>
              </div>

              <h3 className="mt-5 text-xl font-bold text-white">
                Customer Success & Churn Scoring
              </h3>
              <p className="mt-2 text-sm text-sky-200/70">
                Predict churn before it happens. Dynamic retention algorithms monitor seat utilization, engagement frequency, and invoice renewals.
              </p>
            </div>

            {/* Retention Gauge Simulation */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#042033]/80 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Account Health Index</span>
                  <div className="mt-1 text-2xl font-black text-white">96.4 <span className="text-sm font-medium text-emerald-400">/ 100</span></div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-950/40 text-xs font-black text-emerald-400">
                  EXCELLENT
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-sky-300/80 border-t border-white/5 pt-2">
                <span>Predicted Churn Risk</span>
                <span className="font-bold text-emerald-400">&lt; 1.2% Low</span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Real-Time Pipeline Telemetry */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="group relative overflow-hidden rounded-3xl border border-white/[0.12] bg-[#073652]/60 p-6 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-xl hover:border-sky-400/40 hover:bg-[#073652]/75 transition-all flex flex-col justify-between"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-950/60 px-3 py-1 text-[11px] font-bold text-cyan-300">
                  Revenue Intel
                </span>
              </div>

              <h3 className="mt-5 text-xl font-bold text-white">
                Revenue Trajectory & Forecasting
              </h3>
              <p className="mt-2 text-sm text-sky-200/70">
                Track conversion rates across each stage with automated revenue forecasts tailored for recurring subscriptions.
              </p>
            </div>

            {/* Mini Trend Bar Chart */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#042033]/80 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Monthly MRR Growth</span>
                <span className="font-bold text-cyan-400">+24.6% MoM</span>
              </div>
              <div className="mt-3 flex h-16 items-end gap-2">
                {[30, 45, 40, 60, 55, 75, 70, 95, 85, 100].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t bg-cyan-950/80" style={{ height: `${h}%` }}>
                    <div
                      className="w-full rounded-t bg-cyan-400 transition-all group-hover:bg-sky-400"
                      style={{ height: `${Math.min(100, h * 0.85)}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 4: Automated Task & SLA Dispatch */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="group relative overflow-hidden rounded-3xl border border-white/[0.12] bg-[#073652]/60 p-6 sm:p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.15)] backdrop-blur-xl md:col-span-2 hover:border-sky-400/40 hover:bg-[#073652]/75 transition-all"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]">
                <Clock className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-amber-500/30 bg-amber-950/60 px-3 py-1 text-[11px] font-bold text-amber-300">
                Zero Stale Leads
              </span>
            </div>

            <h3 className="mt-5 text-xl font-bold text-white sm:text-2xl">
              Automated Task Scheduling & Overdue SLA Protection
            </h3>
            <p className="mt-2 max-w-xl text-sm text-sky-200/70">
              Never let a high-value customer slip through the cracks. Versaly monitors team workload and triggers proactive alerts when a follow-up is overdue.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#042033]/80 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <p className="text-[10px] font-bold uppercase text-sky-400">Auto Task Dispatch</p>
                <p className="mt-1 text-sm font-bold text-white">Call within 15 min</p>
                <p className="mt-0.5 text-[10px] text-sky-200/60">Assigned to best available rep</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#042033]/80 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <p className="text-[10px] font-bold uppercase text-amber-400">SLA Warning Alert</p>
                <p className="mt-1 text-sm font-bold text-white">Overdue Escalation</p>
                <p className="mt-0.5 text-[10px] text-sky-200/60">Manager alerted after 24h idle</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#042033]/80 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
                <p className="text-[10px] font-bold uppercase text-emerald-400">Workload Balance</p>
                <p className="mt-1 text-sm font-bold text-white">Fair Lead Rotation</p>
                <p className="mt-0.5 text-[10px] text-sky-200/60">Weighted round-robin algorithm</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
