'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../../lib/currency';

type Lead = { id: string; contactName: string; companyName?: string | null; email: string };
type Proposal = {
  id: string;
  leadId: string;
  title: string;
  description?: string | null;
  value?: number | null;
  status: string;
  createdAt: string;
  sentAt?: string | null;
  respondedAt?: string | null;
  lead: Lead;
};

const statuses = ['draft', 'sent', 'accepted', 'rejected'];

// Predefined Quick Proposal Templates
const PROPOSAL_TEMPLATES = [
  {
    title: 'Luxury Home Marketing Package',
    description:
      'Premium marketing services for luxury property listings including professional photography, virtual tours, and targeted social media advertising.',
    value: 15000,
  },
  {
    title: 'Commercial Property Marketing Campaign',
    description:
      'Comprehensive marketing strategy for downtown commercial properties including LinkedIn, email marketing, and content creation.',
    value: 25000,
  },
  {
    title: 'Executive Real Estate Advisory Retainer',
    description:
      'Dedicated quarterly transaction advisory, market valuation analysis, and priority client acquisitions.',
    value: 45000,
  },
  {
    title: 'Residential Listing Launch & Staging',
    description:
      'Turnkey property staging coordination, open house promotion, and multichannel digital buyer outreach.',
    value: 12500,
  },
];

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ leadId: '', title: '', description: '', value: '', status: 'draft' });
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, l] = await Promise.all([fetch('/api/proposals'), fetch('/api/leads')]);
      if (!p.ok || !l.ok) throw new Error();
      setProposals(await p.json());
      setLeads(await l.json());
    } catch {
      setError('Could not load proposals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingProposal) {
        const r = await fetch(`/api/proposals/${editingProposal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            previousStatus: editingProposal.status,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to update proposal');
        setProposals((prev) => prev.map((item) => (item.id === editingProposal.id ? data : item)));
        setEditingProposal(null);
        setForm({ leadId: '', title: '', description: '', value: '', status: 'draft' });
      } else {
        if (proposals.length >= 4) {
          throw new Error('Maximum limit of 4 proposal templates reached. You can only edit existing templates or delete one to add a new one.');
        }
        const r = await fetch('/api/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to create proposal');
        setProposals([data, ...proposals]);
        setForm({ leadId: '', title: '', description: '', value: '', status: 'draft' });
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save proposal');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: Proposal) => {
    setEditingProposal(p);
    setForm({
      leadId: p.leadId,
      title: p.title,
      description: p.description || '',
      value: p.value != null ? String(p.value) : '',
      status: p.status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingProposal(null);
    setForm({ leadId: '', title: '', description: '', value: '', status: 'draft' });
  };

  const applyTemplate = (tmpl: (typeof PROPOSAL_TEMPLATES)[0]) => {
    setForm((prev) => ({
      ...prev,
      title: tmpl.title,
      description: tmpl.description,
      value: String(tmpl.value),
    }));
  };

  const updateStatus = async (p: Proposal, status: string) => {
    const old = p.status;
    setProposals((x) => x.map((i) => (i.id === p.id ? { ...i, status } : i)));
    const r = await fetch(`/api/proposals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, previousStatus: old }),
    });
    if (!r.ok) {
      setProposals((x) => x.map((i) => (i.id === p.id ? { ...i, status: old } : i)));
      setError('Failed to update proposal');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this proposal?')) return;
    const r = await fetch(`/api/proposals/${id}`, { method: 'DELETE' });
    if (r.ok) setProposals((x) => x.filter((i) => i.id !== id));
    else setError('Failed to delete proposal');
  };

  const visible = useMemo(
    () =>
      proposals.filter((p) => {
        const hay = [p.title, p.lead?.contactName, p.lead?.companyName, p.lead?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return (filter === 'all' || p.status === filter) && hay.includes(query.toLowerCase());
      }),
    [proposals, query, filter]
  );

  const totalValue = proposals.reduce((a, p) => a + (p.value || 0), 0);
  const acceptedValue = proposals.filter((p) => p.status === 'accepted').reduce((a, p) => a + (p.value || 0), 0);
  const fmt = (n: number) => formatCurrency(n);

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Proposals & Quotes</h1>
            <p className="text-sm text-slate-400 mt-1">
              Create, track, and manage client proposals and revenue agreements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <span>↻</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Top KPI Summary Cards (Liquid Glass) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Proposals', value: proposals.length, color: 'text-white' },
            { label: 'Drafts', value: proposals.filter((p) => p.status === 'draft').length, color: 'text-slate-300' },
            { label: 'Accepted Deals', value: proposals.filter((p) => p.status === 'accepted').length, color: 'text-emerald-400' },
            { label: 'Accepted Pipeline', value: fmt(acceptedValue), color: 'text-cyan-300' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#073652]/70 to-[#042438]/80 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className={`mt-2 text-2xl font-extrabold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Main Grid: Form + Proposal Templates List */}
        <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
          {/* Create Proposal Form (Liquid Glass Panel) */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl h-fit space-y-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />

            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{editingProposal ? '✏️' : '📝'}</span>
                  <span>{editingProposal ? 'Edit Proposal Template' : 'Create Proposal'}</span>
                </h2>
                {editingProposal && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="text-[11px] font-semibold text-rose-300 hover:text-rose-200 px-2 py-0.5 rounded-lg border border-rose-500/30 bg-rose-500/10 transition"
                  >
                    ✕ Cancel Edit
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {editingProposal
                  ? `Modifying "${editingProposal.title}". Save changes below.`
                  : 'Draft a new proposal or use a preset template.'}
              </p>
            </div>

            {/* Template Cap Notice when at limit and not editing */}
            {proposals.length >= 4 && !editingProposal && (
              <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3 text-xs text-sky-200 flex items-start gap-2.5 backdrop-blur-md">
                <span className="text-base leading-none">🔒</span>
                <div className="space-y-1">
                  <p className="font-bold text-white">Template Cap Active (4/4 Max)</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    The system is configured with 4 core proposal templates. Only editing is permitted. Click{' '}
                    <strong className="text-cyan-300">Edit</strong> on any template below to adjust its parameters. To add a new template, delete an existing one.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Proposal Templates Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-sky-300">💡 Quick Proposal Templates (Click to Edit)</label>
              <div className="grid grid-cols-1 gap-1.5">
                {PROPOSAL_TEMPLATES.map((tmpl, i) => {
                  const existing = proposals.find((p) => p.title.toLowerCase() === tmpl.title.toLowerCase());
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        if (existing) {
                          startEdit(existing);
                        } else {
                          applyTemplate(tmpl);
                        }
                      }}
                      className="text-left rounded-xl border border-white/5 bg-[#042438]/60 hover:bg-sky-500/15 hover:border-sky-400/30 p-2.5 transition text-xs group"
                    >
                      <div className="font-semibold text-white group-hover:text-cyan-200 transition flex items-center justify-between">
                        <span className="truncate">{tmpl.title}</span>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {existing && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 border border-sky-400/30">
                              Active
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-400 font-bold">{fmt(tmpl.value)}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{tmpl.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-3.5 pt-2 border-t border-white/10">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Contact / Lead *</label>
                <select
                  required
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  className="w-full rounded-xl bg-[#042438] border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition"
                >
                  <option value="">Select a lead...</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.contactName} {l.companyName ? ` — ${l.companyName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Proposal Title *</label>
                <input
                  required
                  placeholder="e.g. Luxury Home Marketing Package"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-xl bg-[#042438] border border-white/10 p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Scope & Description</label>
                <textarea
                  rows={3}
                  placeholder="Details of the agreement or deliverable milestones..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl bg-[#042438] border border-white/10 p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Value Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 15000"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    className="w-full rounded-xl bg-[#042438] border border-white/10 p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-xl bg-[#042438] border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-sky-400 transition"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <button
                  type="submit"
                  disabled={saving || (proposals.length >= 4 && !editingProposal)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-lg transition disabled:opacity-50 ${
                    editingProposal
                      ? 'bg-gradient-to-r from-cyan-600 to-sky-500 hover:from-cyan-500 hover:to-sky-400 text-white shadow-cyan-500/20'
                      : proposals.length >= 4
                      ? 'bg-white/10 text-slate-400 border border-white/10 cursor-not-allowed'
                      : 'bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white shadow-sky-500/20'
                  }`}
                >
                  {saving
                    ? 'Saving...'
                    : editingProposal
                    ? '💾 Update Proposal Template'
                    : proposals.length >= 4
                    ? '🔒 Template Limit Reached (4/4)'
                    : '+ Create Proposal'}
                </button>

                {editingProposal && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition"
                  >
                    Cancel Editing
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Proposals List (React Bits Liquid Glass Styling) */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-5">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Search proposals, leads, or companies..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 transition"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 transition"
              >
                <option value="all">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Proposal Cards List with React Bits Liquid Glass */}
            {loading ? (
              <div className="py-16 text-center text-xs text-slate-400 space-y-2">
                <div className="text-2xl animate-pulse">📄</div>
                <p>Loading proposal templates...</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <div className="text-3xl">📂</div>
                <p className="text-sm font-semibold text-white">No proposals found</p>
                <p className="text-xs max-w-sm mx-auto">
                  Create your first proposal using the form or select a template preset on the left.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visible.map((p) => {
                  const statusColors: Record<string, string> = {
                    draft: 'text-slate-300 bg-white/10 border-white/15',
                    sent: 'text-sky-300 bg-sky-500/15 border-sky-400/30',
                    accepted: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',
                    rejected: 'text-rose-300 bg-rose-500/15 border-rose-400/30',
                  };

                  const isBeingEdited = editingProposal?.id === p.id;

                  return (
                    /* Liquid Glass Proposal Template Card */
                    <div
                      key={p.id}
                      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 backdrop-blur-xl p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.37),inset_0_1px_0_0_rgba(255,255,255,0.14)] ${
                        isBeingEdited
                          ? 'border-cyan-400 bg-gradient-to-b from-[#084266]/85 via-[#073652]/90 to-[#042438]/95 shadow-[0_12px_40px_0_rgba(56,189,248,0.25)] ring-1 ring-cyan-400'
                          : 'border-white/[0.12] hover:border-sky-400/40 bg-gradient-to-b from-[#073652]/70 via-[#062c44]/80 to-[#042438]/90 hover:shadow-[0_12px_40px_0_rgba(56,189,248,0.18)]'
                      }`}
                    >
                      {/* Top Specular Light Refraction Line (Liquid Glass) */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

                      {/* Ambient corner glow on hover */}
                      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-sky-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base group-hover:text-cyan-200 transition">
                              {p.title}
                            </h3>
                            {isBeingEdited && (
                              <span className="rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-200 uppercase tracking-wider animate-pulse">
                                Editing
                              </span>
                            )}
                          </div>

                          {p.lead && (
                            <p className="text-xs text-sky-400 font-medium flex items-center gap-1.5">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                              <span>{p.lead.contactName}</span>
                              {p.lead.companyName && <span>· {p.lead.companyName}</span>}
                            </p>
                          )}

                          {p.description && (
                            <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">
                              {p.description}
                            </p>
                          )}

                          <div className="pt-2">
                            <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1">
                              <span className="text-xs font-normal text-slate-400">Value:</span>
                              <span>{p.value != null ? fmt(p.value) : 'No value set'}</span>
                            </span>
                          </div>
                        </div>

                        {/* Edit, Status & Delete Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 hover:text-white px-3 py-1.5 text-xs font-bold transition flex items-center gap-1 shadow-sm"
                          >
                            <span>✏️</span>
                            <span>Edit</span>
                          </button>

                          <select
                            value={p.status}
                            onChange={(e) => updateStatus(p, e.target.value)}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-sky-400 transition backdrop-blur-md cursor-pointer ${
                              statusColors[p.status] || 'text-white bg-[#042438] border-white/10'
                            }`}
                          >
                            {statuses.map((s) => (
                              <option key={s} value={s} className="bg-[#053048] text-white">
                                {s[0].toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => remove(p.id)}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 px-3 py-1.5 text-xs font-semibold transition"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Total Proposal Value Footer */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Showing <strong className="text-white">{visible.length}</strong> of{' '}
                <strong className="text-white">{proposals.length}</strong> proposals
              </span>
              <p className="text-slate-300">
                Total proposal value:{' '}
                <span className="font-extrabold text-white text-sm ml-1 text-emerald-400">{fmt(totalValue)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}