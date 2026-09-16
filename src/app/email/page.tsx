'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Lead = { id: string; contactName: string; companyName: string | null; email: string };
type Template = { id: string; name: string; subject: string; body: string; category: string | null; isActive: boolean };
type Config = { configured: boolean; from: string | null };

const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-100';

function mergeTemplate(value: string, lead?: Lead | null) {
  if (!lead) return value;
  return value
    .replaceAll('{{contactName}}', lead.contactName || '')
    .replaceAll('{{companyName}}', lead.companyName || '')
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
    setLoading(true); setError('');
    try {
      const [leadRes, templateRes, configRes] = await Promise.all([
        fetch('/api/leads', { cache: 'no-store' }),
        fetch('/api/email/templates', { cache: 'no-store' }),
        fetch('/api/email/send', { cache: 'no-store' }),
      ]);
      const [leadData, templateData, configData] = await Promise.all([leadRes.json(), templateRes.json(), configRes.json()]);
      if (!leadRes.ok || !templateRes.ok || !configRes.ok) throw new Error(templateData.error || configData.error || 'Could not load email workspace.');
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
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    if (!form.leadId) { setError('Please choose a lead.'); return; }
    setSending(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send email.');
      setSuccess(`Email sent to ${form.to || selectedLead?.email || 'the lead'} and logged automatically in outreach history.`);
      setForm((current) => ({ ...current, subject: '', content: '' }));
      setSelectedTemplateId('');
    } catch (err: any) { setError(err.message || 'Could not send email.'); }
    finally { setSending(false); }
  }

  function openNewTemplate() {
    setEditingTemplate(null);
    setTemplateForm({ name: '', subject: '', body: '', category: '' });
    setShowTemplateForm(true);
  }

  function openEditTemplate(template: Template) {
    setEditingTemplate(template);
    setTemplateForm({ name: template.name, subject: template.subject, body: template.body, category: template.category || '' });
    setShowTemplateForm(true);
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setSavingTemplate(true); setError('');
    try {
      const url = editingTemplate ? `/api/email/templates/${editingTemplate.id}` : '/api/email/templates';
      const method = editingTemplate ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(templateForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save template.');
      setShowTemplateForm(false); setEditingTemplate(null); await load();
    } catch (err: any) { setError(err.message || 'Could not save template.'); }
    finally { setSavingTemplate(false); }
  }

  async function deleteTemplate(template: Template) {
    if (!confirm(`Delete the "${template.name}" template?`)) return;
    try {
      const res = await fetch(`/api/email/templates/${template.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete template.');
      if (selectedTemplateId === template.id) setSelectedTemplateId('');
      await load();
    } catch (err: any) { setError(err.message || 'Could not delete template.'); }
  }

  return <div className="min-h-screen bg-gray-50"><div className="container-custom py-8 !max-w-none">
    <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h1 className="text-2xl font-bold text-gray-800">Email Workspace</h1><p className="mt-1 text-sm text-gray-500">Send CRM emails, reuse templates, and automatically keep every sent message in the lead timeline.</p></div><Link href="/outreach" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">View Unified History</Link></div>

    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {success && <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}
    {!config.configured && <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-900">Email delivery needs SMTP configuration</h2><p className="mt-1 text-sm text-amber-800">The workspace is ready, but sending is disabled until SMTP credentials are added to your environment. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE, and SMTP_FROM, then restart the server.</p></div>}
    {config.configured && <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">Email delivery is connected. Messages will be sent from <strong>{config.from}</strong>.</div>}

    {loading ? <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow-soft">Loading email workspace...</div> : <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
      <section className="rounded-xl bg-white p-6 shadow-soft"><div className="mb-6"><h2 className="text-lg font-semibold text-gray-900">Compose Email</h2><p className="mt-1 text-sm text-gray-500">Select a lead, optionally apply a template, and send.</p></div>
        <form onSubmit={sendEmail} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1 block text-sm font-medium text-gray-700">Lead</label><select required className={input} value={form.leadId} onChange={(e) => chooseLead(e.target.value)}><option value="">Select a lead...</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.contactName}{lead.companyName ? ` — ${lead.companyName}` : ''}</option>)}</select></div><div><label className="mb-1 block text-sm font-medium text-gray-700">Template</label><select className={input} value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)}><option value="">Start from scratch</option>{templates.filter((template) => template.isActive).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div></div>
          <div><label className="mb-1 block text-sm font-medium text-gray-700">To</label><input required type="email" className={input} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} placeholder="recipient@example.com" /></div>
          <div><label className="mb-1 block text-sm font-medium text-gray-700">Subject</label><input required className={input} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Email subject" /></div>
          <div><label className="mb-1 block text-sm font-medium text-gray-700">Message</label><textarea required rows={12} className={input} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write your message..." /></div>
          <div className="flex items-center justify-between gap-4"><p className="text-xs text-gray-400">Template variables: <code>{'{{contactName}}'}</code>, <code>{'{{companyName}}'}</code>, <code>{'{{email}}'}</code></p><button disabled={sending || !config.configured} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">{sending ? 'Sending...' : 'Send & Log Email'}</button></div>
        </form>
      </section>

      <aside className="rounded-xl bg-white p-6 shadow-soft"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Email Templates</h2><p className="mt-1 text-sm text-gray-500">Reusable messaging for your team.</p></div><button onClick={openNewTemplate} className="btn-primary">+ New</button></div>
        <div className="space-y-3">{templates.length ? templates.map((template) => <div key={template.id} className="rounded-xl border border-gray-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium text-gray-900">{template.name}</p><p className="mt-1 truncate text-sm text-gray-500">{template.subject}</p>{template.category && <span className="mt-2 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{template.category}</span>}</div><div className="flex gap-2"><button onClick={() => { applyTemplate(template.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-lg border px-2 py-1 text-xs">Use</button><button onClick={() => openEditTemplate(template)} className="rounded-lg border px-2 py-1 text-xs">Edit</button><button onClick={() => deleteTemplate(template)} className="rounded-lg border border-red-100 px-2 py-1 text-xs text-red-600">Delete</button></div></div></div>) : <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No templates yet. Create one for introductions, follow-ups, proposals, or nurture emails.</div>}</div>
      </aside>
    </div>}

    {showTemplateForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">{editingTemplate ? 'Edit Email Template' : 'New Email Template'}</h2><button onClick={() => setShowTemplateForm(false)} className="text-2xl leading-none text-gray-400">×</button></div><form onSubmit={saveTemplate} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div><label className="mb-1 block text-sm font-medium">Template name</label><input required className={input} value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">Category</label><input className={input} value={templateForm.category} onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })} placeholder="e.g. Follow-up" /></div></div><div><label className="mb-1 block text-sm font-medium">Subject</label><input required className={input} value={templateForm.subject} onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })} /></div><div><label className="mb-1 block text-sm font-medium">Message</label><textarea required rows={12} className={input} value={templateForm.body} onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })} /><p className="mt-2 text-xs text-gray-400">Use {'{{contactName}}'}, {'{{companyName}}'}, and {'{{email}}'} for personalization.</p></div><div className="flex justify-end gap-3"><button type="button" onClick={() => setShowTemplateForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={savingTemplate} className="btn-primary disabled:opacity-50">{savingTemplate ? 'Saving...' : 'Save Template'}</button></div></form></div></div>}
  </div></div>;
}
