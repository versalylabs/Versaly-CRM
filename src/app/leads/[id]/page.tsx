'use client';

import { formatCurrency } from '@/lib/currency';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type User = { id: string; name: string | null; email: string; role?: string };
type Task = { id: string; title: string; description?: string | null; completed: boolean; priority: string; dueDate?: string | null; createdAt?: string; assignedTo?: User | null };
type Proposal = { id: string; title: string; description?: string | null; value?: number | null; status: string; createdAt?: string; sentAt?: string | null; respondedAt?: string | null };
type Outreach = { id: string; type: string; subject?: string | null; content?: string | null; status: string; sentAt: string };
type Activity = { id: string; type: string; status?: string; timestamp: string; title: string; detail?: string | null };
type Lead = {
  id: string; companyName: string | null; contactName: string; jobTitle: string | null; email: string; phone: string | null; website: string | null; location: string | null;
  businessType: string | null; instagram: string | null; linkedin: string | null; facebook: string | null; leadSource: string; pipelineStage: string; outreachStatus: string;
  dealValue: number | null; notes: string | null; createdAt: string; dateAdded?: string; lastContact?: string | null; nextFollowUp?: string | null;
  assignedToId?: string | null; assignedTo?: User | null; tasks: Task[]; proposals: Proposal[]; outreachLogs: Outreach[];
};

const PIPELINE_STAGES = ['NEW_LEAD','RESEARCHING','CONTACTED','FOLLOW_UP','INTERESTED','PROPOSAL','WON','LOST'];
const OUTREACH_TYPES = ['EMAIL','PHONE_CALL','WHATSAPP','LINKEDIN','INSTAGRAM','SMS','OTHER'];
const OUTREACH_STATUSES = ['PENDING','SENT','OPENED','CLICKED','REPLIED','BOUNCED'];
const LEAD_SOURCES = ['REFERRAL','COLD_OUTREACH','SOCIAL_MEDIA','WEBSITE_FORM','EVENT','OTHER'];
const TABS = ['Overview','AI Copilot','Activity','Outreach','Tasks','Proposals','Notes'] as const;
type Tab = typeof TABS[number];
const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400';
const label = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';
const pretty = (v?: string | null) => (v || '').toLowerCase().split('_').map((x) => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
const date = (v?: string | null) => v ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(v)) : '—';
const dateTime = (v?: string | null) => v ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v)) : '—';
const money = (v?: number | null) => v == null ? '—' : formatCurrency(v);

export default function LeadDetailPage() {
  const params = useParams(); const router = useRouter(); const id = params.id as string;
  const [lead, setLead] = useState<Lead | null>(null); const [form, setForm] = useState<Partial<Lead>>({}); const [users, setUsers] = useState<User[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]); const [tab, setTab] = useState<Tab>('Overview'); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [saved, setSaved] = useState('');
  const [copilotInsight, setCopilotInsight] = useState<any | null>(null); const [copilotLoading, setCopilotLoading] = useState(false);
  const [showOutreach, setShowOutreach] = useState(false); const [showTask, setShowTask] = useState(false); const [showProposal, setShowProposal] = useState(false);
  const [outreachForm, setOutreachForm] = useState({ type: 'EMAIL', status: 'SENT', subject: '', content: '', nextFollowUp: '' });
  const [taskForm, setTaskForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium', assignedToId: '' });
  const [proposalForm, setProposalForm] = useState({ title: '', description: '', value: '', status: 'draft' });

  const loadCopilot = useCallback(async () => {
    setCopilotLoading(true);
    try {
      const res = await fetch('/api/copilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotInsight(data.insight);
      }
    } catch (e) {
      // Non-blocking
    } finally {
      setCopilotLoading(false);
    }
  }, [id]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [leadRes, activityRes, usersRes] = await Promise.all([fetch(`/api/leads/${id}`, { cache: 'no-store' }), fetch(`/api/activity?leadId=${id}&limit=100`, { cache: 'no-store' }), fetch('/api/users', { cache: 'no-store' })]);
      if (leadRes.status === 404) { setError('Lead not found.'); return; }
      const leadData = await leadRes.json(); if (!leadRes.ok) throw new Error(leadData.error || 'Could not load lead');
      setLead(leadData); setForm(leadData); setActivity(activityRes.ok ? await activityRes.json() : []); setUsers(usersRes.ok ? await usersRes.json() : []);
      setTaskForm((x) => ({ ...x, assignedToId: x.assignedToId || leadData.assignedToId || '' }));
      loadCopilot();
    } catch { setError('Could not load this lead. Please try again.'); } finally { setLoading(false); }
  }, [id, loadCopilot]);
  useEffect(() => { load(); }, [load]);
  const update = (field: keyof Lead, value: any) => { setForm((f) => ({ ...f, [field]: value })); setSaved(''); };

  async function saveLead(e?: React.FormEvent) {
    e?.preventDefault(); setSaving(true); setError('');
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save changes'); setLead((old) => old ? { ...old, ...data } : data); setForm((old) => ({ ...old, ...data })); setSaved('Changes saved.');
    } catch (err: any) { setError(err.message || 'Failed to save changes.'); } finally { setSaving(false); }
  }
  async function saveQuick(endpoint: string, payload: any, success: string) {
    setSaving(true); setError('');
    try { const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const data = await res.json(); if (!res.ok) throw new Error(data.error || 'Action failed'); setSaved(success); await load(); }
    catch (err: any) { setError(err.message || 'Action failed.'); } finally { setSaving(false); }
  }
  async function createOutreach(e: React.FormEvent) { e.preventDefault(); await saveQuick('/api/outreach', { ...outreachForm, leadId: id, nextFollowUp: outreachForm.nextFollowUp || null }, 'Outreach logged.'); setShowOutreach(false); setOutreachForm({ type: 'EMAIL', status: 'SENT', subject: '', content: '', nextFollowUp: '' }); setTab('Outreach'); }
  async function createTask(e: React.FormEvent) { e.preventDefault(); await saveQuick('/api/tasks', { ...taskForm, leadId: id, dueDate: taskForm.dueDate || null, assignedToId: taskForm.assignedToId || null }, 'Task created.'); setShowTask(false); setTaskForm({ title: '', description: '', dueDate: '', priority: 'medium', assignedToId: lead?.assignedToId || '' }); setTab('Tasks'); }
  async function createProposal(e: React.FormEvent) { e.preventDefault(); await saveQuick('/api/proposals', { ...proposalForm, leadId: id, value: proposalForm.value || null }, 'Proposal created.'); setShowProposal(false); setProposalForm({ title: '', description: '', value: '', status: 'draft' }); setTab('Proposals'); }
  async function toggleTask(task: Task) { const res = await fetch(`/api/tasks/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !task.completed }) }); if (res.ok) await load(); else setError('Could not update task.'); }
  async function handleDelete() { if (!confirm('Delete this lead permanently? This cannot be undone.')) return; const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' }); if (res.ok) router.push('/leads'); else setError('Failed to delete lead.'); }

  const openTasks = useMemo(() => lead?.tasks.filter((x) => !x.completed) || [], [lead]);
  if (loading) return <div className="min-h-screen bg-gray-50"><div className="container-custom py-12"><p className="text-sm text-gray-500">Loading lead workspace...</p></div></div>;
  if (error && !lead) return <div className="min-h-screen bg-gray-50"><div className="container-custom py-12"><Link href="/leads" className="text-sm text-accent-600">← Back to Leads</Link><div className="mt-4 rounded-xl bg-white p-6 shadow-soft"><p className="text-sm text-red-600">{error}</p></div></div></div>;

  return <div className="min-h-screen bg-gray-50"><div className="container-custom py-8 !max-w-none">
    <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div><Link href="/leads" className="text-sm text-accent-600">← Back to Leads</Link><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold text-gray-900">{lead?.contactName}</h1><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{pretty(lead?.pipelineStage)}</span><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{pretty(lead?.outreachStatus)}</span>{copilotInsight && <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800 border border-cyan-200">AI Win: {copilotInsight.winProbability}% ({copilotInsight.sentimentLabel})</span>}</div><p className="mt-1 text-sm text-gray-500">{lead?.companyName || 'Independent contact'}{lead?.jobTitle ? ` · ${lead.jobTitle}` : ''}</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/inbox" className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100">💬 Unified Inbox</Link><button onClick={() => setShowOutreach(true)} className="rounded-lg border px-3 py-2 text-sm font-medium">Log Outreach</button><button onClick={() => setShowTask(true)} className="rounded-lg border px-3 py-2 text-sm font-medium">+ Task</button><button onClick={() => setShowProposal(true)} className="btn-primary">+ Proposal</button><button onClick={handleDelete} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">Delete</button></div>
    </div>
    {(error || saved) && <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{error || saved}</div>}

    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Deal Value" value={money(lead?.dealValue)} /><Stat label="Open Tasks" value={String(openTasks.length)} /><Stat label="Next Follow-up" value={date(lead?.nextFollowUp)} /><Stat label="Assigned To" value={lead?.assignedTo?.name || lead?.assignedTo?.email || 'Unassigned'} /></div>
    <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-soft"><div className="flex min-w-max gap-1 p-2">{TABS.map((name) => <button key={name} onClick={() => setTab(name)} className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === name ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{name}{name === 'Tasks' ? ` (${lead?.tasks.length || 0})` : ''}</button>)}</div></div>

    {tab === 'Overview' && <div className="grid gap-6 xl:grid-cols-3">
      <form onSubmit={saveLead} className="space-y-6 xl:col-span-2">
        <section className="rounded-xl bg-white p-6 shadow-soft"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-gray-900">Lead Information</h2><p className="text-sm text-gray-500">Manage the core contact and business details.</p></div><button disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save Changes'}</button></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Contact Name"><input required className={input} value={form.contactName || ''} onChange={(e) => update('contactName', e.target.value)} /></Field><Field label="Email"><input required type="email" className={input} value={form.email || ''} onChange={(e) => update('email', e.target.value)} /></Field><Field label="Company Name"><input className={input} value={form.companyName || ''} onChange={(e) => update('companyName', e.target.value)} /></Field><Field label="Job Title"><input className={input} value={form.jobTitle || ''} onChange={(e) => update('jobTitle', e.target.value)} /></Field><Field label="Phone"><input className={input} value={form.phone || ''} onChange={(e) => update('phone', e.target.value)} /></Field><Field label="Location"><input className={input} value={form.location || ''} onChange={(e) => update('location', e.target.value)} /></Field><Field label="Website"><input className={input} value={form.website || ''} onChange={(e) => update('website', e.target.value)} /></Field><Field label="Deal Value"><input type="number" min="0" step="0.01" className={input} value={form.dealValue ?? ''} onChange={(e) => update('dealValue', e.target.value)} /></Field>
          <Field label="Pipeline Stage"><select className={input} value={form.pipelineStage || 'NEW_LEAD'} onChange={(e) => update('pipelineStage', e.target.value)}>{PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Outreach Status"><select className={input} value={form.outreachStatus || 'PENDING'} onChange={(e) => update('outreachStatus', e.target.value)}>{OUTREACH_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Lead Source"><select className={input} value={form.leadSource || 'REFERRAL'} onChange={(e) => update('leadSource', e.target.value)}>{LEAD_SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field><Field label="Assigned To"><select className={input} value={form.assignedToId || ''} onChange={(e) => update('assignedToId', e.target.value)}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></Field><Field label="Next Follow-up"><input type="date" className={input} value={form.nextFollowUp ? String(form.nextFollowUp).slice(0,10) : ''} onChange={(e) => update('nextFollowUp', e.target.value)} /></Field><Field label="Last Contact"><input type="date" className={input} value={form.lastContact ? String(form.lastContact).slice(0,10) : ''} onChange={(e) => update('lastContact', e.target.value)} /></Field></div>
        </section>
        <section className="rounded-xl bg-white p-6 shadow-soft"><h2 className="mb-4 font-semibold text-gray-900">Online Presence</h2><div className="grid gap-4 md:grid-cols-3"><Field label="Instagram"><input className={input} value={form.instagram || ''} onChange={(e) => update('instagram', e.target.value)} /></Field><Field label="LinkedIn"><input className={input} value={form.linkedin || ''} onChange={(e) => update('linkedin', e.target.value)} /></Field><Field label="Facebook"><input className={input} value={form.facebook || ''} onChange={(e) => update('facebook', e.target.value)} /></Field></div></section>
      </form>
      <aside className="space-y-6"><section className="rounded-xl bg-white p-6 shadow-soft"><h2 className="mb-4 font-semibold text-gray-900">Quick Actions</h2><div className="space-y-2"><Link href="/inbox" className="block w-full rounded-lg border border-sky-300 bg-sky-50 px-3 py-3 text-left text-sm font-semibold text-sky-800 hover:bg-sky-100">💬 Open Unified Inbox Thread</Link><Link href={`/email?leadId=${id}`} className="block w-full rounded-lg border px-3 py-3 text-left text-sm hover:bg-gray-50">✉ Send email</Link><Link href={`/whatsapp?leadId=${id}`} className="block w-full rounded-lg border px-3 py-3 text-left text-sm hover:bg-gray-50">💬 Send WhatsApp</Link><button onClick={() => setShowOutreach(true)} className="w-full rounded-lg border px-3 py-3 text-left text-sm hover:bg-gray-50">✎ Log a conversation</button><button onClick={() => setShowTask(true)} className="w-full rounded-lg border px-3 py-3 text-left text-sm hover:bg-gray-50">✓ Create a follow-up task</button><button onClick={() => setShowProposal(true)} className="w-full rounded-lg border px-3 py-3 text-left text-sm hover:bg-gray-50">▣ Create a proposal</button></div></section><section className="rounded-xl bg-white p-6 shadow-soft"><h2 className="mb-4 font-semibold text-gray-900">Relationship Snapshot</h2><div className="space-y-3 text-sm"><Row label="Added" value={date(lead?.dateAdded || lead?.createdAt)} /><Row label="Last Contact" value={dateTime(lead?.lastContact)} /><Row label="Follow-up" value={date(lead?.nextFollowUp)} /><Row label="Tasks" value={`${lead?.tasks.filter((x) => x.completed).length || 0}/${lead?.tasks.length || 0} completed`} /><Row label="Proposals" value={String(lead?.proposals.length || 0)} /><Row label="Outreach" value={String(lead?.outreachLogs.length || 0)} /></div></section></aside>
    </div>}

    {tab === 'AI Copilot' && <Panel title="AI Deal Copilot & Predictive Intelligence" subtitle="Autonomous deal scoring, sentiment detection, buying signals, and strategic recommendations." action={<div className="flex gap-2"><Link href="/copilot" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">Launch Copilot Hub →</Link><button onClick={loadCopilot} disabled={copilotLoading} className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold">{copilotLoading ? 'Analyzing...' : '↻ Refresh Intelligence'}</button></div>}>{copilotInsight ? (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Win Probability</span>
            <p className="mt-1 text-2xl font-black text-emerald-600">{copilotInsight.winProbability}%</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${copilotInsight.winProbability}%` }} />
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sentiment Score</span>
            <p className="mt-1 text-2xl font-black text-sky-600">{copilotInsight.sentimentScore}/100</p>
            <p className="mt-1 text-xs font-semibold text-gray-600">Verdict: {copilotInsight.sentimentLabel}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Churn / Stall Risk</span>
            <p className={`mt-1 text-2xl font-black ${copilotInsight.churnRisk === 'HIGH' ? 'text-rose-600' : copilotInsight.churnRisk === 'MEDIUM' ? 'text-amber-600' : 'text-emerald-600'}`}>
              {copilotInsight.churnRisk}
            </p>
            <p className="mt-1 text-xs text-gray-500">Based on pipeline friction</p>
          </div>
        </div>

        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-sky-700">Copilot Assessment</h3>
          <p className="mt-1 text-sm text-sky-950 leading-relaxed">{copilotInsight.summaryNotes}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-3">Detected Buying Signals</h3>
            {(copilotInsight.buyingSignals || []).length === 0 ? (
              <p className="text-xs text-gray-400">No active buying signals recorded.</p>
            ) : (
              <div className="space-y-2">
                {(copilotInsight.buyingSignals || []).map((sig: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span>{sig}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-3">Objections &amp; Resistance Points</h3>
            {(copilotInsight.objections || []).length === 0 ? (
              <p className="text-xs text-gray-400">No major objections detected.</p>
            ) : (
              <div className="space-y-2">
                {(copilotInsight.objections || []).map((obj: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{obj}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">Suggested Next Moves</h3>
          <div className="space-y-2">
            {(copilotInsight.suggestedActions || []).map((act: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
                <div>
                  <p className="font-semibold text-gray-900">{act.action}</p>
                  <p className="text-gray-400 text-[10px]">Timeframe: {act.timeframe}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">{act.priority}</span>
                  <Link href={`/copilot`} className="rounded bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50">
                    Take Action
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <div className="py-12 text-center text-xs text-gray-500">
        {copilotLoading ? 'Analyzing deal signals...' : 'Click "Refresh Intelligence" above to evaluate this deal.'}
      </div>
    )}</Panel>}

    {tab === 'Activity' && <Panel title="Activity Timeline" subtitle="Everything that has happened with this lead, in one place.">{activity.length ? <div className="space-y-4">{activity.map((item) => <div key={item.id} className="flex gap-4 border-b border-gray-100 pb-4 last:border-0"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-gray-900"/><div className="flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><p className="font-medium text-gray-900">{item.title}</p><span className="text-xs text-gray-400">{dateTime(item.timestamp)}</span></div>{item.detail && <p className="mt-1 text-sm text-gray-500">{item.detail}</p>}</div></div>)}</div> : <Empty text="No activity has been recorded for this lead yet." />}</Panel>}
    {tab === 'Outreach' && <Panel title="Outreach History" action={<button onClick={() => setShowOutreach(true)} className="btn-primary">+ Log Outreach</button>}>{lead?.outreachLogs.length ? <div className="space-y-3">{lead.outreachLogs.slice().sort((a,b)=>new Date(b.sentAt).getTime()-new Date(a.sentAt).getTime()).map((o) => <div key={o.id} className="rounded-xl border border-gray-200 p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium text-gray-900">{pretty(o.type)} · <span className="text-gray-500">{pretty(o.status)}</span></p>{o.subject && <p className="mt-1 text-sm text-gray-600">{o.subject}</p>}{o.content && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-500">{o.content}</p>}</div><span className="text-xs text-gray-400">{dateTime(o.sentAt)}</span></div></div>)}</div> : <Empty text="No outreach has been logged for this lead." />}</Panel>}
    {tab === 'Tasks' && <Panel title="Tasks" action={<button onClick={() => setShowTask(true)} className="btn-primary">+ Create Task</button>}>{lead?.tasks.length ? <div className="space-y-3">{lead.tasks.slice().sort((a,b)=>Number(a.completed)-Number(b.completed)).map((t) => <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><input type="checkbox" checked={t.completed} onChange={() => toggleTask(t)} className="mt-1 h-4 w-4"/><div><p className={t.completed ? 'font-medium text-gray-400 line-through' : 'font-medium text-gray-900'}>{t.title}</p>{t.description && <p className="mt-1 text-sm text-gray-500">{t.description}</p>}<p className="mt-2 text-xs text-gray-400">{pretty(t.priority)} priority · Due {date(t.dueDate)}{t.assignedTo ? ` · ${t.assignedTo.name || t.assignedTo.email}` : ''}</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${t.completed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>{t.completed ? 'Completed' : 'Open'}</span></div>)}</div> : <Empty text="No tasks are linked to this lead." />}</Panel>}
    {tab === 'Proposals' && <Panel title="Proposals" action={<button onClick={() => setShowProposal(true)} className="btn-primary">+ Create Proposal</button>}>{lead?.proposals.length ? <div className="space-y-3">{lead.proposals.map((p) => <div key={p.id} className="rounded-xl border border-gray-200 p-4"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><p className="font-semibold text-gray-900">{p.title}</p>{p.description && <p className="mt-1 text-sm text-gray-500">{p.description}</p>}<p className="mt-2 text-sm font-medium">{money(p.value)}</p></div><div className="text-right"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">{pretty(p.status)}</span><p className="mt-3 text-xs text-gray-400">Created {date(p.createdAt)}</p></div></div></div>)}</div> : <Empty text="No proposals have been created for this lead." />}</Panel>}
    {tab === 'Notes' && <Panel title="Lead Notes" subtitle="Keep relationship context and internal notes attached to this lead."><textarea rows={14} className={input} value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="Add important context, objections, preferences, meeting notes, or anything the team should know..."/><div className="mt-4 flex justify-end"><button onClick={() => saveLead()} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : 'Save Notes'}</button></div></Panel>}

    {showOutreach && <Modal title="Log Outreach" onClose={() => setShowOutreach(false)}><form onSubmit={createOutreach} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Type"><select className={input} value={outreachForm.type} onChange={(e) => setOutreachForm({ ...outreachForm, type: e.target.value })}>{OUTREACH_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field><Field label="Status"><select className={input} value={outreachForm.status} onChange={(e) => setOutreachForm({ ...outreachForm, status: e.target.value })}>{OUTREACH_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></Field></div><Field label="Subject"><input className={input} value={outreachForm.subject} onChange={(e) => setOutreachForm({ ...outreachForm, subject: e.target.value })} /></Field><Field label="Details"><textarea rows={4} className={input} value={outreachForm.content} onChange={(e) => setOutreachForm({ ...outreachForm, content: e.target.value })} /></Field><Field label="Next Follow-up"><input type="date" className={input} value={outreachForm.nextFollowUp} onChange={(e) => setOutreachForm({ ...outreachForm, nextFollowUp: e.target.value })} /></Field><ModalActions saving={saving} label="Save Outreach" onCancel={() => setShowOutreach(false)} /></form></Modal>}
    {showTask && <Modal title="Create Task" onClose={() => setShowTask(false)}><form onSubmit={createTask} className="space-y-4"><Field label="Task Title"><input required className={input} value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></Field><Field label="Description"><textarea rows={3} className={input} value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></Field><div className="grid gap-4 md:grid-cols-3"><Field label="Due Date"><input type="date" className={input} value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></Field><Field label="Priority"><select className={input} value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field><Field label="Assignee"><select className={input} value={taskForm.assignedToId} onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}</select></Field></div><ModalActions saving={saving} label="Create Task" onCancel={() => setShowTask(false)} /></form></Modal>}
    {showProposal && <Modal title="Create Proposal" onClose={() => setShowProposal(false)}><form onSubmit={createProposal} className="space-y-4"><Field label="Proposal Title"><input required className={input} value={proposalForm.title} onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })} /></Field><Field label="Description / Scope"><textarea rows={4} className={input} value={proposalForm.description} onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })} /></Field><div className="grid gap-4 md:grid-cols-2"><Field label="Value"><input type="number" min="0" step="0.01" className={input} value={proposalForm.value} onChange={(e) => setProposalForm({ ...proposalForm, value: e.target.value })} /></Field><Field label="Status"><select className={input} value={proposalForm.status} onChange={(e) => setProposalForm({ ...proposalForm, status: e.target.value })}><option value="draft">Draft</option><option value="sent">Sent</option></select></Field></div><ModalActions saving={saving} label="Create Proposal" onCancel={() => setShowProposal(false)} /></form></Modal>}
  </div></div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 truncate text-lg font-bold text-gray-900">{value}</p></div>; }
function Field({ label: title, children }: { label: string; children: React.ReactNode }) { return <div><label className={label}>{title}</label>{children}</div>; }
function Row({ label: title, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4"><span className="text-gray-500">{title}</span><span className="text-right font-medium text-gray-800">{value}</span></div>; }
function Panel({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-xl bg-white p-6 shadow-soft"><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-lg font-semibold text-gray-900">{title}</h2>{subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}</div>{action}</div>{children}</section>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-500">{text}</div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold text-gray-900">{title}</h2><button onClick={onClose} className="text-2xl leading-none text-gray-400">×</button></div>{children}</div></div>; }
function ModalActions({ saving, label: title, onCancel }: { saving: boolean; label: string; onCancel: () => void }) { return <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving...' : title}</button></div>; }
