'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Data = { metrics: Record<string, number>; organizations: Array<any> };
const label: Record<string, string> = { totalOrganizations: 'Organizations', activeSubscriptions: 'Active subscriptions', trialing: 'Trials', pastDue: 'Past due', canceled: 'Canceled', mrr: 'MRR', arr: 'ARR', trialRate: 'Trial rate', cancellationRate: 'Cancellation rate' };

export default function PlatformPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { fetch('/api/platform/overview').then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Unable to load platform data'); return j; }).then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-red-50 p-8 text-red-700"><h1 className="text-2xl font-bold">Platform access unavailable</h1><p className="mt-2">{error}</p><p className="mt-4 text-sm">Add your account email to <code>PLATFORM_ADMIN_EMAILS</code> in <code>.env</code>, separated by commas if there is more than one platform administrator.</p></div>;
  if (!data) return <div className="p-8 text-gray-500">Loading platform analytics...</div>;
  const orgs = data.organizations.filter(o => [o.name,o.slug,o.plan,o.planStatus].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <div className="mx-auto max-w-7xl space-y-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-sky-600">STRATEN PLATFORM</p><h1 className="text-3xl font-black tracking-tight">SaaS Admin Console</h1><p className="mt-2 text-sm text-gray-500">Platform-wide subscription health, customer usage, and business metrics.</p></div><div className="flex gap-2"><Link href="/platform/automation" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">Automation usage</Link><Link href="/platform/automation" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">Automation usage</Link><Link href="/platform/support" className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500">Support operations</Link><Link href="/" className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-gray-50">Open CRM</Link></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Object.entries(data.metrics).map(([key,value]) => <div key={key} className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900"><p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label[key]}</p><p className="mt-2 text-2xl font-black">{key === 'mrr' || key === 'arr' ? `$${value.toLocaleString()}` : key.endsWith('Rate') ? `${value}%` : value.toLocaleString()}</p></div>)}</div>
    <section className="rounded-2xl border bg-white shadow-sm dark:bg-gray-900"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Customer workspaces</h2><p className="text-xs text-gray-500">Read-only operational overview. Subscription changes remain Stripe-driven.</p></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search organizations..." className="rounded-xl border px-3 py-2 text-sm" /></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800"><tr><th className="p-4">Workspace</th><th className="p-4">Plan</th><th className="p-4">Status</th><th className="p-4">Users</th><th className="p-4">Leads</th><th className="p-4">Created</th></tr></thead><tbody>{orgs.map(o=><tr key={o.id} className="border-t"><td className="p-4 font-semibold">{o.name}<div className="text-xs font-normal text-gray-500">{o.slug}</div></td><td className="p-4">{o.plan}</td><td className="p-4"><span className="rounded-full border px-2 py-1 text-xs">{o.planStatus}</span></td><td className="p-4">{o.userCount} / {o.seatLimit}</td><td className="p-4">{o.leadCount} / {o.leadLimit}</td><td className="p-4 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>
  </div>;
}
