'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lead = { id: string; contactName: string; companyName: string | null; email: string };
type Template = { id: string; name: string; subject: string; body: string; category: string | null; isActive: boolean };
type Config = { configured: boolean; from: string | null };

const glassInput =
  'w-full rounded-xl bg-[#042438] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 transition';

function mergeTemplate(value: string, lead?: Lead | null) {
  if (!lead) return value;
  return value
    .replaceAll('{{contactName}}', lead.contactName || '')
    .replaceAll('{{contact_name}}', lead.contactName || '')
    .replaceAll('{{companyName}}', lead.companyName || '')
    .replaceAll('{{company}}', lead.companyName || '')
    .replaceAll('{{email}}', lead.email || '');
}

export default function EmailPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [config, setConfig] = useState<Config>({ configured: false, from: null });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [form, setForm] = useState({ leadId: '', to: '', subject: '', content: '' });
  const [templateForm, setTemplateForm] = useState({ name: '', subject: '', body: '', category: '' });

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === form.leadId) || null, [leads, form.leadId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leadRes, templateRes, configRes] = await Promise.all([
        fetch('/api/leads', { cache: 'no-store' }),
        fetch('/api/email/templates', { cache: 'no-store' }),
        fetch('/api/email/send', { cache: 'no-store' }),
      ]);
      const [leadData, templateData, configData] = await Promise.all([
        leadRes.json(),
        templateRes.json(),
        configRes.json(),
      ]);
      if (!leadRes.ok || !templateRes.ok || !configRes.ok)
        throw new Error(templateData.error || configData.error || 'Could not load email workspace.');
      const nextLeads = Array.isArray(leadData) ? leadData : [];
      setLeads(nextLeads);
      setTemplates(Array.isArray(templateData) ? templateData : []);
      setConfig(configData);
      if (typeof window !== 'undefined') {
        const requestedLeadId = new URLSearchParams(window.location.search).get('leadId') || '';
        const requestedLead = nextLeads.find((lead: Lead) => lead.id === requestedLeadId);
        if (requestedLead) setForm((current) => ({ ...current, leadId: requestedLead.id, to: requestedLead.email }));
      }
    } catch (err: any) {
      setError(err.message || 'Could not load email workspace.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function chooseLead(id: string) {
    const lead = leads.find((item) => item.id === id);
    setForm((current) => ({ ...current, leadId: id, to: lead?.email || current.to }));
    if (selectedTemplateId) applyTemplate(selectedTemplateId, lead || null);
  }

  function applyTemplate(id: string, explicitLead?: Lead | null) {
    setSelectedTemplateId(id);
    const template = templates.find((item) => item.id === id);
    const lead = explicitLead === undefined ? selectedLead : explicitLead;
    if (!template) return;
    setForm((current) => ({
      ...current,
      subject: mergeTemplate(template.subject, lead),
      content: mergeTemplate(template.body, lead),
    }));
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leadId) {
      setError('Please choose a lead.');
      return;
    }
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send email.');
      setSuccess(`Email sent to ${form.to || selectedLead?.email || 'the lead'} and logged automatically in outreach history.`);
      setForm((current) => ({ ...current, subject: '', content: '' }));
      setSelectedTemplateId('');
    } catch (err: any) {
      setError(err.message || 'Could not send email.');
    } finally {
      setSending(false);
    }
  }

  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: '', subject: '', body: '', category: '' });
    setShowTemplateForm(true);
  }

  function openEditTemplate(template: Template) {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: template.category || '',
    });
    setShowTemplateForm(true);
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSavingTemplate(true);
    setError('');
    try {
      const url = editingTemplate ? `/api/email/templates/${editingTemplate.id}` : '/api/email/templates';
      const method = editingTemplate ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save template.');
      setShowTemplateForm(false);
      setEditingTemplate(null);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not save template.');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function deleteTemplate(template: Template) {
    if (!confirm(`Delete the "${template.name}" template?`)) return;
    try {
      const res = await fetch(`/api/email/templates/${template.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete template.');
      if (selectedTemplateId === template.id) setSelectedTemplateId('');
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not delete template.');
    }
  }

  return (
    <div className="min-h-screen bg-[#053048] text-slate-100">
      <div className="container-custom py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">Communication Suite</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold text-white tracking-tight">Email Workspace</h1>
            <p className="text-sm text-slate-400 mt-1">
              Compose client outreach, manage reusable email templates, and auto-sync delivery history.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/outreach"
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1.5"
            >
              <span>📜</span>
              <span>Unified History</span>
            </Link>
          </div>
        </div>

        {/* Notifications & System Alerts (Liquid Glass) */}
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-200">
            {success}
          </div>
        )}

        {!config.configured && (
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-amber-950/20 p-5 shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
            <h2 className="font-bold text-amber-300 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>Email Delivery Needs SMTP Configuration</span>
            </h2>
            <p className="mt-1 text-xs text-amber-200/80 leading-relaxed">
              The email template engine and composer are fully active. Live delivery is simulated or staged until production SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD) are set in your environment.
            </p>
          </div>
        )}

        {config.configured && (
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-emerald-950/20 p-4 backdrop-blur-xl text-xs text-emerald-200 flex items-center gap-2">
            <span>✓</span>
            <span>
              Connected to SMTP server. Outbound messages will be sent from <strong className="text-white">{config.from}</strong>.
            </span>
          </div>
        )}

        {/* Main Grid: Composer + Templates Library */}
        {loading ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[#073652]/70 p-12 text-center text-xs text-slate-400 backdrop-blur-xl">
            <div className="text-2xl animate-pulse">✉️</div>
            <p className="mt-2">Loading email workspace & templates...</p>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.7fr)]">
            {/* Compose Email Panel (React Bits Liquid Glass) */}
            <section className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>✉️</span>
                  <span>Compose Email</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Select a lead, optionally apply a template, and send.</p>
              </div>

              <form onSubmit={sendEmail} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Lead *</label>
                    <select
                      required
                      className={glassInput}
                      value={form.leadId}
                      onChange={(e) => chooseLead(e.target.value)}
                    >
                      <option value="">Select a lead...</option>
                      {leads.map((lead) => (
                        <option key={lead.id} value={lead.id} className="bg-[#053048] text-white">
                          {lead.contactName}
                          {lead.companyName ? ` — ${lead.companyName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Apply Template</label>
                    <select
                      className={glassInput}
                      value={selectedTemplateId}
                      onChange={(e) => applyTemplate(e.target.value)}
                    >
                      <option value="">Start from scratch</option>
                      {templates
                        .filter((template) => template.isActive)
                        .map((template) => (
                          <option key={template.id} value={template.id} className="bg-[#053048] text-white">
                            {template.name} ({template.category || 'General'})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Recipient Email *</label>
                  <input
                    required
                    type="email"
                    className={glassInput}
                    value={form.to}
                    onChange={(e) => setForm({ ...form, to: e.target.value })}
                    placeholder="recipient@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Subject Line *</label>
                  <input
                    required
                    className={glassInput}
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="e.g. Exploring strategic synergies between our companies"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Message Body *</label>
                  <textarea
                    required
                    rows={10}
                    className={`${glassInput} resize-none font-mono text-xs`}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    placeholder="Write your email here..."
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/10">
                  <p className="text-[11px] text-slate-400">
                    Variables: <code className="text-cyan-300">{'{{contactName}}'}</code>,{' '}
                    <code className="text-cyan-300">{'{{companyName}}'}</code>,{' '}
                    <code className="text-cyan-300">{'{{email}}'}</code>
                  </p>
                  <button
                    disabled={sending || !config.configured}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-sky-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? 'Sending...' : '🚀 Send & Log Email'}
                  </button>
                </div>
              </form>
            </section>

            {/* Email Templates Sidebar (Liquid Glass Panel) */}
            <aside className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-b from-[#073652]/75 via-[#062c44]/80 to-[#042438]/90 p-6 shadow-[0_12px_36px_rgba(0,0,0,0.4),inset_0_1px_1px_0_rgba(255,255,255,0.15)] backdrop-blur-xl space-y-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>📑</span>
                    <span>Email Templates</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">Reusable B2B templates ({templates.length}).</p>
                </div>
                <button
                  onClick={openNewTemplate}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow transition"
                >
                  + New
                </button>
              </div>

              <div className="space-y-3">
                {templates.length ? (
                  templates.map((template) => (
                    <div
                      key={template.id}
                      className="group relative overflow-hidden rounded-xl border border-white/[0.08] hover:border-sky-400/40 bg-[#042438]/60 hover:bg-[#042438]/90 p-4 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white text-xs group-hover:text-cyan-200 transition">
                            {template.name}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-slate-400">{template.subject}</p>
                          {template.category && (
                            <span className="mt-2 inline-block rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                              {template.category}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              applyTemplate(template.id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:text-white transition"
                          >
                            Use
                          </button>
                          <button
                            onClick={() => openEditTemplate(template)}
                            className="rounded-lg border border-sky-400/30 bg-sky-500/15 hover:bg-sky-500/25 px-2.5 py-1 text-[11px] font-medium text-sky-200 hover:text-white transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteTemplate(template)}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 text-[11px] font-medium text-rose-300 hover:text-rose-200 transition"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-400">
                    No templates found. Click + New to add your first template.
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* Liquid Glass Modal for Creating / Editing Templates */}
        {showTemplateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/[0.14] bg-gradient-to-b from-[#073652] via-[#062c44] to-[#042438] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.6)] backdrop-blur-2xl space-y-5">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />

              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{editingTemplate ? '✏️' : '✨'}</span>
                  <span>{editingTemplate ? 'Edit Email Template' : 'New Email Template'}</span>
                </h2>
                <button
                  onClick={() => setShowTemplateForm(false)}
                  className="text-lg text-slate-400 hover:text-white transition leading-none px-2 py-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={saveTemplate} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Template Name *</label>
                    <input
                      required
                      className={glassInput}
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                      placeholder="e.g. Strategic Introduction"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Category</label>
                    <input
                      className={glassInput}
                      value={templateForm.category}
                      onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                      placeholder="e.g. Outreach, Follow-up, Retention"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Subject Line *</label>
                  <input
                    required
                    className={glassInput}
                    value={templateForm.subject}
                    onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                    placeholder="e.g. Quick check-in for {{companyName}}"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Message Body *</label>
                  <textarea
                    required
                    rows={10}
                    className={`${glassInput} resize-none font-mono text-xs`}
                    value={templateForm.body}
                    onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                  />
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Use <code className="text-cyan-300">{'{{contactName}}'}</code>,{' '}
                    <code className="text-cyan-300">{'{{companyName}}'}</code>, and{' '}
                    <code className="text-cyan-300">{'{{email}}'}</code> for auto-personalization.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowTemplateForm(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={savingTemplate}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow transition disabled:opacity-50"
                  >
                    {savingTemplate ? 'Saving...' : 'Save Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
