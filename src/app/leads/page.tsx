'use client';

import { formatCurrency } from '../../../lib/currency';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lead = {
  id: string;
  companyName: string | null;
  contactName: string;
  jobTitle: string | null;
  email: string;
  phone: string | null;
  location: string | null;
  leadSource: string;
  pipelineStage: string;
  outreachStatus: string;
  dealValue: number | null;
  assignedToId?: string | null;
  assignedTo?: { id: string; name: string | null; email: string; role: string } | null;
  createdAt: string;
};

const PIPELINE_STAGES = [
  'NEW_LEAD',
  'RESEARCHING',
  'CONTACTED',
  'FOLLOW_UP',
  'INTERESTED',
  'PROPOSAL',
  'WON',
  'LOST',
];

const LEAD_SOURCES = [
  'REFERRAL',
  'COLD_OUTREACH',
  'SOCIAL_MEDIA',
  'WEBSITE_FORM',
  'EVENT',
  'OTHER',
];

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead',
  RESEARCHING: 'Researching',
  CONTACTED: 'Contacted',
  FOLLOW_UP: 'Follow Up',
  INTERESTED: 'Interested',
  PROPOSAL: 'Proposal',
  WON: 'Won',
  LOST: 'Lost',
};

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: 'bg-slate-500/15 text-slate-300 border border-slate-400/30',
  RESEARCHING: 'bg-blue-500/15 text-blue-300 border border-blue-400/30',
  CONTACTED: 'bg-cyan-500/15 text-cyan-300 border border-cyan-400/30',
  FOLLOW_UP: 'bg-sky-500/15 text-sky-300 border border-sky-400/30',
  INTERESTED: 'bg-teal-500/15 text-teal-300 border border-teal-400/30',
  PROPOSAL: 'bg-indigo-500/15 text-indigo-300 border border-indigo-400/30',
  WON: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30',
  LOST: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
};

const PAGE_SIZE = 10;

type User = { id: string; name: string | null; email: string; role: string };

function emptyForm() {
  return {
    companyName: '',
    contactName: '',
    jobTitle: '',
    email: '',
    phone: '',
    location: '',
    leadSource: 'REFERRAL',
    dealValue: '',
    notes: '',
    assignedToId: '',
  };
}

function formatSource(source: string) {
  return source
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatLeadCurrency(value: number | null) {
  if (value === null || value === undefined) return '—';
  return formatCurrency(value);
}

const glassInput =
  'w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [page, setPage] = useState(1);
  const [updatingId, setUpdatingId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (stageFilter) params.set('stage', stageFilter);

      const res = await fetch(`/api/leads?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load leads');
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Could not load leads. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter]);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(fetchLeads, 250);
    return () => clearTimeout(timeout);
  }, [fetchLeads]);

  useEffect(() => {
    setPage(1);
  }, [search, stageFilter, sourceFilter]);

  const filteredLeads = useMemo(() => {
    if (!sourceFilter) return leads;
    return leads.filter((lead) => lead.leadSource === sourceFilter);
  }, [leads, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedLeads = filteredLeads.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const summary = useMemo(() => {
    const totalValue = filteredLeads.reduce(
      (sum, lead) => sum + (lead.dealValue || 0),
      0
    );
    return {
      total: filteredLeads.length,
      active: filteredLeads.filter(
        (lead) => !['WON', 'LOST'].includes(lead.pipelineStage)
      ).length,
      won: filteredLeads.filter((lead) => lead.pipelineStage === 'WON').length,
      value: totalValue,
    };
  }, [filteredLeads]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || 'Failed to create lead');
        return;
      }

      setForm(emptyForm());
      setShowForm(false);
      await fetchLeads();
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStage(id: string, pipelineStage: string) {
    setUpdatingId(id);
    setError('');
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipelineStage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update lead');

      setLeads((current) =>
        current.map((lead) => (lead.id === id ? { ...lead, ...data } : lead))
      );
    } catch {
      setError('Could not update the lead stage. Please try again.');
    } finally {
      setUpdatingId('');
    }
  }

  async function deleteLead(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;

    setDeletingId(id);
    setError('');
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete lead');

      setLeads((current) => current.filter((lead) => lead.id !== id));
    } catch {
      setError('Could not delete the lead. Please try again.');
    } finally {
      setDeletingId('');
    }
  }

  function clearFilters() {
    setSearch('');
    setStageFilter('');
    setSourceFilter('');
  }

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8 !max-w-none">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Prospect Engine</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Leads & Prospects</h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage prospective clients from initial point-of-contact to closed contracts.
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm((visible) => !visible);
              setFormError('');
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition whitespace-nowrap"
          >
            {showForm ? '✕ Close Form' : '+ Add Lead'}
          </button>
        </div>

        {/* Top Summary Cards (React Bits Liquid Glass) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard label="Total Leads" value={summary.total.toString()} color="text-white" />
          <SummaryCard label="Active Opportunities" value={summary.active.toString()} color="text-cyan-300" />
          <SummaryCard label="Won Clients" value={summary.won.toString()} color="text-emerald-400" />
          <SummaryCard label="Potential Value" value={formatLeadCurrency(summary.value)} color="text-sky-300" />
        </div>

        {/* Add Lead Form (React Bits Liquid Glass Panel) */}
        {showForm && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />

            <div className="mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>👤</span>
                <span>Add New Lead</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Enter details to add a prospect into your pipeline.</p>
            </div>

            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Contact Name *">
                <input
                  required
                  placeholder="e.g. Jane Wanjiku"
                  className={glassInput}
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                />
              </Field>
              <Field label="Email *">
                <input
                  required
                  type="email"
                  placeholder="name@company.com"
                  className={glassInput}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Company / Organization">
                <input
                  placeholder="Business name"
                  className={glassInput}
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                />
              </Field>
              <Field label="Job Title">
                <input
                  placeholder="e.g. CEO, Director, Partner"
                  className={glassInput}
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <input
                  placeholder="Phone number"
                  className={glassInput}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Location">
                <input
                  placeholder="e.g. Nairobi, Kenya"
                  className={glassInput}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </Field>
              <Field label="Lead Source *">
                <select
                  className={glassInput}
                  value={form.leadSource}
                  onChange={(e) => setForm({ ...form, leadSource: e.target.value })}
                >
                  {LEAD_SOURCES.map((source) => (
                    <option key={source} value={source} className="bg-[#053048]">
                      {formatSource(source)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estimated Deal Value">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 18000"
                  className={glassInput}
                  value={form.dealValue}
                  onChange={(e) => setForm({ ...form, dealValue: e.target.value })}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Prospect Notes">
                  <textarea
                    placeholder="Key context, specific requests, or requirements..."
                    className={`${glassInput} resize-none`}
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </Field>
              </div>

              {formError && (
                <p className="text-xs text-rose-300 md:col-span-2 bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5">
                  {formError}
                </p>
              )}

              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormError('');
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Leads Table Container (React Bits Liquid Glass Panel) */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

          {/* Filters Bar */}
          <div className="flex flex-col xl:flex-row xl:items-end gap-3 mb-5">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-300 mb-1">Search Leads</label>
              <input
                placeholder="Search by name, company, or email..."
                className={glassInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="min-w-44">
              <label className="block text-xs font-medium text-slate-300 mb-1">Pipeline Stage</label>
              <select
                className={glassInput}
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
              >
                <option value="" className="bg-[#053048]">All stages</option>
                {PIPELINE_STAGES.map((stage) => (
                  <option key={stage} value={stage} className="bg-[#053048]">
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-44">
              <label className="block text-xs font-medium text-slate-300 mb-1">Lead Source</label>
              <select
                className={glassInput}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              >
                <option value="" className="bg-[#053048]">All sources</option>
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source} className="bg-[#053048]">
                    {formatSource(source)}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={clearFilters}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition whitespace-nowrap"
            >
              Clear Filters
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 text-xs">
            <p className="text-slate-400">
              {loading ? 'Loading prospects...' : `${filteredLeads.length} lead${filteredLeads.length === 1 ? '' : 's'} found`}
            </p>
            {!loading && filteredLeads.length > PAGE_SIZE && (
              <p className="text-slate-400">
                Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredLeads.length)} of{' '}
                {filteredLeads.length}
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <div className="text-2xl animate-pulse">👥</div>
              <p>Loading lead records...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="text-3xl">🔍</div>
              <p className="font-bold text-white text-sm">No leads match the criteria</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Try adjusting your search filters or click below to add a new contact.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow transition inline-block"
              >
                + Add your first lead
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-xs">
                <thead>
                  <tr className="text-left uppercase tracking-wider text-slate-400 border-b border-white/10">
                    <th className="pb-3 pr-4 font-semibold">Contact</th>
                    <th className="pb-3 pr-4 font-semibold">Company</th>
                    <th className="pb-3 pr-4 font-semibold">Location</th>
                    <th className="pb-3 pr-4 font-semibold">Stage</th>
                    <th className="pb-3 pr-4 font-semibold">Source</th>
                    <th className="pb-3 pr-4 font-semibold">Value</th>
                    <th className="pb-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paginatedLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="py-3.5 pr-4">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-bold text-white group-hover:text-cyan-200 transition hover:underline"
                        >
                          {lead.contactName}
                        </Link>
                        <div className="text-[11px] text-slate-400 mt-0.5">{lead.email}</div>
                      </td>
                      <td className="py-3.5 pr-4 text-slate-300">
                        <div>{lead.companyName || '—'}</div>
                        {lead.jobTitle && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{lead.jobTitle}</div>
                        )}
                      </td>
                      <td className="py-3.5 pr-4 text-slate-300">{lead.location || '—'}</td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap ${
                              STAGE_COLORS[lead.pipelineStage] || 'bg-white/10 text-slate-300 border border-white/15'
                            }`}
                          >
                            {STAGE_LABELS[lead.pipelineStage] || lead.pipelineStage}
                          </span>
                          <select
                            aria-label={`Change stage for ${lead.contactName}`}
                            value={lead.pipelineStage}
                            disabled={updatingId === lead.id}
                            onChange={(e) => updateStage(lead.id, e.target.value)}
                            className="rounded-lg border border-white/10 bg-[#042438] px-2 py-1 text-[11px] text-white focus:outline-none focus:border-sky-400 transition cursor-pointer disabled:opacity-50"
                          >
                            {PIPELINE_STAGES.map((stage) => (
                              <option key={stage} value={stage} className="bg-[#053048]">
                                {STAGE_LABELS[stage]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4 text-slate-400">{formatSource(lead.leadSource)}</td>
                      <td className="py-3.5 pr-4 font-bold text-emerald-400">
                        {formatLeadCurrency(lead.dealValue)}
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="text-xs font-semibold text-sky-400 hover:text-cyan-300 transition mr-3"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => deleteLead(lead.id, lead.contactName)}
                          disabled={deletingId === lead.id}
                          className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition disabled:opacity-50"
                        >
                          {deletingId === lead.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredLeads.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-white/10 text-xs">
              <button
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition disabled:opacity-50"
                disabled={safePage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span className="text-slate-400">
                Page <strong className="text-white">{safePage}</strong> of{' '}
                <strong className="text-white">{totalPages}</strong>
              </span>
              <button
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition disabled:opacity-50"
                disabled={safePage === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#073652]/70 to-[#042438]/80 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_0_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}
