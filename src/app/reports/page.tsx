'use client';

import { formatCurrency } from '@/lib/currency';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users,
  User,
  Target,
  DollarSign,
  Zap,
  Download,
  Printer,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { Sparkline, RadialGaugeChart } from '@/components/dashboard/DashboardCharts';

type ReportsData = {
  generatedAt: string;
  viewer: { id: string; name: string; role: string; scope: 'mine' | 'team'; canViewTeam: boolean };
  filters: { range: string; label: string };
  summary: {
    totalLeads: number;
    won: number;
    lost: number;
    conversionRate: number;
    activeValue: number;
    outreachCount: number;
    replyRate: number;
    proposalCount: number;
    proposalWinRate: number;
    taskCompletionRate: number;
    overdueTasks: number;
    averageSalesCycleDays: number;
    averageDealSize: number;
    wonValue: number;
    lostValue: number;
    weightedForecast: number;
  };
  funnel: { stage: string; count: number; value: number; progressionRate: number }[];
  agingBuckets: { bucket: string; leads: number; value: number }[];
  leadSources: { source: string; leads: number; won: number; lost: number; value: number; conversionRate: number }[];
  pipeline: { stage: string; count: number; value: number }[];
  outreach: {
    total: number;
    replied: number;
    byType: { type: string; count: number }[];
    byStatus: { status: string; count: number }[];
  };
  proposals: {
    total: number;
    accepted: number;
    responded: number;
    byStatus: { status: string; count: number; value: number }[];
  };
  tasks: {
    total: number;
    completed: number;
    open: number;
    overdue: number;
    byPriority: { priority: string; total: number; completed: number }[];
  };
  trends: { key: string; label: string; leads: number; won: number; outreach: number; proposals: number }[];
  agents: {
    id: string;
    name: string;
    email: string;
    role: string;
    leads: number;
    won: number;
    conversionRate: number;
    activeValue: number;
    openTasks: number;
    completedTasks: number;
    overdueTasks: number;
  }[];
};

const money = (value: number) => formatCurrency(value);
const percent = (value: number) => `${(value || 0).toFixed(1)}%`;
const label = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const rangeOptions = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [range, setRange] = useState('30');
  const [scope, setScope] = useState<'team' | 'mine'>('team');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports?range=${range}&scope=${scope}`, { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to load reports');
      setData(body);
      if (!body.viewer.canViewTeam) setScope('mine');
    } catch {
      setError('Reports could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [range, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const exportCsv = () => {
    window.open(`/api/reports?range=${range}&scope=${scope}&format=csv`, '_blank', 'noopener,noreferrer');
  };

  const printReport = () => window.print();

  const maxPipeline = useMemo(() => Math.max(1, ...(data?.pipeline?.map((item) => item.count) || [0])), [data]);
  const maxSource = useMemo(() => Math.max(1, ...(data?.leadSources?.map((item) => item.leads) || [0])), [data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="h-10 w-72 rounded-xl bg-gray-200 dark:bg-gray-800" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800" />
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
        <h1 className="mt-3 text-lg font-bold text-red-900 dark:text-red-200">Reports Unavailable</h1>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error || 'No report data was returned.'}</p>
        <button onClick={load} className="btn-primary mt-4 px-5 py-2 text-sm shadow">
          Try again
        </button>
      </div>
    );
  }

  const s = data.summary;

  // Chart calculation for activity trend
  const trendPoints = data.trends || [];
  const svgW = 600;
  const svgH = 220;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;
  const plotW = svgW - padLeft - padRight;
  const plotH = svgH - padTop - padBottom;
  const maxTrendVal = Math.max(1, ...trendPoints.map((t) => Math.max(t.leads, t.outreach, t.proposals)));
  const ceiling = Math.ceil(maxTrendVal / 5) * 5 || 10;

  const getCoordinates = (key: 'leads' | 'outreach' | 'proposals') => {
    return trendPoints.map((t, i) => {
      const x = padLeft + (i / Math.max(1, trendPoints.length - 1)) * plotW;
      const y = padTop + plotH - (t[key] / ceiling) * plotH;
      return { x, y, raw: t };
    });
  };

  const leadPts = getCoordinates('leads');
  const outreachPts = getCoordinates('outreach');
  const proposalPts = getCoordinates('proposals');

  const buildCurve = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const leadPath = buildCurve(leadPts);
  const outreachPath = buildCurve(outreachPts);
  const proposalPath = buildCurve(proposalPts);

  const hoveredItem = hoveredTrendIdx !== null ? trendPoints[hoveredTrendIdx] : null;
  const hoveredLeadPt = hoveredTrendIdx !== null ? leadPts[hoveredTrendIdx] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl space-y-7 pb-12"
    >
      {/* =========================================
          1. Header & Controls
         ========================================= */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Versaly Intelligence Platform</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className="font-medium text-gray-500 dark:text-gray-400">{data.filters.label}</span>
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Performance Intelligence & Analytics
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Comprehensive conversion attribution, outreach velocity, proposal outcomes, and team workloads.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {data.viewer.canViewTeam && (
            <div className="inline-flex rounded-xl border border-gray-200/80 bg-white/80 p-1 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[#073652]/80">
              <button
                onClick={() => setScope('team')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  scope === 'team'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Team Performance</span>
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
                <span>My Metrics</span>
              </button>
            </div>
          )}

          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm outline-none transition focus:border-sky-500 dark:border-white/10 dark:bg-[#073652]/80 dark:text-gray-200"
          >
            {rangeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-[#073652]/80 dark:text-gray-200 dark:hover:border-sky-700">
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
          <button onClick={printReport} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-[#073652]/80 dark:text-gray-200 dark:hover:border-sky-700">
            <Printer className="h-3.5 w-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* =========================================
          2. Top Metric KPI Cards with Sparklines
         ========================================= */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Leads */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition hover:shadow-md dark:border-white/10 dark:bg-[#073652]/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total Inbound & Sourced</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {s.totalLeads}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="inline-flex items-center rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                {data.filters.label}
              </span>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">New prospects acquired</p>
            </div>
            <Sparkline data={[2, 4, 3, 6, 5, 8, s.totalLeads || 8]} color="blue" />
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition hover:shadow-md dark:border-white/10 dark:bg-[#073652]/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Conversion Velocity</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                {percent(s.conversionRate)}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                {s.won} Closed Won
              </span>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{s.lost} deals archived lost</p>
            </div>
            <Sparkline data={[10, 14, 12, 18, 16, 22]} color="emerald" />
          </div>
        </div>

        {/* Active Pipeline Value */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition hover:shadow-md dark:border-white/10 dark:bg-[#073652]/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Active Pipeline Value</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                {money(s.activeValue)}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Weighted Potential
              </span>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">Active opportunities in play</p>
            </div>
            <Sparkline data={[12, 15, 14, 20, 18, 25]} color="emerald" />
          </div>
        </div>

        {/* Outreach Reply Rate */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl transition hover:shadow-md dark:border-white/10 dark:bg-[#073652]/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Outreach Engagement</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                {percent(s.replyRate)}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="inline-flex items-center rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                {data.outreach.replied} Responses
              </span>
              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">across {data.outreach.total} touchpoints</p>
            </div>
            <Sparkline data={[8, 12, 11, 16, 15, 20]} color="amber" />
          </div>
        </div>
      </section>

      {/* =========================================
          3. Visual Charts Grid: Activity Trajectory & Radial Gauges
         ========================================= */}
      <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        {/* Activity & Conversion Trajectory Area Chart */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Activity & Trajectory Flow</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Prospect acquisition vs outreach engagement vs proposal volume over time
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                <span className="text-gray-600 dark:text-gray-300 font-medium">Leads</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-gray-600 dark:text-gray-300 font-medium">Outreach</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                <span className="text-gray-600 dark:text-gray-300 font-medium">Proposals</span>
              </div>
            </div>
          </div>

          {trendPoints.length > 0 ? (
            <div className="relative mt-4 w-full overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50/40 to-transparent p-2 dark:border-gray-800/80 dark:from-sky-950/10">
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-auto overflow-visible cursor-crosshair select-none"
                onMouseLeave={() => setHoveredTrendIdx(null)}
              >
                {/* Horizontal Gridlines */}
                {[0, ceiling * 0.5, ceiling].map((tick, i) => {
                  const y = padTop + plotH - (tick / ceiling) * plotH;
                  return (
                    <g key={i}>
                      <line
                        x1={padLeft}
                        y1={y}
                        x2={padLeft + plotW}
                        y2={y}
                        stroke="currentColor"
                        className="text-gray-200 dark:text-gray-800"
                        strokeDasharray="2 4"
                      />
                      <text
                        x={padLeft - 6}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-gray-400 text-[10px] font-medium dark:fill-gray-500"
                      >
                        {tick}
                      </text>
                    </g>
                  );
                })}

                {/* Spline Paths */}
                <path d={leadPath} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
                <path d={outreachPath} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                <path d={proposalPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" />

                {/* Labels */}
                {trendPoints.map((t, i) => {
                  const x = padLeft + (i / Math.max(1, trendPoints.length - 1)) * plotW;
                  return (
                    <text
                      key={i}
                      x={x}
                      y={svgH - 8}
                      textAnchor="middle"
                      className="fill-gray-500 text-[10px] font-medium dark:fill-gray-400"
                    >
                      {t.label}
                    </text>
                  );
                })}

                {/* Hover targets */}
                {trendPoints.map((_, i) => {
                  const step = plotW / Math.max(1, trendPoints.length - 1);
                  const x = padLeft + i * step - step / 2;
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={padTop}
                      width={step}
                      height={plotH}
                      fill="transparent"
                      onMouseEnter={() => setHoveredTrendIdx(i)}
                    />
                  );
                })}

                {/* Hover indicator */}
                {hoveredTrendIdx !== null && hoveredLeadPt && (
                  <line
                    x1={hoveredLeadPt.x}
                    y1={padTop}
                    x2={hoveredLeadPt.x}
                    y2={padTop + plotH}
                    stroke="#64748b"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.6"
                  />
                )}
              </svg>

              {/* Floating Tooltip */}
              {hoveredItem && hoveredLeadPt && (
                <div
                  className="pointer-events-none absolute z-20 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm transition-all dark:border-gray-700 dark:bg-gray-900/95"
                  style={{
                    left: `${Math.min(80, Math.max(20, (hoveredLeadPt.x / svgW) * 100))}%`,
                    top: '15px',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 pb-1 dark:border-gray-800">
                    {hoveredItem.label}
                  </div>
                  <div className="mt-1 space-y-1 text-[11px]">
                    <div className="flex justify-between gap-3 text-sky-600 font-medium">
                      <span>Leads:</span> <span className="font-bold">{hoveredItem.leads}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-emerald-600 font-medium">
                      <span>Outreach:</span> <span className="font-bold">{hoveredItem.outreach}</span>
                    </div>
                    <div className="flex justify-between gap-3 text-cyan-600 font-medium">
                      <span>Proposals:</span> <span className="font-bold">{hoveredItem.proposals}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-6 text-xs text-gray-500 py-8 text-center">No trend activity logged for this range.</p>
          )}
        </div>

        {/* Dual Radial Gauges: Proposal Win Rate & Task Completion */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Proposal Win Rate</h3>
              <Link href="/proposals" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
                Proposals →
              </Link>
            </div>
            <RadialGaugeChart
              rate={s.proposalWinRate}
              target={40}
              wonCount={data.proposals.accepted}
              totalLeads={data.proposals.responded || data.proposals.total}
            />
          </div>

          <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Task Execution Velocity</h3>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {percent(s.taskCompletionRate)} Complete
              </span>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between font-medium">
                <span className="text-gray-500 dark:text-gray-400">Tasks Completed vs Total</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {data.tasks.completed} / {data.tasks.total}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${Math.max(4, s.taskCompletionRate)}%` }}
                />
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-gray-500 dark:text-gray-400">
                <span>Open: {data.tasks.open}</span>
                <span className={s.overdueTasks > 0 ? 'font-semibold text-red-500' : ''}>
                  Overdue: {s.overdueTasks}
                </span>
                <span>Avg cycle: {s.averageSalesCycleDays.toFixed(1)}d</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
          4. Executive Forecast & Pipeline Health
         ========================================= */}
      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pipeline Forecast</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Weighted forecast using stage-based close probabilities.</p>
            </div>
            <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              {money(s.weightedForecast)} weighted
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60"><p className="text-[11px] font-semibold text-gray-500">Active pipeline</p><p className="mt-1 text-xl font-extrabold text-gray-900 dark:text-white">{money(s.activeValue)}</p></div>
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950/30"><p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Won value</p><p className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{money(s.wonValue)}</p></div>
            <div className="rounded-xl bg-cyan-50 p-4 dark:bg-cyan-950/30"><p className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">Avg. won deal</p><p className="mt-1 text-xl font-extrabold text-cyan-700 dark:text-cyan-300">{money(s.averageDealSize)}</p></div>
          </div>
          <div className="mt-5 space-y-3">
            {data.pipeline.filter((item) => !['WON','LOST'].includes(item.stage)).map((item) => {
              const probabilities: Record<string, number> = { NEW_LEAD: .10, RESEARCHING: .15, CONTACTED: .25, FOLLOW_UP: .35, INTERESTED: .50, PROPOSAL: .70 };
              const probability = probabilities[item.stage] || 0;
              return <div key={item.stage}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-gray-700 dark:text-gray-300">{label(item.stage)}</span><span className="text-gray-500">{Math.round(probability*100)}% · {money(item.value * probability)}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{width:`${Math.max(2, probability*100)}%`}} /></div></div>;
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 pb-3 dark:border-gray-800"><h3 className="text-sm font-bold text-gray-900 dark:text-white">Deal Aging</h3><p className="text-xs text-gray-500 dark:text-gray-400">Active opportunities by age.</p></div>
          <div className="mt-4 space-y-4">
            {data.agingBuckets.map((item) => { const max = Math.max(1, ...data.agingBuckets.map(x => x.leads)); return <div key={item.bucket}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-gray-700 dark:text-gray-300">{item.bucket}</span><span className="text-gray-500">{item.leads} · {money(item.value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-sky-500" style={{width:`${item.leads ? Math.max(5, item.leads/max*100) : 0}%`}} /></div></div>; })}
          </div>
          <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/20"><p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Sales cycle</p><p className="mt-1 text-lg font-extrabold text-gray-900 dark:text-white">{s.averageSalesCycleDays.toFixed(1)} days</p><p className="text-[11px] text-gray-500 dark:text-gray-400">Average time from lead creation to won.</p></div>
        </div>
      </section>

      {/* =========================================
          5. Lead Sources & Pipeline Funnel
         ========================================= */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Lead Source Performance */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Lead Source Attribution</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prospect density and deal values by channel</p>
            </div>
            <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              {data.leadSources.length} Channels
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {data.leadSources.length ? (
              data.leadSources.map((item) => {
                const percentShare = maxSource ? (item.leads / maxSource) * 100 : 0;
                return (
                  <div key={item.source} className="group">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {label(item.source)}
                      </span>
                      <span className="font-medium text-gray-500 dark:text-gray-400">
                        {item.leads} prospects · <strong className="text-emerald-600 dark:text-emerald-400">{percent(item.conversionRate)} won</strong>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500 group-hover:from-sky-400 group-hover:to-indigo-400"
                        style={{ width: `${Math.max(5, percentShare)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                      <span>{item.won} won · {item.lost} lost</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{money(item.value)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-500 py-6 text-center">No source attribution for this period.</p>
            )}
          </div>
        </div>

        {/* Pipeline Distribution Funnel */}
        <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pipeline Stage Density</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Active deal volume across stages</p>
            </div>
            <Link href="/pipeline" className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400">
              Kanban →
            </Link>
          </div>

          <div className="mt-4 space-y-3.5">
            {data.pipeline.map((item) => {
              const percentShare = maxPipeline ? (item.count / maxPipeline) * 100 : 0;
              const isWon = item.stage === 'WON';
              const isLost = item.stage === 'LOST';

              return (
                <div key={item.stage} className="group">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {label(item.stage)}
                    </span>
                    <span className="font-medium text-gray-500 dark:text-gray-400">
                      {item.count} leads · <span className="font-semibold text-gray-800 dark:text-gray-200">{money(item.value)}</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isWon
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : isLost
                          ? 'bg-gray-400 dark:bg-gray-600'
                          : 'bg-gradient-to-r from-sky-500 to-sky-400'
                      }`}
                      style={{ width: `${Math.max(item.count ? 5 : 0, percentShare)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================
          5. Team Performance Table (Team View)
         ========================================= */}
      {data.viewer.canViewTeam && data.viewer.scope === 'team' && (
        <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Team Member Performance</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Conversion velocity and commitment execution by representative
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
                  <th className="pb-3 font-semibold">Representative</th>
                  <th className="pb-3 font-semibold">Assigned Leads</th>
                  <th className="pb-3 font-semibold">Won Deals</th>
                  <th className="pb-3 font-semibold">Conversion</th>
                  <th className="pb-3 font-semibold">Pipeline Value</th>
                  <th className="pb-3 font-semibold">Open Tasks</th>
                  <th className="pb-3 font-semibold">Overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.agents.map((agent) => (
                  <tr key={agent.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                          {agent.name?.[0]?.toUpperCase() || 'U'}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{agent.name}</p>
                          <p className="text-[10px] text-gray-500">{agent.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 font-medium text-gray-700 dark:text-gray-300">{agent.leads}</td>
                    <td className="py-3 font-semibold text-emerald-600 dark:text-emerald-400">{agent.won}</td>
                    <td className="py-3">
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {percent(agent.conversionRate)}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-gray-900 dark:text-white">{money(agent.activeValue)}</td>
                    <td className="py-3 text-gray-700 dark:text-gray-300">{agent.openTasks}</td>
                    <td className="py-3">
                      <span
                        className={`font-semibold ${
                          agent.overdueTasks > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
                        }`}
                      >
                        {agent.overdueTasks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </motion.div>
  );
}
