'use client';

import { formatCurrency } from '@/lib/currency';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Clock,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Moon,
  Users,
  User,
  Target,
  DollarSign,
  TrendingUp,
  Zap,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import {
  Sparkline,
  RevenueTrendChart,
  RadialGaugeChart,
  WeeklyActivityBarChart,
  SubscriptionQuotaCard,
} from '@/components/dashboard/DashboardCharts';

type DashboardData = {
  generatedAt: string;
  viewer: { id: string; name: string; role: string; scope: 'mine' | 'team'; canViewTeam: boolean };
  workload: { id: string; name: string; email: string; role: string; leads: number; openTasks: number; overdueTasks: number }[];
  unassigned: { leads: number; tasks: number };
  kpis: {
    totalLeads: number;
    activeLeads: number;
    wonLeads: number;
    lostLeads: number;
    activePipelineValue: number;
    wonValue: number;
    conversionRate: number;
  };
  attention: {
    overdueTasks: number;
    dueToday: number;
    openTasks: number;
    followUpsDue: number;
    overdueFollowUps: number;
    staleLeads: number;
    inactivityDays: number;
  };
  stages: { stage: string; count: number; value: number }[];
  recent: {
    tasks: { id: string; title: string; dueDate: string | null; priority: string; lead: { id: string; contactName: string; companyName: string | null } | null }[];
    leads: { id: string; contactName: string; companyName: string | null; pipelineStage: string; dealValue: number | null; createdAt: string }[];
    outreach: { id: string; type: string; subject: string | null; status: string; sentAt: string; lead: { id: string; contactName: string; companyName: string | null } }[];
    proposals: { id: string; title: string; value: number | null; status: string; updatedAt: string; lead: { id: string; contactName: string; companyName: string | null } }[];
  };
  trajectory?: { month: string; pipeline: number; won: number; leads: number }[];
  weeklyActivity?: { day: string; count: number; label: string; isPeak: boolean }[];
  subscription?: {
    plan: string;
    tier: string;
    status: string;
    badge: string;
    billingCycle: string;
    leadLimit: number;
    leadUsed: number;
    leadPercentage: number;
    seatLimit: number;
    seatUsed: number;
    seatPercentage: number;
    storageLimitMb: number;
    storageUsedMb: number;
    storagePercentage: number;
    renewalDays: number;
    renewalDate: string;
  };
  sparklines?: {
    totalLeads: number[];
    activePipeline: number[];
    wonDeals: number[];
    conversionRate: number[];
  };
};

const STAGES = ['NEW_LEAD', 'RESEARCHING', 'CONTACTED', 'FOLLOW_UP', 'INTERESTED', 'PROPOSAL', 'WON', 'LOST'];
const stageLabel = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

const money = (value: number) => formatCurrency(value);
const shortDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date';
const leadLabel = (lead: { contactName: string; companyName: string | null }) =>
  lead.companyName ? `${lead.contactName} · ${lead.companyName}` : lead.contactName;

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [scope, setScope] = useState<'team' | 'mine'>('team');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');

  const load = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/dashboard?scope=${scope}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load dashboard');
      setData(body);
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setError('The dashboard could not be loaded. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, [scope, status, session]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      load();
    }
  }, [load, status, session]);

  const stageMap = useMemo(() => new Map(data?.stages.map((item) => [item.stage, item]) || []), [data]);
  const maxStageCount = Math.max(1, ...(data?.stages.map((item) => item.count) || [0]));

  // Loading state while session or dashboard data resolves
  if (status === 'loading' || loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="h-10 w-72 rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="h-20 w-full rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="h-80 rounded-2xl bg-gray-100 dark:bg-gray-800 xl:col-span-2" />
          <div className="h-80 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200/80 bg-red-50/80 p-8 text-center backdrop-blur-xl dark:border-red-900/50 dark:bg-red-950/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-3 text-lg font-bold text-red-900 dark:text-red-200">Dashboard Unavailable</h1>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
        <button onClick={load} className="btn-primary mt-4 px-5 py-2 text-sm shadow">
          Try again
        </button>
      </div>
    );
  }

  const attentionItems = [
    {
      label: 'Overdue tasks',
      value: data.attention.overdueTasks,
      href: '/tasks?status=open',
      urgent: data.attention.overdueTasks > 0,
      icon: <Clock className="h-5 w-5 text-red-500" />,
      badgeColor: 'text-red-400 bg-red-950/40 border-red-800/40',
    },
    {
      label: 'Due today',
      value: data.attention.dueToday,
      href: '/tasks?status=open',
      urgent: false,
      icon: <Calendar className="h-5 w-5 text-amber-400" />,
      badgeColor: 'text-amber-300 bg-amber-950/40 border-amber-800/40',
    },
    {
      label: 'Follow-ups due',
      value: data.attention.followUpsDue,
      href: '/leads',
      urgent: false,
      icon: <MessageSquare className="h-5 w-5 text-sky-400" />,
      badgeColor: 'text-sky-300 bg-sky-950/40 border-sky-800/40',
    },
    {
      label: 'Overdue follow-ups',
      value: data.attention.overdueFollowUps,
      href: '/leads',
      urgent: data.attention.overdueFollowUps > 0,
      icon: <AlertTriangle className="h-5 w-5 text-rose-400" />,
      badgeColor: 'text-rose-300 bg-rose-950/40 border-rose-800/40',
    },
    {
      label: `Stale (${data.attention.inactivityDays}d+ inactivity)`,
      value: data.attention.staleLeads,
      href: '/leads',
      urgent: false,
      icon: <Moon className="h-5 w-5 text-gray-400" />,
      badgeColor: 'text-gray-300 bg-gray-800/60 border-gray-700/40',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="mx-auto max-w-7xl space-y-7 pb-12"
    >
      {/* =========================================
          1. SaaS Header & Controls
         ========================================= */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Versaly CRM Cloud Platform</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className="font-medium text-gray-500 dark:text-gray-400">Synced at {lastRefreshed}</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {data.viewer.scope === 'mine' ? 'Personal Command Center' : 'Agency Performance Dashboard'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {data.viewer.scope === 'mine'
              ? `Real-time activity and assigned pipeline for ${data.viewer.name}.`
              : 'Holistic agency prospecting velocity, pipeline health, and high-priority actions.'}
          </p>
        </div>

        {/* Action Controls & Scope Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {data.viewer.canViewTeam && (
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <button
                onClick={() => setScope('team')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  scope === 'team'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Team View</span>
              </button>
              <button
                onClick={() => setScope('mine')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  scope === 'mine'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <User className="h-3.5 w-3.5" />
                <span>My Work</span>
              </button>
            </div>
          )}

          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-850"
          >
            <Users className="h-3.5 w-3.5 text-sky-500" />
            <span>Prospect Pool</span>
          </Link>

          <Link
            href="/tasks"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-4 py-2 text-xs font-semibold text-white shadow hover:from-sky-500 hover:to-sky-600 transition"
          >
            <span>+ Open Tasks</span>
          </Link>
        </div>
      </div>

      {/* =========================================
          2. SaaS Subscription Health & Quota Bar
         ========================================= */}
      {data.subscription && <SubscriptionQuotaCard subscription={data.subscription} />}

      {/* =========================================
          3. Top Modern KPI Cards with Sparklines (Liquid Glass)
         ========================================= */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] transition hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.38)] hover:border-sky-400/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400">Total Prospects</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
                {data.kpis.totalLeads}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 border border-sky-400/30">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="space-y-0.5">
              <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                ↑ 14.5%
              </span>
              <p className="text-[11px] text-gray-400">{data.kpis.activeLeads} active in funnel</p>
            </div>
            <Sparkline data={data.sparklines?.totalLeads || [4, 6, 8, 7, 10, 12]} color="blue" />
          </div>
        </div>

        {/* Active Pipeline */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] transition hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.38)] hover:border-emerald-400/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400">Active Pipeline Value</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
                {money(data.kpis.activePipelineValue)}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="space-y-0.5">
              <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                ↑ 18.2%
              </span>
              <p className="text-[11px] text-gray-400">{data.kpis.activeLeads} active opportunities</p>
            </div>
            <Sparkline data={data.sparklines?.activePipeline || [10, 14, 12, 18, 16, 22]} color="emerald" />
          </div>
        </div>

        {/* Won Deals */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] transition hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.38)] hover:border-emerald-400/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400">Won Revenue</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-400">
                {money(data.kpis.wonValue)}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="space-y-0.5">
              <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                ↑ 24.8%
              </span>
              <p className="text-[11px] text-gray-400">{data.kpis.wonLeads} closed deals</p>
            </div>
            <Sparkline data={data.sparklines?.wonDeals || [5, 8, 7, 12, 11, 16]} color="emerald" />
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] transition hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.38)] hover:border-emerald-400/30">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400">Conversion Rate</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
                {data.kpis.conversionRate.toFixed(1)}%
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div className="space-y-0.5">
              <span className="inline-flex items-center rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                On Target
              </span>
              <p className="text-[11px] text-gray-400">{data.kpis.lostLeads} archived lost</p>
            </div>
            <Sparkline data={data.sparklines?.conversionRate || [12, 15, 14, 19, 18, 24]} color="emerald" />
          </div>
        </div>
      </section>

      {/* =========================================
          4. Visual Charts: Trajectory & Gauges
         ========================================= */}
      <section className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        {/* Main Trajectory Area Chart (Shopeers / Pivora inspired) */}
        <div className="rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-6 shadow-sm">
          <RevenueTrendChart
            data={data.trajectory || []}
            formatCurrency={formatCurrency}
            totalWon={data.kpis.wonValue}
          />
        </div>

        {/* Side Visuals: Conversion Radial Gauge & Weekly Activity Bar Chart */}
        <div className="flex flex-col gap-6">
          {/* Radial Semi-Circle Conversion Arc */}
          <div className="rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">Conversion Velocity</h3>
              <Link href="/pipeline" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">
                Funnel →
              </Link>
            </div>
            <RadialGaugeChart
              rate={data.kpis.conversionRate}
              target={35}
              wonCount={data.kpis.wonLeads}
              totalLeads={data.kpis.totalLeads}
            />
          </div>

          {/* Weekly Activity Velocity Bars */}
          {data.weeklyActivity && (
            <div className="rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-6 shadow-sm">
              <WeeklyActivityBarChart days={data.weeklyActivity} />
            </div>
          )}
        </div>
      </section>

      {/* =========================================
          5. Smart Needs Attention Action Center
         ========================================= */}
      <section className="rounded-2xl border border-white/10 bg-[#073652]/80 backdrop-blur-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="h-4.5 w-4.5 text-amber-400" />
              <span>High Priority Actions</span>
              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-300">
                Action Required
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Clear commitments and critical follow-ups before starting new campaigns.
            </p>
          </div>
          <Link href="/tasks" className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">
            Open All Tasks →
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {attentionItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                item.urgent
                  ? 'border-red-500/40 bg-red-950/20 hover:bg-red-950/30'
                  : 'border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>{item.icon}</div>
                {item.urgent && (
                  <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>
              <div className="mt-3">
                <p className="text-2xl font-black text-white">{item.value}</p>
                <p className="mt-1 text-xs font-medium text-gray-300 group-hover:text-white">
                  {item.label}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* =========================================
          6. Pipeline Funnel & Upcoming Commitments
         ========================================= */}
      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Pipeline Distribution Funnel */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Pipeline Distribution</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Prospect density and weighted deal volume across pipeline stages.
              </p>
            </div>
            <Link href="/pipeline" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
              Interactive Kanban →
            </Link>
          </div>

          <div className="mt-5 space-y-3.5">
            {STAGES.map((stage) => {
              const item = stageMap.get(stage) || { count: 0, value: 0 };
              const percent = maxStageCount ? (item.count / maxStageCount) * 100 : 0;
              const isWon = stage === 'WON';
              const isLost = stage === 'LOST';

              return (
                <div key={stage} className="group">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {stageLabel(stage)}
                    </span>
                    <span className="font-medium text-gray-500 dark:text-gray-400">
                      {item.count} leads · <span className="font-semibold text-gray-800 dark:text-gray-200">{money(item.value)}</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        isWon
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : isLost
                          ? 'bg-gray-400 dark:bg-gray-600'
                          : 'bg-gradient-to-r from-sky-500 to-sky-400'
                      }`}
                      style={{ width: `${Math.max(item.count ? 5 : 0, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming Tasks */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Upcoming Tasks</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Scheduled client touchpoints.</p>
            </div>
            <Link href="/tasks" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
              View Calendar →
            </Link>
          </div>

          <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {data.recent.tasks.length ? (
              data.recent.tasks.map((task) => (
                <div key={task.id} className="py-3 first:pt-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white hover:text-sky-600 transition">
                        {task.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {task.lead ? leadLabel(task.lead) : 'Internal Task'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {shortDate(task.dueDate)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="flex items-center justify-center gap-1.5 py-6 text-center text-xs text-gray-500 dark:text-gray-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>No upcoming tasks. Your schedule is clear.</span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* =========================================
          7. Team Workload & Unassigned (Team Scope)
         ========================================= */}
      {data.viewer.canViewTeam && data.viewer.scope === 'team' && (
        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Team Workload Distribution</h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Assigned prospect records & open commitments per team member.
                </p>
              </div>
              <Link href="/admin/users" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
                Manage Team →
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-gray-100 text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <tr>
                    <th className="pb-3 font-semibold">Member</th>
                    <th className="pb-3 font-semibold">Leads</th>
                    <th className="pb-3 font-semibold">Open Tasks</th>
                    <th className="pb-3 font-semibold">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.workload.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                            {user.name?.[0]?.toUpperCase() || 'U'}
                          </span>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{user.name}</p>
                            <p className="text-[10px] text-gray-500">{user.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 font-medium text-gray-700 dark:text-gray-300">{user.leads}</td>
                      <td className="py-3 font-medium text-gray-700 dark:text-gray-300">{user.openTasks}</td>
                      <td className="py-3">
                        <span
                          className={`font-semibold ${
                            user.overdueTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
                          }`}
                        >
                          {user.overdueTasks}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Unassigned Triage</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Unclaimed prospects and orphaned tasks that need an owner.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Link
                href="/leads"
                className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 transition hover:border-sky-300 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:hover:border-sky-700"
              >
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{data.unassigned.leads}</p>
                <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300">Unassigned Leads</p>
              </Link>
              <Link
                href="/tasks"
                className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 transition hover:border-sky-300 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:hover:border-sky-700"
              >
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{data.unassigned.tasks}</p>
                <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300">Unassigned Tasks</p>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* =========================================
          8. Bottom Feeds: Leads, Outreach, Proposals
         ========================================= */}
      <section className="grid gap-6 lg:grid-cols-3">
        {/* New Leads */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Prospects</h3>
            <Link href="/leads" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
              View All →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.recent.leads.length ? (
              data.recent.leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="block rounded-xl p-2.5 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">{leadLabel(lead)}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="rounded bg-sky-50 px-1.5 py-0.5 font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      {stageLabel(lead.pipelineStage)}
                    </span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {lead.dealValue != null ? money(lead.dealValue) : 'Unvalued'}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">No prospects found.</p>
            )}
          </div>
        </div>

        {/* Recent Outreach */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Outreach</h3>
            <Link href="/outreach" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
              View All →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.recent.outreach.length ? (
              data.recent.outreach.map((item) => (
                <Link
                  key={item.id}
                  href={`/leads/${item.lead.id}`}
                  className="block rounded-xl p-2.5 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {item.subject || `${item.type} Outreach`}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    {leadLabel(item.lead)} · <span className="capitalize font-medium">{item.status.toLowerCase()}</span>
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">No outreach logged yet.</p>
            )}
          </div>
        </div>

        {/* Recent Proposals */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Proposals</h3>
            <Link href="/proposals" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
              View All →
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.recent.proposals.length ? (
              data.recent.proposals.map((proposal) => (
                <Link
                  key={proposal.id}
                  href={`/leads/${proposal.lead.id}`}
                  className="block rounded-xl p-2.5 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{proposal.title}</p>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="capitalize">{proposal.status}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {proposal.value != null ? money(proposal.value) : '—'}
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center">No proposals sent yet.</p>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
