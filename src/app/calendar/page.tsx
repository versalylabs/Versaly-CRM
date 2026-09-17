'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Users,
  Phone,
  RotateCw,
  Home,
  Pin,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User as UserIcon,
  Plus,
} from 'lucide-react';

type Lead = { id:string; contactName:string; companyName?:string|null; email:string };
type User = { id:string; name:string|null; email:string; role:string };
type Event = { id:string; title:string; description?:string|null; type:string; startAt:string; endAt?:string|null; location?:string|null; completed:boolean; reminderAt?:string|null; lead?:Lead|null; assignedTo?:User|null; assignedToId?:string|null };
const types = ['MEETING','CALL','FOLLOW_UP','PROPERTY_VIEWING','OTHER'];

function EventTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'MEETING':
      return <Users className="h-4 w-4 text-sky-500" />;
    case 'CALL':
      return <Phone className="h-4 w-4 text-emerald-500" />;
    case 'FOLLOW_UP':
      return <RotateCw className="h-4 w-4 text-amber-500" />;
    case 'PROPERTY_VIEWING':
      return <Home className="h-4 w-4 text-violet-500" />;
    default:
      return <Pin className="h-4 w-4 text-gray-500" />;
  }
}

const fmt = (v?:string|null) => v ? new Date(v).toLocaleString([], { dateStyle:'medium', timeStyle:'short' }) : '—';
const localInput = (d:Date) => { const p=(n:number)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

export default function CalendarPage() {
 const { data:session } = useSession(); const [events,setEvents]=useState<Event[]>([]); const [leads,setLeads]=useState<Lead[]>([]); const [users,setUsers]=useState<User[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [show,setShow]=useState(false); const [saving,setSaving]=useState(false); const [filter,setFilter]=useState('ALL');
 const [form,setForm]=useState({ title:'', description:'', type:'MEETING', startAt:localInput(new Date(Date.now()+3600000)), endAt:'', location:'', reminderAt:'', leadId:'', assignedToId:'' });
 const canAssign = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';
 const load=async()=>{ setLoading(true); setError(''); try { const [e,l,u]=await Promise.all([fetch('/api/calendar'),fetch('/api/leads'),fetch('/api/users')]); if(!e.ok) throw new Error('Could not load calendar.'); setEvents(await e.json()); if(l.ok)setLeads(await l.json()); if(u.ok)setUsers(await u.json()); } catch(err:any){setError(err.message||'Could not load calendar.');} finally{setLoading(false);} };
 useEffect(()=>{load();},[]);
 const filtered=useMemo(()=>filter==='ALL'?events:events.filter(e=>e.type===filter),[events,filter]);
 const create=async(e:React.FormEvent)=>{e.preventDefault(); setSaving(true); setError(''); try { const r=await fetch('/api/calendar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)}); const d=await r.json(); if(!r.ok) throw new Error(d.error); setEvents(s=>[...s,d].sort((a,b)=>+new Date(a.startAt)-+new Date(b.startAt))); setShow(false); setForm({ title:'',description:'',type:'MEETING',startAt:localInput(new Date(Date.now()+3600000)),endAt:'',location:'',reminderAt:'',leadId:'',assignedToId:''}); }catch(err:any){setError(err.message||'Failed to schedule event.');}finally{setSaving(false);} };
 const complete=async(ev:Event)=>{ const old=events; setEvents(s=>s.map(x=>x.id===ev.id?{...x,completed:!x.completed}:x)); const r=await fetch(`/api/calendar/${ev.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({completed:!ev.completed})}); if(!r.ok){setEvents(old);setError('Could not update event.');} else {const d=await r.json();setEvents(s=>s.map(x=>x.id===ev.id?d:x));}};
 const remove=async(id:string)=>{if(!confirm('Delete this event?'))return; const old=events;setEvents(s=>s.filter(e=>e.id!==id)); const r=await fetch(`/api/calendar/${id}`,{method:'DELETE'});if(!r.ok){setEvents(old);setError('Could not delete event.');}};
 const upcoming=events.filter(e=>!e.completed&&new Date(e.startAt)>=new Date()).length; const today=events.filter(e=>new Date(e.startAt).toDateString()===new Date().toDateString()).length;
 return <div className="min-h-screen bg-gray-50"><div className="container-custom py-10">
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold text-gray-900">Calendar & Scheduling</h1><p className="mt-1 text-gray-600">Schedule meetings, calls, viewings, and follow-ups without losing lead context.</p></div><button onClick={()=>setShow(v=>!v)} className="inline-flex items-center gap-1.5 rounded-lg bg-accent-600 px-5 py-3 font-medium text-white shadow-sm hover:bg-accent-700"><Plus className="h-4 w-4" /><span>Schedule Event</span></button></div>
  {error&&<div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
  <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="rounded-xl bg-white p-5 shadow-soft"><p className="text-sm text-gray-500">Upcoming</p><p className="mt-2 text-3xl font-bold">{upcoming}</p></div><div className="rounded-xl bg-white p-5 shadow-soft"><p className="text-sm text-gray-500">Today</p><p className="mt-2 text-3xl font-bold">{today}</p></div><div className="rounded-xl bg-white p-5 shadow-soft"><p className="text-sm text-gray-500">Completed</p><p className="mt-2 text-3xl font-bold">{events.filter(e=>e.completed).length}</p></div></div>
  {show&&<form onSubmit={create} className="mb-6 rounded-xl bg-white p-6 shadow-soft"><h2 className="mb-5 text-lg font-semibold">Schedule an event</h2><div className="grid gap-4 md:grid-cols-2"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Event title" className="rounded-lg border border-gray-300 px-4 py-3"/><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} className="rounded-lg border border-gray-300 px-4 py-3">{types.map(t=><option key={t}>{t.replace('_',' ')}</option>)}</select><input type="datetime-local" required value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})} className="rounded-lg border border-gray-300 px-4 py-3"/><input type="datetime-local" value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})} className="rounded-lg border border-gray-300 px-4 py-3"/><input value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Location or meeting link (optional)" className="rounded-lg border border-gray-300 px-4 py-3"/><input type="datetime-local" value={form.reminderAt} onChange={e=>setForm({...form,reminderAt:e.target.value})} className="rounded-lg border border-gray-300 px-4 py-3"/><select value={form.leadId} onChange={e=>setForm({...form,leadId:e.target.value})} className="rounded-lg border border-gray-300 px-4 py-3"><option value="">No lead attached</option>{leads.map(l=><option key={l.id} value={l.id}>{l.contactName}{l.companyName?` — ${l.companyName}`:''}</option>)}</select>{canAssign&&<select value={form.assignedToId} onChange={e=>setForm({...form,assignedToId:e.target.value})} className="rounded-lg border border-gray-300 px-4 py-3"><option value="">Assign to me</option>{users.map(u=><option key={u.id} value={u.id}>{u.name||u.email} · {u.role}</option>)}</select>}<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Agenda or notes" className="min-h-24 rounded-lg border border-gray-300 px-4 py-3 md:col-span-2"/></div><div className="mt-5 flex gap-3"><button disabled={saving} className="rounded-lg bg-accent-600 px-5 py-3 font-medium text-white disabled:opacity-60">{saving?'Scheduling...':'Schedule Event'}</button><button type="button" onClick={()=>setShow(false)} className="rounded-lg border border-gray-300 px-5 py-3">Cancel</button></div></form>}
  <div className="rounded-xl bg-white shadow-soft"><div className="flex flex-wrap gap-2 border-b border-gray-100 p-5">{['ALL',...types].map(t=><button key={t} onClick={()=>setFilter(t)} className={`rounded-full px-4 py-2 text-sm font-medium ${filter===t?'bg-accent-100 text-accent-800':'text-gray-600 hover:bg-gray-50'}`}>{t==='ALL'?'All events':t.replace('_',' ')}</button>)}</div>
  {loading?<div className="p-10 text-center text-gray-500">Loading calendar...</div>:filtered.length===0?<div className="p-12 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"><CalendarIcon className="h-6 w-6" /></div><h3 className="mt-3 font-semibold text-gray-900">No events scheduled</h3><p className="mt-1 text-sm text-gray-500">Schedule a meeting, call, viewing, or follow-up to keep the next action visible.</p></div>:<div className="divide-y divide-gray-100">{filtered.map(ev=><div key={ev.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-start"><input type="checkbox" checked={ev.completed} onChange={()=>complete(ev)} className="mt-1 h-5 w-5"/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span><EventTypeIcon type={ev.type} /></span><p className={`font-semibold ${ev.completed?'text-gray-400 line-through':'text-gray-900'}`}>{ev.title}</p><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">{ev.type.replace('_',' ')}</span></div>{ev.description&&<p className="mt-1 text-sm text-gray-500">{ev.description}</p>}<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3 text-gray-400" /> {fmt(ev.startAt)}{ev.endAt?` → ${fmt(ev.endAt)}`:''}</span>{ev.location&&<span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-gray-400" /> {ev.location}</span>}{ev.lead&&<Link href={`/leads/${ev.lead.id}`} className="inline-flex items-center gap-1 font-medium text-accent-700 hover:underline"><UserIcon className="h-3 w-3" /> {ev.lead.contactName}{ev.lead.companyName?` · ${ev.lead.companyName}`:''}</Link>}{ev.assignedTo&&<span>Assigned: {ev.assignedTo.name||ev.assignedTo.email}</span>}</div></div><button onClick={()=>remove(ev.id)} className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button></div>)}</div>}</div>
 </div></div>;
}
