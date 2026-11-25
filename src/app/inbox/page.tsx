'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CANNED_RESPONSES } from '@/lib/inbox-shared';

/* ----------------------------------------------------------------------------
 * Simple Inbox
 * One list, one conversation, one reply box. Everything else is a click away.
 * -------------------------------------------------------------------------- */

type Channel = 'EMAIL' | 'WHATSAPP' | string;

interface Conversation {
  id: string;
  leadId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactHandle: string | null;
  channel: Channel;
  subject: string | null;
  lastMessageAt: string;
  lastMessageSnippet: string | null;
  unreadCount: number;
  isClosed: boolean;
  assignedToId: string | null;
  assignedTo?: { id: string; name: string | null; email: string } | null;
  lead?: { id: string; contactName: string; companyName: string | null; email: string; phone: string | null; pipelineStage: string; dealValue: number | null } | null;
}

interface Message {
  id: string;
  channel: string;
  direction: 'INBOUND' | 'OUTBOUND';
  senderName: string | null;
  content: string;
  isInternal: boolean;
  deliveryStatus: string;
  sentAt: string;
}

interface ChannelInfo {
  channel: string;
  connected: boolean;
  status: string;
  accountHandle?: string | null;
  errorMessage?: string | null;
  lastSyncAt?: string | null;
}

interface Account { id: string; channel: string; accountHandle: string; status: string; errorMessage?: string | null }
interface Member { id: string; name: string | null; email: string }

const CHANNEL_LABEL: Record<string, string> = { EMAIL: 'Email', WHATSAPP: 'WhatsApp' };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function displayName(c: Conversation) {
  return c.lead?.contactName || c.contactName || c.contactEmail || c.contactPhone || c.contactHandle || 'Unknown contact';
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

function ChannelIcon({ channel, className = 'h-3.5 w-3.5' }: { channel: string; className?: string }) {
  if (channel === 'WHATSAPP') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-label="WhatsApp">
        <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 000-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.1 5.1 0 001.1 2.7 11.6 11.6 0 004.4 3.9c1.6.7 2.2.7 3 .6a2.6 2.6 0 001.7-1.2 2.1 2.1 0 00.1-1.2c-.1-.1-.3-.2-.5-.3z" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-label="Email">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

export default function InboxPage() {
  const { data: session } = useSession();
  const myId = session?.user?.id;
  const isManager = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  // list state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [scope, setScope] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [state, setState] = useState<'open' | 'done'>('open');
  const [query, setQuery] = useState('');

  // thread state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');

  // composer
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(false);

  // channels
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [team, setTeam] = useState<Member[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const emailChannel = channels.find((c) => c.channel === 'EMAIL');
  const whatsappChannel = channels.find((c) => c.channel === 'WHATSAPP');
  const anyConnected = Boolean(emailChannel?.connected || whatsappChannel?.connected);
  const emailAccount = accounts.find((a) => a.channel === 'EMAIL');

  /* ------------------------------- loading ------------------------------- */
  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || []);
        setAccounts(data.accounts || []);
      }
    } finally {
      setChannelsLoaded(true);
    }
  }, []);

  const loadList = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const folder = scope === 'mine' ? 'assigned_to_me' : scope === 'unassigned' ? 'unassigned' : 'all';
      const params = new URLSearchParams({ folder, state, limit: '80' });
      if (query.trim()) params.set('query', query.trim());
      const res = await fetch(`/api/inbox/conversations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } finally {
      setLoadingList(false);
    }
  }, [scope, state, query]);

  const loadThread = useCallback(async (id: string) => {
    const res = await fetch(`/api/inbox/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setThread(data.conversation);
    setMessages(data.conversation.messages || []);
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);
  useEffect(() => {
    fetch('/api/users').then((r) => (r.ok ? r.json() : [])).then((u) => setTeam(Array.isArray(u) ? u : [])).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadList(), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [loadList, query]);

  useEffect(() => {
    if (selectedId) loadThread(selectedId);
    else { setThread(null); setMessages([]); }
  }, [selectedId, loadThread]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, selectedId]);

  // Pull new email while the inbox is open and visible.
  const syncNow = useCallback(async (manual = false) => {
    if (!emailChannel?.connected) return;
    if (manual) setSyncing(true);
    try {
      const res = await fetch('/api/inbox/sync', { method: 'POST' });
      const data = res.ok ? await res.json() : null;
      if (manual || (data && data.imported > 0)) {
        await Promise.all([loadList(true), loadChannels(), selectedId ? loadThread(selectedId) : Promise.resolve()]);
      }
    } finally {
      if (manual) setSyncing(false);
    }
  }, [emailChannel?.connected, loadList, loadChannels, loadThread, selectedId]);

  useEffect(() => {
    if (!emailChannel?.connected) return;
    syncNow();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') syncNow();
    }, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailChannel?.connected]);

  // Light refresh for new WhatsApp/other messages that arrive by webhook.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadList(true);
        if (selectedId) loadThread(selectedId);
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [loadList, loadThread, selectedId]);

  /* ------------------------------- actions ------------------------------- */
  const openConversation = (id: string) => {
    setSelectedId(id);
    setMobileView('thread');
    setSendError(null);
    setMode('reply');
    setDraft('');
  };

  const patchConversation = async (body: Record<string, unknown>) => {
    if (!thread) return;
    const res = await fetch(`/api/inbox/conversations/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await Promise.all([loadList(true), loadThread(thread.id)]);
    }
  };

  const toggleDone = async () => {
    if (!thread) return;
    await patchConversation(thread.isClosed ? { isClosed: false, status: 'OPEN' } : { isClosed: true, status: 'CLOSED' });
    if (!thread.isClosed) { setSelectedId(null); setMobileView('list'); }
  };

  const send = async () => {
    if (!thread || !draft.trim() || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/inbox/conversations/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: mode === 'note' ? 'INTERNAL_NOTE' : thread.channel, content: draft, isInternal: mode === 'note' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(data.error || 'Message could not be sent.');
        return;
      }
      setDraft('');
      await Promise.all([loadThread(thread.id), loadList(true)]);
    } finally {
      setSending(false);
    }
  };

  const addAsLead = async () => {
    if (!thread) return;
    const res = await fetch(`/api/inbox/conversations/${thread.id}/convert-lead`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) await Promise.all([loadThread(thread.id), loadList(true)]);
  };

  const disconnectEmail = async () => {
    if (!emailAccount) return;
    if (!window.confirm('Disconnect this email account? Existing conversations stay, but new mail will stop arriving.')) return;
    await fetch(`/api/inbox/channels?id=${emailAccount.id}`, { method: 'DELETE' });
    await loadChannels();
  };

  const applyQuick = (text: string) => {
    const name = (thread && displayName(thread).split(' ')[0]) || 'there';
    const company = thread?.lead?.companyName || 'your team';
    setDraft(text.replace(/{{name}}/g, name).replace(/{{company}}/g, company));
    setShowQuick(false);
  };

  const unreadTotal = useMemo(() => conversations.reduce((n, c) => n + (c.unreadCount > 0 ? 1 : 0), 0), [conversations]);
  const replyChannelConnected = thread ? Boolean(channels.find((c) => c.channel === thread.channel)?.connected) : false;

  /* -------------------------------- render -------------------------------- */
  const showWizard = channelsLoaded && !anyConnected && conversations.length === 0 && !loadingList;

  return (
    <div className="flex h-[calc(100vh-6.5rem)] min-h-[520px] w-full overflow-hidden rounded-2xl border border-white/10 bg-ink-900 text-slate-100">
      {/* ----------------------------- conversation list ----------------------------- */}
      <section className={`${mobileView === 'thread' ? 'hidden' : 'flex'} w-full flex-col border-r border-white/10 md:flex md:w-[340px] md:shrink-0`}>
        <header className="space-y-3 border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold text-white">Inbox</h1>
              <p className="text-xs text-slate-400">{unreadTotal > 0 ? `${unreadTotal} waiting for a reply` : 'All caught up'}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {emailChannel?.connected && (
                <button onClick={() => syncNow(true)} title="Check for new email" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Check for new email">
                  <svg className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
              <button onClick={() => setShowNew(true)} disabled={!anyConnected} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
                New message
              </button>
            </div>
          </div>

          <div className="flex rounded-lg bg-white/5 p-0.5 text-xs font-medium">
            {([['all', 'All'], ['mine', 'Mine'], ['unassigned', 'Unassigned']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setScope(key)} className={`flex-1 rounded-md px-2 py-1.5 transition ${scope === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people or messages" className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none" />
            </div>
            <div className="flex rounded-lg bg-white/5 p-0.5 text-xs font-medium">
              {(['open', 'done'] as const).map((s) => (
                <button key={s} onClick={() => setState(s)} className={`rounded-md px-2.5 py-1.5 capitalize transition ${state === s ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>{s}</button>
              ))}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList && <p className="p-6 text-center text-xs text-slate-500">Loading…</p>}
          {!loadingList && conversations.length === 0 && !showWizard && (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-slate-200">{state === 'done' ? 'Nothing marked done yet' : query ? 'No matches' : 'No open conversations'}</p>
              <p className="mt-1 text-xs text-slate-500">{state === 'open' && !query ? 'New messages from your connected accounts will appear here.' : ''}</p>
            </div>
          )}
          {conversations.map((c) => {
            const name = displayName(c);
            const active = c.id === selectedId;
            return (
              <button key={c.id} onClick={() => openConversation(c.id)} className={`flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left transition ${active ? 'bg-sky-500/10' : 'hover:bg-white/5'}`}>
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white">{initials(name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${c.unreadCount > 0 ? 'font-semibold text-white' : 'font-medium text-slate-200'}`}>{name}</span>
                    <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(c.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="text-slate-500"><ChannelIcon channel={c.channel} className="h-3 w-3" /></span>
                    <span className={`truncate text-xs ${c.unreadCount > 0 ? 'text-slate-200' : 'text-slate-400'}`}>{(c.lastMessageSnippet || '').replace(/^\[[A-Z_]+\]\s*/, '')}</span>
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    {c.assignedTo ? <span>{c.assignedTo.name || c.assignedTo.email}</span> : <span className="text-amber-400/80">Unassigned</span>}
                  </span>
                </span>
                {c.unreadCount > 0 && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-400" aria-label="Unread" />}
              </button>
            );
          })}
        </div>

        <footer className="border-t border-white/10 px-4 py-2.5 text-[11px] text-slate-500">
          {emailChannel?.connected ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">
                <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${emailChannel.status === 'ERROR' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                {emailChannel.accountHandle || 'Email connected'}
              </span>
              {isManager && <button onClick={disconnectEmail} className="shrink-0 text-slate-500 hover:text-red-300">Disconnect</button>}
            </div>
          ) : (
            <button onClick={() => setShowConnect(true)} className="text-sky-400 hover:text-sky-300">+ Connect an account</button>
          )}
          {emailChannel?.status === 'ERROR' && <p className="mt-1 text-red-300">{emailChannel.errorMessage}</p>}
        </footer>
      </section>

      {/* -------------------------------- conversation -------------------------------- */}
      <section className={`${mobileView === 'list' ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col md:flex`}>
        {showWizard ? (
          <ConnectWizard isManager={isManager} onConnectEmail={() => setShowConnect(true)} />
        ) : !thread ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="text-sm font-medium text-slate-300">Select a conversation</p>
              <p className="mt-1 text-xs text-slate-500">Pick someone from the list to read and reply.</p>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <button className="md:hidden rounded-lg p-1.5 text-slate-400 hover:bg-white/5" onClick={() => setMobileView('list')} aria-label="Back to list">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold">{initials(displayName(thread))}</span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-white">{displayName(thread)}</h2>
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-400">
                  <ChannelIcon channel={thread.channel} className="h-3 w-3" />
                  {thread.contactEmail || thread.contactPhone || thread.contactHandle || CHANNEL_LABEL[thread.channel] || thread.channel}
                </p>
              </div>
              <select value={thread.assignedToId || ''} onChange={(e) => patchConversation({ assignedToId: e.target.value || null })} className="hidden max-w-[150px] rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-200 focus:outline-none sm:block" aria-label="Assign to">
                <option value="">Unassigned</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.id === myId ? 'Me' : m.name || m.email}</option>)}
              </select>
              <button onClick={() => setShowDetails((v) => !v)} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${showDetails ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5'}`}>Details</button>
              <button onClick={toggleDone} className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500">{thread.isClosed ? 'Reopen' : 'Mark done'}</button>
            </header>

            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {messages.length === 0 && <p className="py-10 text-center text-xs text-slate-500">No messages yet. Say hello below.</p>}
                  {messages.map((m) => {
                    if (m.isInternal) {
                      return (
                        <div key={m.id} className="mx-auto max-w-[85%] rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                          <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-300">Private note · {m.senderName || 'Team'}</p>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      );
                    }
                    const mine = m.direction === 'OUTBOUND';
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? 'rounded-br-md bg-sky-600 text-white' : 'rounded-bl-md bg-white/8 bg-slate-800 text-slate-100'}`}>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className={`mt-1 text-[11px] ${mine ? 'text-sky-100/80' : 'text-slate-500'}`}>
                            {new Date(m.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            {mine && m.deliveryStatus === 'FAILED' ? ' · failed' : ''}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <div className="border-t border-white/10 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex rounded-lg bg-white/5 p-0.5 text-xs font-medium">
                      <button onClick={() => setMode('reply')} className={`rounded-md px-3 py-1 ${mode === 'reply' ? 'bg-white/10 text-white' : 'text-slate-400'}`}>Reply</button>
                      <button onClick={() => setMode('note')} className={`rounded-md px-3 py-1 ${mode === 'note' ? 'bg-amber-400/20 text-amber-200' : 'text-slate-400'}`}>Private note</button>
                    </div>
                    <div className="relative">
                      <button onClick={() => setShowQuick((v) => !v)} className="text-xs text-slate-400 hover:text-white">Quick replies</button>
                      {showQuick && (
                        <div className="absolute bottom-7 right-0 z-10 w-72 overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-xl">
                          {CANNED_RESPONSES.map((r) => (
                            <button key={r.id} onClick={() => applyQuick(r.content)} className="block w-full border-b border-white/5 px-3 py-2 text-left text-xs text-slate-200 last:border-0 hover:bg-white/5">
                              {r.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {mode === 'reply' && !replyChannelConnected && (
                    <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                      {CHANNEL_LABEL[thread.channel] || thread.channel} is not connected, so replies can't be sent. <button onClick={() => setShowConnect(true)} className="font-semibold underline">Connect it</button>
                    </div>
                  )}
                  {sendError && <div className="mb-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{sendError}</div>}

                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); send(); } }}
                      rows={3}
                      placeholder={mode === 'note' ? 'Write a note only your team can see…' : `Reply via ${CHANNEL_LABEL[thread.channel] || thread.channel}…`}
                      className={`min-h-[76px] flex-1 resize-none rounded-xl border px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none ${mode === 'note' ? 'border-amber-400/30 bg-amber-400/5 focus:border-amber-400/60' : 'border-white/10 bg-white/5 focus:border-sky-500/60'}`}
                    />
                    <button onClick={send} disabled={!draft.trim() || sending || (mode === 'reply' && !replyChannelConnected)} className="h-10 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
                      {sending ? 'Sending…' : mode === 'note' ? 'Add note' : 'Send'}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600">Ctrl + Enter to send</p>
                </div>
              </div>

              {showDetails && (
                <aside className="hidden w-72 shrink-0 space-y-4 overflow-y-auto border-l border-white/10 p-4 lg:block">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Contact</p>
                    <p className="mt-1 text-sm font-medium text-white">{displayName(thread)}</p>
                    {thread.contactEmail && <p className="text-xs text-slate-400">{thread.contactEmail}</p>}
                    {thread.contactPhone && <p className="text-xs text-slate-400">{thread.contactPhone}</p>}
                  </div>
                  {thread.lead ? (
                    <div className="rounded-xl bg-white/5 p-3 text-xs">
                      <p className="font-semibold text-white">{thread.lead.companyName || 'Lead'}</p>
                      <p className="mt-1 text-slate-400">Stage: <span className="text-slate-200">{thread.lead.pipelineStage.replace(/_/g, ' ').toLowerCase()}</span></p>
                      {thread.lead.dealValue ? <p className="text-slate-400">Deal value: <span className="text-slate-200">{thread.lead.dealValue.toLocaleString()}</span></p> : null}
                      <Link href={`/leads/${thread.lead.id}`} className="mt-2 inline-block font-semibold text-sky-400 hover:text-sky-300">Open lead →</Link>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-400">
                      <p>This person isn&apos;t in your leads yet.</p>
                      <button onClick={addAsLead} className="mt-2 rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-500">Add as lead</button>
                    </div>
                  )}
                </aside>
              )}
            </div>
          </>
        )}
      </section>

      {showConnect && <ConnectEmailModal onClose={() => setShowConnect(false)} onConnected={async () => { setShowConnect(false); await loadChannels(); await loadList(true); }} isManager={isManager} whatsappConnected={Boolean(whatsappChannel?.connected)} />}
      {showNew && <NewMessageModal channels={channels} onClose={() => setShowNew(false)} onCreated={async (id) => { setShowNew(false); await loadList(true); openConversation(id); }} />}
    </div>
  );
}

/* ------------------------------ first-run wizard ------------------------------ */
function ConnectWizard({ isManager, onConnectEmail }: { isManager: boolean; onConnectEmail: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-lg">
        <h2 className="text-xl font-semibold text-white">Bring your conversations together</h2>
        <p className="mt-2 text-sm text-slate-400">Connect an account and every customer message lands here. Reply without leaving VersalyLabs.</p>

        {!isManager && <p className="mt-4 rounded-lg bg-amber-400/10 p-3 text-xs text-amber-200">Ask a workspace admin to connect your accounts.</p>}

        <div className="mt-6 space-y-3">
          <button disabled={!isManager} onClick={onConnectEmail} className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-sky-500/50 hover:bg-white/10 disabled:opacity-50">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300"><ChannelIcon channel="EMAIL" className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-white">Email</span>
              <span className="block text-xs text-slate-400">Gmail, Outlook, Yahoo, Zoho or your own domain</span>
            </span>
            <span className="text-xs font-semibold text-sky-400">Connect</span>
          </button>
          <Link href="/settings/integrations" className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-emerald-500/50 hover:bg-white/10">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><ChannelIcon channel="WHATSAPP" className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-white">WhatsApp Business</span>
              <span className="block text-xs text-slate-400">Guided setup with your WhatsApp Business number</span>
            </span>
            <span className="text-xs font-semibold text-emerald-400">Set up</span>
          </Link>
          <div className="flex w-full items-center gap-4 rounded-2xl border border-dashed border-white/10 p-4 opacity-60">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-slate-400">IG</span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-200">Instagram &amp; Facebook</span>
              <span className="block text-xs text-slate-500">Coming soon</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- connect email ------------------------------- */
function ConnectEmailModal({ onClose, onConnected, isManager, whatsappConnected }: { onClose: () => void; onConnected: () => void; isManager: boolean; whatsappConnected: boolean }) {
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [settings, setSettings] = useState({ imapHost: '', imapPort: '993', smtpHost: '', smtpPort: '465' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const domain = address.split('@')[1]?.toLowerCase() || '';
  const help =
    domain === 'gmail.com' || domain === 'googlemail.com'
      ? 'Gmail needs an app password: Google Account → Security → 2-Step Verification → App passwords. Use that 16-letter code here.'
      : /^(outlook|hotmail|live|msn)\./.test(domain)
        ? 'Outlook accounts need an app password from account.microsoft.com → Security → App passwords.'
        : domain
          ? 'Use your email password, or an app password if your provider offers one.'
          : 'Enter the address you want customers to reply to.';

  const loadGuess = async () => {
    if (!/^\S+@\S+\.\S+$/.test(address)) return;
    const res = await fetch(`/api/inbox/channels/email?address=${encodeURIComponent(address)}`);
    if (res.ok) {
      const { settings: s } = await res.json();
      setSettings({ imapHost: s.imapHost, imapPort: String(s.imapPort), smtpHost: s.smtpHost, smtpPort: String(s.smtpPort) });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: any = { address, password, displayName: name };
      if (advanced) {
        body.settings = {
          imapHost: settings.imapHost, imapPort: Number(settings.imapPort), imapSecure: true,
          smtpHost: settings.smtpHost, smtpPort: Number(settings.smtpPort), smtpSecure: Number(settings.smtpPort) === 465,
        };
      }
      const res = await fetch('/api/inbox/channels/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Could not connect this account.'); return; }
      onConnected();
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-ink-850 p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Connect your email</h2>
            <p className="mt-1 text-xs text-slate-400">Customers will see replies coming from this address.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">✕</button>
        </div>

        {!isManager && <p className="rounded-lg bg-amber-400/10 p-3 text-xs text-amber-200">Only workspace admins and managers can connect accounts.</p>}

        <label className="block text-xs font-medium text-slate-300">Email address
          <input type="email" required autoFocus value={address} onChange={(e) => setAddress(e.target.value)} onBlur={loadGuess} placeholder="you@yourcompany.com" className={`${field} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-slate-300">App password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={`${field} mt-1`} />
          <span className="mt-1 block text-[11px] font-normal text-slate-500">{help}</span>
        </label>
        <label className="block text-xs font-medium text-slate-300">Your name on emails <span className="font-normal text-slate-500">(optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Sales" className={`${field} mt-1`} />
        </label>

        <button type="button" onClick={() => { setAdvanced((v) => !v); if (!advanced) loadGuess(); }} className="text-xs text-slate-400 hover:text-white">{advanced ? '▾' : '▸'} Mail server settings</button>
        {advanced && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <input aria-label="Incoming server" value={settings.imapHost} onChange={(e) => setSettings({ ...settings, imapHost: e.target.value })} placeholder="Incoming (IMAP) server" className={`${field} col-span-2`} />
            <input aria-label="Incoming port" value={settings.imapPort} onChange={(e) => setSettings({ ...settings, imapPort: e.target.value })} className={field} />
            <input aria-label="Outgoing server" value={settings.smtpHost} onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })} placeholder="Outgoing (SMTP) server" className={`${field} col-span-2`} />
            <input aria-label="Outgoing port" value={settings.smtpPort} onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })} className={field} />
          </div>
        )}

        {error && <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</div>}

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-slate-500">Your password is encrypted and only used to send and fetch your mail.</p>
          <button disabled={busy || !isManager} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50">{busy ? 'Checking…' : 'Connect'}</button>
        </div>

        <div className="border-t border-white/10 pt-3 text-xs text-slate-400">
          {whatsappConnected ? 'WhatsApp is connected.' : <>Want WhatsApp too? <Link href="/settings/integrations" className="font-semibold text-emerald-400 hover:text-emerald-300">Set it up</Link></>}
        </div>
      </form>
    </div>
  );
}

/* ------------------------------- new message ------------------------------- */
function NewMessageModal({ channels, onClose, onCreated }: { channels: ChannelInfo[]; onClose: () => void; onCreated: (id: string) => void }) {
  const available = channels.filter((c) => c.connected && (c.channel === 'EMAIL' || c.channel === 'WHATSAPP'));
  const [channel, setChannel] = useState(available[0]?.channel || 'EMAIL');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const create = await fetch('/api/inbox/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, contactName: name || undefined, contactEmail: channel === 'EMAIL' ? to.trim().toLowerCase() : undefined, contactPhone: channel === 'WHATSAPP' ? to.trim() : undefined, subject: subject || undefined }),
      });
      const created = await create.json();
      if (!create.ok || !created.conversation?.id) { setError(created.error || 'Could not start the conversation.'); return; }
      const send = await fetch(`/api/inbox/conversations/${created.conversation.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, content: text, subject: channel === 'EMAIL' ? subject || undefined : undefined }),
      });
      const sent = await send.json().catch(() => ({}));
      if (!send.ok) { setError(sent.error || 'Message could not be sent.'); return; }
      onCreated(created.conversation.id);
    } finally {
      setBusy(false);
    }
  };

  const field = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-white/10 bg-ink-850 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">New message</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">✕</button>
        </div>
        {available.length > 1 && (
          <div className="flex rounded-lg bg-white/5 p-0.5 text-xs font-medium">
            {available.map((c) => <button type="button" key={c.channel} onClick={() => setChannel(c.channel)} className={`flex-1 rounded-md px-3 py-1.5 ${channel === c.channel ? 'bg-white/10 text-white' : 'text-slate-400'}`}>{CHANNEL_LABEL[c.channel]}</button>)}
          </div>
        )}
        <input required value={to} onChange={(e) => setTo(e.target.value)} type={channel === 'EMAIL' ? 'email' : 'tel'} placeholder={channel === 'EMAIL' ? 'Their email address' : 'Phone with country code, e.g. 2547…'} className={field} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their name (optional)" className={field} />
        {channel === 'EMAIL' && <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={field} />}
        <textarea required rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your message…" className={`${field} resize-none`} />
        {error && <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">{error}</div>}
        <div className="flex justify-end">
          <button disabled={busy} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{busy ? 'Sending…' : 'Send'}</button>
        </div>
      </form>
    </div>
  );
}
