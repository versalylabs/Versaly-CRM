'use client';

import React, { useState, useId } from 'react';
import Link from 'next/link';

// ==========================================
// 1. Sparkline Component (for Top KPI Cards)
// ==========================================
interface SparklineProps {
  data: number[];
  color?: 'emerald' | 'blue' | 'purple' | 'amber';
  height?: number;
  width?: number;
}

export function Sparkline({ data, color = 'blue', height = 36, width = 110 }: SparklineProps) {
  const gradientId = useId();
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - paddingY - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  // Generate smooth cubic bezier curve
  let pathD = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`;

  const colorMap = {
    blue: { stroke: '#0284c7', stopStart: '#38bdf8', stopEnd: '#0284c7' },
    emerald: { stroke: '#10b981', stopStart: '#34d399', stopEnd: '#10b981' },
    purple: { stroke: '#8b5cf6', stopStart: '#a78bfa', stopEnd: '#8b5cf6' },
    amber: { stroke: '#f59e0b', stopStart: '#fbbf24', stopEnd: '#f59e0b' },
  };

  const scheme = colorMap[color];

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scheme.stopStart} stopOpacity="0.32" />
          <stop offset="100%" stopColor={scheme.stopEnd} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradientId})`} />
      <path d={pathD} fill="none" stroke={scheme.stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={scheme.stroke}
        className="animate-pulse"
      />
    </svg>
  );
}

// ==========================================
// 2. Revenue & Pipeline Trajectory Area Chart
// ==========================================
interface TrajectoryPoint {
  month: string;
  pipeline: number;
  won: number;
  leads: number;
}

interface RevenueTrendChartProps {
  data: TrajectoryPoint[];
  formatCurrency: (val: number) => string;
  totalWon: number;
}

export function RevenueTrendChart({ data, formatCurrency, totalWon }: RevenueTrendChartProps) {
  const gradientWonId = useId();
  const gradientPipelineId = useId();
  const [activeRange, setActiveRange] = useState<'30D' | '90D' | '6M' | '1Y'>('6M');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Filter or scale slice based on range
  const displayData = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    if (activeRange === '30D') return data.slice(-2);
    if (activeRange === '90D') return data.slice(-3);
    return data;
  }, [data, activeRange]);

  if (!displayData || displayData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        No trajectory history recorded yet.
      </div>
    );
  }

  const svgWidth = 640;
  const svgHeight = 240;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 35;
  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  const maxVal = Math.max(
    ...displayData.map((d) => Math.max(d.pipeline, d.won)),
    10000
  );
  // Round up to clean ceiling
  const ceiling = Math.ceil(maxVal / 20000) * 20000 || 50000;

  const getPoints = (key: 'won' | 'pipeline') => {
    return displayData.map((d, i) => {
      const x = padLeft + (i / Math.max(1, displayData.length - 1)) * chartW;
      const y = padTop + chartH - (d[key] / ceiling) * chartH;
      return { x, y, raw: d };
    });
  };

  const wonPoints = getPoints('won');
  const pipelinePoints = getPoints('pipeline');

  const buildPath = (pts: { x: number; y: number }[]) => {
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

  const wonLine = buildPath(wonPoints);
  const wonFill = `${wonLine} L ${wonPoints[wonPoints.length - 1].x},${padTop + chartH} L ${wonPoints[0].x},${padTop + chartH} Z`;

  const pipelineLine = buildPath(pipelinePoints);
  const pipelineFill = `${pipelineLine} L ${pipelinePoints[pipelinePoints.length - 1].x},${padTop + chartH} L ${pipelinePoints[0].x},${padTop + chartH} Z`;

  const yTicks = [0, ceiling * 0.33, ceiling * 0.66, ceiling];

  const hoveredItem = hoveredIdx !== null ? displayData[hoveredIdx] : null;
  const hoveredWonPt = hoveredIdx !== null ? wonPoints[hoveredIdx] : null;
  const hoveredPipePt = hoveredIdx !== null ? pipelinePoints[hoveredIdx] : null;

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {formatCurrency(totalWon)}
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/50 dark:text-emerald-300">
              ↑ 24.8% vs last cycle
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Realized Closed Won revenue & Active Pipeline potential
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm" />
              <span className="font-medium text-gray-600 dark:text-gray-300">Won Revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm" />
              <span className="font-medium text-gray-600 dark:text-gray-300">Pipeline Value</span>
            </div>
          </div>

          {/* Timeframe selector */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50/80 p-0.5 text-xs dark:border-gray-800 dark:bg-gray-900/60">
            {(['30D', '90D', '6M', '1Y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setActiveRange(range);
                  setHoveredIdx(null);
                }}
                className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                  activeRange === range
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-sky-600 dark:text-white'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive Chart Container */}
      <div className="relative w-full overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-b from-gray-50/40 to-transparent p-2 dark:border-gray-800/80 dark:from-sky-950/10">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible cursor-crosshair select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Won Gradient */}
            <linearGradient id={gradientWonId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>

            {/* Pipeline Gradient */}
            <linearGradient id={gradientPipelineId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {yTicks.map((tick, i) => {
            const y = padTop + chartH - (tick / ceiling) * chartH;
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={padLeft + chartW}
                  y2={y}
                  stroke="currentColor"
                  className="text-gray-200 dark:text-gray-800"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-gray-400 text-[10px] font-medium dark:fill-gray-500"
                >
                  {tick >= 1000 ? `${Math.round(tick / 1000)}k` : tick}
                </text>
              </g>
            );
          })}

          {/* Pipeline Area & Line */}
          <path d={pipelineFill} fill={`url(#${gradientPipelineId})`} />
          <path
            d={pipelineLine}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeDasharray="5 3"
            strokeLinecap="round"
          />

          {/* Won Area & Line */}
          <path d={wonFill} fill={`url(#${gradientWonId})`} />
          <path
            d={wonLine}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Month X-Axis Labels */}
          {displayData.map((d, i) => {
            const x = padLeft + (i / Math.max(1, displayData.length - 1)) * chartW;
            return (
              <text
                key={i}
                x={x}
                y={svgHeight - 10}
                textAnchor="middle"
                className="fill-gray-500 text-[11px] font-medium dark:fill-gray-400"
              >
                {d.month}
              </text>
            );
          })}

          {/* Interactive column hover targets */}
          {displayData.map((_, i) => {
            const step = chartW / Math.max(1, displayData.length - 1);
            const x = padLeft + i * step - step / 2;
            return (
              <rect
                key={i}
                x={x}
                y={padTop}
                width={step}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
              />
            );
          })}

          {/* Hover highlight indicators */}
          {hoveredIdx !== null && hoveredWonPt && hoveredPipePt && (
            <g>
              {/* Vertical guideline */}
              <line
                x1={hoveredWonPt.x}
                y1={padTop}
                x2={hoveredWonPt.x}
                y2={padTop + chartH}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.6"
              />

              {/* Pipeline Point */}
              <circle
                cx={hoveredPipePt.x}
                cy={hoveredPipePt.y}
                r="5.5"
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="2"
              />

              {/* Won Point */}
              <circle
                cx={hoveredWonPt.x}
                cy={hoveredWonPt.y}
                r="6.5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip HTML Overlay */}
        {hoveredItem && hoveredWonPt && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur-sm transition-all dark:border-gray-700 dark:bg-gray-900/95"
            style={{
              left: `${Math.min(80, Math.max(15, (hoveredWonPt.x / svgWidth) * 100))}%`,
              top: '12px',
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-semibold text-gray-900 dark:text-white border-b border-gray-100 pb-1 dark:border-gray-800">
              {hoveredItem.month} Overview
            </div>
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Won:
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatCurrency(hoveredItem.won)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-sky-600 font-medium">
                  <span className="h-2 w-2 rounded-full bg-sky-500" /> Pipeline:
                </span>
                <span className="font-bold text-gray-700 dark:text-gray-300">
                  {formatCurrency(hoveredItem.pipeline)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500">
                <span>Active Leads:</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{hoveredItem.leads}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 3. Radial Semi-Circle Conversion Arc Gauge
// ==========================================
interface RadialGaugeProps {
  rate: number; // e.g. 68
  target?: number; // e.g. 80
  wonCount: number;
  totalLeads: number;
}

export function RadialGaugeChart({ rate, target = 80, wonCount, totalLeads }: RadialGaugeProps) {
  const gradientId = useId();
  const clampedRate = Math.min(100, Math.max(0, rate));
  const radius = 80;
  const strokeWidth = 14;
  const center = 100;
  const circumference = Math.PI * radius; // Half-circle perimeter
  const strokeDashoffset = circumference - (clampedRate / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-2">
      <div className="relative flex items-center justify-center">
        <svg width="200" height="115" viewBox="0 0 200 115" className="overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Background Arc */}
          <path
            d={`M ${center - radius},${center} A ${radius} ${radius} 0 0 1 ${center + radius},${center}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="text-gray-100 dark:text-gray-800/80"
          />

          {/* Progress Arc */}
          <path
            d={`M ${center - radius},${center} A ${radius} ${radius} 0 0 1 ${center + radius},${center}`}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Central Metric Value */}
        <div className="absolute bottom-1 flex flex-col items-center">
          <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {clampedRate.toFixed(1)}%
          </span>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            Conversion Rate
          </span>
        </div>
      </div>

      <div className="mt-3 text-center">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1.5" />
          On track for <strong className="text-gray-900 dark:text-white">{target}% target</strong> benchmark
        </p>
        <p className="mt-1 text-[11px] text-gray-400">
          {wonCount} won conversions out of {totalLeads} total prospects
        </p>
      </div>
    </div>
  );
}

// ==========================================
// 4. Weekly Activity Velocity Bar Chart
// ==========================================
interface WeeklyDay {
  day: string;
  count: number;
  label: string;
  isPeak: boolean;
}

interface WeeklyActivityBarChartProps {
  days: WeeklyDay[];
}

export function WeeklyActivityBarChart({ days }: WeeklyActivityBarChartProps) {
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Most Active Days</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">Team client interactions & tasks</p>
        </div>
        <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
          Past 7 Days
        </span>
      </div>

      <div className="flex items-end justify-between gap-2 pt-6 pb-2 h-36">
        {days.map((item) => {
          const heightPercent = Math.max(15, Math.round((item.count / maxCount) * 100));

          return (
            <div key={item.day} className="group relative flex flex-1 flex-col items-center justify-end h-full">
              {/* Peak indicator floating badge */}
              {item.isPeak && (
                <div className="absolute -top-7 animate-bounce rounded-full bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  {item.count}
                </div>
              )}

              {/* Tooltip on non-peak hover */}
              {!item.isPeak && (
                <div className="pointer-events-none absolute -top-6 hidden rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white shadow group-hover:block dark:bg-gray-100 dark:text-gray-900">
                  {item.count}
                </div>
              )}

              {/* Bar */}
              <div className="w-full max-w-[28px] h-full flex items-end">
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-lg transition-all duration-500 ease-out group-hover:opacity-100 ${
                    item.isPeak
                      ? 'bg-gradient-to-t from-sky-600 to-sky-400 shadow-md shadow-sky-500/20'
                      : 'bg-gray-200/80 hover:bg-sky-300 dark:bg-gray-800 dark:hover:bg-sky-700/60'
                  }`}
                />
              </div>

              {/* Day Label */}
              <span
                className={`mt-2 text-xs ${
                  item.isPeak
                    ? 'font-bold text-sky-600 dark:text-sky-400'
                    : 'font-medium text-gray-500 dark:text-gray-400'
                }`}
              >
                {item.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==========================================
// 5. Modern SaaS Subscription Status Banner
// ==========================================
interface SubscriptionInfo {
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
  renewalDays: number;
  renewalDate: string;
}

interface SubscriptionCardProps {
  subscription: SubscriptionInfo;
}

export function SubscriptionQuotaCard({ subscription }: SubscriptionCardProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/60 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 p-5 shadow-sm transition hover:shadow-md dark:border-sky-800/40 dark:from-[#08293d] dark:via-[#053048] dark:to-[#08293d]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Plan information */}
          <div className="flex items-center space-x-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 text-white shadow-md shadow-sky-500/20">
              <span className="text-xl">⭐</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {subscription.plan}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-600/20">
                  ● {subscription.badge}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-300">
                Monthly SaaS billing · Renews in {subscription.renewalDays} days on {subscription.renewalDate}
              </p>
            </div>
          </div>

          {/* Quotas */}
          <div className="flex flex-wrap items-center gap-6">
            {/* Leads Quota */}
            <div className="min-w-[140px]">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-600 dark:text-gray-300">Leads Capacity</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {subscription.leadUsed} / {subscription.leadLimit}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.max(4, subscription.leadPercentage)}%` }}
                />
              </div>
            </div>

            {/* Team Seats */}
            <div className="min-w-[120px]">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-600 dark:text-gray-300">Team Seats</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {subscription.seatUsed} / {subscription.seatLimit}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-purple-500 transition-all duration-500"
                  style={{ width: `${Math.max(8, subscription.seatPercentage)}%` }}
                />
              </div>
            </div>

            {/* Action Button */}
            <Link
              href="/settings/billing"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 px-4 py-2 text-xs font-semibold text-white shadow hover:from-sky-500 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition"
            >
              <span>⚡ Manage Plan & Billing</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Subscription Tier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Subscription & Tier Management
                </h3>
                <p className="text-xs text-gray-500">
                  Manage your agency subscription package & team expansion.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-800/60 dark:bg-sky-950/20">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                      Current Active Tier
                    </span>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                      Growth Pro ($79 / month)
                    </h4>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Active
                  </span>
                </div>
                <ul className="mt-3 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <li>✓ Up to 500 Active Leads & Unlimited Contacts</li>
                  <li>✓ 10 Team Seats with Role-Based Permissions</li>
                  <li>✓ Full Pipeline & Automated Email/WhatsApp Sequences</li>
                  <li>✓ Advanced Visual Analytics & Custom Reporting</li>
                </ul>
              </div>

              <div className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 dark:border-purple-800/40 dark:bg-purple-950/20">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                      Scale Tier Upgrade
                    </span>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                      Enterprise Scale ($199 / month)
                    </h4>
                  </div>
                  <button
                    onClick={() => {
                      alert('Upgrade requested! Support team will assist your account migration.');
                      setModalOpen(false);
                    }}
                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-purple-700"
                  >
                    Upgrade
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Unlimited leads, 50 team members, dedicated webhooks, white-label branding, and dedicated account manager.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
