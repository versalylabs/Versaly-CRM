'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/currency';
import { CANNED_RESPONSES, generateSmartReplySuggestions } from '@/lib/inbox-shared';

interface ConversationItem {
  id: string;
  leadId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactHandle: string | null;
  channel: string;
  primaryChannel?: string | null;
  status: string;
  priority: string;
  subject: string | null;
  lastMessageAt: string;
  lastMessageSnippet: string | null;
  unreadCount: number;
  isStarred: boolean;
  isArchived: boolean;
  isClosed: boolean;
  assignedToId: string | null;
  assignedTo?: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  } | null;
  lead?: {
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
    lastContact?: string | null;
    location?: string | null;
    notes?: string | null;
    aiInsight?: {
      sentimentScore: number;
      sentimentLabel: string;
      winProbability: number;
      churnRisk: string;
    } | null;
    customerSuccess?: {
      lifecycleStage: string;
      healthScore: number;
      healthStatus: string;
      renewalDate: string | null;
      renewalValue: number | null;
    } | null;
    tasks?: Array<{
      id: string;
      title: string;
      dueDate: string | null;
      completed: boolean;
      priority: string;
    }>;
    proposals?: Array<{
      id: string;
      title: string;
      value: number | null;
      status: string;
    }>;
    activityEvents?: Array<{
      id: string;
      action: string;
      createdAt: string;
    }>;
  } | null;
}

interface MessageItem {
  id: string;
  conversationId: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  senderType: string;
  senderId: string | null;
  senderName: string | null;
  channel: string;
  content: string;
  contentType?: string;
  isInternal: boolean;
  deliveryStatus?: string;
  status: string;
  sentAt: string;
  metadata?: any;
}

interface ChannelStatus {
  channel: string;
  connected: boolean;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING';
  displayName: string;
  accountName?: string;
  accountHandle?: string;
}

// Brand monochrome SVG Icons
const ChannelIcon = ({ channel, className = 'h-4 w-4' }: { channel: string; className?: string }) => {
  const c = (channel || 'EMAIL').toUpperCase();
  if (c === 'WHATSAPP') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (c === 'INSTAGRAM') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    );
  }
  if (c === 'FACEBOOK') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    );
  }
  if (c === 'X') {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  if (c === 'TIKTOK') {
    return (
      <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.97-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    );
  }
  if (c === 'INTERNAL_NOTE') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    );
  }
  // Default EMAIL
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
};

const FOLDERS = [
  { id: 'all', label: 'All', fullLabel: 'All Conversations', icon: '📬' },
  { id: 'unread', label: 'Unread', fullLabel: 'Unread', icon: '🔵' },
  { id: 'assigned_to_me', label: 'Assigned', fullLabel: 'Assigned to Me', icon: '👤' },
  { id: 'unassigned', label: 'Unassigned', fullLabel: 'Unassigned', icon: '👥' },
  { id: 'starred', label: 'Starred', fullLabel: 'Starred', icon: '⭐' },
  { id: 'archived', label: 'Archived', fullLabel: 'Archived', icon: '📦' },
  { id: 'closed', label: 'Closed', fullLabel: 'Closed', icon: '✅' },
] as const;

const CHANNELS = [
  { id: 'all', label: 'All Channels', shortLabel: 'All', icon: '🌐' },
  { id: 'EMAIL', label: 'Email', shortLabel: 'Email', icon: 'EMAIL' },
  { id: 'WHATSAPP', label: 'WhatsApp', shortLabel: 'WhatsApp', icon: 'WHATSAPP' },
  { id: 'INSTAGRAM', label: 'Instagram', shortLabel: 'Instagram', icon: 'INSTAGRAM' },
  { id: 'FACEBOOK', label: 'Facebook', shortLabel: 'Facebook', icon: 'FACEBOOK' },
  { id: 'X', label: 'X (Twitter)', shortLabel: 'X', icon: 'X' },
  { id: 'TIKTOK', label: 'TikTok', shortLabel: 'TikTok', icon: 'TIKTOK' },
] as const;

export default function UnifiedInboxPage() {
  const { data: session } = useSession();

  // Primary State
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [counts, setCounts] = useState({
    all: 0,
    unread: 0,
    assignedToMe: 0,
    unassigned: 0,
    starred: 0,
    archived: 0,
    closed: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [channelStatuses, setChannelStatuses] = useState<Record<string, ChannelStatus>>({});
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);

  // Filters & Search
  const [activeFolder, setActiveFolder] = useState<string>('all');
  const [activeChannel, setActiveChannel] = useState<string>('all');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Composer State
  const [composerMode, setComposerMode] = useState<'REPLY' | 'INTERNAL_NOTE'>('REPLY');
  const [composerChannel, setComposerChannel] = useState<string>('EMAIL');
  const [composerSubject, setComposerSubject] = useState('');
  const [composerContent, setComposerContent] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  // Modals & Panels
  const [showIntelPanel, setShowIntelPanel] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [mobileView, setMobileView] = useState<'LIST' | 'CHAT' | 'INTEL'>('LIST');

  // New Conversation Modal State
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newChannel, setNewChannel] = useState('EMAIL');
  const [newSubject, setNewSubject] = useState('');
  const [newInitialMessage, setNewInitialMessage] = useState('');
  const [creatingConv, setCreatingConv] = useState(false);

  // Task follow-up form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [creatingTask, setCreatingTask] = useState(false);

  // New Lead conversion form state
  const [convertCompanyName, setConvertCompanyName] = useState('');
  const [convertingLead, setConvertingLead] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch Channel Statuses & Team Members
  const loadChannelStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox/channels', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const map: Record<string, ChannelStatus> = {};
        (data.channels || []).forEach((c: ChannelStatus) => {
          map[c.channel] = c;
        });
        setChannelStatuses(map);
      }
    } catch (e) {
      console.error('Failed to load channel statuses:', e);
    }
  }, []);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.users || []);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // 2. Fetch Conversations
  const loadConversations = useCallback(
    async (selectFirst = false) => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (activeFolder !== 'all') params.set('folder', activeFolder);
        if (activeChannel !== 'all') params.set('channel', activeChannel);
        if (activeStatus !== 'all') params.set('status', activeStatus);
        if (searchQuery.trim()) params.set('query', searchQuery.trim());

        const res = await fetch(`/api/inbox/conversations?${params.toString()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
          if (data.counts) setCounts(data.counts);
          setLastUpdated(new Date());

          if (selectFirst && data.conversations?.length > 0 && !selectedId) {
            setSelectedId(data.conversations[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load conversations:', e);
      } finally {
        setLoading(false);
      }
    },
    [activeFolder, activeChannel, activeStatus, searchQuery, selectedId]
  );

  // 3. Fetch Specific Conversation Details & Messages
  const loadConversationDetails = useCallback(async (id: string) => {
    try {
      setMessagesLoading(true);
      const res = await fetch(`/api/inbox/conversations/${id}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSelectedConversation(data.conversation);
        setMessages(data.conversation.messages || []);
        setComposerChannel(data.conversation.channel || 'EMAIL');
        setComposerSubject(data.conversation.subject || '');
        setComposerError(null);

        // Update unread count in local state
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (e) {
      console.error('Failed to load conversation details:', e);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    loadChannelStatuses();
    loadTeamMembers();
  }, [loadChannelStatuses, loadTeamMembers]);

  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) {
      loadConversationDetails(selectedId);
    }
  }, [selectedId, loadConversationDetails]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send Message / Note
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedId || !composerContent.trim() || sending) return;

    setSending(true);
    setComposerError(null);

    const isNote = composerMode === 'INTERNAL_NOTE';
    const channelToUse = isNote ? 'INTERNAL_NOTE' : composerChannel;

    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelToUse,
          content: composerContent.trim(),
          subject: composerSubject.trim() || undefined,
          isInternal: isNote,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setComposerError(data.error || 'Failed to dispatch message');
        setSending(false);
        return;
      }

      // Add to messages list immediately
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }

      setComposerContent('');
      setComposerSubject('');
      setDraftSaved(false);

      // Refresh list snippet
      loadConversations(false);
    } catch (err: any) {
      setComposerError(err.message || 'Network error sending message');
    } finally {
      setSending(false);
    }
  };

  // Toggle Star
  const handleToggleStar = async (convId: string, currentStarred: boolean) => {
    const nextStarred = !currentStarred;
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, isStarred: nextStarred } : c))
    );
    if (selectedConversation?.id === convId) {
      setSelectedConversation((prev) => (prev ? { ...prev, isStarred: nextStarred } : null));
    }

    try {
      await fetch(`/api/inbox/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: nextStarred }),
      });
    } catch (e) {
      console.error('Failed to update star state:', e);
    }
  };

  // Change Status
  const handleStatusChange = async (convId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/inbox/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, isClosed: newStatus === 'CLOSED' }),
      });
      if (res.ok) {
        setSelectedConversation((prev) => (prev ? { ...prev, status: newStatus } : null));
        loadConversations(false);
      }
    } catch (e) {
      console.error('Failed to update conversation status:', e);
    }
  };

  // Change Priority
  const handlePriorityChange = async (convId: string, newPriority: string) => {
    try {
      const res = await fetch(`/api/inbox/conversations/${convId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (res.ok) {
        setSelectedConversation((prev) => (prev ? { ...prev, priority: newPriority } : null));
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, priority: newPriority } : c))
        );
      }
    } catch (e) {
      console.error('Failed to update priority:', e);
    }
  };

  // Change Assignee
  const handleAssignChange = async (convId: string, assignedToId: string) => {
    try {
      const res = await fetch(`/api/inbox/conversations/${convId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: assignedToId || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedConversation((prev) =>
          prev ? { ...prev, assignedToId: assignedToId || null, assignedTo: data.conversation.assignedTo } : null
        );
        loadConversations(false);
      }
    } catch (e) {
      console.error('Failed to assign conversation:', e);
    }
  };

  // Create Follow-up Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !taskTitle.trim() || creatingTask) return;

    setCreatingTask(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          dueDate: taskDueDate || null,
          priority: taskPriority,
        }),
      });
      if (res.ok) {
        setTaskTitle('');
        setTaskDueDate('');
        setShowTaskModal(false);
        loadConversationDetails(selectedId);
      }
    } catch (e) {
      console.error('Failed to create task:', e);
    } finally {
      setCreatingTask(false);
    }
  };

  // Convert Unknown Contact to Lead
  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || convertingLead) return;

    setConvertingLead(true);
    try {
      const res = await fetch(`/api/inbox/conversations/${selectedId}/convert-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: convertCompanyName.trim() || undefined,
        }),
      });
      if (res.ok) {
        setShowConvertModal(false);
        setConvertCompanyName('');
        loadConversationDetails(selectedId);
        loadConversations(false);
      }
    } catch (e) {
      console.error('Failed to convert contact to lead:', e);
    } finally {
      setConvertingLead(false);
    }
  };

  // Smart suggestions
  const smartSuggestions = useMemo(() => {
    if (!selectedConversation) return [];
    const lastMessage = messages[messages.length - 1]?.content || '';
    return generateSmartReplySuggestions(selectedConversation.lead || selectedConversation, lastMessage);
  }, [selectedConversation, messages]);

  // Check if active composer channel is connected
  const isSelectedChannelConnected = useMemo(() => {
    if (composerMode === 'INTERNAL_NOTE') return true;
    const status = channelStatuses[composerChannel];
    return status ? status.connected : false;
  }, [composerMode, composerChannel, channelStatuses]);

  // Relative time helper
  const formatRelativeTime = (dateStr: string) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '';
    }
  };

  // Filter helper functions
  const isFiltered =
    activeFolder !== 'all' ||
    activeChannel !== 'all' ||
    activeStatus !== 'all' ||
    Boolean(searchQuery.trim());

  const resetAllFilters = () => {
    setActiveFolder('all');
    setActiveChannel('all');
    setActiveStatus('all');
    setSearchQuery('');
  };

  const getFolderCount = (folderId: string) => {
    switch (folderId) {
      case 'all':
        return counts.all;
      case 'unread':
        return counts.unread;
      case 'assigned_to_me':
        return counts.assignedToMe;
      case 'unassigned':
        return counts.unassigned;
      case 'starred':
        return counts.starred;
      case 'archived':
        return counts.archived;
      case 'closed':
        return counts.closed;
      default:
        return 0;
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() && !newContactEmail.trim() && !newContactPhone.trim()) return;

    setCreatingConv(true);
    try {
      const res = await fetch('/api/inbox/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: newChannel,
          contactName: newContactName.trim() || undefined,
          contactEmail: newContactEmail.trim() || undefined,
          contactPhone: newContactPhone.trim() || undefined,
          subject: newSubject.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const conv = data.conversation;
        if (conv?.id && newInitialMessage.trim()) {
          await fetch(`/api/inbox/conversations/${conv.id}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channel: newChannel,
              content: newInitialMessage.trim(),
            }),
          });
        }
        setShowNewModal(false);
        setNewContactName('');
        setNewContactEmail('');
        setNewContactPhone('');
        setNewSubject('');
        setNewInitialMessage('');
        await loadConversations(false);
        if (conv?.id) {
          setSelectedId(conv.id);
          setMobileView('CHAT');
        }
      }
    } catch (err) {
      console.error('Failed to create conversation:', err);
    } finally {
      setCreatingConv(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-[#053048] text-slate-100 font-sans">
      {/* ========================================================================= */}
      {/* COLUMN 1: LEFT NAVIGATION & FOLDERS & CHANNEL FILTERS */}
      {/* ========================================================================= */}
      <aside
        className={`w-64 shrink-0 flex-col border-r border-white/10 bg-[#042a40] p-4 space-y-6 overflow-y-auto hidden lg:flex`}
      >
        {/* Brand / Inbox Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white font-black shadow-md shadow-sky-500/25">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </span>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">Unified Inbox</h1>
              <p className="text-[11px] text-slate-400">Omnichannel Hub</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadConversations(false)}
            title="Refresh Inbox"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* New Conversation Action */}
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-xs font-bold text-white shadow-md shadow-sky-500/20 transition flex items-center justify-center gap-1.5"
        >
          <span className="text-sm font-black leading-none">+</span>
          <span>New Conversation</span>
        </button>

        {/* Folders Navigation */}
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 pb-1">
            Views
          </p>

          {FOLDERS.map((f) => {
            const isActive = activeFolder === f.id;
            const count = getFolderCount(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFolder(f.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xs">{f.icon}</span>
                  <span>{f.fullLabel}</span>
                </span>
                {count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Communication Channels Filter */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center justify-between px-2 pb-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Channels
            </p>
            <Link
              href="/settings/integrations"
              className="text-[10px] text-sky-400 hover:text-sky-300 font-medium"
            >
              Manage
            </Link>
          </div>

          {CHANNELS.map((ch) => {
            const isActive = activeChannel === ch.id;
            const isConn = ch.id === 'all' || channelStatuses[ch.id]?.connected;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => setActiveChannel(ch.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {ch.id === 'all' ? (
                    <span>🌐</span>
                  ) : (
                    <ChannelIcon channel={ch.id} className="h-4 w-4" />
                  )}
                  <span>{ch.label}</span>
                </span>
                {ch.id !== 'all' && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isConn ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                    }`}
                    title={isConn ? 'Channel Connected' : 'Not Connected'}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Channel Health Footer */}
        <div className="mt-auto pt-4 border-t border-white/10">
          <Link
            href="/settings/integrations"
            className="rounded-xl bg-white/5 p-3 flex items-center justify-between border border-white/5 hover:border-sky-500/30 transition group"
          >
            <div>
              <p className="text-[11px] font-bold text-white group-hover:text-sky-400 transition">
                Channel Integrations
              </p>
              <p className="text-[10px] text-slate-400">
                {Object.values(channelStatuses).filter((s) => s.connected).length} of 6 Connected
              </p>
            </div>
            <span className="text-slate-400 group-hover:text-white text-xs">→</span>
          </Link>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* COLUMN 2: CONVERSATION LIST (MIDDLE COLUMN) */}
      {/* ========================================================================= */}
      <section
        className={`w-full md:w-80 lg:w-96 shrink-0 flex-col border-r border-white/10 bg-[#073b58]/50 backdrop-blur-md flex ${
          mobileView !== 'LIST' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Mobile Header Bar (Only visible on screens < lg) */}
        <div className="p-3 border-b border-white/10 lg:hidden space-y-2 bg-[#053048]/80 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowMobileSidebar(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition"
              title="Open Views & Channels Drawer"
            >
              <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <span>Views</span>
              {isFiltered && (
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 text-white text-xs font-bold shadow hover:from-sky-500 hover:to-cyan-400 transition flex items-center gap-1"
              >
                <span>+</span>
                <span>New</span>
              </button>

              <button
                type="button"
                onClick={() => loadConversations(false)}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition"
                title="Refresh Inbox"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <Link
                href="/settings/integrations"
                className="text-[11px] font-medium text-sky-400 hover:text-sky-300 px-2 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center gap-1"
                title="Manage Integrations"
              >
                <span>⚙️</span>
                <span className="text-[10px] text-slate-300">
                  {Object.values(channelStatuses).filter((s) => s.connected).length}/6
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Search, Pills & Filters Header */}
        <div className="p-3 border-b border-white/10 space-y-2 bg-[#073b58]/40">
          {/* Search Bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search conversations, contacts, messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#042a40] border border-white/10 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2.5 flex items-center text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Folder Pills (Horizontal Scrollable) */}
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex items-center gap-1.5 py-0.5 -mx-1 px-1">
            {FOLDERS.map((f) => {
              const isActive = activeFolder === f.id;
              const count = getFolderCount(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFolder(f.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition border ${
                    isActive
                      ? 'bg-sky-600/30 text-sky-200 border-sky-400/50 shadow-sm font-semibold'
                      : 'bg-[#042a40]/70 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-[11px]">{f.icon}</span>
                  <span>{f.label}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                        isActive ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Channel Pills (Horizontal Scrollable) */}
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex items-center gap-1.5 py-0.5 -mx-1 px-1">
            {CHANNELS.map((ch) => {
              const isActive = activeChannel === ch.id;
              const isConn = ch.id === 'all' || channelStatuses[ch.id]?.connected;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChannel(ch.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition border ${
                    isActive
                      ? 'bg-cyan-600/30 text-cyan-200 border-cyan-400/50 shadow-sm font-semibold'
                      : 'bg-[#042a40]/70 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {ch.id === 'all' ? (
                    <span className="text-[11px]">🌐</span>
                  ) : (
                    <ChannelIcon channel={ch.id} className="h-3 w-3" />
                  )}
                  <span>{ch.shortLabel}</span>
                  {ch.id !== 'all' && (
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        isConn ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Status & Channel Dropdowns */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span>Status:</span>
                <select
                  value={activeStatus}
                  onChange={(e) => setActiveStatus(e.target.value)}
                  className="bg-[#042a40] border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All</option>
                  <option value="OPEN">Open</option>
                  <option value="WAITING_ON_US">Waiting on Us</option>
                  <option value="WAITING_ON_CUSTOMER">Waiting on Client</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span>Channel:</span>
                <select
                  value={activeChannel}
                  onChange={(e) => setActiveChannel(e.target.value)}
                  className="bg-[#042a40] border border-white/10 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none"
                >
                  <option value="all">All Channels</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="X">X (Twitter)</option>
                  <option value="TIKTOK">TikTok</option>
                </select>
              </div>
            </div>

            <span className="text-[10px]">Updated {formatRelativeTime(lastUpdated.toISOString())}</span>
          </div>

          {/* Active Filter Clear Bar (Shown only if filtered) */}
          {isFiltered && (
            <div className="flex items-center justify-between gap-1.5 pt-1 text-[11px] bg-sky-500/10 border border-sky-500/20 rounded-xl px-2.5 py-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sky-300 font-semibold">Active:</span>
                {activeFolder !== 'all' && (
                  <span className="text-slate-200 bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                    {FOLDERS.find((f) => f.id === activeFolder)?.label || activeFolder}
                  </span>
                )}
                {activeChannel !== 'all' && (
                  <span className="text-slate-200 bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                    {activeChannel}
                  </span>
                )}
                {activeStatus !== 'all' && (
                  <span className="text-slate-200 bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                    {activeStatus}
                  </span>
                )}
                {searchQuery && (
                  <span className="text-slate-200 bg-white/10 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[80px]">
                    &quot;{searchQuery}&quot;
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-sky-300 hover:text-white font-medium text-[10px] shrink-0 underline"
              >
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Conversation Rows */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading inbox...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="text-4xl">📭</div>
              <p className="text-sm font-bold text-white">No conversations found</p>
              <p className="text-xs text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                {isFiltered
                  ? 'No conversations match your current filters. Try resetting filters or switching folders/channels.'
                  : 'No conversations found in your unified inbox. Connect communication channels or start a new conversation.'}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                {isFiltered && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold hover:bg-sky-500/30 transition shadow"
                  >
                    Reset All Filters
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-bold shadow transition flex items-center justify-center gap-1.5"
                >
                  <span>+</span>
                  <span>New Conversation</span>
                </button>

                <Link
                  href="/settings/integrations"
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Connect Channels</span>
                </Link>

                <button
                  type="button"
                  onClick={() => loadConversations(false)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-semibold transition"
                >
                  Refresh
                </button>
              </div>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedId === conv.id;
              const hasUnread = conv.unreadCount > 0;
              const contactDisplayName =
                conv.contactName || conv.lead?.contactName || conv.contactEmail || conv.contactHandle || 'Unknown Contact';

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedId(conv.id);
                    setMobileView('CHAT');
                    setShowIntelPanel(false);
                  }}
                  className={`p-3.5 cursor-pointer transition relative flex gap-3 group ${
                    isSelected
                      ? 'bg-sky-600/15 border-l-4 border-sky-400'
                      : 'hover:bg-white/5 border-l-4 border-transparent'
                  }`}
                >
                  {/* Avatar with Channel Badge */}
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#053048] to-[#0a486c] border border-white/10 flex items-center justify-center text-xs font-bold text-sky-300">
                      {contactDisplayName.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#042a40] border border-white/10 flex items-center justify-center p-0.5 shadow">
                      <ChannelIcon channel={conv.channel} className="h-2.5 w-2.5 text-sky-400" />
                    </span>
                  </div>

                  {/* Content Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs truncate ${
                          hasUnread ? 'font-bold text-white' : 'font-semibold text-slate-200'
                        }`}
                      >
                        {contactDisplayName}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    {conv.lead?.companyName && (
                      <p className="text-[10px] text-slate-400 truncate">{conv.lead.companyName}</p>
                    )}

                    <p
                      className={`text-xs truncate mt-1 ${
                        hasUnread ? 'font-medium text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {conv.lastMessageSnippet || 'No messages'}
                    </p>

                    {/* Indicators Footer */}
                    <div className="flex items-center justify-between gap-1 mt-2">
                      <div className="flex items-center gap-1.5">
                        {conv.priority === 'URGENT' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Urgent
                          </span>
                        )}
                        {conv.priority === 'HIGH' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            High
                          </span>
                        )}
                        {conv.lead?.pipelineStage && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 text-slate-300 border border-white/10">
                            {conv.lead.pipelineStage.replace('_', ' ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Star Toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStar(conv.id, conv.isStarred);
                          }}
                          className={`text-xs ${
                            conv.isStarred ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          ★
                        </button>

                        {/* Unread Badge */}
                        {hasUnread && (
                          <span className="h-4 min-w-[16px] px-1 rounded-full bg-sky-500 text-[10px] font-bold text-white flex items-center justify-center shadow">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* COLUMN 3: MESSAGE THREAD & COMPOSER */}
      {/* ========================================================================= */}
      <main
        className={`flex-1 flex-col bg-[#053048] min-w-0 flex ${
          mobileView !== 'CHAT' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConversation ? (
          <>
            {/* Sticky Conversation Header */}
            <header className="px-5 py-3 border-b border-white/10 bg-[#073b58]/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {/* Mobile Back Button */}
                <button
                  type="button"
                  onClick={() => setMobileView('LIST')}
                  className="p-1 rounded-lg text-slate-400 hover:text-white md:hidden"
                >
                  ←
                </button>

                {/* Clickable Client Profile */}
                <button
                  type="button"
                  onClick={() => setShowIntelPanel((prev) => !prev)}
                  className={`flex items-center gap-3 min-w-0 text-left p-1.5 -ml-1.5 rounded-2xl transition border ${
                    showIntelPanel
                      ? 'bg-sky-500/15 border-sky-500/30 ring-1 ring-sky-500/30'
                      : 'border-transparent hover:bg-white/5 hover:border-white/10'
                  }`}
                  title={
                    showIntelPanel
                      ? 'Click to close profile & return to texting'
                      : 'Click to view client profile & lead overview in texting area'
                  }
                >
                  <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-400 text-white font-bold flex items-center justify-center text-xs shadow">
                      {(selectedConversation.contactName || selectedConversation.lead?.contactName || 'C')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white truncate">
                        {selectedConversation.contactName ||
                          selectedConversation.lead?.contactName ||
                          'Unknown Contact'}
                      </h2>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 shrink-0">
                        <ChannelIcon channel={selectedConversation.channel} className="h-3 w-3" />
                        <span>{selectedConversation.channel}</span>
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border transition shrink-0 hidden sm:inline-flex items-center gap-1 ${
                          showIntelPanel
                            ? 'bg-sky-500/30 text-sky-200 border-sky-400/50 font-semibold'
                            : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
                        }`}
                      >
                        {showIntelPanel ? 'Close Profile ✕' : 'Client Profile'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {selectedConversation.lead?.companyName ||
                        selectedConversation.contactEmail ||
                        selectedConversation.contactPhone ||
                        'Inbound conversation thread'}
                    </p>
                  </div>
                </button>
              </div>

              {/* Priority / Assign Controls (Waiting on us status dropdown removed to avoid blocking view) */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Priority Dropdown */}
                <select
                  value={selectedConversation.priority}
                  onChange={(e) => handlePriorityChange(selectedConversation.id, e.target.value)}
                  className="bg-[#042a40] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none hidden sm:block"
                >
                  <option value="NORMAL">Normal Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="URGENT">Urgent Priority</option>
                  <option value="LOW">Low Priority</option>
                </select>

                {/* Assignee Dropdown */}
                <select
                  value={selectedConversation.assignedToId || ''}
                  onChange={(e) => handleAssignChange(selectedConversation.id, e.target.value)}
                  className="bg-[#042a40] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none hidden lg:block"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.email}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messagesLoading ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading conversation history...</div>
              ) : messages.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-400 space-y-2">
                  <p className="text-2xl">💬</p>
                  <p className="font-semibold text-white">Conversation initiated</p>
                  <p>Send a message or record an internal note below.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isInternal = msg.isInternal || msg.channel === 'INTERNAL_NOTE';
                  const isOutbound = msg.direction === 'OUTBOUND' || msg.senderType === 'AGENT';

                  if (isInternal) {
                    return (
                      <div key={msg.id} className="max-w-2xl mx-auto my-3">
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200 shadow space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-bold text-amber-300">
                              <span>🔒</span>
                              <span>Internal Note · {msg.senderName || 'Team Member'}</span>
                            </span>
                            <span className="text-[10px] text-amber-400/80">
                              {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isOutbound ? 'items-end' : 'items-start'} max-w-2xl ${
                        isOutbound ? 'ml-auto' : 'mr-auto'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">
                          {msg.senderName || (isOutbound ? 'You' : 'Customer')}
                        </span>
                        <span>·</span>
                        <span>
                          {new Date(msg.sentAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10">
                          <ChannelIcon channel={msg.channel} className="h-2.5 w-2.5" />
                          <span>{msg.channel}</span>
                        </span>
                      </div>

                      <div
                        className={`rounded-2xl p-4 text-xs shadow-md leading-relaxed whitespace-pre-wrap ${
                          isOutbound
                            ? 'bg-gradient-to-tr from-sky-700 to-cyan-600 text-white rounded-tr-none'
                            : 'bg-[#073b58] border border-white/10 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Delivery Status */}
                      {isOutbound && (
                        <div className="flex items-center gap-1 mt-1 px-1 text-[10px] text-slate-400">
                          {msg.deliveryStatus === 'FAILED' ? (
                            <span className="text-rose-400">⚠️ Delivery Failed</span>
                          ) : (
                            <span>✓ {msg.deliveryStatus || 'Sent'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Conditional Texting Area: Normal Composer OR Client Profile & Lead Overview */}
            {showIntelPanel ? (
              /* Client Profile & Lead Overview in Texting Area */
              <footer className="p-4 sm:p-5 border-t border-sky-500/30 bg-[#06334f] shadow-2xl space-y-4 shrink-0 max-h-[460px] overflow-y-auto">
                {/* Header: Title + Open Lead + Close Button */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10 gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-sky-600 to-cyan-400 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow">
                      {(selectedConversation.contactName || selectedConversation.lead?.contactName || 'C')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white truncate">
                          {selectedConversation.contactName ||
                            selectedConversation.lead?.contactName ||
                            'Client Profile'}
                        </h3>
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 shrink-0">
                          <ChannelIcon channel={selectedConversation.channel} className="h-3 w-3" />
                          <span>{selectedConversation.channel}</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {selectedConversation.lead?.companyName ||
                          selectedConversation.contactEmail ||
                          selectedConversation.contactPhone ||
                          'Inbound conversation identity'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {selectedConversation.lead && (
                      <Link
                        href={`/leads`}
                        className="text-xs text-sky-300 hover:text-white px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 transition flex items-center gap-1 font-medium shadow-sm"
                      >
                        <span>Open in Leads</span>
                        <span>→</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowIntelPanel(false)}
                      className="text-xs font-semibold text-white px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/30 transition flex items-center gap-1.5 shadow"
                      title="Return to normal texting area"
                    >
                      <span>✕</span>
                      <span>Back to Texting</span>
                    </button>
                  </div>
                </div>

                {/* Content */}
                {!selectedConversation.lead ? (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                      <span>⚠️</span>
                      <span>Unknown Contact (Not linked to a CRM lead)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      This conversation originated from an external identity that isn&apos;t connected to a lead profile yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowConvertModal(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-bold text-xs shadow transition"
                    >
                      + Convert to CRM Lead
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {/* Card 1: Lead Details */}
                    <div className="rounded-2xl border border-white/10 bg-[#042a40]/90 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                        <span className="font-bold text-white text-xs">Lead Details</span>
                        <span className="text-[10px] text-sky-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                          {selectedConversation.lead.pipelineStage.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Company:</span>
                          <span className="font-semibold text-white truncate max-w-[140px]">
                            {selectedConversation.lead.companyName || 'None'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Deal Value:</span>
                          <span className="font-bold text-emerald-400">
                            {formatCurrency(selectedConversation.lead.dealValue || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Email:</span>
                          <span className="text-slate-200 truncate max-w-[140px]">
                            {selectedConversation.lead.email}
                          </span>
                        </div>
                        {selectedConversation.lead.phone && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400">Phone:</span>
                            <span className="text-slate-200">{selectedConversation.lead.phone}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <label className="text-slate-400 text-xs block font-medium">
                            Conversation Status:
                          </label>
                          <select
                            value={selectedConversation.status}
                            onChange={(e) => handleStatusChange(selectedConversation.id, e.target.value)}
                            className="w-full bg-[#073b58] hover:bg-[#094266] border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-400 transition shadow-inner cursor-pointer"
                          >
                            <option value="OPEN">Open</option>
                            <option value="WAITING_ON_US">Waiting on Us</option>
                            <option value="WAITING_ON_CUSTOMER">Waiting on Client</option>
                            <option value="CLOSED">Closed</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Customer Success & AI Signals */}
                    <div className="rounded-2xl border border-white/10 bg-[#042a40]/90 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                        <span className="font-bold text-white text-xs">Retention & AI Signals</span>
                        {selectedConversation.lead.customerSuccess && (
                          <span className="font-bold text-emerald-400 text-xs">
                            {selectedConversation.lead.customerSuccess.healthScore}% Health
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {selectedConversation.lead.customerSuccess && (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Lifecycle:</span>
                              <span className="font-medium text-slate-200">
                                {selectedConversation.lead.customerSuccess.lifecycleStage}
                              </span>
                            </div>
                            {selectedConversation.lead.customerSuccess.renewalDate && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-400">Renewal Date:</span>
                                <span className="text-slate-200">
                                  {new Date(
                                    selectedConversation.lead.customerSuccess.renewalDate
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        {selectedConversation.lead.aiInsight && (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Win Probability:</span>
                              <span className="font-bold text-sky-400">
                                {selectedConversation.lead.aiInsight.winProbability}%
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Sentiment:</span>
                              <span className="font-medium text-emerald-400">
                                {selectedConversation.lead.aiInsight.sentimentLabel}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-400">Churn Risk:</span>
                              <span className="font-medium text-amber-400">
                                {selectedConversation.lead.aiInsight.churnRisk}
                              </span>
                            </div>
                          </>
                        )}
                        {!selectedConversation.lead.customerSuccess && !selectedConversation.lead.aiInsight && (
                          <p className="text-slate-400 italic py-3 text-center">
                            Standard account engagement.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Card 3: Follow-up Tasks */}
                    <div className="rounded-2xl border border-white/10 bg-[#042a40]/90 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                        <span className="font-bold text-white text-xs">Follow-up Tasks</span>
                        <button
                          type="button"
                          onClick={() => setShowTaskModal(true)}
                          className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                        >
                          + Add Task
                        </button>
                      </div>
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                        {selectedConversation.lead.tasks && selectedConversation.lead.tasks.length > 0 ? (
                          selectedConversation.lead.tasks.map((t) => (
                            <div
                              key={t.id}
                              className="rounded-xl border border-white/5 bg-[#073b58]/50 p-2 text-xs flex justify-between items-center gap-2"
                            >
                              <span className="truncate text-slate-200">{t.title}</span>
                              {t.dueDate && (
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  {new Date(t.dueDate).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-slate-400 italic py-3 text-center text-xs">
                            No open tasks.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </footer>
            ) : (
              <>
                {/* Smart Suggestions Bar */}
                {smartSuggestions.length > 0 && composerMode === 'REPLY' && (
                  <div className="px-5 py-2 border-t border-white/5 bg-[#042a40]/50 flex items-center gap-2 overflow-x-auto text-[11px]">
                    <span className="text-slate-400 shrink-0 font-medium">⚡ Quick Replies:</span>
                    {smartSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setComposerContent(s.text)}
                        className="whitespace-nowrap px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-sky-300 border border-white/10 transition"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Sticky Unified Composer */}
                <footer className="p-4 border-t border-white/10 bg-[#073b58]/95 backdrop-blur-md space-y-3 shrink-0">
                  {/* Mode & Channel Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-xl bg-[#042a40] p-0.5 border border-white/10 text-xs">
                        <button
                          type="button"
                          onClick={() => setComposerMode('REPLY')}
                          className={`px-3 py-1 rounded-lg font-semibold transition ${
                            composerMode === 'REPLY'
                              ? 'bg-sky-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Reply to Customer
                        </button>
                        <button
                          type="button"
                          onClick={() => setComposerMode('INTERNAL_NOTE')}
                          className={`px-3 py-1 rounded-lg font-semibold transition ${
                            composerMode === 'INTERNAL_NOTE'
                              ? 'bg-amber-600 text-white shadow'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🔒 Internal Note
                        </button>
                      </div>

                      {composerMode === 'REPLY' && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-400 text-[11px] hidden sm:inline">Send via:</span>
                          <select
                            value={composerChannel}
                            onChange={(e) => setComposerChannel(e.target.value)}
                            className="bg-[#042a40] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none"
                          >
                            <option value="EMAIL">Email</option>
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="INSTAGRAM">Instagram</option>
                            <option value="FACEBOOK">Facebook</option>
                            <option value="X">X (Twitter)</option>
                            <option value="TIKTOK">TikTok</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTemplates((prev) => !prev)}
                        className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 transition"
                      >
                        📋 Templates
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowTaskModal(true)}
                        className="text-xs text-sky-400 hover:text-sky-300 px-2.5 py-1 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 transition hidden sm:inline-flex"
                      >
                        ⏰ Follow-up
                      </button>
                    </div>
                  </div>

                  {/* Templates Dropdown */}
                  {showTemplates && (
                    <div className="rounded-2xl border border-white/10 bg-[#042a40] p-3 space-y-2 shadow-2xl">
                      <p className="text-[11px] font-bold text-slate-300">Select Canned Response</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {CANNED_RESPONSES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setComposerContent(
                                t.content
                                  .replace(
                                    '{{name}}',
                                    selectedConversation.contactName?.split(' ')[0] || 'there'
                                  )
                                  .replace(
                                    '{{company}}',
                                    selectedConversation.lead?.companyName || 'your company'
                                  )
                              );
                              setShowTemplates(false);
                            }}
                            className="text-left p-2 rounded-xl bg-white/5 hover:bg-white/10 transition border border-white/5"
                          >
                            <p className="text-xs font-semibold text-white">{t.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">{t.content}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Channel Disconnected Warning Banner */}
                  {!isSelectedChannelConnected && composerMode === 'REPLY' && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-300">
                      <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                          {composerChannel} isn&apos;t connected. Connect credentials to send live messages from this channel.
                        </span>
                      </div>
                      <Link
                        href="/settings/integrations"
                        className="inline-flex whitespace-nowrap px-3 py-1 rounded-lg bg-amber-500 text-slate-900 font-bold text-[11px] hover:bg-amber-400 transition"
                      >
                        Connect {composerChannel}
                      </Link>
                    </div>
                  )}

                  {composerError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                      {composerError}
                    </div>
                  )}

                  {/* Subject Input for Email */}
                  {composerMode === 'REPLY' && composerChannel === 'EMAIL' && (
                    <div>
                      <input
                        type="text"
                        placeholder="Email Subject..."
                        value={composerSubject}
                        onChange={(e) => setComposerSubject(e.target.value)}
                        className="w-full rounded-xl bg-[#042a40] border border-white/10 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Composer Textarea */}
                  <div className="relative">
                    <textarea
                      rows={3}
                      placeholder={
                        composerMode === 'INTERNAL_NOTE'
                          ? 'Write an internal team note (not sent to customer)...'
                          : `Reply via ${composerChannel}... (Ctrl+Enter to send)`
                      }
                      value={composerContent}
                      onChange={(e) => setComposerContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className={`w-full rounded-2xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none border transition resize-none ${
                        composerMode === 'INTERNAL_NOTE'
                          ? 'bg-amber-950/20 border-amber-500/30 focus:border-amber-400'
                          : 'bg-[#042a40] border-white/10 focus:border-sky-400'
                      }`}
                    />
                  </div>

                  {/* Action Toolbar */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <button
                        type="button"
                        onClick={() => setComposerContent((p) => p + ' 😊')}
                        className="p-1.5 hover:text-white rounded-lg hover:bg-white/5 transition"
                        title="Insert Emoji"
                      >
                        😊
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftSaved(true);
                          setTimeout(() => setDraftSaved(false), 2000);
                        }}
                        className="p-1.5 hover:text-white rounded-lg hover:bg-white/5 transition text-[11px]"
                      >
                        {draftSaved ? '✓ Saved' : 'Save Draft'}
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={
                        sending ||
                        !composerContent.trim() ||
                        (!isSelectedChannelConnected && composerMode === 'REPLY')
                      }
                      onClick={() => handleSendMessage()}
                      className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition flex items-center gap-2 ${
                        composerMode === 'INTERNAL_NOTE'
                          ? 'bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 shadow-amber-500/20'
                          : 'bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 shadow-sky-500/20 disabled:opacity-50'
                      }`}
                    >
                      {sending ? (
                        <span>Sending...</span>
                      ) : composerMode === 'INTERNAL_NOTE' ? (
                        <span>Add Internal Note</span>
                      ) : (
                        <span>Send Message</span>
                      )}
                    </button>
                  </div>
                </footer>
              </>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
              📬
            </div>
            <h3 className="text-base font-bold text-white">Select a conversation</h3>
            <p className="text-xs max-w-sm">
              Choose a conversation from your inbox on the left to read messages, collaborate with notes, or respond across channels.
            </p>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* MODAL: SCHEDULE FOLLOW-UP TASK */}
      {/* ========================================================================= */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#073b58] p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Schedule Follow-up Task</h3>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call back regarding pricing proposal"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white focus:border-sky-400 focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingTask}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-xs font-bold text-white shadow transition disabled:opacity-60"
                >
                  {creatingTask ? 'Saving...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONVERT TO LEAD */}
      {/* ========================================================================= */}
      {showConvertModal && selectedConversation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#073b58] p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Convert to CRM Lead</h3>
              <button
                type="button"
                onClick={() => setShowConvertModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Create a formal lead profile for{' '}
              <strong className="text-white">
                {selectedConversation.contactName || selectedConversation.contactHandle}
              </strong>{' '}
              to track deals, proposals, and pipeline milestones.
            </p>

            <form onSubmit={handleConvertLead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Company / Organization Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Corp"
                  value={convertCompanyName}
                  onChange={(e) => setConvertCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={convertingLead}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-xs font-bold text-white shadow transition disabled:opacity-60"
                >
                  {convertingLead ? 'Converting...' : 'Convert to Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: START NEW CONVERSATION */}
      {/* ========================================================================= */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#073b58] p-6 shadow-2xl space-y-4 text-slate-100">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xl">💬</span>
                <h3 className="text-base font-bold text-white">Start New Conversation</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateConversation} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Channel
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'EMAIL', label: 'Email' },
                    { id: 'WHATSAPP', label: 'WhatsApp' },
                    { id: 'INSTAGRAM', label: 'Instagram' },
                    { id: 'FACEBOOK', label: 'Facebook' },
                    { id: 'X', label: 'X (Twitter)' },
                    { id: 'TIKTOK', label: 'TikTok' },
                  ].map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setNewChannel(ch.id)}
                      className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold border transition ${
                        newChannel === ch.id
                          ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-sm'
                          : 'bg-[#042a40] border-white/10 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <ChannelIcon channel={ch.id} className="h-3.5 w-3.5" />
                      <span className="truncate">{ch.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contact Name / Organization
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins or Acme Corp"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="client@example.com"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone / Handle
                  </label>
                  <input
                    type="text"
                    placeholder="+1 555 0199 or @username"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subject / Topic (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Project Consultation Inquiry"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#042a40] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Initial Message (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Type an opening message..."
                  value={newInitialMessage}
                  onChange={(e) => setNewInitialMessage(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#042a40] p-3 text-xs text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingConv}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-xs font-bold text-white shadow transition disabled:opacity-60"
                >
                  {creatingConv ? 'Creating...' : 'Start Conversation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE DRAWER: FOLDERS & CHANNELS */}
      {/* ========================================================================= */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setShowMobileSidebar(false)}
          />

          {/* Drawer Sidebar */}
          <div className="relative w-72 max-w-[85vw] bg-[#042a40] border-r border-white/10 p-4 flex flex-col h-full shadow-2xl z-10 overflow-y-auto space-y-5 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 text-white font-black shadow-md shadow-sky-500/25">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide">Unified Inbox</h2>
                  <p className="text-[11px] text-slate-400">Omnichannel Hub</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileSidebar(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              >
                ✕
              </button>
            </div>

            {/* Quick New Conversation Button */}
            <button
              type="button"
              onClick={() => {
                setShowMobileSidebar(false);
                setShowNewModal(true);
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-xs font-bold text-white shadow transition flex items-center justify-center gap-1.5"
            >
              <span className="text-sm font-black leading-none">+</span>
              <span>New Conversation</span>
            </button>

            {/* Folders Navigation */}
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-2 pb-1">
                Views
              </p>

              {FOLDERS.map((f) => {
                const isActive = activeFolder === f.id;
                const count = getFolderCount(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      setActiveFolder(f.id);
                      setShowMobileSidebar(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30 font-semibold'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-xs">{f.icon}</span>
                      <span>{f.fullLabel}</span>
                    </span>
                    {count > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isActive ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-300'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Communication Channels Filter */}
            <div className="space-y-1 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Channels
                </p>
                <Link
                  href="/settings/integrations"
                  onClick={() => setShowMobileSidebar(false)}
                  className="text-[10px] text-sky-400 hover:text-sky-300 font-medium"
                >
                  Manage
                </Link>
              </div>

              {CHANNELS.map((ch) => {
                const isActive = activeChannel === ch.id;
                const isConn = ch.id === 'all' || channelStatuses[ch.id]?.connected;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => {
                      setActiveChannel(ch.id);
                      setShowMobileSidebar(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
                      isActive
                        ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30 font-semibold'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {ch.id === 'all' ? (
                        <span>🌐</span>
                      ) : (
                        <ChannelIcon channel={ch.id} className="h-4 w-4" />
                      )}
                      <span>{ch.label}</span>
                    </span>
                    {ch.id !== 'all' && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          isConn ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-slate-600'
                        }`}
                        title={isConn ? 'Channel Connected' : 'Not Connected'}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Channel Health Footer */}
            <div className="mt-auto pt-4 border-t border-white/10">
              <Link
                href="/settings/integrations"
                onClick={() => setShowMobileSidebar(false)}
                className="rounded-xl bg-white/5 p-3 flex items-center justify-between border border-white/5 hover:border-sky-500/30 transition group"
              >
                <div>
                  <p className="text-[11px] font-bold text-white group-hover:text-sky-400 transition">
                    Channel Integrations
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {Object.values(channelStatuses).filter((s) => s.connected).length} of 6 Connected
                  </p>
                </div>
                <span className="text-slate-400 group-hover:text-white text-xs">→</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
