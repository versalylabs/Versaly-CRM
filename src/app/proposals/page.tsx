'use client';

import { formatCurrency } from '../../../lib/currency';

import { useEffect, useMemo, useState } from 'react';

type Lead = { id:string; contactName:string; companyName?:string|null; email:string };
type Proposal = { id:string; leadId:string; title:string; description?:string|null; value?:number|null; status:string; createdAt:string; sentAt?:string|null; respondedAt?:string|null; lead:Lead };

const statuses = ['draft','sent','accepted','rejected'];

export default function ProposalsPage() {
  const [proposals,setProposals]=useState<Proposal[]>([]);
  const [leads,setLeads]=useState<Lead[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [form,setForm]=useState({leadId:'',title:'',description:'',value:'',status:'draft'});

  const load=async()=>{
    setLoading(true); setError('');
    try {
      const [p,l]=await Promise.all([fetch('/api/proposals'),fetch('/api/leads')]);
      if(!p.ok || !l.ok) throw new Error();
      setProposals(await p.json()); setLeads(await l.json());
    } catch { setError('Could not load proposals. Please try again.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{load()},[]);

  const create=async(e:React.FormEvent)=>{
    e.preventDefault(); setSaving(true); setError('');
    try {
      const r=await fetch('/api/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
      const data=await r.json(); if(!r.ok) throw new Error(data.error);
      setProposals([data,...proposals]); setForm({leadId:'',title:'',description:'',value:'',status:'draft'});
    } catch(e:any){setError(e.message||'Failed to create proposal');}
    finally{setSaving(false);}
  };
  const updateStatus=async(p:Proposal,status:string)=>{
    const old=p.status; setProposals(x=>x.map(i=>i.id===p.id?{...i,status}:i));
    const r=await fetch(`/api/proposals/${p.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,previousStatus:old})});
    if(!r.ok){setProposals(x=>x.map(i=>i.id===p.id?{...i,status:old}:i));setError('Failed to update proposal');}
  };
  const remove=async(id:string)=>{
    if(!confirm('Delete this proposal?')) return;
    const r=await fetch(`/api/proposals/${id}`,{method:'DELETE'});
    if(r.ok)setProposals(x=>x.filter(i=>i.id!==id)); else setError('Failed to delete proposal');
  };

  const visible=useMemo(()=>proposals.filter(p=>{
    const hay=[p.title,p.lead.contactName,p.lead.companyName,p.lead.email].filter(Boolean).join(' ').toLowerCase();
    return (filter==='all'||p.status===filter)&&hay.includes(query.toLowerCase());
  }),[proposals,query,filter]);
  const totalValue=proposals.reduce((a,p)=>a+(p.value||0),0);
  const acceptedValue=proposals.filter(p=>p.status==='accepted').reduce((a,p)=>a+(p.value||0),0);
  const fmt=(n:number)=>formatCurrency(n);

  return <div className="min-h-screen bg-gray-50">
    <div className="container-custom py-8">
      <div className="flex flex-col gap-1 mb-8"><h1 className="text-3xl font-bold text-gray-900">Proposals</h1><p className="text-gray-600">Create, track and manage proposals for your real estate prospects.</p></div>
      {error&&<div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {[['Total Proposals',proposals.length],['Drafts',proposals.filter(p=>p.status==='draft').length],['Accepted',proposals.filter(p=>p.status==='accepted').length],['Accepted Value',fmt(acceptedValue)]].map(([k,v])=><div key={String(k)} className="rounded-xl bg-white p-5 shadow-soft"><p className="text-sm text-gray-500">{k}</p><p className="mt-2 text-2xl font-bold text-gray-900">{v}</p></div>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form onSubmit={create} className="rounded-xl bg-white p-6 shadow-soft h-fit">
          <h2 className="text-lg font-semibold mb-5">Create Proposal</h2>
          <div className="space-y-4">
            <select required value={form.leadId} onChange={e=>setForm({...form,leadId:e.target.value})} className="w-full rounded-lg border p-3"><option value="">Select a lead</option>{leads.map(l=><option key={l.id} value={l.id}>{l.contactName}{l.companyName?` — ${l.companyName}`:''}</option>)}</select>
            <input required placeholder="Proposal title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="w-full rounded-lg border p-3"/>
            <textarea placeholder="Proposal description or scope" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} className="w-full rounded-lg border p-3 min-h-24"/>
            <input type="number" min="0" step="0.01" placeholder="Proposal value" value={form.value} onChange={e=>setForm({...form,value:e.target.value})} className="w-full rounded-lg border p-3"/>
            <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} className="w-full rounded-lg border p-3">{statuses.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select>
            <button disabled={saving} className="w-full rounded-lg bg-gray-900 py-3 font-medium text-white disabled:opacity-60">{saving?'Creating...':'Create Proposal'}</button>
          </div>
        </form>
        <div className="rounded-xl bg-white p-6 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row mb-5">
            <input placeholder="Search proposals or leads..." value={query} onChange={e=>setQuery(e.target.value)} className="flex-1 rounded-lg border p-3"/>
            <select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border p-3"><option value="all">All statuses</option>{statuses.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select>
          </div>
          {loading?<p className="py-10 text-center text-gray-500">Loading proposals...</p>:visible.length===0?<p className="py-10 text-center text-gray-500">No proposals found. Create your first proposal to get started.</p>:<div className="space-y-3">{visible.map(p=><div key={p.id} className="rounded-xl border p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row"><div><h3 className="font-semibold text-gray-900">{p.title}</h3><p className="text-sm text-gray-500 mt-1">{p.lead.contactName}{p.lead.companyName?` · ${p.lead.companyName}`:''}</p>{p.description&&<p className="text-sm text-gray-600 mt-3">{p.description}</p>}<p className="text-sm font-medium mt-3">{p.value!=null?fmt(p.value):'No value set'}</p></div>
            <div className="flex items-start gap-2"><select value={p.status} onChange={e=>updateStatus(p,e.target.value)} className="rounded-lg border px-3 py-2">{statuses.map(s=><option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select><button onClick={()=>remove(p.id)} className="rounded-lg border px-3 py-2 text-red-600">Delete</button></div></div>
          </div>)}</div>}
          <p className="mt-5 text-sm text-gray-500">Total proposal value: <span className="font-semibold text-gray-900">{fmt(totalValue)}</span></p>
        </div>
      </div>
    </div>
  </div>
}