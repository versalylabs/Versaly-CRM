'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { formatCurrency } from '../../../lib/currency';

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

type Stage = {
  id: string;
  label: string;
  probability: number;
  badgeColor: string;
  dotColor: string;
  accentBorder: string;
  columnBg: string;
};

const STAGES: Stage[] = [
  {
    id: 'NEW_LEAD',
    label: 'New Lead',
    probability: 10,
    badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dotColor: 'bg-slate-500',
    accentBorder: 'border-t-slate-500',
    columnBg: 'bg-slate-50/50 dark:bg-slate-900/30',
  },
  {
    id: 'RESEARCHING',
    label: 'Researching',
    probability: 20,
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    dotColor: 'bg-blue-500',
    accentBorder: 'border-t-blue-500',
    columnBg: 'bg-blue-50/40 dark:bg-blue-950/20',
  },
  {
    id: 'CONTACTED',
    label: 'Contacted',
    probability: 35,
    badgeColor: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
    dotColor: 'bg-cyan-500',
    accentBorder: 'border-t-cyan-500',
    columnBg: 'bg-cyan-50/40 dark:bg-cyan-950/20',
  },
  {
    id: 'FOLLOW_UP',
    label: 'Follow Up',
    probability: 50,
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
    dotColor: 'bg-amber-500',
    accentBorder: 'border-t-amber-500',
    columnBg: 'bg-amber-50/40 dark:bg-amber-950/20',
  },
  {
    id: 'INTERESTED',
    label: 'Interested',
    probability: 65,
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    dotColor: 'bg-purple-500',
    accentBorder: 'border-t-purple-500',
    columnBg: 'bg-purple-50/40 dark:bg-purple-950/20',
  },
  {
    id: 'PROPOSAL',
    label: 'Proposal',
    probability: 80,
    badgeColor: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    dotColor: 'bg-indigo-500',
    accentBorder: 'border-t-indigo-500',
    columnBg: 'bg-indigo-50/40 dark:bg-indigo-950/20',
  },
  {
    id: 'WON',
    label: 'Won',
    probability: 100,
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
    accentBorder: 'border-t-emerald-500',
    columnBg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
  },
  {
    id: 'LOST',
    label: 'Lost',
    probability: 0,
    badgeColor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
    dotColor: 'bg-rose-500',
    accentBorder: 'border-t-rose-500',
    columnBg: 'bg-rose-50/40 dark:bg-rose-950/20',
  },
];

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'won' | 'high_value'>('all');
  const [sortBy, setSortBy] = useState<'value_desc' | 'value_asc' | 'recent'>('value_desc');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [activeDropStage, setActiveDropStage] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/leads', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load pipeline');
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      setError('Could not load your pipeline. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Filter & Sort leads
  const filteredLeads = useMemo(() => {
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
        return !['WON', 'LOST'].includes(lead.pipelineStage);
      }
      if (activeFilter === 'won') {
        return lead.pipelineStage === 'WON';
      }
      if (activeFilter === 'high_value') {
        return (lead.dealValue || 0) >= 50000;
      }
      return true;
    });
  }, [leads, search, activeFilter]);

  // Group by stage and apply sorting within each stage
  const groupedLeads = useMemo(() => {
    return STAGES.reduce<Record<string, Lead[]>>((groups, stage) => {
      const stageList = filteredLeads.filter((lead) => lead.pipelineStage === stage.id);
      
      stageList.sort((a, b) => {
        if (sortBy === 'value_desc') return (b.dealValue || 0) - (a.dealValue || 0);
        if (sortBy === 'value_asc') return (a.dealValue || 0) - (b.dealValue || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      groups[stage.id] = stageList;
      return groups;
    }, {});
  }, [filteredLeads, sortBy]);

  // Executive pipeline KPI metrics
  const totals = useMemo(() => {
    const activeLeads = leads.filter((lead) => !['WON', 'LOST'].includes(lead.pipelineStage));
    const wonLeads = leads.filter((lead) => lead.pipelineStage === 'WON');
    const lostLeads = leads.filter((lead) => lead.pipelineStage === 'LOST');
    const closedCount = wonLeads.length + lostLeads.length;
    const winRate = closedCount > 0 ? Math.round((wonLeads.length / closedCount) * 100) : 0;

    const totalActiveValue = activeLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
    const wonValue = wonLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);

    // Weighted Expected Revenue based on stage probability
    const weightedPipelineValue = activeLeads.reduce((sum, lead) => {
      const stageObj = STAGES.find((s) => s.id === lead.pipelineStage);
      const prob = (stageObj?.probability || 10) / 100;
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
  }, [leads]);

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
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#061826]">
      <div className="container-custom py-8 !max-w-none">
        
        {/* Header Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
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
          <div className="flex items-center gap-3">
            <Link
              href="/leads"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:from-sky-500 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 transition"
            >
              <span>+ Add New Lead</span>
            </Link>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active Deals
              </span>
              <span className="rounded-full bg-sky-100 p-1.5 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                🎯
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">{totals.active}</span>
              <span className="text-xs text-gray-500">/ {totals.total} total</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Open active opportunities in funnel</p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Active Pipeline Value
              </span>
              <span className="rounded-full bg-emerald-100 p-1.5 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                💰
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {formatCurrency(totals.activeValue)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Total unweighted potential revenue</p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Weighted Forecast
              </span>
              <span className="rounded-full bg-purple-100 p-1.5 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                ⚡
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                {formatCurrency(totals.weightedValue)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Calculated by stage probabilities</p>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Won Rate
              </span>
              <span className="rounded-full bg-amber-100 p-1.5 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                🏆
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {totals.winRate}%
              </span>
              <span className="text-xs text-gray-500">({totals.won} won)</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Won revenue: {formatCurrency(totals.wonValue)}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-gray-200/80 bg-white p-3.5 shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
          <div className="flex flex-1 items-center gap-2.5">
            <span className="text-gray-400">🔍</span>
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

          <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 sm:border-l border-gray-100 sm:pl-3 pt-2 sm:pt-0 dark:border-gray-800">
            {/* Quick Scope Filter */}
            <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              <button
                onClick={() => setActiveFilter('all')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  activeFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter('active')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  activeFilter === 'active'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                }`}
              >
                Active Only
              </button>
              <button
                onClick={() => setActiveFilter('high_value')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  activeFilter === 'high_value'
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400'
                }`}
              >
                🔥 High Value
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 outline-none"
            >
              <option value="value_desc">Value: High to Low</option>
              <option value="value_asc">Value: Low to High</option>
              <option value="recent">Recently Added</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
            <span>⚠️ {error}</span>
            <button onClick={fetchLeads} className="font-bold underline underline-offset-2">
              Reload
            </button>
          </div>
        )}

        {/* Kanban Board Container */}
        {loading ? (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900/40">
            <div className="space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Loading pipeline deals...</p>
            </div>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-800 dark:bg-gray-900/40">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-2xl dark:bg-sky-950/60">
              📊
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
              No Leads in Your Pipeline Yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs text-gray-500 dark:text-gray-400">
              Start adding prospects to track opportunities from discovery to closed revenue.
            </p>
            <Link
              href="/leads"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-sky-500 transition"
            >
              + Create Your First Lead
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto pb-6 custom-scrollbar">
            <div className="grid min-w-[2100px] grid-cols-8 gap-4">
              {STAGES.map((stage) => {
                const stageLeads = groupedLeads[stage.id] || [];
                const stageValue = stageLeads.reduce((sum, lead) => sum + (lead.dealValue || 0), 0);
                const isDropTarget = activeDropStage === stage.id;

                return (
                  <div
                    key={stage.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (activeDropStage !== stage.id) setActiveDropStage(stage.id);
                    }}
                    onDragLeave={(e) => {
                      if (e.currentTarget === e.target) setActiveDropStage(null);
                    }}
                    onDrop={() => handleDrop(stage.id)}
                    className={`flex flex-col rounded-2xl border-t-4 border border-gray-200/80 p-3.5 transition-all duration-150 ${stage.accentBorder} ${stage.columnBg} dark:border-gray-800/80 ${
                      isDropTarget
                        ? 'ring-2 ring-sky-500 bg-sky-50/80 dark:bg-sky-950/40 border-sky-400 dark:border-sky-600 scale-[1.01]'
                        : ''
                    }`}
                  >
                    {/* Stage Header */}
                    <div className="mb-3.5 pb-3 border-b border-gray-200/60 dark:border-gray-800">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${stage.dotColor}`} />
                          <h3 className="truncate text-xs font-bold text-gray-900 dark:text-white">
                            {stage.label}
                          </h3>
                        </div>
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-700 shadow-2xs dark:bg-gray-800 dark:text-gray-300">
                          {stageLeads.length}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                          {formatCurrency(stageValue)}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400">
                          {stage.probability}% prob
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
                            className={`group relative rounded-xl border border-gray-200 bg-white p-3.5 shadow-xs transition hover:border-sky-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/90 dark:hover:border-sky-600/50 ${
                              isDragging
                                ? 'opacity-40 scale-[0.98] border-dashed border-sky-400 rotate-1'
                                : ''
                            } ${
                              isUpdating
                                ? 'pointer-events-none opacity-60'
                                : 'cursor-grab active:cursor-grabbing'
                            }`}
                          >
                            {/* Card Top: Deal Value & Recency */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                                {lead.dealValue ? formatCurrency(lead.dealValue) : 'No Value'}
                              </span>
                              <span className="text-[10px] font-medium text-gray-400">
                                {getDaysAgo(lead.createdAt)}
                              </span>
                            </div>

                            {/* Contact & Company */}
                            <div className="mt-2.5">
                              <Link
                                href={`/leads/${lead.id}`}
                                className="block font-bold text-xs text-gray-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400 truncate"
                              >
                                {lead.contactName}
                              </Link>
                              <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                                {lead.companyName || 'Independent Client'}
                              </p>
                            </div>

                            {/* Contact Details Snippets */}
                            <div className="mt-3 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                              {lead.location && (
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="shrink-0 text-gray-400">📍</span>
                                  <span className="truncate">{lead.location}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="shrink-0 text-gray-400">✉️</span>
                                <span className="truncate">{lead.email}</span>
                              </div>
                            </div>

                            {/* Footer: Source, Owner, and Stage Select */}
                            <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-800/80">
                              <div className="flex items-center justify-between gap-2">
                                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                  {formatSource(lead.leadSource)}
                                </span>

                                {lead.assignedTo && (
                                  <div
                                    title={`Assigned to ${lead.assignedTo.name || lead.assignedTo.email}`}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300"
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
                                  className="w-full rounded-lg border border-gray-200 bg-gray-50/70 px-2 py-1 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800/70 dark:text-gray-300 outline-none"
                                >
                                  {STAGES.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      → {s.label} ({s.probability}%)
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {isUpdating && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-xs dark:bg-gray-900/70">
                                <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 animate-pulse">
                                  Moving...
                                </span>
                              </div>
                            )}
                          </article>
                        );
                      })}

                      {/* Drop Target Placeholder */}
                      {isDropTarget && (
                        <div className="rounded-xl border-2 border-dashed border-sky-400 bg-sky-100/50 py-8 text-center text-xs font-bold text-sky-700 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-300 animate-pulse">
                          Drop to move to {stage.label}
                        </div>
                      )}

                      {stageLeads.length === 0 && !isDropTarget && (
                        <div className="rounded-xl border border-dashed border-gray-200/80 bg-white/30 py-8 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900/20">
                          No deals in this stage
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

