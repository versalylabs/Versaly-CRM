'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/currency';

interface LeadItem {
  id: string;
  contactName: string;
  companyName: string | null;
  email: string;
  phone: string | null;
  pipelineStage: string;
  outreachStatus: string;
  dealValue: number | null;
  lastContact: string | null;
  updatedAt: string;
  insight: {
    sentimentScore: number;
    sentimentLabel: 'POSITIVE' | 'NEUTRAL' | 'CONCERN';
    winProbability: number;
    churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    buyingSignals: string[];
    objections: string[];
    suggestedActions: {
      action: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      timeframe: string;
      channel?: string;
    }[];
    summaryNotes: string;
    analyzedAt: string;
  };
}

interface MeetingSummaryItem {
  id: string;
  leadId: string;
  lead?: {
    id: string;
    contactName: string;
    companyName: string | null;
    pipelineStage: string;
  };
  title: string;
  summary: string;
  sentiment: string;
  actionItems: {
    title: string;
    dueDate?: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  objections: {
    objection: string;
    counterStrategy: string;
  }[];
  keyDecisions: string[];
  createdAt: string;
}

interface OverviewMetrics {
  totalDeals: number;
  highIntentCount: number;
  atRiskCount: number;
  avgWinProbability: number;
  sentimentCounts: {
    positive: number;
    neutral: number;
    concern: number;
  };
}

export default function CopilotPage() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'summarizer' | 'drafter'>('matrix');
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [metrics, setMetrics] = useState<OverviewMetrics>({
    totalDeals: 0,
    highIntentCount: 0,
    atRiskCount: 0,
    avgWinProbability: 0,
    sentimentCounts: { positive: 0, neutral: 0, concern: 0 },
  });
  const [recentMeetings, setRecentMeetings] = useState<MeetingSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters for Pipeline Intelligence Matrix
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'LOW' | 'MEDIUM' | 'HIGH'>('ALL');
  const [sentimentFilter, setSentimentFilter] = useState<'ALL' | 'POSITIVE' | 'NEUTRAL' | 'CONCERN'>('ALL');

  // Selected lead for detail inspection modal
  const [inspectedLead, setInspectedLead] = useState<LeadItem | null>(null);

  // Meeting Summarizer State
  const [meetingLeadId, setMeetingLeadId] = useState<string>('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [autoCreateTasks, setAutoCreateTasks] = useState(true);
  const [activeMeetingResult, setActiveMeetingResult] = useState<any | null>(null);

  // Outreach Drafter State
  const [drafterLeadId, setDrafterLeadId] = useState<string>('');
  const [drafterChannel, setDrafterChannel] = useState<'EMAIL' | 'WHATSAPP'>('EMAIL');
  const [drafterTone, setDrafterTone] = useState<'PROFESSIONAL' | 'URGENT' | 'WARM' | 'DIRECT'>('PROFESSIONAL');
  const [drafterObjective, setDrafterObjective] = useState<'FOLLOW_UP' | 'CLOSE_DEAL' | 'REENGAGE' | 'MEETING_REQUEST'>('FOLLOW_UP');
  const [drafterNotes, setDrafterNotes] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState<{ subject: string; content: string; channel: string } | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/copilot/overview', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load AI Copilot data');
      const data = await res.json();
      setLeads(data.leads || []);
      setMetrics(data.metrics || {
        totalDeals: 0,
        highIntentCount: 0,
        atRiskCount: 0,
        avgWinProbability: 0,
        sentimentCounts: { positive: 0, neutral: 0, concern: 0 },
      });
      setRecentMeetings(data.recentMeetings || []);

      if (data.leads && data.leads.length > 0 && !drafterLeadId) {
        setDrafterLeadId(data.leads[0].id);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error loading AI intelligence' });
    } finally {
      setLoading(false);
    }
  }, [drafterLeadId]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Re-analyze specific lead
  const handleReanalyzeLead = async (leadId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch('/api/copilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      if (!res.ok) throw new Error('Analysis failed');
      const result = await res.json();
      setStatusMessage({ type: 'success', text: 'Deal intelligence refreshed successfully' });
      await loadOverview();
      if (inspectedLead && inspectedLead.id === leadId) {
        setInspectedLead((prev) => (prev ? { ...prev, insight: result.insight } : null));
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to analyze lead' });
    } finally {
      setActionLoading(false);
    }
  };

  // Summarize meeting notes
  const handleSummarizeMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawTranscript.trim()) return;

    try {
      setActionLoading(true);
      setActiveMeetingResult(null);
      const res = await fetch('/api/copilot/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawTranscript,
          leadId: meetingLeadId || undefined,
          autoCreateTasks,
        }),
      });

      if (!res.ok) throw new Error('Failed to summarize transcript');
      const data = await res.json();
      setActiveMeetingResult(data.summary);
      setStatusMessage({
        type: 'success',
        text: `Meeting processed successfully! ${data.tasksCreated > 0 ? `${data.tasksCreated} CRM tasks auto-created.` : ''}`,
      });
      await loadOverview();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Summarization error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Generate outreach draft
  const handleGenerateDraft = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!drafterLeadId) return;

    try {
      setActionLoading(true);
      setCopiedText(false);
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: drafterLeadId,
          channel: drafterChannel,
          tone: drafterTone,
          objective: drafterObjective,
          customNotes: drafterNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate draft');
      const data = await res.json();
      setGeneratedDraft(data.draft);
      setStatusMessage({ type: 'success', text: 'Tailored outreach draft generated.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Draft generation failed' });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((item) => {
      const matchQuery =
        item.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.companyName && item.companyName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRisk = riskFilter === 'ALL' || item.insight.churnRisk === riskFilter;
      const matchSentiment = sentimentFilter === 'ALL' || item.insight.sentimentLabel === sentimentFilter;
      return matchQuery && matchRisk && matchSentiment;
    });
  }, [leads, searchQuery, riskFilter, sentimentFilter]);

  const copyDraftToClipboard = () => {
    if (!generatedDraft) return;
    const textToCopy =
      generatedDraft.channel === 'EMAIL'
        ? `Subject: ${generatedDraft.subject}\n\n${generatedDraft.content}`
        : generatedDraft.content;
    navigator.clipboard.writeText(textToCopy);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span>Phase 18 · Deal Intelligence Engine</span>
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            AI Deal Copilot & Intelligence
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            Real-time pipeline sentiment scoring, predictive win probabilities, autonomous meeting transcription intelligence, and high-conversion outreach drafting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadOverview()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm backdrop-blur-md hover:bg-gray-50 dark:border-white/10 dark:bg-[#073652]/80 dark:text-gray-200 dark:hover:bg-[#073652]"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Scan Pipeline</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('summarizer');
              setRawTranscript('');
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-500/20 hover:from-sky-500 hover:to-cyan-400 transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Summarize Meeting</span>
          </button>
        </div>
      </div>

      {/* Flash Status Notification */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium ${
              statusMessage.type === 'success'
                ? 'border border-cyan-400/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-200'
                : 'border border-rose-400/30 bg-rose-500/10 text-rose-800 dark:text-rose-200'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="ml-3 text-xs opacity-70 hover:opacity-100 font-bold"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI Glass Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Metric 1: Deals Evaluated */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Evaluated Deals
            </span>
            <span className="rounded-lg bg-sky-500/10 p-2 text-sky-600 dark:text-cyan-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-gray-900 dark:text-white">
            {metrics.totalDeals}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Active workspace sales opportunities
          </p>
        </div>

        {/* Metric 2: Average Win Probability */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Avg Win Probability
            </span>
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {metrics.avgWinProbability}%
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full"
              style={{ width: `${Math.min(100, metrics.avgWinProbability)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: High Intent Opportunities */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              High-Intent Deals
            </span>
            <span className="rounded-lg bg-cyan-500/10 p-2 text-cyan-600 dark:text-cyan-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-cyan-600 dark:text-cyan-300">
            {metrics.highIntentCount}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Positive sentiment &amp; 65%+ close probability
          </p>
        </div>

        {/* Metric 4: At-Risk Deals */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              At-Risk Flags
            </span>
            <span className="rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-rose-600 dark:text-rose-400">
            {metrics.atRiskCount}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Requiring immediate engagement or triage
          </p>
        </div>
      </div>

      {/* Tab Navigation Pill Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'matrix'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white/60 text-gray-600 hover:bg-white hover:text-gray-900 dark:bg-[#073652]/50 dark:text-gray-300 dark:hover:bg-[#073652]'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Pipeline Intelligence ({filteredLeads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('summarizer')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'summarizer'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white/60 text-gray-600 hover:bg-white hover:text-gray-900 dark:bg-[#073652]/50 dark:text-gray-300 dark:hover:bg-[#073652]'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Meeting Summarizer</span>
        </button>

        <button
          onClick={() => setActiveTab('drafter')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
            activeTab === 'drafter'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'bg-white/60 text-gray-600 hover:bg-white hover:text-gray-900 dark:bg-[#073652]/50 dark:text-gray-300 dark:hover:bg-[#073652]'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>Smart Outreach Drafter</span>
        </button>
      </div>

      {/* TAB 1: PIPELINE INTELLIGENCE MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search lead or company name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 pl-9 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
              />
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <select
              value={riskFilter}
              onChange={(e: any) => setRiskFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold dark:border-white/10 dark:bg-[#053048] dark:text-white"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk (At-Risk)</option>
            </select>

            <select
              value={sentimentFilter}
              onChange={(e: any) => setSentimentFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold dark:border-white/10 dark:bg-[#053048] dark:text-white"
            >
              <option value="ALL">All Sentiments</option>
              <option value="POSITIVE">Positive Sentiment</option>
              <option value="NEUTRAL">Neutral Sentiment</option>
              <option value="CONCERN">Concern Sentiment</option>
            </select>
          </div>

          {/* Matrix Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/90">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-gray-100 bg-gray-50/70 dark:border-white/10 dark:bg-[#053048]/60">
                  <tr>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Deal &amp; Prospect</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Stage &amp; Value</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Win Probability</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Sentiment</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Churn Risk</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">AI Suggested Action</th>
                    <th className="px-5 py-3.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-xs text-gray-500 dark:text-gray-400">
                        Evaluating live deal intelligence...
                      </td>
                    </tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-xs text-gray-500 dark:text-gray-400">
                        No deals match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((item) => {
                      const prob = item.insight.winProbability;
                      const isHighRisk = item.insight.churnRisk === 'HIGH';
                      const isPositive = item.insight.sentimentLabel === 'POSITIVE';
                      const isConcern = item.insight.sentimentLabel === 'CONCERN';

                      return (
                        <tr key={item.id} className="hover:bg-sky-500/5 transition-colors">
                          <td className="px-5 py-4">
                            <Link
                              href={`/leads/${item.id}`}
                              className="font-bold text-gray-900 hover:text-sky-600 dark:text-white dark:hover:text-cyan-400"
                            >
                              {item.companyName || item.contactName}
                            </Link>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {item.contactName} · {item.email}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-300">
                              {item.pipelineStage}
                            </span>
                            <p className="mt-1 text-xs font-bold text-gray-900 dark:text-gray-200">
                              {item.dealValue ? formatCurrency(item.dealValue) : 'Unset'}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">
                                {prob}%
                              </span>
                              <div className="h-1.5 w-16 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    prob >= 65
                                      ? 'bg-emerald-500'
                                      : prob >= 40
                                      ? 'bg-sky-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${prob}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                isPositive
                                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:text-emerald-300'
                                  : isConcern
                                  ? 'bg-rose-500/10 text-rose-700 border border-rose-500/20 dark:text-rose-300'
                                  : 'bg-gray-500/10 text-gray-700 border border-gray-500/20 dark:text-gray-300'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isPositive ? 'bg-emerald-500' : isConcern ? 'bg-rose-500' : 'bg-gray-400'
                                }`}
                              />
                              {item.insight.sentimentLabel} ({item.insight.sentimentScore}%)
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                isHighRisk
                                  ? 'bg-rose-500/10 text-rose-700 border border-rose-500/20 dark:text-rose-300'
                                  : item.insight.churnRisk === 'MEDIUM'
                                  ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20 dark:text-amber-300'
                                  : 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 dark:text-emerald-300'
                              }`}
                            >
                              {item.insight.churnRisk}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-xs max-w-xs truncate text-gray-600 dark:text-gray-300">
                            {item.insight.suggestedActions[0]?.action || 'Schedule follow-up'}
                          </td>

                          <td className="px-5 py-4 text-right space-x-1.5">
                            <button
                              onClick={() => setInspectedLead(item)}
                              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-[#053048] dark:text-gray-200"
                            >
                              Signals
                            </button>
                            <button
                              onClick={() => {
                                setDrafterLeadId(item.id);
                                setActiveTab('drafter');
                              }}
                              className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-600 hover:bg-sky-500/20 dark:text-cyan-300"
                            >
                              Draft
                            </button>
                            <button
                              disabled={actionLoading}
                              onClick={() => handleReanalyzeLead(item.id)}
                              title="Re-analyze deal"
                              className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-400 hover:text-gray-700 dark:border-white/10 dark:hover:text-white"
                            >
                              ↻
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEETING SUMMARIZER */}
      {activeTab === 'summarizer' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Input form */}
          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/90">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Transcript &amp; Call Note Analyzer
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Paste raw call transcript, Zoom notes, or sales call bullet points. AI Copilot will distill key takeaways, extract objections with counter-strategies, and automatically schedule tasks.
              </p>

              <form onSubmit={handleSummarizeMeeting} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Link to Deal / Prospect (Optional)
                  </label>
                  <select
                    value={meetingLeadId}
                    onChange={(e) => setMeetingLeadId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  >
                    <option value="">-- No specific lead (General Workspace Meeting) --</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.companyName ? `${l.companyName} (${l.contactName})` : l.contactName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Raw Transcript / Notes
                  </label>
                  <textarea
                    rows={8}
                    required
                    value={rawTranscript}
                    onChange={(e) => setRawTranscript(e.target.value)}
                    placeholder="E.g. Spoke with Sarah from Acme Corp. She loved our automation engine and mentioned budget is ready for Q4. However, their CTO is concerned about migration downtime. She asked if we can provide SOC2 compliance docs by next Tuesday..."
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoCreate"
                    checked={autoCreateTasks}
                    onChange={(e) => setAutoCreateTasks(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="autoCreate" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Automatically convert detected action items into CRM Tasks
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !rawTranscript.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 py-3 text-xs font-bold text-white shadow-md shadow-sky-500/25 hover:from-sky-500 hover:to-cyan-400 transition-all disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>{actionLoading ? 'Analyzing Transcript...' : 'Extract Intelligence & Summary'}</span>
                </button>
              </form>
            </div>

            {/* Past Meeting Summaries */}
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/90">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Recent Intelligence Logs
              </h3>
              {recentMeetings.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No previous meeting transcripts summarized yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentMeetings.slice(0, 4).map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setActiveMeetingResult(m)}
                      className="cursor-pointer rounded-xl border border-gray-100 bg-gray-50/60 p-3 hover:border-sky-400/40 hover:bg-sky-500/5 transition-all dark:border-white/5 dark:bg-[#053048]/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          {m.title}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                        {m.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Output Display */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/90 h-full">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                  Copilot Intelligence Report
                </h3>
                {activeMeetingResult && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      activeMeetingResult.sentiment === 'POSITIVE'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                        : activeMeetingResult.sentiment === 'CONCERN'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300'
                        : 'bg-gray-500/10 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Sentiment: {activeMeetingResult.sentiment}
                  </span>
                )}
              </div>

              {!activeMeetingResult ? (
                <div className="py-16 text-center text-xs text-gray-400">
                  <svg className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                  Paste a transcript on the left and run analysis to extract takeaways and tasks.
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  {/* Title & Executive Summary */}
                  <div>
                    <h4 className="text-base font-black text-gray-900 dark:text-white">
                      {activeMeetingResult.title}
                    </h4>
                    <p className="mt-2 text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                      {activeMeetingResult.summary}
                    </p>
                  </div>

                  {/* Action Items */}
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-cyan-400">
                      Action Items ({activeMeetingResult.actionItems?.length || 0})
                    </h5>
                    <div className="mt-2 space-y-2">
                      {(activeMeetingResult.actionItems || []).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-white/5 dark:bg-[#053048]/60 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {item.title}
                            </span>
                          </div>
                          <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-cyan-300">
                            {item.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Objections & Counter-strategies */}
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Objections &amp; Recommended Counter-Strategies
                    </h5>
                    <div className="mt-2 space-y-2">
                      {(activeMeetingResult.objections || []).length === 0 ? (
                        <p className="text-xs text-gray-400">No commercial or product objections detected.</p>
                      ) : (
                        (activeMeetingResult.objections || []).map((obj: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs"
                          >
                            <p className="font-bold text-amber-800 dark:text-amber-300">
                              Objection: {obj.objection}
                            </p>
                            <p className="mt-1 text-gray-600 dark:text-gray-300">
                              <strong className="text-gray-800 dark:text-gray-200">Recommended play:</strong> {obj.counterStrategy}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Key Decisions */}
                  {activeMeetingResult.keyDecisions && activeMeetingResult.keyDecisions.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Key Decisions Made
                      </h5>
                      <ul className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-300 list-disc list-inside">
                        {activeMeetingResult.keyDecisions.map((dec: string, idx: number) => (
                          <li key={idx}>{dec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SMART OUTREACH DRAFTER */}
      {activeTab === 'drafter' && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Configurator */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/90">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Contextual Outreach Drafter
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Generate high-conversion, personalized communications based on the prospect's real-time sentiment score, pipeline stage, and past objections.
              </p>

              <form onSubmit={handleGenerateDraft} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Select Target Prospect
                  </label>
                  <select
                    value={drafterLeadId}
                    onChange={(e) => setDrafterLeadId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  >
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.companyName ? `${l.companyName} (${l.contactName})` : l.contactName} - {l.insight.sentimentLabel}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                      Channel
                    </label>
                    <select
                      value={drafterChannel}
                      onChange={(e: any) => setDrafterChannel(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                    >
                      <option value="EMAIL">Email</option>
                      <option value="WHATSAPP">WhatsApp</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                      Tone
                    </label>
                    <select
                      value={drafterTone}
                      onChange={(e: any) => setDrafterTone(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                    >
                      <option value="PROFESSIONAL">Professional</option>
                      <option value="WARM">Warm &amp; Consultative</option>
                      <option value="DIRECT">Direct &amp; Concise</option>
                      <option value="URGENT">Urgent &amp; Action-Oriented</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Objective
                  </label>
                  <select
                    value={drafterObjective}
                    onChange={(e: any) => setDrafterObjective(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs font-medium outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  >
                    <option value="FOLLOW_UP">Follow Up on Prior Discussion</option>
                    <option value="CLOSE_DEAL">Accelerate Closing / Sign Proposal</option>
                    <option value="REENGAGE">Re-engage Stalled Prospect</option>
                    <option value="MEETING_REQUEST">Schedule Discovery / Demo Call</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                    Custom Context / Value Proposition
                  </label>
                  <textarea
                    rows={3}
                    value={drafterNotes}
                    onChange={(e) => setDrafterNotes(e.target.value)}
                    placeholder="E.g. Mention that we can offer a 10% discount if closed this month, or reference our new SOC2 certification..."
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={actionLoading || !drafterLeadId}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 py-3 text-xs font-bold text-white shadow-md shadow-sky-500/25 hover:from-sky-500 hover:to-cyan-400 transition-all disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>{actionLoading ? 'Drafting with Intelligence...' : 'Generate Smart Outreach'}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Generated Draft Output */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/90 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
                    Generated {drafterChannel} Copy
                  </h3>
                  {generatedDraft && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyDraftToClipboard}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-[#053048] dark:text-gray-200"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span>{copiedText ? 'Copied!' : 'Copy Copy'}</span>
                      </button>

                      <Link
                        href={
                          drafterChannel === 'EMAIL'
                            ? `/email?leadId=${drafterLeadId}`
                            : `/whatsapp?leadId=${drafterLeadId}`
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-500/20 dark:text-cyan-300"
                      >
                        <span>Launch in {drafterChannel === 'EMAIL' ? 'Email' : 'WhatsApp'}</span>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </div>

                {!generatedDraft ? (
                  <div className="py-24 text-center text-xs text-gray-400">
                    <svg className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Configure outreach objective and click &quot;Generate Smart Outreach&quot;.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {generatedDraft.channel === 'EMAIL' && (
                      <div className="rounded-xl border border-gray-200/60 bg-gray-50/70 p-3.5 dark:border-white/10 dark:bg-[#053048]/60">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          Subject Line
                        </span>
                        <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                          {generatedDraft.subject}
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl border border-gray-200/60 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-[#053048]/60">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                        Message Body
                      </span>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-800 dark:text-gray-200 font-sans">
                        {generatedDraft.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {generatedDraft && (
                <div className="mt-6 border-t border-gray-100 dark:border-white/10 pt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>AI calibrated for: {drafterTone.toLowerCase()} tone</span>
                  <button
                    onClick={() => handleGenerateDraft()}
                    className="font-bold text-sky-600 hover:text-sky-700 dark:text-cyan-400"
                  >
                    ↻ Regenerate variation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INSPECT LEAD INTELLIGENCE MODAL */}
      <AnimatePresence>
        {inspectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#073652]"
            >
              <div className="flex items-start justify-between border-b border-gray-100 dark:border-white/10 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                    Deal Intelligence Dossier
                  </span>
                  <h3 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">
                    {inspectedLead.companyName || inspectedLead.contactName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {inspectedLead.contactName} · {inspectedLead.email}
                  </p>
                </div>
                <button
                  onClick={() => setInspectedLead(null)}
                  className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-5 text-xs">
                {/* Score & Risk Summary Banner */}
                <div className="grid grid-cols-3 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3.5 dark:border-white/5 dark:bg-[#053048]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Win Probability</span>
                    <p className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {inspectedLead.insight.winProbability}%
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Sentiment Score</span>
                    <p className="mt-1 text-xl font-black text-sky-600 dark:text-cyan-400">
                      {inspectedLead.insight.sentimentScore}/100
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Churn Risk</span>
                    <p className="mt-1 text-xl font-black text-rose-600 dark:text-rose-400">
                      {inspectedLead.insight.churnRisk}
                    </p>
                  </div>
                </div>

                {/* Copilot Executive Notes */}
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Copilot Assessment
                  </h4>
                  <p className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-gray-700 dark:border-white/5 dark:bg-[#053048] dark:text-gray-200">
                    {inspectedLead.insight.summaryNotes}
                  </p>
                </div>

                {/* Buying Signals */}
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">
                    Detected Buying Signals ({inspectedLead.insight.buyingSignals.length})
                  </h4>
                  {inspectedLead.insight.buyingSignals.length === 0 ? (
                    <p className="text-gray-400">No strong buying signals detected yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {inspectedLead.insight.buyingSignals.map((sig, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-300"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>{sig}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Objections */}
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1.5">
                    Identified Objections &amp; Resistance
                  </h4>
                  {inspectedLead.insight.objections.length === 0 ? (
                    <p className="text-gray-400">No active objections recorded.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {inspectedLead.insight.objections.map((obj, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-lg bg-rose-500/10 p-2 text-rose-800 dark:text-rose-300"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          <span>{obj}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Suggested Actions */}
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-sky-600 dark:text-cyan-400 mb-1.5">
                    Prescribed Actions
                  </h4>
                  <div className="space-y-2">
                    {inspectedLead.insight.suggestedActions.map((act, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-2.5 dark:border-white/5 dark:bg-[#053048]"
                      >
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{act.action}</p>
                          <p className="text-[10px] text-gray-400">Timeframe: {act.timeframe}</p>
                        </div>
                        <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-cyan-300">
                          {act.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-white/10 pt-4">
                <Link
                  href={`/leads/${inspectedLead.id}`}
                  className="text-xs font-bold text-sky-600 hover:underline dark:text-cyan-400"
                >
                  Open Full Lead Profile →
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDrafterLeadId(inspectedLead.id);
                      setInspectedLead(null);
                      setActiveTab('drafter');
                    }}
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-sm"
                  >
                    Draft Message
                  </button>
                  <button
                    onClick={() => setInspectedLead(null)}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold dark:border-white/10"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
