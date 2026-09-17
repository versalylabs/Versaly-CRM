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
  NEW_LEAD: 'bg-gray-100 text-gray-700',
  RESEARCHING: 'bg-blue-50 text-blue-700',
  CONTACTED: 'bg-cyan-50 text-cyan-700',
  FOLLOW_UP: 'bg-sky-50 text-sky-700',
  INTERESTED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  PROPOSAL: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
  WON: 'bg-green-50 text-green-700',
  LOST: 'bg-red-50 text-red-700',
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
    fetch('/api/users').then(r=>r.ok?r.json():[]).then(setUsers).catch(()=>setUsers([]));
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
      setError('Could not delete this lead. Please try again.');
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
    <div className="min-h-screen bg-gray-50">
      <div className="container-custom py-8 !max-w-none">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Leads</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage prospects from first contact to closed client.
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm((visible) => !visible);
              setFormError('');
            }}
            className="btn-primary whitespace-nowrap"
          >
            {showForm ? 'Close Form' : '+ Add Lead'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Total Leads" value={summary.total.toString()} />
          <SummaryCard label="Active Opportunities" value={summary.active.toString()} />
          <SummaryCard label="Won Clients" value={summary.won.toString()} />
          <SummaryCard label="Potential Value" value={formatLeadCurrency(summary.value)} />
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-soft p-6 mb-6 border border-gray-100">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">New Lead</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Add a new real estate prospect to your CRM.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Contact Name *">
                <input required placeholder="e.g. Jane Wanjiku" className="lead-input" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </Field>
              <Field label="Email *">
                <input required type="email" placeholder="name@company.com" className="lead-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Company / Agency">
                <input placeholder="Business name" className="lead-input" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </Field>
              <Field label="Job Title">
                <input placeholder="e.g. CEO, Agent, Director" className="lead-input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input placeholder="Phone number" className="lead-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Location">
                <input placeholder="e.g. Ruaka, Nairobi" className="lead-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Lead Source *">
                <select className="lead-input" value={form.leadSource} onChange={(e) => setForm({ ...form, leadSource: e.target.value })}>
                  {LEAD_SOURCES.map((source) => <option key={source} value={source}>{formatSource(source)}</option>)}
                </select>
              </Field>
              <Field label="Estimated Deal Value">
                <input type="number" min="0" step="0.01" placeholder="e.g. 18000" className="lead-input" value={form.dealValue} onChange={(e) => setForm({ ...form, dealValue: e.target.value })} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Notes">
                  <textarea placeholder="Anything important about this prospect..." className="lead-input min-h-24" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>

              {formError && <p className="text-sm text-red-600 md:col-span-2">{formError}</p>}

              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setFormError(''); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                  {submitting ? 'Saving...' : 'Save Lead'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-soft p-6 border border-gray-100">
          <div className="flex flex-col xl:flex-row xl:items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="lead-label">Search Leads</label>
              <input placeholder="Search by name, company, or email..." className="lead-input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="min-w-44">
              <label className="lead-label">Pipeline Stage</label>
              <select className="lead-input" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option value="">All stages</option>
                {PIPELINE_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
              </select>
            </div>
            <div className="min-w-44">
              <label className="lead-label">Lead Source</label>
              <select className="lead-input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">All sources</option>
                {LEAD_SOURCES.map((source) => <option key={source} value={source}>{formatSource(source)}</option>)}
              </select>
            </div>
            <button onClick={clearFilters} className="btn-secondary whitespace-nowrap">Clear Filters</button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <p className="text-sm text-gray-500">
              {loading ? 'Loading leads...' : `${filteredLeads.length} lead${filteredLeads.length === 1 ? '' : 's'} found`}
            </p>
            {!loading && filteredLeads.length > PAGE_SIZE && (
              <p className="text-xs text-gray-400">Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredLeads.length)} of {filteredLeads.length}</p>
            )}
          </div>

          {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {loading ? (
            <div className="py-14 text-center text-sm text-gray-500">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-14 text-center">
              <p className="font-medium text-gray-700">No leads found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or add a new prospect.</p>
              <button onClick={() => setShowForm(true)} className="text-sm text-accent-600 font-medium mt-4">+ Add your first lead</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
                    <th className="pb-3 pr-4 font-medium">Contact</th>
                    <th className="pb-3 pr-4 font-medium">Company</th>
                    <th className="pb-3 pr-4 font-medium">Location</th>
                    <th className="pb-3 pr-4 font-medium">Stage</th>
                    <th className="pb-3 pr-4 font-medium">Source</th>
                    <th className="pb-3 pr-4 font-medium">Value</th>
                    <th className="pb-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-gray-100 last:border-0 hover:bg-[#0f4965] transition-colors">
                      <td className="py-4 pr-4">
                        <Link href={`/leads/${lead.id}`} className="font-semibold text-gray-800 hover:text-accent-600">
                          {lead.contactName}
                        </Link>
                        <div className="text-xs text-gray-400 mt-1">{lead.email}</div>
                      </td>
                      <td className="py-4 pr-4 text-gray-600">
                        <div>{lead.companyName || '—'}</div>
                        {lead.jobTitle && <div className="text-xs text-gray-400 mt-1">{lead.jobTitle}</div>}
                      </td>
                      <td className="py-4 pr-4 text-gray-600">{lead.location || '—'}</td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${STAGE_COLORS[lead.pipelineStage] || 'bg-gray-100 text-gray-700'}`}>
                            {STAGE_LABELS[lead.pipelineStage] || lead.pipelineStage}
                          </span>
                          <select aria-label={`Change stage for ${lead.contactName}`} value={lead.pipelineStage} disabled={updatingId === lead.id} onChange={(e) => updateStage(lead.id, e.target.value)} className="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-500 bg-white disabled:opacity-50">
                            {PIPELINE_STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-gray-500">{formatSource(lead.leadSource)}</td>
                      <td className="py-4 pr-4 font-medium text-gray-700">{formatLeadCurrency(lead.dealValue)}</td>
                      <td className="py-4 text-right whitespace-nowrap">
                        <Link href={`/leads/${lead.id}`} className="text-sm font-medium text-accent-600 hover:underline mr-4">View</Link>
                        <button onClick={() => deleteLead(lead.id, lead.contactName)} disabled={deletingId === lead.id} className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
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
            <div className="flex items-center justify-between gap-3 pt-5 mt-5 border-t border-gray-100">
              <button className="btn-secondary disabled:opacity-50" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
              <span className="text-sm text-gray-500">Page {safePage} of {totalPages}</span>
              <button className="btn-secondary disabled:opacity-50" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl shadow-soft border border-gray-100 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-800 mt-2">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="lead-label">{label}</label>
      {children}
    </div>
  );
}
