'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { INDUSTRY_TEMPLATES } from '@/lib/industryTemplates';

type Status = { needed: boolean; industry: string | null; steps: { pipeline: boolean; contacts: boolean; channels: boolean; team: boolean } };

function Step({ n, done, title, children }: { n: number; done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-ink-800 p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${done ? 'bg-emerald-500 text-ink-950' : 'bg-white/10 text-white'}`} aria-hidden="true">
          {done ? '✓' : n}
        </span>
        <h2 className="text-base font-bold text-white">
          {title} {done && <span className="sr-only">(done)</span>}
        </h2>
      </div>
      <div className="mt-3 pl-10 text-sm text-gray-300">{children}</div>
    </li>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [industry, setIndustry] = useState('general');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = () =>
    fetch('/api/onboarding', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        if (s.industry) setIndustry(s.industry);
      });
  useEffect(() => {
    load();
  }, []);

  async function post(body: object) {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || 'Something went wrong.');
      return false;
    }
    return true;
  }

  async function finish() {
    if (await post({ action: 'finish' })) router.push('/dashboard');
  }

  if (!status) return <p className="p-8 text-sm text-gray-400">Loading…</p>;
  const chosen = INDUSTRY_TEMPLATES.find((t) => t.key === industry);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <h1 className="text-3xl font-bold text-white">Welcome! Let&apos;s set up your workspace</h1>
        <p className="mt-2 text-base text-gray-300">Five quick steps. You can skip any of them and come back later.</p>
      </div>

      {message && <p role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">{message}</p>}

      <ol className="space-y-4">
        <Step n={1} done={status.steps.pipeline} title="Choose your industry">
          <p>We&apos;ll set up pipeline stages that match how your business sells.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="industry">Industry</label>
            <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className="rounded-lg border border-gray-600 px-3 py-2 text-sm">
              {INDUSTRY_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <button
              disabled={busy || status.steps.contacts}
              onClick={async () => {
                if (await post({ action: 'template', industry })) await load();
              }}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              Use these stages
            </button>
          </div>
          {chosen && <p className="mt-2 text-xs text-gray-400">Stages: {chosen.stages.map((s) => s.label).join(' → ')}</p>}
        </Step>

        <Step n={2} done={status.steps.contacts} title="Bring in your contacts">
          <p>Import your existing customers from Excel or Google Sheets, or add your first lead by hand.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/leads/import" className="btn-primary px-4 py-2 text-sm">Import a spreadsheet</Link>
            <Link href="/leads" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Add a lead</Link>
          </div>
        </Step>

        <Step n={3} done={status.steps.channels} title="Connect your email or WhatsApp">
          <p>Customer messages then arrive in one shared inbox. You can also add a contact form to your website.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/inbox" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Connect inbox</Link>
            <Link href="/settings/lead-capture" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Website form & WhatsApp link</Link>
          </div>
        </Step>

        <Step n={4} done={status.steps.team} title="Invite your team">
          <p>Give each salesperson their own login so leads and follow-ups can be assigned.</p>
          <Link href="/admin/users" className="mt-3 inline-block rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Invite team members</Link>
        </Step>

        <Step n={5} done={false} title="You're ready">
          <p>Your dashboard shows today&apos;s follow-ups, your pipeline and what needs attention.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button onClick={finish} disabled={busy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">Finish setup</button>
            <button onClick={finish} disabled={busy} className="text-sm font-semibold text-gray-400 underline">Skip for now</button>
          </div>
        </Step>
      </ol>
    </div>
  );
}
