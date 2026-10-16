'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  X,
  Check,
  MapPin,
  User as UserIcon,
  Users,
  Phone,
  RotateCw,
  Home,
  Pin,
  ExternalLink,
  Trash2,
  Edit3,
  Filter,
  Sparkles,
  Download,
  CheckCircle2,
  CalendarDays,
  List as ListIcon,
  Grid3X3,
  Layers,
  Link2,
} from 'lucide-react';

// ==========================================
// Types
// ==========================================
type Lead = { id: string; contactName: string; companyName?: string | null; email: string };
type User = { id: string; name: string | null; email: string; role: string };

export type CalendarEventType = 'MEETING' | 'CALL' | 'FOLLOW_UP' | 'PROPERTY_VIEWING' | 'OTHER';

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  type: CalendarEventType;
  startAt: string;
  endAt?: string | null;
  location?: string | null;
  completed: boolean;
  reminderAt?: string | null;
  lead?: Lead | null;
  leadId?: string | null;
  assignedTo?: User | null;
  assignedToId?: string | null;
};

type ViewMode = 'month' | 'week' | 'day' | 'list';
type FilterType = 'ALL' | 'MEETING' | 'FOLLOW_UP' | 'OTHER' | 'CALL' | 'PROPERTY_VIEWING';

const EVENT_TYPES: { type: CalendarEventType; label: string }[] = [
  { type: 'MEETING', label: 'Interview / Meeting' },
  { type: 'CALL', label: 'Client Call' },
  { type: 'FOLLOW_UP', label: 'Task / Follow-up' },
  { type: 'PROPERTY_VIEWING', label: 'Demo / Viewing' },
  { type: 'OTHER', label: 'Time Off / Other' },
];

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// ==========================================
// Color Helper (matching screenshot theme)
// ==========================================
function getEventColor(event: { title: string; type: string }) {
  const t = event.type;
  const title = (event.title || '').toLowerCase();

  // Time off / Medical / Leave / Holiday (Coral / Red)
  if (
    t === 'OTHER' ||
    title.includes('leave') ||
    title.includes('medical') ||
    title.includes('flu') ||
    title.includes('holiday') ||
    title.includes('wedding') ||
    title.includes('vacation') ||
    title.includes('appointment')
  ) {
    return {
      border: 'border-l-rose-500',
      stripeBg: 'bg-rose-500',
      badgeBg: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
      cardHover: 'hover:border-rose-400/40',
      pill: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      avatarBg: 'bg-gradient-to-tr from-rose-600 to-rose-400',
      tag: 'Time Off / Leave',
    };
  }

  // Reports / Assessments / Viewings (Teal / Emerald)
  if (
    t === 'PROPERTY_VIEWING' ||
    title.includes('report') ||
    title.includes('feedback') ||
    title.includes('assessment') ||
    title.includes('learning') ||
    title.includes('review')
  ) {
    return {
      border: 'border-l-emerald-500',
      stripeBg: 'bg-emerald-500',
      badgeBg: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
      cardHover: 'hover:border-emerald-400/40',
      pill: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      avatarBg: 'bg-gradient-to-tr from-emerald-600 to-teal-400',
      tag: 'Report / Review',
    };
  }

  // Meetings / Interviews / Q3 Planning (Cyan / Sky)
  if (t === 'MEETING' || title.includes('meeting') || title.includes('planning') || title.includes('interview')) {
    return {
      border: 'border-l-cyan-400',
      stripeBg: 'bg-cyan-400',
      badgeBg: 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/30',
      cardHover: 'hover:border-cyan-400/40',
      pill: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      avatarBg: 'bg-gradient-to-tr from-cyan-600 to-sky-400',
      tag: 'Meeting / Interview',
    };
  }

  // Client Calls / 1-on-1 (Sky / Blue)
  if (t === 'CALL' || title.includes('call') || title.includes('am -') || title.includes('pm -')) {
    return {
      border: 'border-l-sky-500',
      stripeBg: 'bg-sky-500',
      badgeBg: 'bg-sky-500/15 text-sky-200 border border-sky-500/30',
      cardHover: 'hover:border-sky-400/40',
      pill: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      avatarBg: 'bg-gradient-to-tr from-blue-600 to-sky-400',
      tag: 'Client Call',
    };
  }

  // Tasks / Follow-ups (Versaly Gold / Amber)
  return {
    border: 'border-l-[#fca311]',
    stripeBg: 'bg-[#fca311]',
    badgeBg: 'bg-[#fca311]/15 text-amber-200 border border-[#fca311]/30',
    cardHover: 'hover:border-amber-400/40',
    pill: 'bg-[#fca311]/20 text-amber-300 border-[#fca311]/30',
    avatarBg: 'bg-gradient-to-tr from-amber-600 to-yellow-400',
    tag: 'Task / Follow-up',
  };
}

function getInitials(name?: string | null, email?: string | null) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'VS';
}

function formatTimeOnly(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
}

function formatTimeRange(startStr: string, endStr?: string | null) {
  try {
    const start = new Date(startStr);
    const startFormatted = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    if (!endStr) return startFormatted;
    const end = new Date(endStr);
    const endFormatted = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${startFormatted} - ${endFormatted}`;
  } catch {
    return '';
  }
}

const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const glassInput =
  'w-full rounded-xl bg-[#0e172a] border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition';

// ==========================================
// Main Calendar Page Component
// ==========================================
export default function CalendarPage() {
  const { data: session } = useSession();

  // Calendar view state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  // Data state
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modals & Panels
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [isEditingActiveEvent, setIsEditingActiveEvent] = useState(false);
  const [linkBannerDismissed, setLinkBannerDismissed] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // Event Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'MEETING' as CalendarEventType,
    startAt: localInput(new Date(Date.now() + 3600000)),
    endAt: localInput(new Date(Date.now() + 7200000)),
    location: '',
    reminderAt: '',
    leadId: '',
    assignedToId: '',
  });

  const canAssign = session?.user?.role === 'ADMIN' || session?.user?.role === 'MANAGER';

  // Load calendar events, leads, and users
  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [eRes, lRes, uRes] = await Promise.all([
        fetch('/api/calendar'),
        fetch('/api/leads'),
        fetch('/api/users'),
      ]);
      if (!eRes.ok) throw new Error('Could not load calendar events.');
      const evList = await eRes.json();
      setEvents(evList);
      if (lRes.ok) setLeads(await lRes.json());
      if (uRes.ok) setUsers(await uRes.json());
    } catch (err: any) {
      setError(err.message || 'Could not load calendar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'MEETING') return e.type === 'MEETING';
      if (activeFilter === 'CALL') return e.type === 'CALL';
      if (activeFilter === 'FOLLOW_UP') return e.type === 'FOLLOW_UP';
      if (activeFilter === 'PROPERTY_VIEWING') return e.type === 'PROPERTY_VIEWING';
      if (activeFilter === 'OTHER') return e.type === 'OTHER';
      return true;
    });
  }, [events, activeFilter]);

  // Calendar Month Grid Generation
  const monthGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: {
      date: Date;
      isCurrentMonth: boolean;
      dayNumber: number;
      dateKey: string;
      isWeekend: boolean;
      dayOfWeekIndex: number;
    }[] = [];

    // Preceding Month Days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const date = new Date(year, month - 1, d);
      const dayOfWeekIndex = date.getDay();
      cells.push({
        date,
        isCurrentMonth: false,
        dayNumber: d,
        dateKey: date.toDateString(),
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
        dayOfWeekIndex,
      });
    }

    // Current Month Days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayOfWeekIndex = date.getDay();
      cells.push({
        date,
        isCurrentMonth: true,
        dayNumber: d,
        dateKey: date.toDateString(),
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
        dayOfWeekIndex,
      });
    }

    // Trailing Month Days to complete grid (standard 35 or 42 cells)
    const totalNeeded = cells.length > 35 ? 42 : 35;
    const remaining = totalNeeded - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      const dayOfWeekIndex = date.getDay();
      cells.push({
        date,
        isCurrentMonth: false,
        dayNumber: d,
        dateKey: date.toDateString(),
        isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
        dayOfWeekIndex,
      });
    }

    return cells;
  }, [currentDate]);

  // Group events by date string
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((e) => {
      const key = new Date(e.startAt).toDateString();
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    });
    return map;
  }, [filteredEvents]);

  // Upcoming Events list (sorted by startAt ascending)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    // If a specific date is selected on the grid, prioritize/show events for that date
    if (selectedDate) {
      const key = selectedDate.toDateString();
      const onDay = filteredEvents.filter((e) => new Date(e.startAt).toDateString() === key);
      if (onDay.length > 0) return onDay;
    }
    // Otherwise show all future/active events
    return [...filteredEvents]
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [filteredEvents, selectedDate]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const jumpToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  // Open schedule modal prefilled for a given date
  const openScheduleForDate = (date: Date) => {
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(date);
    end.setHours(10, 0, 0, 0);

    setForm({
      title: '',
      description: '',
      type: 'MEETING',
      startAt: localInput(start),
      endAt: localInput(end),
      location: 'Google Meet',
      reminderAt: '',
      leadId: '',
      assignedToId: session?.user?.id || '',
    });
    setScheduleModalOpen(true);
  };

  // Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event.');
      setEvents((prev) => [...prev, data]);
      setScheduleModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Error creating event.');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Complete
  const toggleComplete = async (ev: CalendarEvent) => {
    const updatedStatus = !ev.completed;
    setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, completed: updatedStatus } : x)));
    if (activeEvent?.id === ev.id) {
      setActiveEvent({ ...activeEvent, completed: updatedStatus });
    }
    try {
      await fetch(`/api/calendar/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: updatedStatus }),
      });
    } catch {
      // Revert if error
      setEvents((prev) => prev.map((x) => (x.id === ev.id ? { ...x, completed: !updatedStatus } : x)));
    }
  };

  // Update Event
  const handleUpdateActiveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEvent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/calendar/${activeEvent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeEvent.title,
          description: activeEvent.description,
          type: activeEvent.type,
          startAt: activeEvent.startAt,
          endAt: activeEvent.endAt,
          location: activeEvent.location,
          leadId: activeEvent.leadId,
          assignedToId: activeEvent.assignedToId,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Failed to update event.');
      setEvents((prev) => prev.map((x) => (x.id === activeEvent.id ? updated : x)));
      setActiveEvent(updated);
      setIsEditingActiveEvent(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update event.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    setEvents((prev) => prev.filter((x) => x.id !== id));
    setActiveEvent(null);
    try {
      await fetch(`/api/calendar/${id}`, { method: 'DELETE' });
    } catch {
      setError('Could not delete event.');
    }
  };

  // Optional: Quick Load Demo Events from Screenshot
  const handleLoadSampleEvents = async () => {
    if (!confirm('Load example calendar events to preview the full schedule?')) return;
    setSaving(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const sampleData = [
        { title: 'Annual Leave — Bali Trip', type: 'OTHER', day: 1, startH: 9, endH: 18, desc: 'Approved vacation leave' },
        { title: 'Complete Legal Documents', type: 'PROPERTY_VIEWING', day: 1, startH: 11, endH: 12, desc: 'Corporate legal review' },
        { title: '9:00 AM - 10:00 AM Discovery Call', type: 'CALL', day: 1, startH: 9, endH: 10, desc: 'Introductory client discovery' },
        { title: 'Submit Monthly Report - Marketing', type: 'PROPERTY_VIEWING', day: 4, startH: 14, endH: 15, desc: 'Q3 lead velocity summary' },
        { title: 'Medical Appointment', type: 'OTHER', day: 7, startH: 9, endH: 10, desc: 'Routine health checkup' },
        { title: 'Team Meeting - Q3 Planning', type: 'MEETING', day: 7, startH: 10, endH: 11, desc: 'Quarterly roadmap sync' },
        { title: 'Flu Recovery', type: 'OTHER', day: 8, startH: 9, endH: 10, desc: 'Sick leave day' },
        { title: 'Attending Wedding', type: 'OTHER', day: 13, startH: 15, endH: 21, desc: 'Family ceremony' },
        { title: 'Implementation of learning', type: 'PROPERTY_VIEWING', day: 13, startH: 11, endH: 12, desc: 'Team training review' },
        { title: 'Assessment & Feedback', type: 'PROPERTY_VIEWING', day: 13, startH: 13, endH: 14, desc: '1-on-1 team member review' },
        { title: 'Personal Leave', type: 'OTHER', day: 18, startH: 9, endH: 17, desc: 'Personal errands' },
        { title: 'Vacation', type: 'OTHER', day: 19, startH: 9, endH: 18, desc: 'Out of office' },
        { title: 'Parent Communication', type: 'CALL', day: 20, startH: 16, endH: 17, desc: 'Client follow-up call' },
        { title: 'Student Well-being Review', type: 'CALL', day: 22, startH: 9, endH: 10, desc: 'Performance check' },
        { title: 'Religious Holiday', type: 'OTHER', day: 28, startH: 9, endH: 18, desc: 'Public holiday celebration' },
      ];

      for (const item of sampleData) {
        const start = new Date(year, month, item.day, item.startH, 0);
        const end = new Date(year, month, item.day, item.endH, 0);
        await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.title,
            type: item.type,
            description: item.desc,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            location: 'Google Meet',
            assignedToId: session?.user?.id,
          }),
        });
      }
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to seed sample events.');
    } finally {
      setSaving(false);
    }
  };

  // Export .ics format
  const exportICS = () => {
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Versaly Labs//Versaly CRM Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    events.forEach((ev) => {
      const start = new Date(ev.startAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const end = ev.endAt
        ? new Date(ev.endAt).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
        : start;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@versaly-crm.com`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${ev.title}`,
        `DESCRIPTION:${ev.description || ''}`,
        `LOCATION:${ev.location || ''}`,
        `STATUS:${ev.completed ? 'COMPLETED' : 'CONFIRMED'}`,
        'END:VEVENT'
      );
    });

    ics.push('END:VCALENDAR');
    const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `versaly-calendar-${currentDate.getFullYear()}-${currentDate.getMonth() + 1}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const todayStr = new Date().toDateString();
  const selectedDayIndex = selectedDate ? selectedDate.getDay() : new Date().getDay();

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Message on Error */}
      {error && (
        <div className="flex items-center justify-between rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ==========================================
          Header Bar: Title & Primary Controls
         ========================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              Schedule & Operations
            </span>
          </div>
          <h1 className="mt-1 font-glorase text-3xl sm:text-4xl font-normal text-white tracking-tight">
            Calendar & Engagements
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Interactive team schedule, client interviews, site visits, and automated calendar sync.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {events.length === 0 && (
            <button
              onClick={handleLoadSampleEvents}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Load Example Schedule</span>
            </button>
          )}

          <button
            onClick={() => setSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#1b2a4a]/80 px-3.5 py-2 text-xs font-semibold text-slate-200 shadow-sm backdrop-blur-md transition hover:bg-white/10 hover:text-white"
          >
            <Link2 className="h-3.5 w-3.5 text-cyan-400" />
            <span>Sync External</span>
          </button>

          <button
            onClick={() => openScheduleForDate(selectedDate || new Date())}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-500 hover:to-cyan-400"
          >
            <Plus className="h-4 w-4" />
            <span>Schedule Event</span>
          </button>
        </div>
      </div>

      {/* ==========================================
          Main Layout: 2-Column (Calendar + Sidebar)
         ========================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-6 items-start">
        
        {/* ========================================
            LEFT COLUMN: Main Calendar Grid
           ======================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1b2a4a]/80 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] backdrop-blur-xl">
          {/* Subtle top liquid glass highlight bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />

          {/* Calendar Inner Header (Matching uploaded screenshot) */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5 border-b border-white/10">
            {/* Month & Year with Prev/Next Navigation */}
            <div className="flex items-center gap-3">
              <h2 className="font-glorase text-2xl sm:text-3xl font-normal text-white tracking-tight">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  aria-label="Previous Month"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/15 hover:text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextMonth}
                  aria-label="Next Month"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/15 hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Pills + View Switcher + Today */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter Tabs (All, Interview, Task, Time Off) */}
              <div className="flex items-center rounded-full border border-white/10 bg-[#0e172a]/60 p-1">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'MEETING', label: 'Interview' },
                  { id: 'FOLLOW_UP', label: 'Task' },
                  { id: 'OTHER', label: 'Time Off' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveFilter(item.id as FilterType)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      activeFilter === item.id
                        ? 'bg-white/15 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* View Selector (Month dropdown) */}
              <div className="relative">
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value as ViewMode)}
                  className="appearance-none rounded-xl border border-white/10 bg-[#0e172a]/70 px-3.5 py-1.5 pr-8 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                >
                  <option value="month" className="bg-[#14213d] text-white">Month</option>
                  <option value="week" className="bg-[#14213d] text-white">Week</option>
                  <option value="day" className="bg-[#14213d] text-white">Day</option>
                  <option value="list" className="bg-[#14213d] text-white">List</option>
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                  ▾
                </span>
              </div>

              {/* Today Button */}
              <button
                onClick={jumpToToday}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Today
              </button>
            </div>
          </div>

          {/* ========================================
              VIEW: Month Grid
             ======================================== */}
          {viewMode === 'month' && (
            <div className="w-full overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 border-b border-white/10 text-center">
                  {DAYS_OF_WEEK.map((dayName, idx) => {
                    const isSelectedDayCol = selectedDayIndex === idx;
                    return (
                      <div
                        key={dayName}
                        className={`py-3 text-xs font-bold transition-colors ${
                          isSelectedDayCol
                            ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                            : 'text-slate-400'
                        }`}
                      >
                        <span className="hidden sm:inline">{dayName}</span>
                        <span className="sm:hidden">{dayName.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Grid Cells (7 columns) */}
                <div className="grid grid-cols-7 border-collapse">
                  {monthGrid.map((cell, idx) => {
                    const isToday = cell.dateKey === todayStr;
                    const isSelected = selectedDate && cell.dateKey === selectedDate.toDateString();
                    const dayEvents = eventsByDate.get(cell.dateKey) || [];

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedDate(cell.date)}
                        onDoubleClick={() => openScheduleForDate(cell.date)}
                        style={
                          cell.isWeekend
                            ? {
                                backgroundImage:
                                  'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.02) 0, rgba(255, 255, 255, 0.02) 10px, transparent 10px, transparent 20px)',
                              }
                            : undefined
                        }
                        className={`group relative min-h-[115px] sm:min-h-[125px] p-2 border-r border-b border-white/[0.08] transition flex flex-col justify-between cursor-pointer ${
                          !cell.isCurrentMonth ? 'bg-black/20 text-slate-500' : 'text-slate-200'
                        } ${isSelected ? 'ring-1 ring-inset ring-cyan-400/80 bg-cyan-950/20' : 'hover:bg-white/[0.02]'}`}
                      >
                        {/* Day Number Header in Cell */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-semibold ${
                              isToday
                                ? 'flex h-6 px-1.5 items-center justify-center rounded-md bg-cyan-400 font-bold text-[#0e172a] shadow-sm'
                                : cell.isCurrentMonth
                                ? 'text-slate-300'
                                : 'text-slate-600'
                            }`}
                          >
                            {/* If 1st day of month, show "Month 1" like screenshot e.g. "Aug 1" */}
                            {cell.dayNumber === 1
                              ? `${MONTH_NAMES[cell.date.getMonth()].slice(0, 3)} 1`
                              : cell.dayNumber}
                          </span>

                          {/* Quick "+" button on hover to schedule event */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openScheduleForDate(cell.date);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition h-5 w-5 rounded bg-white/10 hover:bg-cyan-500 hover:text-white flex items-center justify-center text-[10px] text-slate-300"
                            title="Add event on this date"
                          >
                            +
                          </button>
                        </div>

                        {/* Events Chips in Day Cell */}
                        <div className="mt-1.5 space-y-1 flex-1">
                          {dayEvents.slice(0, 3).map((ev) => {
                            const colors = getEventColor(ev);
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveEvent(ev);
                                }}
                                className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition border-l-2 ${colors.border} ${
                                  ev.completed
                                    ? 'bg-white/5 text-slate-500 line-through'
                                    : `${colors.badgeBg} hover:opacity-90`
                                }`}
                              >
                                <span className="truncate block">
                                  {ev.title}
                                </span>
                              </button>
                            );
                          })}

                          {dayEvents.length > 3 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDate(cell.date);
                              }}
                              className="text-[10px] font-semibold text-slate-400 hover:text-cyan-300 pl-1 block transition"
                            >
                              +{dayEvents.length - 3} more
                            </button>
                          )}
                        </div>

                        {/* Selected day bottom highlight line */}
                        {isSelected && (
                          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-cyan-400 to-sky-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================
              VIEW: Week Mode
             ======================================== */}
          {viewMode === 'week' && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
                {DAYS_OF_WEEK.map((dayName, idx) => {
                  const targetDay = new Date(currentDate);
                  const currentDayIdx = currentDate.getDay();
                  targetDay.setDate(currentDate.getDate() - currentDayIdx + idx);
                  const key = targetDay.toDateString();
                  const dayEvents = eventsByDate.get(key) || [];
                  const isToday = key === todayStr;

                  return (
                    <div
                      key={dayName}
                      className={`rounded-xl border p-3 min-h-[220px] transition ${
                        isToday
                          ? 'border-cyan-400/50 bg-cyan-950/20'
                          : 'border-white/10 bg-[#0e172a]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <div>
                          <p className="text-xs font-bold text-slate-400">{dayName.slice(0, 3)}</p>
                          <p className="text-sm font-extrabold text-white">{targetDay.getDate()}</p>
                        </div>
                        <button
                          onClick={() => openScheduleForDate(targetDay)}
                          className="h-6 w-6 rounded-lg bg-white/5 hover:bg-cyan-500 hover:text-white flex items-center justify-center text-xs text-slate-300"
                        >
                          +
                        </button>
                      </div>

                      <div className="mt-2.5 space-y-1.5">
                        {dayEvents.map((ev) => {
                          const colors = getEventColor(ev);
                          return (
                            <button
                              key={ev.id}
                              onClick={() => setActiveEvent(ev)}
                              className={`w-full text-left rounded-lg p-2 text-xs border-l-4 transition ${colors.border} ${colors.badgeBg}`}
                            >
                              <p className="font-semibold truncate">{ev.title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatTimeOnly(ev.startAt)}
                              </p>
                            </button>
                          );
                        })}
                        {dayEvents.length === 0 && (
                          <p className="text-[11px] text-slate-500 pt-4 text-center">No events</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================
              VIEW: Day Mode
             ======================================== */}
          {viewMode === 'day' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <p className="text-xs text-slate-400">Detailed schedule for this date</p>
                </div>
                <button
                  onClick={() => openScheduleForDate(currentDate)}
                  className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#0e172a] font-bold px-3 py-1.5 text-xs transition"
                >
                  + Add Event
                </button>
              </div>

              <div className="space-y-3">
                {(eventsByDate.get(currentDate.toDateString()) || []).map((ev) => {
                  const colors = getEventColor(ev);
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setActiveEvent(ev)}
                      className={`flex items-start justify-between rounded-xl border p-4 cursor-pointer transition ${colors.border} border-l-4 ${colors.badgeBg}`}
                    >
                      <div>
                        <h4 className="font-bold text-sm text-white">{ev.title}</h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{formatTimeRange(ev.startAt, ev.endAt)}</span>
                          {ev.location && (
                            <>
                              <span>·</span>
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              <span>{ev.location}</span>
                            </>
                          )}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-slate-300 mt-2">{ev.description}</p>
                        )}
                      </div>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${colors.pill}`}>
                        {colors.tag}
                      </span>
                    </div>
                  );
                })}

                {(eventsByDate.get(currentDate.toDateString()) || []).length === 0 && (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <CalendarDays className="h-8 w-8 mx-auto text-slate-600" />
                    <p className="text-sm font-semibold text-white">No engagements scheduled</p>
                    <p className="text-xs">Click + Add Event to book this slot.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================
              VIEW: List / Agenda Mode
             ======================================== */}
          {viewMode === 'list' && (
            <div className="divide-y divide-white/5">
              {filteredEvents.map((ev) => {
                const colors = getEventColor(ev);
                return (
                  <div
                    key={ev.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={ev.completed}
                        onChange={() => toggleComplete(ev)}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-[#0e172a] text-cyan-400 focus:ring-0 cursor-pointer"
                      />
                      <div>
                        <p className={`font-semibold text-sm ${ev.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                          {ev.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="text-cyan-300">
                            {new Date(ev.startAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · {formatTimeRange(ev.startAt, ev.endAt)}
                          </span>
                          {ev.location && <span>· {ev.location}</span>}
                          {ev.assignedTo && <span>· Assigned: {ev.assignedTo.name || ev.assignedTo.email}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => setActiveEvent(ev)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(ev.id)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredEvents.length === 0 && (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <p className="text-sm font-semibold text-white">No events found</p>
                  <p className="text-xs">Adjust your filter or schedule a new event.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================
            RIGHT COLUMN: Sidebar (Matching Screenshot)
           ======================================== */}
        <div className="space-y-6">

          {/* Top Banner: "Link Your Calendar" (Screenshot Card) */}
          {!linkBannerDismissed && (
            <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-[#1b2a4a]/85 to-[#0e172a]/90 p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <button
                onClick={() => setLinkBannerDismissed(true)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white text-xs transition"
                aria-label="Dismiss banner"
              >
                ✕
              </button>

              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>Link Your Calendar</span>
              </h3>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                Sync interviews, tasks, and schedules by connecting your calendar.
              </p>

              {/* Calendar App Brand Icons */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Google Calendar Icon */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white p-1 shadow-sm">
                    <span className="font-black text-[11px] text-blue-600">31</span>
                  </div>
                  {/* Outlook Icon */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0078d4] text-white shadow-sm font-bold text-xs">
                    O
                  </div>
                  {/* Apple / iCal Icon */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500 text-white shadow-sm font-bold text-[10px]">
                    CAL
                  </div>
                  {/* Slack / Calendly Icon */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm font-bold text-xs">
                    ✦
                  </div>
                </div>

                <button
                  onClick={() => setSyncModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-indigo-200 transition"
                >
                  <span>Connect</span>
                  <span>›</span>
                </button>
              </div>
            </div>
          )}

          {/* Upcoming Events List Container */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1b2a4a]/80 p-5 shadow-[0_8px_32px_0_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Upcoming Event</h3>
                <p className="text-[11px] text-slate-400">
                  {selectedDate
                    ? `Showing for ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                    : 'Scheduled client & internal agenda'}
                </p>
              </div>
              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300"
                >
                  Show All
                </button>
              )}
            </div>

            {/* List of Upcoming Events */}
            <div className="mt-4 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {upcomingEvents.map((ev) => {
                const colors = getEventColor(ev);
                const assigneeName = ev.assignedTo?.name || ev.assignedTo?.email || session?.user?.name || 'Assigned User';
                const initials = getInitials(ev.assignedTo?.name, ev.assignedTo?.email);

                return (
                  <div
                    key={ev.id}
                    onClick={() => setActiveEvent(ev)}
                    className={`group relative rounded-xl border border-white/10 bg-[#0e172a]/60 hover:bg-[#0e172a]/90 transition-all p-3.5 cursor-pointer border-l-4 ${colors.border}`}
                  >
                    {/* Event Title */}
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-xs text-white group-hover:text-cyan-200 transition line-clamp-1">
                        {ev.title}
                      </h4>
                      <input
                        type="checkbox"
                        checked={ev.completed}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleComplete(ev);
                        }}
                        className="mt-0.5 h-3.5 w-3.5 rounded border-white/20 bg-[#0e172a] text-cyan-400 focus:ring-0 cursor-pointer"
                      />
                    </div>

                    {/* Assignee Avatar & Info */}
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm ${colors.avatarBg}`}
                        >
                          {initials}
                        </div>
                        <span className="text-[11px] font-medium text-slate-300 truncate max-w-[150px]">
                          {assigneeName}
                        </span>
                      </div>

                      <span className="text-[10px] font-medium text-slate-400 shrink-0">
                        {formatTimeOnly(ev.startAt)}
                      </span>
                    </div>

                    {/* Attached Lead pill if available */}
                    {ev.lead && (
                      <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5 text-[10px] text-cyan-300">
                        <UserIcon className="h-3 w-3" />
                        <span className="truncate">{ev.lead.contactName}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {upcomingEvents.length === 0 && (
                <div className="py-12 text-center text-slate-400 space-y-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-cyan-400">
                    <CalendarIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">No engagements scheduled</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedDate
                        ? 'No events for the selected day.'
                        : 'Your agenda is clean and ready.'}
                    </p>
                  </div>
                  <button
                    onClick={() => openScheduleForDate(selectedDate || new Date())}
                    className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Book Slot</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================
          MODAL: Schedule New Event
         ========================================== */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleCreateEvent}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1b2a4a] via-[#16233f] to-[#0e172a] p-6 shadow-2xl space-y-4"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-cyan-400" />
                  <span>Schedule Event</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Book a meeting, client call, or team task on the CRM calendar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">Event Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Discovery Demo Call or Annual Leave"
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Category / Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CalendarEventType })}
                  className={glassInput}
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.type} value={t.type} className="bg-[#14213d] text-white">
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Location / Meeting URL</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Google Meet, Zoom, or Office"
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={form.startAt}
                  onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  className={glassInput}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">Attach Prospect / Lead</label>
                <select
                  value={form.leadId}
                  onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                  className={glassInput}
                >
                  <option value="">No lead attached</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id} className="bg-[#14213d] text-white">
                      {l.contactName} {l.companyName ? `(${l.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {canAssign && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Assigned Team Member</label>
                  <select
                    value={form.assignedToId}
                    onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                    className={glassInput}
                  >
                    <option value="">Assign to me</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id} className="bg-[#14213d] text-white">
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-slate-300">Agenda / Notes</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Meeting agenda, briefing notes, or requirements..."
                  className={`${glassInput} resize-none`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setScheduleModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/20 transition hover:from-sky-500 hover:to-cyan-400 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Confirm Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================
          MODAL: Event Details & Quick Edit
         ========================================== */}
      {activeEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1b2a4a] via-[#16233f] to-[#0e172a] p-6 shadow-2xl space-y-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${getEventColor(activeEvent).badgeBg}`}>
                  {getEventColor(activeEvent).tag}
                </span>
                {activeEvent.completed && (
                  <span className="rounded-md bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Completed
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setActiveEvent(null);
                  setIsEditingActiveEvent(false);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!isEditingActiveEvent ? (
              // View Mode
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{activeEvent.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5 text-cyan-300">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{new Date(activeEvent.startAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      {activeEvent.endAt && (
                        <span>→ {new Date(activeEvent.endAt).toLocaleTimeString([], { timeStyle: 'short' })}</span>
                      )}
                    </span>
                    {activeEvent.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{activeEvent.location}</span>
                      </span>
                    )}
                  </div>
                </div>

                {activeEvent.description && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-200 leading-relaxed">
                    {activeEvent.description}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  {activeEvent.lead && (
                    <div className="rounded-xl border border-white/10 bg-[#0e172a]/60 p-3">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Attached Prospect</p>
                      <Link
                        href={`/leads/${activeEvent.lead.id}`}
                        className="mt-1 font-semibold text-cyan-400 hover:underline flex items-center gap-1"
                      >
                        <span>{activeEvent.lead.contactName}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                      {activeEvent.lead.companyName && (
                        <p className="text-[11px] text-slate-400">{activeEvent.lead.companyName}</p>
                      )}
                    </div>
                  )}

                  <div className="rounded-xl border border-white/10 bg-[#0e172a]/60 p-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Assigned Team Member</p>
                    <p className="mt-1 font-semibold text-white">
                      {activeEvent.assignedTo?.name || activeEvent.assignedTo?.email || session?.user?.name || 'Assigned'}
                    </p>
                    <p className="text-[11px] text-slate-400">{activeEvent.assignedTo?.role || 'Team Member'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(activeEvent.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleComplete(activeEvent)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        activeEvent.completed
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{activeEvent.completed ? 'Reopen Event' : 'Mark Done'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsEditingActiveEvent(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:from-sky-500 hover:to-cyan-400"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Edit Mode
              <form onSubmit={handleUpdateActiveEvent} className="space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Title</label>
                  <input
                    required
                    value={activeEvent.title}
                    onChange={(e) => setActiveEvent({ ...activeEvent, title: e.target.value })}
                    className={glassInput}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Type</label>
                    <select
                      value={activeEvent.type}
                      onChange={(e) => setActiveEvent({ ...activeEvent, type: e.target.value as CalendarEventType })}
                      className={glassInput}
                    >
                      {EVENT_TYPES.map((t) => (
                        <option key={t.type} value={t.type} className="bg-[#14213d] text-white">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">Location</label>
                    <input
                      value={activeEvent.location || ''}
                      onChange={(e) => setActiveEvent({ ...activeEvent, location: e.target.value })}
                      className={glassInput}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Agenda / Notes</label>
                  <textarea
                    rows={3}
                    value={activeEvent.description || ''}
                    onChange={(e) => setActiveEvent({ ...activeEvent, description: e.target.value })}
                    className={`${glassInput} resize-none`}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditingActiveEvent(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-cyan-500 px-4 py-1.5 text-xs font-bold text-[#0e172a] hover:bg-cyan-400"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: External Calendar Sync & Export
         ========================================== */}
      {syncModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1b2a4a] via-[#16233f] to-[#0e172a] p-6 shadow-2xl space-y-4">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Link2 className="h-4 w-4 text-cyan-400" />
                <span>External Calendar Sync</span>
              </h3>
              <button
                onClick={() => setSyncModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Seamlessly subscribe to or export your Versaly CRM calendar into Google Calendar, Microsoft Outlook, or Apple Calendar.
            </p>

            <div className="space-y-3">
              {/* Option 1: Direct .ics Export */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Export .ICS File</h4>
                  <p className="text-[11px] text-slate-400">Import directly into any calendar app</p>
                </div>
                <button
                  onClick={exportICS}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-1.5 text-xs font-bold text-[#0e172a] transition"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
              </div>

              {/* Option 2: Live Integrations link */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-3.5 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Google & Outlook Connect</h4>
                  <p className="text-[11px] text-slate-400">Configure automated two-way webhooks</p>
                </div>
                <Link
                  href="/settings/integrations"
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition"
                >
                  <span>Settings →</span>
                </Link>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setSyncModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
