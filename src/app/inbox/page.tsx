'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/currency';

interface ConversationItem {
  id: string;
  leadId: string;
  channel: string;
  status: string;
  subject: string | null;
  lastMessageAt: string;
  lastMessageSnippet: string | null;
  unreadCount: number;
  assignedToId: string | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  lead: {
    id: string;
    contactName: string;
    companyName: string | null;
    email: string;
    phone: string | null;
    instagram?: string | null;
    facebook?: string | null;
    tiktok?: string | null;
    xHandle?: string | null;
    pipelineStage: string;
    outreachStatus: string;
    dealValue: number | null;
    aiInsight?: {
      sentimentScore: number;
      sentimentLabel: string;
      winProbability: number;
      churnRisk: string;
    } | null;
  };
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderType: 'AGENT' | 'LEAD' | 'SYSTEM' | 'AI_COPILOT';
  senderId: string | null;
  senderName: string | null;
  channel: string;
  content: string;
  isInternal: boolean;
  status: string;
  sentAt: string;
}

interface SmartReplySuggestion {
  id: string;
  label: string;
  text: string;
  channel: 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X';
}

interface ConnectedAccount {
  id: string;
  channel: string;
  accountName: string;
  accountHandle: string;
  externalAccountId?: string | null;
  status: string;
  avatarUrl?: string | null;
  hasAccessToken?: boolean;
  hasAppSecret?: boolean;
  webhookSecret?: string | null;
  connectedAt: string;
}

const CANNED_RESPONSES = [
  {
    id: 'intro',
    title: 'Warm Discovery Introduction',
    content: 'Hi {{name}}, thanks for reaching out! We would love to learn more about your goals at {{company}} and see how Versaly CRM can streamline your sales pipeline. When would be a good time for a brief 15-minute introductory call?',
  },
  {
    id: 'pricing',
    title: 'Standard Pricing & Tiers',
    content: 'Hi {{name}}, here is a quick overview of our plans. Our Growth Pro plan includes unlimited pipeline tracking, automated cadences, and AI deal intelligence. Let us know if you would like a customized quote for {{company}}.',
  },
  {
    id: 'calendar',
    title: 'Calendar Booking Link',
    content: 'Hi {{name}}, please feel free to pick a convenient slot directly on my calendar here: https://calendar.versaly.io/sync. Looking forward to our conversation!',
  },
  {
    id: 'followup',
    title: 'Gentle Value Follow-Up',
    content: 'Hi {{name}}, following up on our previous note. We have some exciting updates that can help {{company}} accelerate conversions this quarter. Are you available for a quick touchpoint this week?',
  },
];

export default function UnifiedInboxPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [counts, setCounts] = useState({ all: 0, unread: 0, open: 0, waiting: 0, closed: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [smartReplies, setSmartReplies] = useState<SmartReplySuggestion[]>([]);

  // Folder & Channel filter
  const [activeFolder, setActiveFolder] = useState<'all' | 'unread' | 'open' | 'waiting' | 'closed'>('all');
  const [activeChannel, setActiveChannel] = useState<'all' | 'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer State
  const [composerMode, setComposerMode] = useState<'REPLY' | 'INTERNAL_NOTE'>('REPLY');
  const [composerChannel, setComposerChannel] = useState<'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X'>('EMAIL');
  const [composerSubject, setComposerSubject] = useState('');
  const [composerContent, setComposerContent] = useState('');

  // Connected Accounts State
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeConnectTab, setActiveConnectTab] = useState<'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X'>('INSTAGRAM');
  const [connectHandle, setConnectHandle] = useState('');
  const [connectAccountName, setConnectAccountName] = useState('');
  const [connectAppId, setConnectAppId] = useState('');
  const [connectAccessToken, setConnectAccessToken] = useState('');
  const [connectAppSecret, setConnectAppSecret] = useState('');
  const [connectWebhookSecret, setConnectWebhookSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectStatusMsg, setConnectStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Conversation Modal State
  const [showNewModal, setShowNewModal] = useState(false);
  const [workspaceLeads, setWorkspaceLeads] = useState<any[]>([]);
  const [newLeadId, setNewLeadId] = useState('');
  const [newChannel, setNewChannel] = useState<'EMAIL' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X'>('EMAIL');

  // Simulation State
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simulateText, setSimulateText] = useState('Hi! Just reviewed your proposal and we would like to proceed with the discovery call.');
  const [simulateChannel, setSimulateChannel] = useState<'WHATSAPP' | 'EMAIL' | 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | 'X'>('WHATSAPP');

  // Mobile View state (THREADS | CHAT | CHANNELS)
  const [mobileView, setMobileView] = useState<'THREADS' | 'CHAT' | 'CHANNELS'>('THREADS');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Load Connected Channel Accounts
  const loadConnectedAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/channels', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConnectedAccounts(data.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load connected channels:', err);
    }
  }, []);

  // 2. Load Conversations List
  const loadConversations = useCallback(async (selectFirst = false) => {
    try {
      setLoading(true);
      const res = await fetch('/api/inbox/conversations', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
      setCounts(data.counts || { all: 0, unread: 0, open: 0, waiting: 0, closed: 0 });

      if (selectFirst && data.conversations?.length > 0 && !selectedId) {
        setSelectedId(data.conversations[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  // 3. Load Single Conversation Details & Messages
  const loadConversationDetails = useCallback(async (id: string) => {
    try {
      setMessagesLoading(true);
      const [res, repliesRes] = await Promise.all([
        fetch(`/api/inbox/conversations/${id}`, { cache: 'no-store' }),
        fetch(`/api/inbox/conversations/${id}/smart-replies`, { cache: 'no-store' }),
      ]);

      if (res.ok) {
        const data = await res.json();
        setSelectedConversation(data.conversation);
        setMessages(data.conversation?.messages || []);

        const validChannels = ['EMAIL', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X'];
        if (validChannels.includes(data.conversation?.channel)) {
          setComposerChannel(data.conversation.channel as any);
        } else {
          setComposerChannel('EMAIL');
        }
        setComposerSubject(data.conversation?.subject || '');
      }

      if (repliesRes.ok) {
        const repliesData = await repliesRes.json();
        setSmartReplies(repliesData.suggestions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // 4. Load Leads for New Thread Picker
  const loadWorkspaceLeads = async () => {
    try {
      const res = await fetch('/api/leads', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setWorkspaceLeads(data.leads || []);
        if (data.leads?.length > 0 && !newLeadId) {
          setNewLeadId(data.leads[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadConversations(true);
    loadConnectedAccounts();
  }, [loadConversations, loadConnectedAccounts]);

  useEffect(() => {
    if (selectedId) {
      loadConversationDetails(selectedId);
    }
  }, [selectedId, loadConversationDetails]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time live polling synchronization (every 4 seconds)
  useEffect(() => {
    const timer = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        try {
          const res = await fetch('/api/inbox/conversations', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setConversations(data.conversations || []);
            setCounts(data.counts || { all: 0, unread: 0, open: 0, waiting: 0, closed: 0 });
          }

          if (selectedId) {
            const detailRes = await fetch(`/api/inbox/conversations/${selectedId}`, { cache: 'no-store' });
            if (detailRes.ok) {
              const detailData = await detailRes.json();
              if (detailData.conversation?.messages) {
                setMessages(detailData.conversation.messages);
              }
            }
          }
        } catch (e) {
          // Silent catch for background polling
        }
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [selectedId]);

  // Send Message or Internal Note
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedId || !composerContent.trim() || sending) return;

    try {
      setSending(true);
      const isInternal = composerMode === 'INTERNAL_NOTE';
      const channel = isInternal ? 'INTERNAL_NOTE' : composerChannel;

      const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          content: composerContent,
          subject: composerSubject,
          isInternal,
        }),
      });

      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      setMessages((prev) => [...prev, data.message]);
      setComposerContent('');
      await loadConversations(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  // Simulate Inbound Customer Message
  const handleSimulateInbound = async () => {
    if (!selectedId || !simulateText.trim()) return;

    try {
      const res = await fetch('/api/inbox/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedId,
          content: simulateText,
          channel: simulateChannel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setShowSimulateModal(false);
        await loadConversations(false);
        if (selectedId) {
          loadConversationDetails(selectedId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Conversation Status (Open <-> Closed)
  const handleToggleStatus = async (newStatus: string) => {
    if (!selectedId) return;

    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setSelectedConversation((prev: any) => ({ ...prev, status: newStatus }));
        await loadConversations(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Connect Channel Account (Quick OAuth or Manual)
  const handleConnectChannel = async (quickAuth = false) => {
    try {
      setConnecting(true);
      setConnectStatusMsg(null);

      const fallbackHandle = quickAuth
        ? activeConnectTab === 'INSTAGRAM'
          ? '@versalylabs'
          : activeConnectTab === 'FACEBOOK'
          ? 'Versaly Agency Official'
          : activeConnectTab === 'TIKTOK'
          ? '@versalylabs_agency'
          : '@versalylabs'
        : connectHandle;

      if (!fallbackHandle.trim()) {
        setConnectStatusMsg({ text: 'Please enter an account handle or username', type: 'error' });
        return;
      }

      const payload = {
        channel: activeConnectTab,
        accountHandle: fallbackHandle,
        accountName: connectAccountName || `${fallbackHandle} (${activeConnectTab})`,
        appId: connectAppId || (quickAuth ? `app_${activeConnectTab.toLowerCase()}_live` : undefined),
        accessToken: connectAccessToken || (quickAuth ? `token_live_${activeConnectTab.toLowerCase()}_${Math.random().toString(36).substring(2, 12)}` : undefined),
        appSecret: connectAppSecret || (quickAuth ? `sec_${Math.random().toString(36).substring(2, 10)}` : undefined),
        webhookSecret: connectWebhookSecret || undefined,
      };

      const res = await fetch('/api/inbox/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setConnectStatusMsg({ text: data.error || 'Failed to connect account', type: 'error' });
        return;
      }

      setConnectStatusMsg({
        text: `Connected ${fallbackHandle} to ${activeConnectTab} successfully!`,
        type: 'success',
      });
      setConnectHandle('');
      setConnectAccountName('');
      setConnectAppId('');
      setConnectAccessToken('');
      setConnectAppSecret('');
      setConnectWebhookSecret('');
      await loadConnectedAccounts();
    } catch (err: any) {
      setConnectStatusMsg({ text: err.message || 'Connection error occurred', type: 'error' });
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect Channel Account
  const handleDisconnectChannel = async (accountId: string) => {
    try {
      const res = await fetch(`/api/inbox/channels?id=${accountId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConnectStatusMsg({ text: 'Channel account disconnected', type: 'success' });
        await loadConnectedAccounts();
      }
    } catch (err) {
      console.error('Failed to disconnect account', err);
    }
  };

  // Create New Conversation Thread
  const handleCreateNewThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadId) return;

    try {
      const res = await fetch('/api/inbox/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: newLeadId,
          channel: newChannel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowNewModal(false);
        await loadConversations(false);
        setSelectedId(data.conversation.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Insert Canned Template
  const applyCannedResponse = (template: typeof CANNED_RESPONSES[0]) => {
    const lead = selectedConversation?.lead;
    const name = lead?.contactName?.split(' ')[0] || lead?.contactName || 'there';
    const company = lead?.companyName || 'your company';

    const text = template.content
      .replace(/{{name}}/g, name)
      .replace(/{{company}}/g, company);

    setComposerContent(text);
  };

  // Channel helper styling & badges
  const getChannelMeta = (channel: string) => {
    switch (channel?.toUpperCase()) {
      case 'WHATSAPP':
        return {
          label: 'WhatsApp',
          dot: 'bg-emerald-500',
          badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
          border: 'border-emerald-500/30',
        };
      case 'EMAIL':
        return {
          label: 'Email',
          dot: 'bg-sky-500',
          badge: 'bg-sky-500/15 text-sky-600 dark:text-cyan-300',
          border: 'border-sky-500/30',
        };
      case 'INSTAGRAM':
        return {
          label: 'Instagram',
          dot: 'bg-pink-500',
          badge: 'bg-pink-500/15 text-pink-600 dark:text-pink-300',
          border: 'border-pink-500/30',
        };
      case 'FACEBOOK':
        return {
          label: 'Facebook',
          dot: 'bg-blue-600',
          badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
          border: 'border-blue-500/30',
        };
      case 'TIKTOK':
        return {
          label: 'TikTok',
          dot: 'bg-teal-400',
          badge: 'bg-teal-500/15 text-teal-600 dark:text-teal-300',
          border: 'border-teal-500/30',
        };
      case 'X':
        return {
          label: 'X (Twitter)',
          dot: 'bg-slate-400',
          badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-200',
          border: 'border-slate-500/30',
        };
      default:
        return {
          label: channel,
          dot: 'bg-gray-400',
          badge: 'bg-gray-500/15 text-gray-600 dark:text-gray-300',
          border: 'border-gray-500/30',
        };
    }
  };

  // Filter Conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Folder filter
      if (activeFolder === 'unread' && c.unreadCount === 0) return false;
      if (activeFolder === 'open' && c.status !== 'OPEN') return false;
      if (activeFolder === 'waiting' && c.status !== 'WAITING_ON_CUSTOMER') return false;
      if (activeFolder === 'closed' && c.status !== 'CLOSED') return false;

      // Channel filter
      if (activeChannel !== 'all' && c.channel !== activeChannel) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const contactMatch = c.lead?.contactName?.toLowerCase().includes(q);
        const companyMatch = c.lead?.companyName?.toLowerCase().includes(q);
        const snippetMatch = c.lastMessageSnippet?.toLowerCase().includes(q);
        return contactMatch || companyMatch || snippetMatch;
      }

      return true;
    });
  }, [conversations, activeFolder, activeChannel, searchQuery]);

  const activeTabAccount = connectedAccounts.find((a) => a.channel === activeConnectTab);
  const activeComposerAccount = connectedAccounts.find((a) => a.channel === composerChannel);

  return (
    <div className="mx-auto max-w-[1600px] h-[calc(100vh-5rem)] flex flex-col space-y-3 pb-2">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>· Unified Omnichannel Communications</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            Omnichannel Unified Inbox
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Live Sync Active Pulse Badge */}
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Live Sync Active</span>
          </div>

          {/* Connect Channels Modal Button */}
          <button
            onClick={() => {
              setShowConnectModal(true);
              setConnectStatusMsg(null);
            }}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-all shadow-sm"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>Connect Channels</span>
            <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 text-[10px] font-black">
              {connectedAccounts.length} Connected
            </span>
          </button>

          {/* New Conversation Button */}
          <button
            onClick={() => {
              loadWorkspaceLeads();
              setShowNewModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-sky-500/20 hover:from-sky-500 hover:to-cyan-400 transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>New Conversation</span>
          </button>
        </div>
      </div>

      {/* 3-Pane Unified Inbox Container */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 overflow-hidden rounded-2xl border border-gray-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#073652]/80">
        {/* PANE 1: Folders & Channels (Cols: 2.5) */}
        <div className={`col-span-12 md:col-span-3 lg:col-span-2 border-r border-gray-200/80 dark:border-white/10 p-3 flex-col justify-between overflow-y-auto ${mobileView === 'CHANNELS' ? 'flex' : 'hidden md:flex'}`}>
          <div className="space-y-4">
            {/* Mobile-only return to threads header */}
            <div className="md:hidden flex items-center justify-between pb-2 border-b border-gray-200 dark:border-white/10">
              <span className="text-xs font-bold text-gray-800 dark:text-white">Filter Channels</span>
              <button
                onClick={() => setMobileView('THREADS')}
                className="rounded-lg bg-sky-500/15 text-sky-600 dark:text-cyan-300 px-2.5 py-1 text-xs font-bold"
              >
                Done →
              </button>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block px-2 mb-1.5">
                Inboxes
              </span>
              <nav className="space-y-1 text-xs font-semibold">
                <button
                  onClick={() => setActiveFolder('all')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition-all ${
                    activeFolder === 'all'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-cyan-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <span>All Messages</span>
                  </div>
                  <span className="rounded-full bg-gray-200/70 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    {counts.all}
                  </span>
                </button>

                <button
                  onClick={() => setActiveFolder('unread')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition-all ${
                    activeFolder === 'unread'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-cyan-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Unread</span>
                  </div>
                  {counts.unread > 0 && (
                    <span className="rounded-full bg-cyan-500 text-white font-black px-1.5 py-0.5 text-[10px]">
                      {counts.unread}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveFolder('open')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition-all ${
                    activeFolder === 'open'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-cyan-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Open Threads</span>
                  </div>
                  <span className="rounded-full bg-gray-200/70 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    {counts.open}
                  </span>
                </button>

                <button
                  onClick={() => setActiveFolder('waiting')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition-all ${
                    activeFolder === 'waiting'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-cyan-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Awaiting Client</span>
                  </div>
                  <span className="rounded-full bg-gray-200/70 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    {counts.waiting}
                  </span>
                </button>

                <button
                  onClick={() => setActiveFolder('closed')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 transition-all ${
                    activeFolder === 'closed'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-cyan-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Resolved / Closed</span>
                  </div>
                  <span className="rounded-full bg-gray-200/70 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-white/10 dark:text-gray-300">
                    {counts.closed}
                  </span>
                </button>
              </nav>
            </div>

            {/* Channels Filter */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Filter by Channel
                </span>
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  Manage
                </button>
              </div>

              <nav className="space-y-1 text-xs font-semibold">
                <button
                  onClick={() => setActiveChannel('all')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-all ${
                    activeChannel === 'all'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-cyan-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <span>All Channels</span>
                </button>

                {/* WhatsApp */}
                <button
                  onClick={() => setActiveChannel('WHATSAPP')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-all ${
                    activeChannel === 'WHATSAPP'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>WhatsApp</span>
                  </div>
                </button>

                {/* Email */}
                <button
                  onClick={() => setActiveChannel('EMAIL')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-all ${
                    activeChannel === 'EMAIL'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-cyan-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    <span>Email</span>
                  </div>
                </button>

                {/* Instagram */}
                <button
                  onClick={() => setActiveChannel('INSTAGRAM')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-all ${
                    activeChannel === 'INSTAGRAM'
                      ? 'bg-pink-500/15 text-pink-600 dark:text-pink-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-pink-500" />
                    <span>Instagram</span>
                  </div>
                  {connectedAccounts.some((a) => a.channel === 'INSTAGRAM') && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Connected" />
                  )}
                </button>

                {/* Facebook */}
                <button
                  onClick={() => setActiveChannel('FACEBOOK')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-all ${
                    activeChannel === 'FACEBOOK'
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    <span>Facebook</span>
                  </div>
                  {connectedAccounts.some((a) => a.channel === 'FACEBOOK') && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Connected" />
                  )}
                </button>

                {/* TikTok */}
                <button
                  onClick={() => setActiveChannel('TIKTOK')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-all ${
                    activeChannel === 'TIKTOK'
                      ? 'bg-teal-500/15 text-teal-600 dark:text-teal-300 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-teal-400" />
                    <span>TikTok</span>
                  </div>
                  {connectedAccounts.some((a) => a.channel === 'TIKTOK') && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Connected" />
                  )}
                </button>

                {/* X */}
                <button
                  onClick={() => setActiveChannel('X')}
                  className={`w-full flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-all ${
                    activeChannel === 'X'
                      ? 'bg-slate-500/15 text-slate-700 dark:text-slate-200 font-bold'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                    <span>X (Twitter)</span>
                  </div>
                  {connectedAccounts.some((a) => a.channel === 'X') && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Connected" />
                  )}
                </button>
              </nav>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-gray-50/70 dark:bg-[#053048]/60 text-[11px] text-gray-500 dark:text-gray-400">
            <p className="font-bold text-gray-800 dark:text-gray-200">Omnichannel Routing</p>
            <p className="mt-0.5 leading-tight">
              Instagram, FB, TikTok & X DMs sync directly into lead timelines with AI Deal Copilot insight.
            </p>
          </div>
        </div>

        {/* PANE 2: Conversation Thread List (Cols: 3.5) */}
        <div className={`col-span-12 md:col-span-4 lg:col-span-3 border-r border-gray-200/80 dark:border-white/10 flex-col min-h-0 ${mobileView === 'THREADS' ? 'flex' : 'hidden md:flex'}`}>
          <div className="p-3 border-b border-gray-200/80 dark:border-white/10">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 pl-8 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                />
                <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <button
                onClick={() => setMobileView('CHANNELS')}
                className="md:hidden shrink-0 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-2.5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200"
                title="Filter Channels & Inboxes"
              >
                Filters
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {loading ? (
              <div className="p-8 text-center text-xs text-gray-400">Loading inbox...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                No conversations match the current folder or channel filter.
              </div>
            ) : (
              filteredConversations.map((item) => {
                const isSelected = item.id === selectedId;
                const isUnread = item.unreadCount > 0;
                const meta = getChannelMeta(item.channel);
                const winProb = item.lead?.aiInsight?.winProbability;
                const sentiment = item.lead?.aiInsight?.sentimentLabel;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedId(item.id);
                      setMobileView('CHAT');
                    }}
                    className={`p-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-500/10 dark:bg-cyan-500/10 border-l-4 border-sky-500'
                        : 'hover:bg-gray-50/80 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dot}`} />
                        <span className={`text-xs truncate ${isUnread ? 'font-black text-gray-900 dark:text-white' : 'font-semibold text-gray-800 dark:text-gray-200'}`}>
                          {item.lead?.contactName}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {new Date(item.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${meta.badge}`}>
                          {meta.label}
                        </span>
                        <span className="truncate">{item.lead?.companyName || 'Independent'}</span>
                      </div>
                      {isUnread && (
                        <span className="h-4 w-4 rounded-full bg-cyan-500 text-white font-black text-[9px] flex items-center justify-center shrink-0">
                          {item.unreadCount}
                        </span>
                      )}
                    </div>

                    <p className={`mt-1 text-xs truncate ${isUnread ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                      {item.lastMessageSnippet || 'No messages yet'}
                    </p>

                    {/* Sentiment & Win Prob Indicators */}
                    <div className="mt-2 flex items-center gap-2">
                      {winProb !== undefined && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {winProb}% Win
                        </span>
                      )}
                      {sentiment && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold ${
                            sentiment === 'POSITIVE'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : sentiment === 'CONCERN'
                              ? 'bg-rose-500/10 text-rose-600'
                              : 'bg-gray-500/10 text-gray-600'
                          }`}
                        >
                          {sentiment}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANE 3: Live Message Stream & Smart Composer (Cols: 6.5) */}
        <div className={`col-span-12 md:col-span-5 lg:col-span-7 flex-col min-h-0 h-full ${mobileView === 'CHAT' ? 'flex' : 'hidden md:flex'}`}>
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
              <svg className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">Select a conversation</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Choose a client from the thread list on the left to review their unified history across Email, WhatsApp, Instagram, Facebook, TikTok, and X.
              </p>
              <button
                onClick={() => setMobileView('THREADS')}
                className="mt-4 md:hidden rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md"
              >
                ← View Conversations
              </button>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="p-3 border-b border-gray-200/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-white/50 dark:bg-[#073652]/60 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => setMobileView('THREADS')}
                    className="md:hidden p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10 shrink-0"
                    title="Back to conversation list"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black text-gray-900 dark:text-white truncate">
                        {selectedConversation.lead?.contactName}
                      </h2>
                      <span className="text-xs text-gray-400 truncate">
                        {selectedConversation.lead?.companyName && `· ${selectedConversation.lead?.companyName}`}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          selectedConversation.status === 'OPEN'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : selectedConversation.status === 'CLOSED'
                            ? 'bg-gray-500/10 text-gray-500'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {selectedConversation.status}
                      </span>
                    </div>

                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedConversation.lead?.email}
                    {selectedConversation.lead?.phone && ` · ${selectedConversation.lead?.phone}`}
                    {selectedConversation.lead?.instagram && ` · IG: ${selectedConversation.lead?.instagram}`}
                    {selectedConversation.lead?.xHandle && ` · X: ${selectedConversation.lead?.xHandle}`}
                    {' · Stage: '}
                    <strong className="text-gray-800 dark:text-gray-200">{selectedConversation.lead?.pipelineStage}</strong>
                    {selectedConversation.lead?.dealValue && (
                      <span> · Deal: {formatCurrency(selectedConversation.lead?.dealValue)}</span>
                    )}
                  </p>
                </div>
              </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSimulateModal(true)}
                    className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-all"
                  >
                    <span>Simulate Reply</span>
                  </button>

                  <button
                    onClick={() =>
                      handleToggleStatus(selectedConversation.status === 'CLOSED' ? 'OPEN' : 'CLOSED')
                    }
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-[#053048] dark:text-gray-200"
                  >
                    {selectedConversation.status === 'CLOSED' ? 'Reopen' : 'Close'}
                  </button>

                  <Link
                    href={`/leads/${selectedConversation.leadId}`}
                    className="rounded-lg bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300"
                    title="View Full Lead Dossier"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Message Feed Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0 bg-gray-50/30 dark:bg-black/10">
                {messagesLoading ? (
                  <div className="text-center p-8 text-xs text-gray-400">Loading conversation history...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center p-8 text-xs text-gray-400">No messages in this thread yet. Send a reply below.</div>
                ) : (
                  messages.map((m) => {
                    if (m.isInternal || m.channel === 'INTERNAL_NOTE') {
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl border border-amber-300/40 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-700/30 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                              <svg className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span>Internal Team Note · {m.senderName}</span>
                            </span>
                            <span className="text-[10px] text-amber-700/70 dark:text-amber-400/60">
                              {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap text-amber-950 dark:text-amber-100 font-sans">
                            {m.content}
                          </p>
                        </div>
                      );
                    }

                    const isAgent = m.senderType === 'AGENT' || m.senderType === 'AI_COPILOT';
                    const meta = getChannelMeta(m.channel);

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                            {isAgent ? m.senderName || 'You' : selectedConversation.lead?.contactName}
                          </span>
                          <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <span className="text-[9px] text-gray-400">
                            {new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div
                          className={`max-w-md md:max-w-lg rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-wrap font-sans ${
                            isAgent
                              ? 'bg-gradient-to-tr from-sky-600 to-cyan-500 text-white shadow-sm rounded-br-none'
                              : 'bg-white dark:bg-[#053048] text-gray-900 dark:text-white border border-gray-200/80 dark:border-white/10 shadow-sm rounded-bl-none'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* AI Smart Reply Suggestions Bar */}
              {smartReplies.length > 0 && (
                <div className="px-3 py-2 border-t border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-[#053048]/40 flex items-center gap-2 overflow-x-auto">
                  <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 shrink-0">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span>AI Copilot:</span>
                  </div>
                  {smartReplies.map((reply) => (
                    <button
                      key={reply.id}
                      onClick={() => {
                        setComposerMode('REPLY');
                        setComposerChannel(reply.channel as any);
                        setComposerContent(reply.text);
                      }}
                      className="rounded-lg border border-sky-300/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-800 dark:text-cyan-200 hover:bg-sky-500/20 shrink-0 transition-colors truncate max-w-xs"
                    >
                      {reply.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Omnichannel Composer */}
              <div className="p-3 border-t border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-[#073652]/80">
                {/* Composer Mode & Channel Toggles */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setComposerMode('REPLY')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        composerMode === 'REPLY'
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
                      }`}
                    >
                      Reply to Client
                    </button>
                    <button
                      onClick={() => setComposerMode('INTERNAL_NOTE')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        composerMode === 'INTERNAL_NOTE'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white'
                      }`}
                    >
                      Internal Note
                    </button>
                  </div>

                  {composerMode === 'REPLY' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Via:</label>
                        <select
                          value={composerChannel}
                          onChange={(e: any) => setComposerChannel(e.target.value)}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold dark:border-white/10 dark:bg-[#053048] dark:text-white"
                        >
                          <option value="EMAIL">Email</option>
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="INSTAGRAM">Instagram DM</option>
                          <option value="FACEBOOK">Facebook Messenger</option>
                          <option value="TIKTOK">TikTok Direct</option>
                          <option value="X">X (Twitter) DM</option>
                        </select>
                      </div>

                      {/* Connection status indicator */}
                      {activeComposerAccount ? (
                        <span className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>{activeComposerAccount.accountHandle}</span>
                        </span>
                      ) : ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X'].includes(composerChannel) ? (
                        <button
                          onClick={() => {
                            setActiveConnectTab(composerChannel as any);
                            setShowConnectModal(true);
                          }}
                          className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300 hover:underline"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span>Not Connected · Link {composerChannel}</span>
                        </button>
                      ) : null}

                      {/* Canned Template Picker */}
                      <select
                        onChange={(e) => {
                          const chosen = CANNED_RESPONSES.find((r) => r.id === e.target.value);
                          if (chosen) applyCannedResponse(chosen);
                          e.target.value = '';
                        }}
                        defaultValue=""
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold dark:border-white/10 dark:bg-[#053048] dark:text-white"
                      >
                        <option value="" disabled>Templates</option>
                        {CANNED_RESPONSES.map((r) => (
                          <option key={r.id} value={r.id}>{r.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {composerMode === 'REPLY' && composerChannel === 'EMAIL' && (
                  <input
                    type="text"
                    placeholder="Subject..."
                    value={composerSubject}
                    onChange={(e) => setComposerSubject(e.target.value)}
                    className="w-full mb-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  />
                )}

                <div className="relative">
                  <textarea
                    rows={3}
                    placeholder={
                      composerMode === 'INTERNAL_NOTE'
                        ? 'Write a private note visible only to your internal team...'
                        : `Write a message to send via ${getChannelMeta(composerChannel).label}... (Press Ctrl+Enter to send)`
                    }
                    value={composerContent}
                    onChange={(e) => setComposerContent(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        handleSendMessage();
                      }
                    }}
                    className={`w-full rounded-xl border p-2.5 text-xs outline-none focus:border-sky-500 ${
                      composerMode === 'INTERNAL_NOTE'
                        ? 'border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-700/40 text-gray-900 dark:text-white'
                        : 'border-gray-200 bg-white dark:border-white/10 dark:bg-[#053048] text-gray-900 dark:text-white'
                    }`}
                  />

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-gray-400">
                      Shortcut: <kbd className="font-mono bg-gray-100 dark:bg-white/10 px-1 py-0.5 rounded">Ctrl+Enter</kbd>
                    </span>

                    <button
                      onClick={() => handleSendMessage()}
                      disabled={sending || !composerContent.trim()}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50 ${
                        composerMode === 'INTERNAL_NOTE'
                          ? 'bg-amber-600 hover:bg-amber-500'
                          : 'bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400'
                      }`}
                    >
                      <span>
                        {sending
                          ? 'Sending...'
                          : composerMode === 'INTERNAL_NOTE'
                          ? 'Post Note'
                          : `Send via ${getChannelMeta(composerChannel).label}`}
                      </span>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CONNECT CHANNELS MODAL (Instagram, Facebook, TikTok, X) */}
      <AnimatePresence>
        {showConnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#073652] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white">
                    Connect Social & Messaging Channels
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Link your official accounts to receive and dispatch messages directly from the Unified Inbox.
                  </p>
                </div>
                <button
                  onClick={() => setShowConnectModal(false)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              {connectStatusMsg && (
                <div
                  className={`mt-4 rounded-xl p-3 text-xs font-semibold ${
                    connectStatusMsg.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                  }`}
                >
                  {connectStatusMsg.text}
                </div>
              )}

              {/* Channel Tabs */}
              <div className="mt-4 flex border-b border-gray-200 dark:border-white/10">
                {(['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X'] as const).map((tab) => {
                  const meta = getChannelMeta(tab);
                  const isCurrent = activeConnectTab === tab;
                  const isLinked = connectedAccounts.some((a) => a.channel === tab);

                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveConnectTab(tab);
                        setConnectStatusMsg(null);
                      }}
                      className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-all ${
                        isCurrent
                          ? 'border-cyan-500 text-cyan-600 dark:text-cyan-300'
                          : 'border-transparent text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <span>{meta.label}</span>
                      {isLinked && (
                        <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="mt-4 space-y-4">
                {/* Active Connected Account Card */}
                {activeTabAccount ? (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center text-white font-bold text-sm">
                          {activeTabAccount.accountHandle.replace('@', '').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-gray-900 dark:text-white">
                              {activeTabAccount.accountHandle}
                            </span>
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Connected
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {activeTabAccount.accountName} · Linked on {new Date(activeTabAccount.connectedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDisconnectChannel(activeTabAccount.id)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/20 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>

                    <div className="mt-4 pt-3 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Inbound Webhook Token</span>
                        <p className="font-mono text-[11px] text-gray-700 dark:text-gray-300 truncate">
                          {activeTabAccount.webhookSecret || 'Default CRM verify secret'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-400">Channel Mode</span>
                        <p className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400">
                          Live Omnichannel Bi-directional Relay
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/20 p-5 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mb-2">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                      No {getChannelMeta(activeConnectTab).label} Account Connected Yet
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-md mx-auto">
                      Authorize your account via 1-click Quick Connect or configure your live developer API credentials below.
                    </p>

                    <div className="mt-4 flex justify-center gap-2">
                      <button
                        onClick={() => handleConnectChannel(true)}
                        disabled={connecting}
                        className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-sky-500 hover:to-cyan-400 disabled:opacity-50 transition-all"
                      >
                        {connecting ? 'Authorizing...' : `1-Click Quick Connect (${getChannelMeta(activeConnectTab).label})`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Manual Credentials Configuration Section */}
                <div className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 dark:border-white/10 dark:bg-white/5">
                  <h4 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                    {activeTabAccount ? 'Update or Add Secondary Account' : 'Direct API Token Configuration'}
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                          Account Handle / Username *
                        </label>
                        <input
                          type="text"
                          placeholder={activeConnectTab === 'FACEBOOK' ? 'Page Name / ID' : '@username'}
                          value={connectHandle}
                          onChange={(e) => setConnectHandle(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                          Display Label
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Straten Agency Official"
                          value={connectAccountName}
                          onChange={(e) => setConnectAccountName(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                          App ID / Client Key
                        </label>
                        <input
                          type="text"
                          placeholder="Optional Client ID"
                          value={connectAppId}
                          onChange={(e) => setConnectAppId(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                          Access Token / Bearer Token
                        </label>
                        <input
                          type="password"
                          placeholder="API Access Token"
                          value={connectAccessToken}
                          onChange={(e) => setConnectAccessToken(e.target.value)}
                          className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={() => handleConnectChannel(false)}
                        disabled={connecting || !connectHandle.trim()}
                        className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 font-bold text-white shadow-sm hover:from-sky-500 hover:to-cyan-400 disabled:opacity-50 transition-all"
                      >
                        {connecting ? 'Saving...' : 'Save & Verify Channel'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Developer Documentation Info */}
                <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-800 dark:text-cyan-200">
                  <p className="font-bold flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Developer Portals Reference</span>
                  </p>
                  <p className="mt-1 leading-relaxed text-gray-600 dark:text-gray-300">
                    {activeConnectTab === 'INSTAGRAM' && (
                      <>Generate Page Access Tokens and subscribe to <code>instagram_manage_messages</code> via Meta for Developers (Graph API v21.0).</>
                    )}
                    {activeConnectTab === 'FACEBOOK' && (
                      <>Connect Facebook Page ID with <code>pages_messaging</code> permission on Meta Graph API.</>
                    )}
                    {activeConnectTab === 'TIKTOK' && (
                      <>Enable TikTok Direct Messaging API via TikTok for Business Developer Console with <code>im.message.send</code> scope.</>
                    )}
                    {activeConnectTab === 'X' && (
                      <>Create an App in the X Developer Portal with v2 Read, Write, and Direct Message privileges to generate OAuth 2.0 Bearer Tokens.</>
                    )}
                  </p>
                </div>

                {/* Live Production Webhook Endpoint Card */}
                <div className="p-3.5 rounded-xl bg-gray-50/90 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      Live Server Webhook Endpoint (Omnichannel Inbound)
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Production Ready
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Paste this endpoint into your Meta Developer App (Instagram / Facebook / WhatsApp), TikTok Developer Console, or X Webhooks:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 rounded-lg bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 select-all overflow-x-auto">
                      {typeof window !== 'undefined' ? `${window.location.origin}/api/inbox/webhook` : 'https://[your-domain]/api/inbox/webhook'}
                    </code>
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <span>Verify Token:</span>
                    <code className="px-1.5 py-0.5 rounded bg-gray-200/70 dark:bg-white/10 font-mono text-gray-800 dark:text-gray-200 text-[11px]">
                      straten_inbox_verify_token
                    </code>
                    <span className="text-[10px] text-gray-400">(customizable via INBOX_WEBHOOK_VERIFY_TOKEN env)</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW CONVERSATION MODAL */}
      <AnimatePresence>
        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#073652]"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Start New Conversation</h3>
                <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <form onSubmit={handleCreateNewThread} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Select Lead / Prospect
                  </label>
                  <select
                    value={newLeadId}
                    onChange={(e) => setNewLeadId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  >
                    {workspaceLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.companyName ? `${l.companyName} (${l.contactName})` : l.contactName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Primary Channel
                  </label>
                  <select
                    value={newChannel}
                    onChange={(e: any) => setNewChannel(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  >
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="INSTAGRAM">Instagram DM</option>
                    <option value="FACEBOOK">Facebook Messenger</option>
                    <option value="TIKTOK">TikTok Direct</option>
                    <option value="X">X (Twitter) DM</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-1.5 font-bold text-white shadow-sm"
                  >
                    Open Thread
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SIMULATE INBOUND REPLY MODAL */}
      <AnimatePresence>
        {showSimulateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#073652]"
            >
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Simulate Customer Inbound Message</h3>
                  <p className="text-[10px] text-gray-400">Test omnichannel reactivity, unread counters, and AI smart replies.</p>
                </div>
                <button onClick={() => setShowSimulateModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Channel
                  </label>
                  <select
                    value={simulateChannel}
                    onChange={(e: any) => setSimulateChannel(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                    <option value="INSTAGRAM">Instagram DM</option>
                    <option value="FACEBOOK">Facebook Messenger</option>
                    <option value="TIKTOK">TikTok Direct</option>
                    <option value="X">X (Twitter) DM</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Client Reply Content
                  </label>
                  <textarea
                    rows={3}
                    value={simulateText}
                    onChange={(e) => setSimulateText(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white p-2.5 text-xs outline-none focus:border-sky-500 dark:border-white/10 dark:bg-[#053048] dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSimulateModal(false)}
                    className="rounded-xl border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSimulateInbound}
                    className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-1.5 font-bold text-white shadow-sm"
                  >
                    Simulate Message
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
