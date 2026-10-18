'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  DollarSign,
  Zap,
  Trophy,
  Search,
  Flame,
  AlertTriangle,
  MapPin,
  Mail,
  Calendar,
  Plus,
  ArrowRight,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';
import {
  PipelineStageItem,
  DEFAULT_PIPELINE_STAGES,
  getStageColorStyles,
} from '../../lib/pipelineStages';

type Lead = {
  id: string;
  contactName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  location: string | null;
  leadSource: string;
  pipelineStage: string;
  outreachStatus: string;
  dealValue: number | null;
  createdAt: string;
  updatedAt?: string;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  } | null;
};

function formatSource(source: string) {
  if (!source) return 'Direct';
  return source
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getDaysAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Today';
    if (days === 1) return '1d ago';
    return `${days}d ago`;
  } catch {
    return 'Recently';
  }
}

export default function PipelinePage() {
  const { data: session } = useSession();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStageItem[]>(DEFAULT_PIPELINE_STAGES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'won' | 'high_value'>('all');
  const [sortBy, setSortBy] = useState<'value_desc' | 'value_asc' | 'recent'>('value_desc');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeDropStage, setActiveDropStage] = useState<string | null>(null);

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch('/api/pipeline/stages', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.stages) && data.stages.length > 0) {
        setStages(data.stages);
      }
    } catch {
      // Keep default stages on error
    }
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadsRes] = await Promise.all([
        fetch('/api/leads', { cache: 'no-store' }),
        fetchStages(),
      ]);
      const data = await leadsRes.json();
      if (!leadsRes.ok) throw new Error(data.error || 'Failed to load pipeline');
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not load your pipeline. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [fetchStages]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Filter & Sort leads
  const filteredLeads = useMemo(() => {
    const activeStageKeys = new Set(stages.filter((s) => s.category === 'ACTIVE').map((s) => s.key));
    const wonStageKeys = new Set(stages.filter((s) => s.category === 'WON').map((s) => s.key));

    return leads.filter((lead) => {
      // Search match
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = lead.contactName.toLowerCase().includes(query);
        const matchesCompany = (lead.companyName || '').toLowerCase().includes(query);
        const matchesEmail = lead.email.toLowerCase().includes(query);
        const matchesLocation = (lead.location || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCompany && !matchesEmail && !matchesLocation) {
          return false;
        }
      }

      // Quick filter
      if (activeFilter === 'active') {
        if (activeStageKeys.size > 0) return activeStageKeys.has(lead.pipelineStage);
        return !['WON', 'LOST'].includes(lead.pipelineStage);
      }
      if (activeFilter === 'won') {
        if (wonStageKeys.size > 0) return wonStageKeys.has(lead.pipelineStage);
        return lead.pipelineStage === 'WON';
      }
      if (activeFilter === 'high_value') {
        return (lead.dealValue || 0) >= 50000;
      }
      return true;
    });
  }, [leads, search, activeFilter, stages]);

  // Group by stage and apply sorting within each stage
  const groupedLeads = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    stages.forEach((stage) => {
      groups[stage.key] = [];
    });

    filteredLeads.forEach((lead) => {
      if (groups[lead.pipelineStage]) {
        groups[lead.pipelineStage].push(lead);
      } else if (stages.length > 0) {
        // Fallback into first stage if stage key doesn't match
        groups[stages[0].key]?.push(lead);
      }
    });

    stages.forEach((stage) => {
      const list = groups[stage.key] || [];
      list.sort((a, b) => {
        if (sortBy === 'value_desc') return (b.dealValue || 0) - (a.dealValue || 0);
        if (sortBy === 'value_asc') return (a.dealValue || 0) - (b.dealValue || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    });

    return groups;
  }, [filteredLeads, stages, sortBy]);

  // Executive pipeline KPI metrics
  const totals = useMemo(() => {
    const activeStageKeys = new Set(stages.filter((s) => s.category === 'ACTIVE').map((s) => s.key));
    const wonStageKeys = new Set(stages.filter((s) => s.category === 'WON').map((s) => s.key));
    const lostStageKeys = new Set(stages.filter((s) => s.category === 'LOST').map((s) => s.key));

    const activeLeads = leads.filter((lead) =>
      activeStageKeys.size > 0 ? activeStageKeys.has(lead.pipelineStage) : !['WON', 'LOST'].includes(lead.pipelineStage)
    );
    const wonLeads = leads.filter((lead) =>
      wonStageKeys.size > 0 ? wonStageKeys.has(lead.pipelineStage) : lead.pipelineStage === 'WON'
    );
    const lostLeads = leads.filter((lead) =>
      lostStageKeys.size > 0 ? lostStageKeys.has(lead.pipelineStage) : lead.pipelineStage === 'LOST'
    );
    const closedCount = wonLeads.length + lostLeads.length;
    const winRate = closedCount > 0 ? Math.round((wonLeads.length / closedCount) * 100) : 0;

    const totalActiveValue = activeLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
    const wonValue = wonLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);

    // Probability map
    const probMap = new Map<string, number>();
    stages.forEach((s) => probMap.set(s.key, s.probability));

    // Weighted Expected Revenue based on stage probability
    const weightedPipelineValue = activeLeads.reduce((sum, lead) => {
      const prob = (probMap.get(lead.pipelineStage) ?? 10) / 100;
      return sum + (lead.dealValue || 0) * prob;
    }, 0);

    return {
      total: leads.length,
      active: activeLeads.length,
      won: wonLeads.length,
      winRate,
      activeValue: totalActiveValue,
      weightedValue: Math.round(weightedPipelineValue),
      wonValue,
    };
  }, [leads, stages]);

  // Optimistic Move Handler
  async function moveLead(leadId: string, stage: string) {
    const currentLead = leads.find((lead) => lead.id === leadId);
    if (!currentLead || currentLead.pipelineStage === stage) return;

    const previousStage = currentLead.pipelineStage;
    setUpdatingId(leadId);
    setError('');

    // Instant optimistic update
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId ? { ...lead, pipelineStage: stage } : lead
      )
    );

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStage: stage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to move lead');

      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? { ...lead, ...data } : lead))
      );
    } catch {
      // Rollback on failure
      setLeads((current) =>
        current.map((lead) =>
          lead.id === leadId ? { ...lead, pipelineStage: previousStage } : lead
        )
      );
      setError('Could not update lead stage. Please check your connection.');
    } finally {
      setUpdatingId(null);
    }
  }

  function handleDrop(stage: string) {
    if (draggedId) moveLead(draggedId, stage);
    setDraggedId(null);
    setActiveDropStage(null);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-gray-50 dark:bg-[#14213d]"
    >
      <div className="container-custom py-8 !max-w-none">
        
        {/* Header Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-500 dark:text-cyan-400">
                {session?.user?.organizationName || 'Workspace'} Pipeline
              </span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Deals & Opportunity Pipeline
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              Drag and drop prospects across deal stages to track conversion velocity.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/settings/pipeline"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#16233f] px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition shadow-sm"
              title="Add, rename, recolor, or reorder pipeline stages"
            >
              <Settings className="h-4 w-4 text-cyan-400" />
              <span>Customize Stages</span>
            </Link>
            <Link
              href="/leads"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:from-sky-500 hover:to-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Lead</span>
            </Link>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#1b2a4a]/80 backdrop-blur-xl transition hover:border-sky-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active Deals
              </span>
              <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
                <Target className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{totals.active}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">/ {totals.total} total</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Open active opportunities in funnel</p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#1b2a4a]/80 backdrop-blur-xl transition hover:border-emerald-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active Pipeline Value
              </span>
              <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {formatCurrency(totals.activeValue)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Total unweighted potential revenue</p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#1b2a4a]/80 backdrop-blur-xl transition hover:border-teal-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Weighted Forecast
              </span>
              <span className="rounded-lg border border-teal-500/20 bg-teal-500/10 p-2 text-teal-600 dark:text-teal-400">
                <Zap className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totals.weightedValue)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Calculated by stage probabilities</p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-[#1b2a4a]/80 backdrop-blur-xl transition hover:border-amber-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Won Rate
              </span>
              <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400">
                <Trophy className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {totals.winRate}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">({totals.won} won)</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Won revenue: {formatCurrency(totals.wonValue)}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white/80 p-3.5 shadow-sm dark:border-white/10 dark:bg-[#1b2a4a]/80 backdrop-blur-xl">
          <div className="flex flex-1 items-center gap-2.5">
            <Search className="h-4 w-4 text-gray-400 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by contact, company, email, or city..."
              className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none dark:text-white dark:placeholder-gray-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 sm:border-l border-gray-200/60 sm:pl-3 pt-2 sm:pt-0 dark:border-white/10">
            {/* Quick Scope Filter */}
            <div className="flex rounded-xl bg-gray-100/80 p-1 dark:bg-[#16233f]/80">
              <button
                onClick={() => setActiveFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  activeFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-sky-600 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter('active')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  activeFilter === 'active'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-sky-600 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                Active Only
              </button>
              <button
                onClick={() => setActiveFilter('high_value')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  activeFilter === 'high_value'
                    ? 'bg-white text-amber-600 shadow-sm dark:bg-amber-500/20 dark:text-amber-300'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <Flame className="h-3 w-3 text-amber-500" />
                <span>High Value</span>
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-gray-200/80 bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-gray-700 dark:border-white/10 dark:bg-[#16233f] dark:text-gray-200 outline-none"
            >
              <option value="value_desc">Value: High to Low</option>
              <option value="value_asc">Value: Low to High</option>
              <option value="recent">Recently Added</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200/80 bg-rose-50/80 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
            <button onClick={fetchLeads} className="font-bold underline underline-offset-2">
              Reload
            </button>
          </div>
        )}

        {/* Kanban Board Container */}
        {loading ? (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-gray-200/80 bg-white/80 p-12 text-center dark:border-white/10 dark:bg-[#1b2a4a]/60 backdrop-blur-xl">
            <div className="space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading pipeline deals...</p>
            </div>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 p-12 text-center dark:border-white/15 dark:bg-[#1b2a4a]/40 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.2)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-400">
              <TrendingUp className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
              No Leads in Your Pipeline Yet
            </h2>
            <p className="mx-auto mt-1.5 max-w-md text-xs text-gray-500 dark:text-gray-400">
              Your pipeline starts clean. Add new prospective deals to track conversion velocity from discovery to closed revenue.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/leads"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:from-sky-500 hover:to-sky-600 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Create Your First Lead</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6 custom-scrollbar">
            <div className="flex gap-4 min-w-max">
              {stages.map((stage) => {
                const styles = getStageColorStyles(stage.color);
                const stageLeads = groupedLeads[stage.key] || [];
                const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
                const isDropTarget = activeDropStage === stage.key;

                return (
                  <div
                    key={stage.key}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (activeDropStage !== stage.key) setActiveDropStage(stage.key);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget === e.target) setActiveDropStage(null);
                    }}
                    onDrop={() => handleDrop(stage.key)}
                    className={`w-[285px] shrink-0 flex flex-col rounded-2xl border-t-4 border border-white/10 p-3.5 backdrop-blur-xl transition-all duration-150 ${styles.accentBorder} ${styles.columnBg} bg-[#1b2a4a]/70 shadow-lg ${
                      isDropTarget
                        ? 'ring-2 ring-cyan-400 bg-sky-950/70 border-cyan-400 scale-[1.01]'
                        : ''
                    }`}
                  >
                    {/* Stage Header */}
                    <div className="mb-3.5 pb-3 border-b border-white/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dotColor}`} />
                          <h3 className="truncate text-xs font-bold text-white">
                            {stage.label}
                          </h3>
                        </div>
                        <span className="rounded-full bg-[#16233f] px-2 py-0.5 text-[10px] font-bold text-slate-200 border border-white/10">
                          {stageLeads.length}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-200">
                          {formatCurrency(stageValue)}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {stage.probability}% win prob
                        </span>
                      </div>
                    </div>

                    {/* Stage Leads Cards */}
                    <div className="flex-1 space-y-3 min-h-[460px]">
                      {stageLeads.map((lead) => {
                        const isDragging = draggedId === lead.id;
                        const isUpdating = updatingId === lead.id;

                        return (
                          <article
                            key={lead.id}
                            draggable={!isUpdating}
                            onDragStart={(e) => {
                              setDraggedId(lead.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setActiveDropStage(null);
                            }}
                            className={`group relative rounded-xl border border-white/10 bg-[#16233f]/90 p-3.5 shadow-sm backdrop-blur-md transition hover:border-cyan-400/50 hover:shadow-md ${
                              isDragging
                                ? 'opacity-40 scale-[0.98] border-dashed border-cyan-400 rotate-1'
                                : ''
                            } ${
                              isUpdating
                                ? 'pointer-events-none opacity-60'
                                : 'cursor-grab active:cursor-grabbing'
                            }`}
                          >
                            {/* Card Top: Deal Value & Recency */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center rounded-lg bg-emerald-950/60 px-2 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/30">
                                {lead.dealValue ? formatCurrency(lead.dealValue) : 'No Value'}
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {getDaysAgo(lead.createdAt)}
                              </span>
                            </div>

                            {/* Contact & Company */}
                            <div className="mt-2.5">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="block font-bold text-xs text-white hover:text-cyan-300 truncate"
                              >
                                {lead.contactName}
                              </Link>
                              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                {lead.companyName || 'Independent Client'}
                              </p>
                            </div>

                            {/* Contact Details Snippets */}
                            <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                              {lead.location && (
                                <div className="flex items-center gap-1.5 truncate">
                                  <MapPin className="h-3 w-3 shrink-0 text-cyan-400" />
                                  <span className="truncate">{lead.location}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 truncate">
                                <Mail className="h-3 w-3 shrink-0 text-cyan-400" />
                                <span className="truncate">{lead.email}</span>
                              </div>
                            </div>

                            {/* Footer: Source, Owner, and Stage Select */}
                            <div className="mt-3 pt-2.5 border-t border-white/10">
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-md bg-[#1b2a4a] px-1.5 py-0.5 text-[10px] font-medium text-slate-300 border border-white/10">
                                  {formatSource(lead.leadSource)}
                                </span>

                                {lead.assignedTo && (
                                  <div
                                    title={`Assigned to ${lead.assignedTo.name || lead.assignedTo.email}`}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-950 text-[10px] font-bold text-cyan-300 border border-cyan-500/30"
                                  >
                                    {lead.assignedTo.name?.[0]?.toUpperCase() || 'U'}
                                  </div>
                                )}
                              </div>

                              {/* Mobile / Keyboard Stage Transfer dropdown */}
                              <div className="mt-2.5">
                                <select
                                  value={lead.pipelineStage}
                                  disabled={isUpdating}
                                  onChange={(e) => moveLead(lead.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full rounded-lg border border-white/10 bg-[#14213d] px-2 py-1 text-[10px] font-medium text-slate-200 outline-none focus:border-cyan-400"
                                >
                                  {stages.map((s) => (
                                    <option key={s.key} value={s.key}>
                                      → {s.label} ({s.probability}%)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {isUpdating && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-xs">
                                <span className="text-[11px] font-semibold text-cyan-400 animate-pulse">
                                  Moving...
                                </span>
                              </div>
                            )}
                          </article>
                        );
                      })}

                      {/* Drop Target Placeholder */}
                      {isDropTarget && (
                        <div className="rounded-xl border-2 border-dashed border-cyan-400 bg-cyan-950/40 py-8 text-center text-xs font-bold text-cyan-300 animate-pulse">
                          Drop to move to {stage.label}
                        </div>
                      )}

                      {stageLeads.length === 0 && !isDropTarget && (
                        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 py-8 text-center text-xs text-slate-500">
                          No deals in this stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Custom Stage Column */}
              <Link
                href="/settings/pipeline"
                className="w-[200px] shrink-0 min-h-[460px] rounded-2xl border-2 border-dashed border-white/10 bg-[#16233f]/30 hover:bg-[#16233f]/60 hover:border-cyan-400/40 p-5 flex flex-col items-center justify-center text-center transition group cursor-pointer"
              >
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                  +
                </div>
                <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Add Custom Stage
                </span>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[150px] leading-relaxed">
                  Tailor pipeline stages specifically to your company
                </p>
                <span className="mt-3 text-[10px] font-semibold text-cyan-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Configure Settings →
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

