'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  DollarSign, 
  UserCheck, 
  MessageSquare, 
  Building2,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

interface Deal {
  id: string;
  company: string;
  contact: string;
  value: string;
  stageId: number;
  health: number;
  tag: string;
  owner: string;
  action: string;
}

const INITIAL_DEALS: Deal[] = [
  {
    id: 'd1',
    company: 'Apex FinTech Global',
    contact: 'Sarah Kiprono',
    value: 'KES 850,000',
    stageId: 0,
    health: 94,
    tag: 'Enterprise Plan',
    owner: 'David K.',
    action: 'Inbound Lead Ingested',
  },
  {
    id: 'd2',
    company: 'Safari Logistics Ltd',
    contact: 'Kevin Mwangi',
    value: 'KES 1,420,000',
    stageId: 1,
    health: 88,
    tag: 'Growth Pro',
    owner: 'Elena O.',
    action: 'WhatsApp Intro Dispatched',
  },
  {
    id: 'd3',
    company: 'Koko Clean Energies',
    contact: 'Amina Hassan',
    value: 'KES 3,250,000',
    stageId: 2,
    health: 96,
    tag: 'Custom SLA',
    owner: 'Brian N.',
    action: 'Proposal Under Legal Review',
  },
  {
    id: 'd4',
    company: 'Twiga Commerce Network',
    contact: 'Dennis Omondi',
    value: 'KES 4,800,000',
    stageId: 3,
    health: 99,
    tag: 'Annual Contract',
    owner: 'Faith W.',
    action: 'Subscription Signed & Billed',
  },
];

const STAGES = [
  { id: 0, title: '1. Lead Captured', count: '12 new', color: 'border-sky-500/30 text-sky-400' },
  { id: 1, title: '2. Discovery & Outreach', count: '8 active', color: 'border-cyan-500/30 text-cyan-400' },
  { id: 2, title: '3. Proposal & Terms', count: '5 review', color: 'border-indigo-500/30 text-indigo-400' },
  { id: 3, title: '4. Won & Subscription', count: '14 closed', color: 'border-emerald-500/30 text-emerald-400' },
];

export function PipelineVisualizer() {
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [activeTab, setActiveTab] = useState<number | 'all'>('all');
  const [highlightedId, setHighlightedId] = useState<string>('d2');

  const advanceDeal = (id: string) => {
    setDeals((prev) =>
      prev.map((deal) => {
        if (deal.id === id) {
          const nextStage = deal.stageId < 3 ? deal.stageId + 1 : 0;
          return {
            ...deal,
            stageId: nextStage,
            action:
              nextStage === 0
                ? 'Lead refreshed from campaign'
                : nextStage === 1
                ? 'Automated WhatsApp follow-up scheduled'
                : nextStage === 2
                ? 'Contract sent with Stripe link'
                : 'Account provisioned & live in CRM',
          };
        }
        return deal;
      })
    );
    setHighlightedId(id);
  };

  const filteredDeals = activeTab === 'all' ? deals : deals.filter((d) => d.stageId === activeTab);

  return (
    <div className="relative mx-auto w-full max-w-6xl rounded-3xl border border-white/[0.14] bg-[#073652]/65 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.18)] backdrop-blur-2xl sm:p-7">
      {/* Specular Top Edge Light Refraction */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* Header bar */}
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-950/60 px-3 py-1 text-xs font-semibold text-sky-300">
            <Sparkles className="h-3.5 w-3.5 text-sky-400 animate-spin" /> Interactive Pipeline Simulation
          </div>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Live Deal Progression & Revenue Flow
          </h3>
          <p className="mt-1 text-xs text-sky-200/70 sm:text-sm">
            Click &quot;Advance Deal Stage&quot; on any card to see real-time state transitions and automated triggers.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#041d2d]/90 p-1.5 backdrop-blur-md">
          <button
            onClick={() => setActiveTab('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'all'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-sky-300/70 hover:text-white'
            }`}
          >
            All Stages
          </button>
          {STAGES.map((st) => (
            <button
              key={st.id}
              onClick={() => setActiveTab(st.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === st.id
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                  : 'text-sky-300/70 hover:text-white'
              }`}
            >
              Stage {st.id + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Board Grid */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stageId === stage.id);
          const isSelectedTab = activeTab === 'all' || activeTab === stage.id;

          return (
            <div
              key={stage.id}
              className={`flex flex-col rounded-2xl border bg-[#042033]/85 p-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-opacity duration-300 ${
                stage.color
              } ${isSelectedTab ? 'opacity-100' : 'opacity-40'}`}
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {stage.title}
                </span>
                <span className="rounded-full bg-sky-950/70 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                  {stageDeals.length} active
                </span>
              </div>

              <div className="mt-3 flex flex-1 flex-col gap-3 min-h-[220px]">
                <AnimatePresence mode="popLayout">
                  {stageDeals.map((deal) => {
                    const isHighlighted = highlightedId === deal.id;
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        key={deal.id}
                        className={`relative rounded-xl border p-3.5 transition-all ${
                          isHighlighted
                            ? 'border-sky-400/60 bg-[#084266]/90 shadow-[0_8px_20px_rgba(0,0,0,0.35),inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-sm'
                            : 'border-white/10 bg-[#062c45]/75 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] hover:border-sky-500/40 hover:bg-[#073452]/80 backdrop-blur-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block rounded-md bg-sky-950/60 px-2 py-0.5 text-[10px] font-medium text-sky-300">
                              {deal.tag}
                            </span>
                            <h4 className="mt-1 text-xs font-bold text-white line-clamp-1">
                              {deal.company}
                            </h4>
                            <p className="text-[11px] text-sky-200/70">{deal.contact}</p>
                          </div>
                          <span className="rounded-md bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                            {deal.health}% CS
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
                          <span className="text-xs font-extrabold text-white">
                            {deal.value}
                          </span>
                          <span className="text-[10px] text-sky-300/80">
                            Owner: {deal.owner}
                          </span>
                        </div>

                        {/* Stage Action status */}
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#031c2c] px-2 py-1 text-[10px] text-sky-300">
                          <Clock className="h-3 w-3 shrink-0 text-sky-400" />
                          <span className="truncate">{deal.action}</span>
                        </div>

                        {/* Advance button */}
                        <button
                          onClick={() => advanceDeal(deal.id)}
                          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-600/90 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500 transition-colors"
                        >
                          Advance Stage <ArrowRight className="h-3 w-3" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {stageDeals.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/5 p-4 text-center">
                    <p className="text-[11px] text-sky-300/50">Ready for incoming deals</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Telemetry Summary Strip with Frosted Glass */}
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-[#031d2e]/85 p-3.5 sm:p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-md sm:grid-cols-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-sky-300/70">Active Pipeline</p>
            <p className="text-sm font-bold text-white sm:text-base">KES 10,320,000</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-sky-300/70">Win Rate</p>
            <p className="text-sm font-bold text-emerald-400 sm:text-base">38.4% (+6.2%)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-sky-300/70">Outreach Response</p>
            <p className="text-sm font-bold text-cyan-300 sm:text-base">84% WhatsApp</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-semibold text-sky-300/70">Retention Score</p>
            <p className="text-sm font-bold text-indigo-300 sm:text-base">96.8 / 100</p>
          </div>
        </div>
      </div>
    </div>
  );
}
